'use client';

/**
 * #14 2/2 채팅 영속화 어댑터 — useChatStream에 주입할 ChatPersistence 구현.
 * browserId(localStorage) + conversations API를 묶는다. 모두 best-effort.
 */
import { useCallback, useMemo, useRef } from 'react';
import type { ChatMessage } from '@ai-character/shared';
import type { ChatPersistence } from '../hooks/useChatStream';
import { getBrowserId } from './browser-id';
import { appendMessage, ensureConversation, fetchConversation } from './conversations-api';

export function useChatPersistence(personaId: string): ChatPersistence {
  // 대화 id를 lazy get-or-create — 첫 저장 시 1회만 생성하고 promise를 공유
  const convPromiseRef = useRef<Promise<string | null> | null>(null);

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
    const conv = await fetchConversation(getBrowserId(), personaId);
    if (!conv) return [];
    // 기존 대화 id 재사용 — 이후 append가 새 대화를 만들지 않도록 고정
    convPromiseRef.current = Promise.resolve(conv.id);
    return conv.messages.map((m) => ({ role: m.role, content: m.content }));
  }, [personaId]);

  return useMemo<ChatPersistence>(
    () => ({
      restore,
      onUserMessage: (content) => save('user', content),
      onModelMessage: (content) => save('model', content),
    }),
    [restore, save],
  );
}
