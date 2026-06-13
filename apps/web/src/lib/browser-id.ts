'use client';

/**
 * #14 익명 소유자 식별자 — 인증(#10 cut) 대신 브라우저당 uuid 1개.
 * 최초 1회 생성·localStorage 보관, 이후 재사용. 추후 계정 연결 가능 구조.
 */
const STORAGE_KEY = 'ai-character:browser-id';

export function getBrowserId(): string {
  if (typeof window === 'undefined') return '';
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  window.localStorage.setItem(STORAGE_KEY, id);
  return id;
}
