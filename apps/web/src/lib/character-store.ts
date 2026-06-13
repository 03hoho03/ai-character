/**
 * #6 사용자 캐릭터 저장소 — localStorage 고정 (#9 DB 영속화 defer 전제).
 * 페르소나 타입은 shared `Persona`를 그대로 쓴다(신규 타입 금지).
 * 로직은 순수 함수로 분리해 폼/홈/채팅 UI는 얇게 유지.
 */
import { PERSONA_TEMPLATES, type Persona } from '@ai-character/shared';

const STORAGE_KEY = 'ai-character:user-characters';

/** 서버 스냅샷용 안정 참조 — useSyncExternalStore가 매 렌더 재구독하지 않도록 동일 배열 반환 */
const EMPTY: Persona[] = [];

/**
 * 파싱 결과 캐시 — useSyncExternalStore의 getSnapshot은 변화가 없으면
 * 동일 참조를 돌려줘야 무한 렌더를 피한다. write 시에만 무효화.
 */
let cache: Persona[] | null = null;
const listeners = new Set<() => void>();

/** SSR/비브라우저 환경 가드 — 서버에서는 빈 목록 취급 */
function readAll(): Persona[] {
  if (typeof window === 'undefined') return EMPTY;
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? (parsed as Persona[]) : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function writeAll(characters: Persona[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
  cache = characters;
  listeners.forEach((l) => l());
}

/** useSyncExternalStore 구독 — 저장/수정/삭제 시 구독자에게 통지 */
export function subscribeUserCharacters(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 서버/하이드레이션 스냅샷 — 클라이언트 마운트 전까지 빈 목록 */
export function userCharactersServerSnapshot(): Persona[] {
  return EMPTY;
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

export function listUserCharacters(): Persona[] {
  return readAll();
}

export function getUserCharacter(id: string): Persona | undefined {
  return readAll().find((p) => p.id === id);
}

/**
 * id 기준 upsert — 있으면 갱신, 없으면 추가.
 * readAll()의 캐시 배열을 제자리 변형하지 않고 항상 새 배열을 만든다 —
 * useSyncExternalStore가 Object.is로 변화를 감지하려면 참조가 바뀌어야 한다.
 */
export function saveUserCharacter(persona: Persona): Persona {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === persona.id);
  const next = idx >= 0 ? all.map((p, i) => (i === idx ? persona : p)) : [...all, persona];
  writeAll(next);
  return persona;
}

export function removeUserCharacter(id: string): void {
  writeAll(readAll().filter((p) => p.id !== id));
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

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    persona: {
      ...draft,
      name,
      exampleDialogue,
      prohibitions: prohibitions.length > 0 ? prohibitions : undefined,
    },
  };
}

/** id로 페르소나 resolve — 템플릿 우선, 없으면 사용자 저장소 (채팅/홈 합류용) */
export function resolvePersona(
  id: string,
  userCharacters: Persona[] = listUserCharacters(),
): Persona | undefined {
  return PERSONA_TEMPLATES.find((p) => p.id === id) ?? userCharacters.find((p) => p.id === id);
}
