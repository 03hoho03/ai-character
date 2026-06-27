'use client';

/**
 * #47 스토리 제작 API 클라이언트 — #44 백엔드 스토리 CRUD에 대응(characters-api 패턴).
 * 읽기는 best-effort(실패 시 빈 목록/null), 쓰기는 실패를 throw로 전파한다.
 *
 * 소유 경로는 credentials:'include'로 httpOnly JWT 쿠키를 운반한다(#36).
 * 서버 OwnerContext(#44)가 쿠키 userId를 우선하고, 없으면 함께 보낸 browserId로 폴백한다
 * (로그인=계정 소유 / 비로그인=익명 browserId).
 */
import type {
  CreateStoryRequest,
  Story,
  StorySessionRecord,
  StoryTurnResult,
  UpdateStoryRequest,
} from '@ai-character/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** 내 스토리 목록(최신순). 실패/네트워크 에러면 빈 배열 */
export async function fetchOwnedStories(browserId: string): Promise<Story[]> {
  const qs = new URLSearchParams({ browserId }).toString();
  try {
    const res = await fetch(`${API_URL}/stories?${qs}`, { credentials: 'include' });
    if (!res.ok) return [];
    return (await res.json()) as Story[];
  } catch {
    return [];
  }
}

/** 단건 조회(소유자 + 공개). 없음(404)/실패면 null */
export async function fetchStory(id: string, browserId: string): Promise<Story | null> {
  const qs = new URLSearchParams({ browserId }).toString();
  try {
    const res = await fetch(`${API_URL}/stories/${id}?${qs}`, { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as Story;
  } catch {
    return null;
  }
}

/** 스토리 생성(중첩 StartSetting/Stat/Ending 일괄). 서버가 cuid id 부여 */
export async function createStory(
  request: CreateStoryRequest,
  browserId: string,
): Promise<Story> {
  const res = await fetch(`${API_URL}/stories`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, browserId }),
  });
  if (!res.ok) throw new Error(`createStory failed: ${res.status}`);
  return (await res.json()) as Story;
}

/** 스토리 부분 갱신(소유자만). id는 경로로 — 본문엔 patch + browserId만. contentRating은 불변(보내지 않음) */
export async function updateStory(
  id: string,
  patch: UpdateStoryRequest,
  browserId: string,
): Promise<Story> {
  const res = await fetch(`${API_URL}/stories/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...patch, browserId }),
  });
  if (!res.ok) throw new Error(`updateStory failed: ${res.status}`);
  return (await res.json()) as Story;
}

/** 스토리 삭제(소유자만, cascade로 자식 동반 삭제) */
export async function deleteStory(id: string, browserId: string): Promise<void> {
  const qs = new URLSearchParams({ browserId }).toString();
  const res = await fetch(`${API_URL}/stories/${id}?${qs}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`deleteStory failed: ${res.status}`);
}

/**
 * #48 플레이 세션 생성(#49 POST /story-sessions) — startSettingId 기준으로 statValues 초기화.
 * 실패는 throw로 전파(플레이 진입 불가는 사용자에게 보여줘야 한다).
 */
export async function createStorySession(
  storyId: string,
  startSettingId: string,
  browserId: string,
): Promise<StorySessionRecord> {
  const res = await fetch(`${API_URL}/story-sessions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storyId, startSettingId, browserId }),
  });
  if (!res.ok) throw new Error(`createStorySession failed: ${res.status}`);
  return (await res.json()) as StorySessionRecord;
}

/** 세션 이어하기(#49 GET /story-sessions/:id) — 소유자만. 없음/실패면 null(best-effort 복원) */
export async function fetchStorySession(
  id: string,
  browserId: string,
): Promise<StorySessionRecord | null> {
  const qs = new URLSearchParams({ browserId }).toString();
  try {
    const res = await fetch(`${API_URL}/story-sessions/${id}?${qs}`, { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as StorySessionRecord;
  } catch {
    return null;
  }
}

/**
 * #48 플레이 한 턴(#50/#51 POST /story-sessions/:id/turn) — non-streaming.
 * 서버가 검증·clamp한 statValues + 엔딩 평가 결과를 한 번에 반환한다. 실패는 throw로 전파.
 */
export async function turnStorySession(
  id: string,
  message: string,
  browserId: string,
): Promise<StoryTurnResult> {
  const res = await fetch(`${API_URL}/story-sessions/${id}/turn`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, browserId }),
  });
  if (!res.ok) throw new Error(`turnStorySession failed: ${res.status}`);
  return (await res.json()) as StoryTurnResult;
}
