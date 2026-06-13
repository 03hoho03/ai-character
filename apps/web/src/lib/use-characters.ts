'use client';

/**
 * #6 사용자 캐릭터 React 훅 — localStorage를 useSyncExternalStore로 읽어
 * useEffect+setState(=cascading render) 없이 외부 스토어와 동기화.
 */
import { useSyncExternalStore } from 'react';
import type { Persona } from '@ai-character/shared';
import {
  listUserCharacters,
  resolvePersona,
  subscribeUserCharacters,
  userCharactersServerSnapshot,
} from './character-store';

export function useUserCharacters(): Persona[] {
  return useSyncExternalStore(
    subscribeUserCharacters,
    listUserCharacters,
    userCharactersServerSnapshot,
  );
}

/** 클라이언트 마운트 완료 여부 — 서버 스냅샷 false → 클라이언트 true (loading 게이트용) */
const noop = () => () => {};
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** id로 페르소나 resolve (템플릿 + 사용자) — 사용자 목록 변화에 반응 */
export function useResolvedPersona(id: string): Persona | undefined {
  const userCharacters = useUserCharacters();
  return resolvePersona(id, userCharacters);
}

/** 사용자 캐릭터 단건 — 편집 페이지용 */
export function useUserCharacter(id: string): Persona | undefined {
  return useUserCharacters().find((p) => p.id === id);
}
