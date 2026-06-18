/**
 * #15 대화 요약 조립/임계 유틸 테스트 — web/api 공용 단일 출처.
 */
import { describe, expect, it } from 'vitest';
import type { ChatMessage } from './index';
import {
  SUMMARY_RECENT_TURNS,
  SUMMARY_TOKEN_CAP,
  SUMMARY_TURN_THRESHOLD,
  assembleHistory,
  estimateTokens,
  shouldSummarize,
} from './conversation-summary';

const turn = (i: number, content = `m${i}`): ChatMessage => ({
  role: i % 2 === 0 ? 'user' : 'model',
  content,
});

describe('conversation-summary (#15)', () => {
  describe('estimateTokens', () => {
    it('길이에 비례하는 양수를 반환한다', () => {
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens('abcd')).toBeGreaterThan(0);
      expect(estimateTokens('a'.repeat(400))).toBeGreaterThan(estimateTokens('a'.repeat(40)));
    });
  });

  describe('shouldSummarize', () => {
    it('임계 이하면 false, 초과면 true', () => {
      expect(shouldSummarize(SUMMARY_TURN_THRESHOLD)).toBe(false);
      expect(shouldSummarize(SUMMARY_TURN_THRESHOLD + 1)).toBe(true);
    });
  });

  describe('assembleHistory', () => {
    it('summary가 없으면 전체 history를 반환한다 (기존 동작 보존)', () => {
      const history = Array.from({ length: 4 }, (_, i) => turn(i));
      expect(assembleHistory(history, null)).toEqual(history);
    });

    it('summary가 있으면 최근 N turn만 반환한다', () => {
      const history = Array.from({ length: SUMMARY_RECENT_TURNS + 5 }, (_, i) => turn(i));
      const result = assembleHistory(history, '이전 요약');
      expect(result).toHaveLength(SUMMARY_RECENT_TURNS);
      expect(result).toEqual(history.slice(-SUMMARY_RECENT_TURNS));
    });

    it('summary가 있고 history가 N 이하면 전부 반환한다', () => {
      const history = Array.from({ length: 3 }, (_, i) => turn(i));
      expect(assembleHistory(history, '요약')).toEqual(history);
    });

    it('토큰 상한 초과 시 오래된 것부터 trim하고 상한 이내로 맞춘다', () => {
      // 각 4000자 ≈ 1000토큰, 최근 6개 = 6000 + summary(1) > cap → 5개로 trim
      const big = 'x'.repeat(4000);
      const history = Array.from({ length: 10 }, (_, i) => turn(i, big));
      const result = assembleHistory(history, 's');
      expect(result.length).toBeLessThan(SUMMARY_RECENT_TURNS);
      const tokens =
        estimateTokens('s') + result.reduce((sum, m) => sum + estimateTokens(m.content), 0);
      expect(tokens).toBeLessThanOrEqual(SUMMARY_TOKEN_CAP);
    });

    it('상한을 넘어도 최소 1개 turn은 보존한다', () => {
      const huge = 'y'.repeat(SUMMARY_TOKEN_CAP * 8);
      const history = [turn(0, huge), turn(1, huge)];
      const result = assembleHistory(history, 's');
      expect(result.length).toBe(1);
    });
  });
});
