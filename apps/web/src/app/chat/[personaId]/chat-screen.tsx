'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { ChatMessage, Persona } from '@ai-character/shared';
import { useChatStream } from '@/hooks/useChatStream';
import { useChatPersistence } from '@/lib/use-chat-persistence';

/** #3 채팅 화면 — 메시지 목록 / 스트리밍 렌더 / 입력 / 에러 배너 (#18 재생성·편집) */
export function ChatScreen({ persona }: { persona: Persona }) {
  const persistence = useChatPersistence(persona.id); // #14 복원/저장 연동
  const { messages, streamingText, status, error, send, retry, regenerate, editUser } =
    useChatStream(persona, persistence);
  const [input, setInput] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 새 메시지/스트리밍 갱신 시 하단 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (status === 'streaming') return;
    send(input);
    setInput('');
  };

  const idle = status !== 'streaming';
  const lastIndex = messages.length - 1;

  return (
    <main className="mx-auto flex h-dvh max-w-2xl flex-col font-sans">
      <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600" aria-label="홈으로">
          ←
        </Link>
        <Avatar name={persona.name} />
        <h1 className="text-base font-semibold">{persona.name}</h1>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {messages.map((message, i) => (
          <MessageBubble
            key={i}
            message={message}
            persona={persona}
            // #18 user 메시지 편집 — 스트리밍 중엔 비활성
            editable={message.role === 'user' && idle}
            editing={editingIndex === i}
            onStartEdit={() => setEditingIndex(i)}
            onCancelEdit={() => setEditingIndex(null)}
            onSaveEdit={(content) => {
              setEditingIndex(null);
              editUser(i, content);
            }}
            // #18 재생성 — 마지막 model 답변(greeting 외)에만
            regeneratable={message.role === 'model' && i === lastIndex && i > 0 && idle}
            onRegenerate={regenerate}
          />
        ))}

        {streamingText !== null && (
          <MessageBubble
            message={{ role: 'model', content: streamingText }}
            persona={persona}
            streaming
          />
        )}

        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            <span>⚠ {error.message}</span>
            <button
              type="button"
              onClick={retry}
              className="shrink-0 rounded-md border border-red-300 px-3 py-1 font-medium hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900"
            >
              재시도
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`${persona.name}에게 메시지 보내기`}
          aria-label="메시지 입력"
          className="flex-1 rounded-full border border-zinc-300 bg-transparent px-4 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={status === 'streaming' || input.trim() === ''}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          전송
        </button>
      </form>
    </main>
  );
}

function MessageBubble({
  message,
  persona,
  streaming = false,
  editable = false,
  editing = false,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  regeneratable = false,
  onRegenerate,
}: {
  message: ChatMessage;
  persona: Persona;
  streaming?: boolean;
  editable?: boolean;
  editing?: boolean;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (content: string) => void;
  regeneratable?: boolean;
  onRegenerate?: () => void;
}) {
  if (message.role === 'user') {
    if (editing) {
      return <UserMessageEditor initial={message.content} onSave={onSaveEdit} onCancel={onCancelEdit} />;
    }
    return (
      <div className="group flex flex-col items-end gap-1">
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
          {message.content}
        </div>
        {editable && (
          <button
            type="button"
            onClick={onStartEdit}
            className="text-xs text-zinc-400 opacity-0 transition-opacity hover:text-zinc-600 group-hover:opacity-100"
          >
            편집
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2">
      <Avatar name={persona.name} />
      <div className="max-w-[75%]">
        <p className="mb-1 text-xs text-zinc-500">{persona.name}</p>
        <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-zinc-100 px-4 py-2 text-sm dark:bg-zinc-800">
          {message.content}
          {streaming && <span className="ml-1 inline-block animate-pulse">▍</span>}
        </div>
        {regeneratable && (
          <button
            type="button"
            onClick={onRegenerate}
            className="mt-1 text-xs text-zinc-400 opacity-0 transition-opacity hover:text-zinc-600 group-hover:opacity-100"
          >
            재생성
          </button>
        )}
      </div>
    </div>
  );
}

/** #18 user 메시지 인라인 편집기 — 저장 시 해당 지점부터 재실행 */
function UserMessageEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave?: (content: string) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <div className="flex flex-col items-end gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="메시지 편집"
        className="min-h-16 w-full max-w-[75%] rounded-2xl border border-zinc-300 bg-transparent px-4 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
        autoFocus
      />
      <div className="flex gap-2 text-xs">
        <button type="button" onClick={onCancel} className="px-3 py-1 text-zinc-500 hover:text-zinc-700">
          취소
        </button>
        <button
          type="button"
          onClick={() => onSave?.(text)}
          disabled={text.trim() === ''}
          className="rounded-md bg-zinc-900 px-3 py-1 font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          저장 후 재전송
        </button>
      </div>
    </div>
  );
}

/** 아바타 placeholder — 이름 첫 글자 (#7에서 이미지로 대체 여지) */
function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold dark:bg-zinc-700">
      {name.charAt(0)}
    </span>
  );
}
