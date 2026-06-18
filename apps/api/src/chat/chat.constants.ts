import { HarmBlockThreshold, HarmCategory, type SafetySetting } from '@google/genai';

/** GoogleGenAI 클라이언트 DI 토큰. 키 미설정 시 null이 주입된다. */
export const GENAI_CLIENT = Symbol('GENAI_CLIENT');

/**
 * #23 서버 제어 안전 설정 — 클라가 영향 줄 수 없는 모델 레벨 가드.
 * 비성인 유해 카테고리(괴롭힘/혐오/위험)는 MEDIUM 이상 차단으로 강화한다.
 * 성적 노골성은 BLOCK_ONLY_HIGH baseline — 성인/일반 등급별 차등은 #26(19b)에서 contentRating로 분기.
 * 차단 시 응답은 빈 candidate로 와 기존 isSafetyBlocked(#13) 경로가 safety_block 이벤트로 처리한다.
 */
export const SAFETY_SETTINGS: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];
