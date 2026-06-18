/**
 * #15 대화 요약 조립/임계 유틸 — web/api 공용 단일 출처.
 * 요약 생성은 서버(Gemini)가, 요청 조립은 양쪽이 이 함수로 동일하게 수행한다.
 */
import type { ChatMessage } from './index';

/** 저장 turn이 이 수를 넘으면 요약 트리거 */
export const SUMMARY_TURN_THRESHOLD = 12;
/** 요약 후에도 원문으로 유지하는 최근 turn 수 */
export const SUMMARY_RECENT_TURNS = 6;
/** 조립 페이로드(요약 + 최근 turn) 토큰 상한 가드 */
export const SUMMARY_TOKEN_CAP = 6000;

/** 거친 토큰 추정 — 대략 4글자≈1토큰 (정밀 토크나이저는 비대상, #15 휴리스틱) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** 저장 turn 수 기준 요약 필요 여부 */
export function shouldSummarize(turnCount: number): boolean {
  return turnCount > SUMMARY_TURN_THRESHOLD;
}

/**
 * 요청에 실어보낼 history를 조립한다.
 * - summary 있으면 최근 N turn만(과거는 summary가 대표), 없으면 전체.
 * - 두 경우 모두 (summary + 메시지) 토큰 합이 상한을 넘으면 오래된 것부터 제거(최소 1 보존).
 */
export function assembleHistory(history: ChatMessage[], summary: string | null): ChatMessage[] {
  let assembled = summary ? history.slice(-SUMMARY_RECENT_TURNS) : [...history];

  const summaryTokens = summary ? estimateTokens(summary) : 0;
  const totalTokens = (msgs: ChatMessage[]) =>
    summaryTokens + msgs.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  while (assembled.length > 1 && totalTokens(assembled) > SUMMARY_TOKEN_CAP) {
    assembled = assembled.slice(1);
  }
  return assembled;
}
