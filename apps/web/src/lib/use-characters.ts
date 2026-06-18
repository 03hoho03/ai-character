'use client';

/**
 * #21 사용자 캐릭터 React 훅 — 서버 백드 스토어(#16)를 useSyncExternalStore로 구독.
 * 최초 구독 시 store가 서버 로드를 트리거한다(#6의 localStorage 동기 읽기 대체).
 */
import { useSyncExternalStore } from 'react';
import type { Persona } from '@ai-character/shared';
import {
  isCharactersLoaded,
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

/**
 * 초기 서버 로드 완료 여부 — 로드 전 false, 완료 후 true.
 * usr- 캐릭터의 not-found 깜빡임 게이트용(#6 useHydrated의 역할을 '로드 완료'로 확장).
 */
export function useCharactersLoaded(): boolean {
  return useSyncExternalStore(
    subscribeUserCharacters,
    isCharactersLoaded,
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
