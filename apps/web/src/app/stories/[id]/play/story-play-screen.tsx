'use client';

/**
 * #48 스토리 플레이 화면 — non-streaming turn API(#50/#51) 소비.
 * 진입 시 세션 생성(#49) → 프롤로그를 첫 model 메시지로 표시 → 스탯 HUD(값/최대) →
 * 추천 첫 답변 칩(클릭 시 입력창 채움, 사용자 편집 후 전송) → 한 턴마다 turnStorySession 호출.
 * ended=true면 엔딩 화면(resultText)을 오버레이한다.
 *
 * 소유는 stories-api 래퍼가 credentials:'include' + browserId 폴백으로 운반(#23/#36).
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { StartSettingDef, StatDef, StatValues, Story } from '@ai-character/shared';
import { createStorySession, turnStorySession } from '@/lib/stories-api';
import { getBrowserId } from '@/lib/browser-id';

type PlayMessage = { role: 'user' | 'model'; content: string };
type Ending = { id: string; name: string; resultText: string };

/** 시작 설정을 고른다 — startSettingId 우선, 없으면 첫 설정. id 미존재 스토리는 null. */
function pickStartSetting(story: Story, startSettingId?: string): StartSettingDef | null {
  if (story.startSettings.length === 0) return null;
  if (startSettingId) {
    const found = story.startSettings.find((s) => s.id === startSettingId);
    if (found) return found;
  }
  return story.startSettings[0];
}

export function StoryPlayScreen({
  story,
  startSettingId,
}: {
  story: Story;
  startSettingId?: string;
}) {
  const startSetting = pickStartSetting(story, startSettingId);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [statValues, setStatValues] = useState<StatValues>({});
  const [messages, setMessages] = useState<PlayMessage[]>([]);
  const [ending, setEnding] = useState<Ending | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 프롤로그 = 첫 model 메시지(스토리 도입). startSituation도 이어 붙여 도입을 풍부하게.
  const prologueText = useMemo(
    () =>
      [startSetting?.prologue, startSetting?.startSituation]
        .filter((t): t is string => !!t && t.trim() !== '')
        .join('\n\n'),
    [startSetting?.prologue, startSetting?.startSituation],
  );

  // 진입 1회 — 세션 생성 + 프롤로그를 첫 model 메시지로, 스탯 초기값 HUD 세팅.
  const startSettingId_ = startSetting?.id;
  useEffect(() => {
    if (!startSettingId_) return;
    let alive = true;
    void (async () => {
      try {
        const session = await createStorySession(story.id, startSettingId_, getBrowserId());
        if (!alive) return;
        setSessionId(session.id);
        setStatValues(session.statValues ?? {});
        setMessages(prologueText ? [{ role: 'model', content: prologueText }] : []);
      } catch {
        if (alive) setError('세션을 시작할 수 없어요. 잠시 후 다시 시도해 주세요.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [story.id, startSettingId_, prologueText]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending, ending]);

  if (!startSetting?.id) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 p-6 font-sans">
        <p className="text-sm text-zinc-500">플레이할 시작 설정이 없어요.</p>
        <Link href="/" className="text-sm underline hover:text-zinc-600">
          ← 홈으로
        </Link>
      </main>
    );
  }

  const submitTurn = async (text: string) => {
    const message = text.trim();
    if (message === '' || pending || ending || !sessionId) return;
    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setPending(true);
    try {
      const result = await turnStorySession(sessionId, message, getBrowserId());
      setStatValues(result.statValues);
      if (result.reply.trim() !== '') {
        setMessages((prev) => [...prev, { role: 'model', content: result.reply }]);
      }
      if (result.ended && result.ending) setEnding(result.ending);
    } catch {
      setError('전송에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitTurn(input);
  };

  // 추천 첫 답변 칩은 첫 턴(아직 user 메시지가 없을 때)만 노출 — 클릭 시 입력창을 채운다(3A).
  const showSuggestions =
    !ending &&
    messages.every((m) => m.role !== 'user') &&
    startSetting.suggestedReplies.length > 0;

  return (
    <main className="mx-auto flex h-dvh max-w-2xl flex-col font-sans">
      <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600" aria-label="홈으로">
          ←
        </Link>
        <h1 className="text-base font-semibold">{story.name}</h1>
        <span className="text-xs text-zinc-400">{startSetting.name}</span>
      </header>

      <StatHud stats={startSetting.stats} statValues={statValues} />

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {messages.map((message, i) => (
          <MessageBubble key={i} message={message} storyName={story.name} />
        ))}

        {pending && (
          <div className="flex items-start gap-2" aria-label="응답 대기 중">
            <Avatar name={story.name} />
            <div className="rounded-2xl rounded-tl-sm bg-zinc-100 px-4 py-2 text-sm dark:bg-zinc-800">
              <span className="inline-block animate-pulse">생각 중…</span>
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            ⚠ {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {showSuggestions && (
        <div className="flex flex-wrap gap-2 border-t border-zinc-200 px-4 pt-3 dark:border-zinc-800">
          {startSetting.suggestedReplies.map((reply, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInput(reply)}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:border-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {ending ? (
        <EndingScreen ending={ending} />
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="어떻게 할까요?"
            aria-label="메시지 입력"
            disabled={pending || sessionId === null}
            className="flex-1 rounded-full border border-zinc-300 bg-transparent px-4 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-40 dark:border-zinc-700"
          />
          <button
            type="submit"
            disabled={pending || sessionId === null || input.trim() === ''}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            전송
          </button>
        </form>
      )}
    </main>
  );
}

/** 스탯 HUD — 각 스탯을 "이름 값/최대"로 표시(maxValue 사용, 1A). 스탯 없으면 렌더 안 함. */
function StatHud({ stats, statValues }: { stats: StatDef[]; statValues: StatValues }) {
  if (stats.length === 0) return null;
  return (
    <div
      aria-label="스탯"
      className="flex flex-wrap gap-x-4 gap-y-1 border-b border-zinc-200 px-4 py-2 text-xs dark:border-zinc-800"
    >
      {stats.map((stat) => {
        const value = statValues[stat.name] ?? stat.initialValue;
        return (
          <span key={stat.name} className="text-zinc-600 dark:text-zinc-300">
            <span className="font-medium">{stat.name}</span>{' '}
            <span className="tabular-nums">
              {value}/{stat.maxValue}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** 엔딩 화면 — 입력창 자리에 결과 텍스트를 띄우고 홈으로 나가는 링크. */
function EndingScreen({ ending }: { ending: Ending }) {
  return (
    <div
      role="status"
      aria-label="엔딩"
      className="border-t border-zinc-200 bg-zinc-50 px-6 py-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
        엔딩
      </p>
      <h2 className="mt-1 text-lg font-bold">{ending.name}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">
        {ending.resultText}
      </p>
      <Link
        href="/"
        className="mt-4 inline-block rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        홈으로
      </Link>
    </div>
  );
}

function MessageBubble({
  message,
  storyName,
}: {
  message: PlayMessage;
  storyName: string;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <Avatar name={storyName} />
      <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-zinc-100 px-4 py-2 text-sm dark:bg-zinc-800">
        {message.content}
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold dark:bg-zinc-700">
      {name.charAt(0)}
    </span>
  );
}
