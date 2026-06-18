'use client';

/**
 * #21 사용자 캐릭터 저장소 — localStorage(#6)에서 서버 fetch(#16 백엔드)로 전환.
 * useSyncExternalStore 계약(구독/스냅샷)은 유지해 소비처 churn을 최소화한다:
 * 서버에서 1회 로드한 결과를 인메모리 캐시에 담고, 저장/삭제 후 캐시를 교체해 통지한다.
 * 순수 함수(createCharacterId/newDraftFromTemplate/sanitizeForSave/resolvePersona)는 그대로 보존.
 */
import { PERSONA_TEMPLATES, type Persona } from '@ai-character/shared';
import { getBrowserId } from './browser-id';
import {
  createCharacter,
  deleteCharacter,
  fetchOwnedCharacters,
  updateCharacter,
} from './characters-api';

/** #6 localStorage 캐릭터 키 — 이제는 일회성 마이그레이션 원본으로만 읽는다 */
const LEGACY_KEY = 'ai-character:user-characters';
/** 마이그레이션 완료 플래그 — 재실행 skip */
const MIGRATED_KEY = 'ai-character:characters-migrated';

/** getSnapshot 안정 참조 — useSyncExternalStore 무한 렌더 방지 */
const EMPTY: Persona[] = [];

let cache: Persona[] = EMPTY;
let loaded = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

/**
 * 기존 localStorage 캐릭터를 서버로 일회성 import(upsert). 원본은 보존(롤백 대비).
 * id가 usr-라 POST upsert가 멱등 → 플래그 유실 시 재import해도 안전.
 */
async function migrateLegacyOnce(browserId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(MIGRATED_KEY)) return;

  let legacy: Persona[] = [];
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    legacy = Array.isArray(parsed) ? (parsed as Persona[]) : [];
  } catch {
    legacy = [];
  }

  // 전부 성공해야 플래그를 세운다 — 실패 시 다음 로드에서 재시도(upsert라 안전)
  await Promise.all(legacy.map((p) => createCharacter(p, browserId)));
  window.localStorage.setItem(MIGRATED_KEY, '1');
}

/** 서버에서 캐시를 1회 채운다. in-flight 가드로 동시/반복 호출을 합친다 */
export function ensureLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (typeof window === 'undefined') return;
    const browserId = getBrowserId();
    try {
      await migrateLegacyOnce(browserId);
    } catch {
      /* 마이그레이션 실패는 로드를 막지 않는다 — 플래그 미설정으로 다음에 재시도 */
    }
    cache = await fetchOwnedCharacters(browserId);
    loaded = true;
    notify();
  })();
  return loadPromise;
}

/** useSyncExternalStore 구독 — 최초 구독 시 서버 로드를 트리거 */
export function subscribeUserCharacters(listener: () => void): () => void {
  listeners.add(listener);
  void ensureLoaded();
  return () => listeners.delete(listener);
}

/** 클라이언트 스냅샷 — 캐시(로드 전엔 빈 목록) */
export function listUserCharacters(): Persona[] {
  return cache;
}

/** 서버/하이드레이션 스냅샷 — 로드 전까지 빈 목록 */
export function userCharactersServerSnapshot(): Persona[] {
  return EMPTY;
}

/** 초기 서버 로드 완료 여부 — not-found 깜빡임 게이트용 */
export function isCharactersLoaded(): boolean {
  return loaded;
}

export function getUserCharacter(id: string): Persona | undefined {
  return cache.find((p) => p.id === id);
}

/** 캐시 upsert — 항상 새 배열(useSyncExternalStore가 참조로 변화 감지) */
function applyToCache(persona: Persona): void {
  const idx = cache.findIndex((p) => p.id === persona.id);
  cache = idx >= 0 ? cache.map((p, i) => (i === idx ? persona : p)) : [...cache, persona];
  notify();
}

/**
 * 저장 — 캐시에 있으면 PATCH(부분 갱신), 없으면 POST(생성/upsert).
 * 서버 응답(권위 있는 레코드)을 캐시에 반영한다.
 */
export async function saveUserCharacter(persona: Persona): Promise<Persona> {
  const browserId = getBrowserId();
  const exists = cache.some((p) => p.id === persona.id);
  let saved: Persona;
  if (exists) {
    const { id: _id, ...patch } = persona;
    saved = await updateCharacter(persona.id, patch, browserId);
  } else {
    saved = await createCharacter(persona, browserId);
  }
  applyToCache(saved);
  return saved;
}

/** 삭제 — 서버 DELETE 후 캐시에서 제거 */
export async function removeUserCharacter(id: string): Promise<void> {
  await deleteCharacter(id, getBrowserId());
  cache = cache.filter((p) => p.id !== id);
  notify();
}

/** 사용자 캐릭터 id — 템플릿 컨벤션(tpl-)과 구분되는 usr- prefix */
export function createCharacterId(): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  return `usr-${uuid}`;
}

/** 템플릿을 깊은 복사해 새 usr- id를 부여한 편집용 draft 생성 */
export function newDraftFromTemplate(template: Persona): Persona {
  return { ...structuredClone(template), id: createCharacterId() };
}

export type SanitizeResult =
  | { ok: true; persona: Persona }
  | { ok: false; errors: string[] };

/** 저장 전 검증/정리 — name 필수, 빈 turn·금지항목 필터링 */
export function sanitizeForSave(draft: Persona): SanitizeResult {
  const errors: string[] = [];
  const name = draft.name.trim();
  if (!name) errors.push('이름은 비워둘 수 없어요.');

  const exampleDialogue = draft.exampleDialogue.filter(
    (turn) => turn.user.trim() !== '' && turn.model.trim() !== '',
  );
  const prohibitions = (draft.prohibitions ?? [])
    .map((rule) => rule.trim())
    .filter((rule) => rule !== '');

  // #25 분류 메타 정규화 — category 공백 제거(빈 값은 undefined), tags 트림·빈값 제거·중복 제거
  const category = draft.category?.trim() || undefined;
  const tags = Array.from(
    new Set((draft.tags ?? []).map((t) => t.trim()).filter((t) => t !== '')),
  );

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    persona: {
      ...draft,
      name,
      exampleDialogue,
      prohibitions: prohibitions.length > 0 ? prohibitions : undefined,
      category,
      tags: tags.length > 0 ? tags : undefined,
    },
  };
}

/** id로 페르소나 resolve — 템플릿 우선, 없으면 사용자 목록 (채팅/홈 합류용) */
export function resolvePersona(
  id: string,
  userCharacters: Persona[] = listUserCharacters(),
): Persona | undefined {
  return PERSONA_TEMPLATES.find((p) => p.id === id) ?? userCharacters.find((p) => p.id === id);
}
