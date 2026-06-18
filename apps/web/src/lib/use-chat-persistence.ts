'use client';

/**
 * #14 2/2 채팅 영속화 어댑터 — useChatStream에 주입할 ChatPersistence 구현.
 * browserId(localStorage) + conversations API를 묶는다. 모두 best-effort.
 */
import { useCallback, useMemo, useRef } from 'react';
import type { ChatMessage, ConversationWithMessages } from '@ai-character/shared';
import type { ChatPersistence } from '../hooks/useChatStream';
import { getBrowserId } from './browser-id';
import {
  appendMessage,
  ensureConversation,
  fetchConversation,
  replaceMessages,
  summarizeConversation,
} from './conversations-api';

export function useChatPersistence(personaId: string): ChatPersistence {
  // 대화 id를 lazy get-or-create — 첫 저장 시 1회만 생성하고 promise를 공유
  const convPromiseRef = useRef<Promise<string | null> | null>(null);
  // #15 마운트 복원 fetch를 restore/loadSummary가 공유 — 중복 fetch 방지
  const convDataRef = useRef<Promise<ConversationWithMessages | null> | null>(null);

  const ensureConv = useCallback(() => {
    if (!convPromiseRef.current) {
      convPromiseRef.current = ensureConversation(getBrowserId(), personaId)
        .then((c) => c.id)
        .catch(() => {
          convPromiseRef.current = null; // 실패 시 다음 저장에서 재시도 가능
          return null;
        });
    }
    return convPromiseRef.current;
  }, [personaId]);

  // 저장된 대화를 1회 fetch해 공유 — restore(turns) + loadSummary(summary)가 같은 결과를 쓴다
  const loadConv = useCallback(() => {
    if (!convDataRef.current) {
      convDataRef.current = fetchConversation(getBrowserId(), personaId).then((conv) => {
        // 기존 대화 id 재사용 — 이후 append/replace가 새 대화를 만들지 않도록 고정
        if (conv) convPromiseRef.current = Promise.resolve(conv.id);
        return conv;
      });
    }
    return convDataRef.current;
  }, [personaId]);

  const save = useCallback(
    (role: ChatMessage['role'], content: string) => {
      void (async () => {
        try {
          const id = await ensureConv();
          if (id) await appendMessage(id, getBrowserId(), role, content);
        } catch {
          /* best-effort — 저장 실패는 채팅을 막지 않는다 */
        }
      })();
    },
    [ensureConv],
  );

  const restore = useCallback(async (): Promise<ChatMessage[]> => {
    const conv = await loadConv();
    if (!conv) return [];
    return conv.messages.map((m) => ({ role: m.role, content: m.content }));
  }, [loadConv]);

  // #15 마운트 시 저장된 요약 적재 — 이후 요청 조립에 장기기억으로 주입
  const loadSummary = useCallback(async (): Promise<string | null> => {
    const conv = await loadConv();
    return conv?.summary ?? null;
  }, [loadConv]);

  // #15 임계 초과 시 서버 요약 트리거 — 갱신된 요약 반환(실패 시 null). best-effort.
  const summarize = useCallback(async (): Promise<string | null> => {
    try {
      const id = await ensureConv();
      if (!id) return null;
      const result = await summarizeConversation(id, getBrowserId());
      return result.summary;
    } catch {
      return null;
    }
  }, [ensureConv]);

  // #18 편집/재생성 — 메시지 열 전체 교체로 후속 turn truncate. best-effort.
  const replace = useCallback(
    async (messages: ChatMessage[]): Promise<void> => {
      try {
        const id = await ensureConv();
        if (id) await replaceMessages(id, getBrowserId(), messages);
      } catch {
        /* best-effort — 교체 실패는 채팅을 막지 않는다 */
      }
    },
    [ensureConv],
  );

  return useMemo<ChatPersistence>(
    () => ({
      restore,
      onUserMessage: (content) => save('user', content),
      onModelMessage: (content) => save('model', content),
      replace,
      loadSummary,
      summarize,
    }),
    [restore, save, replace, loadSummary, summarize],
  );
}
