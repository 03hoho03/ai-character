/**
 * 공용 타입 패키지 엔트리.
 * Persona 스키마 본체는 #4 ticket에서 확정 — 여기는 placeholder.
 */
export interface Persona {
  /** #2a/#6에서 DB 이전 비용 선납을 위해 id를 처음부터 포함 (sprint plan 합의) */
  id: string;
  name: string;
}

export const SHARED_PACKAGE_NAME = '@ai-character/shared';
