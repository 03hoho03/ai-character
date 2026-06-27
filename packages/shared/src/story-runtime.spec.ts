/**
 * #50 [46b] applyStatDeltas 순수 함수 테스트 — 신뢰경계 엣지 전수.
 * 핵심: 모델 statDeltas를 무검증 신뢰하지 않는다 — 화이트리스트 + clamp + 타입검증.
 * 내용 단언 원칙(l_2026_06_18_x): 존재만이 아니라 *값*을 단언한다.
 */
import { describe, expect, it } from 'vitest';
import { applyStatDeltas } from './story-runtime';
import type { StatDef } from './story';

const stats: StatDef[] = [
  { name: '호감도', initialValue: 35, minValue: 0, maxValue: 100 },
  { name: '신뢰', initialValue: 12, minValue: 0, maxValue: 100 },
];

describe('applyStatDeltas (#50 신뢰경계)', () => {
  it('미정의 스탯 키는 채택 안 됨 + rejectedKeys로 수집(화이트리스트 leak 차단)', () => {
    const res = applyStatDeltas({ 호감도: 35, 신뢰: 12 }, stats, {
      호감도: 5,
      해킹스탯: 999,
      __proto__: 1,
    });
    // 정의된 스탯만 결과에 존재
    expect(Object.keys(res.statValues).sort()).toEqual(['신뢰', '호감도']);
    expect(res.statValues.호감도).toBe(40);
    expect('해킹스탯' in res.statValues).toBe(false);
    expect(res.rejectedKeys).toContain('해킹스탯');
  });

  it('JSON.parse 산물의 __proto__/constructor own-key도 차단(실제 모델 출력 경로)', () => {
    // 객체 리터럴 {__proto__:..}와 달리 JSON.parse는 __proto__를 *own key*로 만든다 — 프로덕션 경로.
    const raw: unknown = JSON.parse('{"호감도":5,"__proto__":{"polluted":true},"constructor":9}');
    const res = applyStatDeltas({ 호감도: 35, 신뢰: 12 }, stats, raw);
    expect(Object.keys(res.statValues).sort()).toEqual(['신뢰', '호감도']);
    expect(res.statValues.호감도).toBe(40);
    // 프로토타입 미오염 — 전역/결과 어디에도 polluted 누출 없음
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((res.statValues as Record<string, unknown>).polluted).toBeUndefined();
    expect(res.rejectedKeys).toEqual(expect.arrayContaining(['__proto__', 'constructor']));
  });

  it('max 초과 → maxValue로 clamp', () => {
    const res = applyStatDeltas({ 호감도: 98, 신뢰: 12 }, stats, { 호감도: 50 });
    expect(res.statValues.호감도).toBe(100);
  });

  it('min 미만 → minValue로 clamp', () => {
    const res = applyStatDeltas({ 호감도: 3, 신뢰: 12 }, stats, { 호감도: -50 });
    expect(res.statValues.호감도).toBe(0);
  });

  it('숫자 아닌 delta(문자열/null/객체/배열/NaN/Infinity) 거부 + rejectedKeys', () => {
    const res = applyStatDeltas({ 호감도: 35, 신뢰: 12 }, stats, {
      호감도: '5',
      신뢰: null,
    });
    // 거부 → 변화 없음
    expect(res.statValues.호감도).toBe(35);
    expect(res.statValues.신뢰).toBe(12);
    expect(res.rejectedKeys).toEqual(expect.arrayContaining(['호감도', '신뢰']));

    expect(applyStatDeltas({ 호감도: 35, 신뢰: 12 }, stats, { 호감도: {} }).statValues.호감도).toBe(35);
    expect(applyStatDeltas({ 호감도: 35, 신뢰: 12 }, stats, { 호감도: [] }).statValues.호감도).toBe(35);
    expect(applyStatDeltas({ 호감도: 35, 신뢰: 12 }, stats, { 호감도: NaN }).statValues.호감도).toBe(35);
    expect(
      applyStatDeltas({ 호감도: 35, 신뢰: 12 }, stats, { 호감도: Infinity }).statValues.호감도,
    ).toBe(35);
  });

  it('음수 delta 정상 적용', () => {
    const res = applyStatDeltas({ 호감도: 35, 신뢰: 12 }, stats, { 호감도: -10 });
    expect(res.statValues.호감도).toBe(25);
  });

  it('current에 없는 스탯 → initialValue 기준 적용', () => {
    // 신뢰가 current에 없음 → initialValue 12 기준 +3 = 15
    const res = applyStatDeltas({ 호감도: 35 }, stats, { 신뢰: 3 });
    expect(res.statValues.신뢰).toBe(15);
    expect(res.statValues.호감도).toBe(35);
  });

  it('빈 rawDeltas → 변화 없음, rejectedKeys 빈 배열', () => {
    const res = applyStatDeltas({ 호감도: 35, 신뢰: 12 }, stats, {});
    expect(res.statValues).toEqual({ 호감도: 35, 신뢰: 12 });
    expect(res.rejectedKeys).toEqual([]);
  });

  it('null/undefined/비객체 rawDeltas → 변화 없음(base 유지)', () => {
    for (const raw of [null, undefined, 'string', 42, [] as unknown]) {
      const res = applyStatDeltas({ 호감도: 35, 신뢰: 12 }, stats, raw);
      expect(res.statValues).toEqual({ 호감도: 35, 신뢰: 12 });
      expect(res.rejectedKeys).toEqual([]);
    }
  });

  it('current에 정의 스탯이 없고 rawDeltas도 비면 모든 스탯 initialValue로 채워진다', () => {
    const res = applyStatDeltas({}, stats, {});
    expect(res.statValues).toEqual({ 호감도: 35, 신뢰: 12 });
  });

  it('소수 delta는 정수로 라운딩되어 clamp(statValues는 정수 의미)', () => {
    const res = applyStatDeltas({ 호감도: 35, 신뢰: 12 }, stats, { 호감도: 4.6 });
    expect(res.statValues.호감도).toBe(40);
    expect(Number.isInteger(res.statValues.호감도)).toBe(true);
  });
});
