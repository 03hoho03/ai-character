'use client';

/**
 * #14 conversations API 클라이언트 — 백엔드(1/2) CRUD에 대응.
 * 복원(fetchConversation)은 best-effort: 실패/404면 null.
 *
 * #36 모든 호출에 credentials:'include'로 httpOnly JWT 쿠키를 운반한다(소유 경로).
 * 현재 백엔드 conversations 소유는 browserId 기준(#34에서 userId 전환 예정)이라 쿠키는
 * 아직 무시되지만, 전환 시 클라 재작업 없이 계정 소유로 승격되도록 선납한다(browserId 폴백 병행).
 */
import type {
  ChatMessage,
  ConversationRecord,
  ConversationWithMessages,
  SummaryResult,
} from '@ai-character/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** 저장된 대화 + 메시지(시간순) 조회. 이력 없음(404)/실패면 null */
export async function fetchConversation(
  browserId: string,
  personaId: string,
): Promise<ConversationWithMessages | null> {
  const qs = new URLSearchParams({ browserId, personaId }).toString();
  try {
    const res = await fetch(`${API_URL}/conversations?${qs}`, { credentials: 'include' });
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
    credentials: 'include',
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
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ browserId, role, content }),
  });
  if (!res.ok) throw new Error(`appendMessage failed: ${res.status}`);
}

/**
 * #15 임계 초과 시 과거 turn 자동 요약 트리거. best-effort —
 * 실패하면 요약 없이(null) 진행해 채팅을 막지 않는다.
 */
export async function summarizeConversation(
  conversationId: string,
  browserId: string,
): Promise<SummaryResult> {
  try {
    const res = await fetch(`${API_URL}/conversations/${conversationId}/summarize`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ browserId }),
    });
    if (!res.ok) return { summary: null, summarizedCount: 0 };
    return (await res.json()) as SummaryResult;
  } catch {
    return { summary: null, summarizedCount: 0 };
  }
}

/** #18 메시지 열 전체 교체 — 편집/재생성 시 후속 turn truncate */
export async function replaceMessages(
  conversationId: string,
  browserId: string,
  messages: ChatMessage[],
): Promise<void> {
  const res = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ browserId, messages }),
  });
  if (!res.ok) throw new Error(`replaceMessages failed: ${res.status}`);
}
