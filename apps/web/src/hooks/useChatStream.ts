'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  assembleHistory,
  buildPersonaPrompt,
  parseChatStream,
  shouldSummarize,
  type ChatMessage,
  type ChatRequest,
  type ChatStreamErrorCode,
  type ChatStreamEvent,
  type Persona,
} from '@ai-character/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ChatStreamError {
  code: ChatStreamErrorCode;
  message: string;
}

export type ChatStreamStatus = 'idle' | 'streaming' | 'error';

/**
 * #14 영속화 주입 — 미주입 시 훅은 기존(메모리) 동작 그대로.
 * 모든 콜백은 best-effort: 실패해도 스트리밍 상태머신을 방해하지 않는다.
 */
export interface ChatPersistence {
  /** 마운트 시 저장된 turn(greeting 제외)을 시간순으로 복원 */
  restore: () => Promise<ChatMessage[]>;
  /** user 메시지 전송 시 (성공 turn만 저장) */
  onUserMessage: (content: string) => void;
  /** model 응답이 done(성공)으로 확정될 때 */
  onModelMessage: (content: string) => void;
  /** #18 편집/재생성 — 메시지 열(greeting 제외) 전체 교체로 후속 turn truncate */
  replace?: (messages: ChatMessage[]) => Promise<void>;
  /** #15 마운트 시 저장된 과거 대화 요약 적재(없으면 null) */
  loadSummary?: () => Promise<string | null>;
  /** #15 임계 초과 시 서버 요약 트리거 — 갱신된 요약 반환(실패 시 null) */
  summarize?: () => Promise<string | null>;
}

/** best-effort — 영속화 콜백 예외를 흡수해 채팅 흐름을 보호 */
function safe(fn: () => void): void {
  try {
    fn();
  } catch {
    /* 영속화 실패는 무시 (#14 best-effort) */
  }
}

/**
 * #3 채팅 스트리밍 상태 훅 — POST /chat/stream을 parseChatStream으로 소비한다.
 * - delta → streamingText 누적, done → messages 확정
 * - error/스트림 단절 → partial은 메시지로 보존(#13 합의)하고 error 상태 노출
 * - persistence 주입 시 마운트 복원 + 성공 turn 저장 (#14)
 */
export function useChatStream(persona: Persona, persistence?: ChatPersistence) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { role: 'model', content: persona.greeting }, // greeting은 UI 책임 (#4 합의)
  ]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatStreamStatus>('idle');
  const [error, setError] = useState<ChatStreamError | null>(null);

  // send 가드/retry는 렌더 사이클과 무관하게 최신 값이 필요 — ref로 동기 관리
  const busyRef = useRef(false);
  const messagesRef = useRef(messages);
  const abortRef = useRef<AbortController | null>(null);
  // #15 현재 대화 요약(장기기억) — 요청 조립에 주입. 마운트 적재 + 임계 초과 시 갱신.
  const summaryRef = useRef<string | null>(null);

  const updateMessages = useCallback((next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []); // unmount 시 진행 중 스트림 정리

  // #15 마운트 시 저장된 요약 적재 — 이후 요청 조립에 장기기억으로 주입
  useEffect(() => {
    if (!persistence?.loadSummary) return;
    let cancelled = false;
    persistence
      .loadSummary()
      .then((summary) => {
        if (!cancelled) summaryRef.current = summary;
      })
      .catch(() => {
        /* best-effort — 요약 적재 실패는 무시 */
      });
    return () => {
      cancelled = true;
    };
  }, [persistence]);

  // #14 마운트 복원 — 저장 turn을 greeting 뒤에 붙인다. 전송 시작 후/언마운트면 무시.
  useEffect(() => {
    if (!persistence) return;
    let cancelled = false;
    persistence
      .restore()
      .then((turns) => {
        // greeting만 있는 초기 상태에서만 복원 — 전송이 시작/완료됐으면 덮어쓰지 않는다
        if (cancelled || busyRef.current || turns.length === 0) return;
        if (messagesRef.current.length > 1) return;
        updateMessages([{ role: 'model', content: persona.greeting }, ...turns]);
      })
      .catch(() => {
        /* best-effort 복원 — 실패 시 greeting만 유지 */
      });
    return () => {
      cancelled = true;
    };
  }, [persistence, persona.greeting, updateMessages]);

  const run = useCallback(
    async (history: ChatMessage[]) => {
      busyRef.current = true;
      const abort = new AbortController();
      abortRef.current = abort;

      updateMessages(history);
      setError(null);
      setStatus('streaming');
      setStreamingText('');

      const prompt = buildPersonaPrompt(persona);
      let partial = '';
      let terminal: ChatStreamEvent | null = null;

      // #15 full-history 대신 '요약 + 최근 N turn' 조립(토큰 상한 가드). 요약 없으면 full 보존.
      const summary = summaryRef.current;
      const assembled = assembleHistory(history, summary);

      try {
        const res = await fetch(`${API_URL}/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: prompt.systemInstruction,
            messages: [...prompt.fewShotMessages, ...assembled],
            ...(summary ? { conversationSummary: summary } : {}),
          } satisfies ChatRequest),
          signal: abort.signal,
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        for await (const event of parseChatStream(res.body)) {
          if (event.type === 'delta') {
            partial += event.text;
            setStreamingText(partial);
          } else {
            terminal = event; // done 또는 error — 종결 이벤트 (#13 규약)
            break;
          }
        }
      } catch {
        terminal = null; // 네트워크 단절 등 — 아래에서 upstream_error로 수렴
      }

      busyRef.current = false;
      if (abort.signal.aborted) return; // unmount — 상태를 건드리지 않는다

      setStreamingText(null);
      if (terminal?.type === 'done') {
        const done = terminal;
        updateMessages([...history, done.message]);
        if (persistence) safe(() => persistence.onModelMessage(done.message.content));
        // #15 저장 turn(greeting 제외)이 임계를 넘으면 과거 turn 요약을 트리거
        if (persistence?.summarize && shouldSummarize(messagesRef.current.length - 1)) {
          persistence
            .summarize()
            .then((summary) => {
              if (summary !== null) summaryRef.current = summary;
            })
            .catch(() => {
              /* best-effort — 요약 트리거 실패는 채팅을 막지 않는다 */
            });
        }
        setStatus('idle');
        return;
      }

      // error 이벤트 또는 done/error 없는 단절 — partial 보존 + 에러 노출
      if (partial) updateMessages([...history, { role: 'model', content: partial }]);
      setError(
        terminal?.type === 'error'
          ? { code: terminal.code, message: terminal.message }
          : { code: 'upstream_error', message: '응답이 중단되었습니다.' },
      );
      setStatus('error');
    },
    [persona, updateMessages, persistence],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current) return; // 이중 전송 가드
      if (persistence) safe(() => persistence.onUserMessage(trimmed));
      void run([...messagesRef.current, { role: 'user', content: trimmed }]);
    },
    [run, persistence],
  );

  /** error 상태에서 실패 턴(partial)을 정리하고 마지막 user 메시지부터 재전송 */
  const retry = useCallback(() => {
    if (busyRef.current) return;
    const history = messagesRef.current;
    const lastUserIdx = history.findLastIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;
    void run(history.slice(0, lastUserIdx + 1));
  }, [run]);

  /**
   * #18 편집/재생성 공통 — 주어진 history로 재실행하기 전에 영속을 먼저 교체(truncate)한다.
   * greeting(index 0)은 영속 대상이 아니므로 slice(1)만 보낸다. run의 done이 새 model을 append.
   */
  const rerun = useCallback(
    async (history: ChatMessage[]) => {
      if (persistence?.replace) {
        try {
          await persistence.replace(history.slice(1));
        } catch {
          /* best-effort — 교체 실패해도 재실행은 진행 */
        }
      }
      await run(history);
    },
    [persistence, run],
  );

  /** #18 마지막 model 답변 재생성 — 직전 user turn 기준으로 재요청, 옛 답변 대체 */
  const regenerate = useCallback(() => {
    if (busyRef.current) return;
    const history = messagesRef.current;
    const lastUserIdx = history.findLastIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return; // user turn 없음 — no-op
    void rerun(history.slice(0, lastUserIdx + 1));
  }, [rerun]);

  /** #18 임의의 user 메시지 편집 — 해당 지점 이후를 truncate하고 편집 내용으로 재실행 */
  const editUser = useCallback(
    (index: number, content: string) => {
      if (busyRef.current) return;
      const trimmed = content.trim();
      if (!trimmed) return;
      const history = messagesRef.current;
      // index 0은 greeting(model). user 메시지만 편집 가능.
      if (index <= 0 || index >= history.length || history[index].role !== 'user') return;
      const next = [...history.slice(0, index), { role: 'user' as const, content: trimmed }];
      void rerun(next);
    },
    [rerun],
  );

  return { messages, streamingText, status, error, send, retry, regenerate, editUser };
}
