'use client';

/**
 * #21 캐릭터 API 클라이언트 — #16 백엔드 Character CRUD에 대응(conversations-api 패턴).
 * 읽기는 best-effort(실패 시 빈 목록), 쓰기는 실패를 throw로 전파한다.
 */
import type { CharacterRecord, Persona } from '@ai-character/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** 내 캐릭터 목록(최신순). 실패/네트워크 에러면 빈 배열 */
export async function fetchOwnedCharacters(browserId: string): Promise<CharacterRecord[]> {
  const qs = new URLSearchParams({ browserId }).toString();
  try {
    const res = await fetch(`${API_URL}/characters?${qs}`);
    if (!res.ok) return [];
    return (await res.json()) as CharacterRecord[];
  } catch {
    return [];
  }
}

/**
 * #24/#25 공개 캐릭터 목록/검색·필터(최신순). q=이름·한줄소개 검색, #25 category/tag 필터.
 * 셋은 함께 보낼 수 있고 서버에서 AND 결합된다. 빈 값은 쿼리에서 생략. 실패면 빈 배열.
 */
export async function fetchPublicCharacters(
  q?: string,
  filters: { category?: string; tag?: string; includeAdult?: boolean } = {},
): Promise<CharacterRecord[]> {
  const params = new URLSearchParams();
  const keyword = q?.trim();
  const category = filters.category?.trim();
  const tag = filters.tag?.trim();
  if (keyword) params.set('q', keyword);
  if (category) params.set('category', category);
  if (tag) params.set('tag', tag);
  if (filters.includeAdult) params.set('includeAdult', 'true');
  const qs = params.toString();
  const url = qs ? `${API_URL}/characters/public?${qs}` : `${API_URL}/characters/public`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return (await res.json()) as CharacterRecord[];
  } catch {
    return [];
  }
}

/** 캐릭터 생성(같은 id면 서버에서 소유자 upsert). 이번 sprint는 비공개 고정 */
export async function createCharacter(
  persona: Persona,
  browserId: string,
): Promise<CharacterRecord> {
  const res = await fetch(`${API_URL}/characters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...persona, browserId, isPublic: false }),
  });
  if (!res.ok) throw new Error(`createCharacter failed: ${res.status}`);
  return (await res.json()) as CharacterRecord;
}

/** 캐릭터 부분 갱신(소유자만). id는 경로로 — 본문엔 patch + browserId만 */
export async function updateCharacter(
  id: string,
  patch: Partial<Omit<Persona, 'id'>>,
  browserId: string,
): Promise<CharacterRecord> {
  const res = await fetch(`${API_URL}/characters/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...patch, browserId }),
  });
  if (!res.ok) throw new Error(`updateCharacter failed: ${res.status}`);
  return (await res.json()) as CharacterRecord;
}

/** 캐릭터 삭제(소유자만) */
export async function deleteCharacter(id: string, browserId: string): Promise<void> {
  const qs = new URLSearchParams({ browserId }).toString();
  const res = await fetch(`${API_URL}/characters/${id}?${qs}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`deleteCharacter failed: ${res.status}`);
}
