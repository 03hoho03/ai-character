'use client';

/**
 * #42 대화 인박스 — 소유자(로그인 userId / 비로그인 browserId) 대화 목록 + 삭제.
 * 페이지 로컬 fetch: 마운트 + 세션 식별자(useSession status/user.id) 변화 시 재로드.
 * 영속 캐시를 두지 않아 소유자 전환 시 stale이 원천 차단된다(lesson l_2026_06_20).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ConversationListItem } from '@ai-character/shared';
import { deleteConversation, fetchConversationList } from '../../lib/conversations-api';
import { getBrowserId } from '../../lib/browser-id';
import { useSession } from '../../lib/session-context';

export function ConversationInbox() {
  const { status, user } = useSession();
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 세션 확정(loading 제외) 후 로드, 소유자(user.id) 변화 시 재로드 — page-local, 캐시 없음.
  // setState는 .then 콜백(비동기 경계) + alive 가드로 — 언마운트 후 갱신/중복 렌더 방지(session-context 패턴).
  useEffect(() => {
    if (status === 'loading') return;
    let alive = true;
    void fetchConversationList(getBrowserId()).then((list) => {
      if (!alive) return;
      setItems(list);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [status, user?.id]);

  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(async (id: string) => {
    setError(null);
    try {
      await deleteConversation(id, getBrowserId());
      setItems((prev) => prev.filter((c) => c.id !== id)); // 성공 시에만 제거
    } catch {
      // 실패(비소유 404·네트워크)면 항목을 유지하고 안내 — rejection을 삼켜 unhandled 방지
      setError('대화를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }, []);

  if (!loaded) return <p className="text-sm text-zinc-500">불러오는 중…</p>;
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">아직 대화가 없습니다. 캐릭터와 대화를 시작해 보세요.</p>;
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-500">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-2">
      {items.map((conv) => {
        const name = conv.characterName ?? '(삭제된 캐릭터)';
        return (
          <li
            key={conv.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
          >
            <Link href={`/chat/${conv.personaId}`} className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-base font-semibold">{name}</span>
              <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                {conv.lastMessage?.content ?? '아직 메시지 없음'}
              </span>
            </Link>
            <button
              type="button"
              aria-label={`${name} 대화 삭제`}
              onClick={() => void handleDelete(conv.id)}
              className="shrink-0 text-sm font-medium text-red-500 hover:text-red-700"
            >
              삭제
            </button>
          </li>
        );
      })}
      </ul>
    </>
  );
}
