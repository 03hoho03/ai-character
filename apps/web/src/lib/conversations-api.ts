'use client';

/**
 * #14 conversations API 클라이언트 — 백엔드(1/2) CRUD에 대응.
 * 복원(fetchConversation)은 best-effort: 실패/404면 null.
 */
import type {
  ChatMessage,
  ConversationRecord,
  ConversationWithMessages,
} from '@ai-character/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** 저장된 대화 + 메시지(시간순) 조회. 이력 없음(404)/실패면 null */
export async function fetchConversation(
  browserId: string,
  personaId: string,
): Promise<ConversationWithMessages | null> {
  const qs = new URLSearchParams({ browserId, personaId }).toString();
  try {
    const res = await fetch(`${API_URL}/conversations?${qs}`);
    if (!res.ok) return null;
    return (await res.json()) as ConversationWithMessages;
  } catch {
    return null;
  }
}

/** (browserId, personaId) 대화 get-or-create */
export async function ensureConversation(
  browserId: string,
  personaId: string,
): Promise<ConversationRecord> {
  const res = await fetch(`${API_URL}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ browserId, personaId }),
  });
  if (!res.ok) throw new Error(`ensureConversation failed: ${res.status}`);
  return (await res.json()) as ConversationRecord;
}

/** 메시지 append */
export async function appendMessage(
  conversationId: string,
  browserId: string,
  role: ChatMessage['role'],
  content: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ browserId, role, content }),
  });
  if (!res.ok) throw new Error(`appendMessage failed: ${res.status}`);
}
