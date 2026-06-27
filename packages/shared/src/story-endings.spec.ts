/**
 * #51 [46c] evaluateEndings 결정론 평가 테스트 (설계 §4.3).
 * condition은 AND, 충족 중 priority 낮은 1개만. 내용 단언(l_2026_06_18_x).
 */
import { describe, expect, it } from 'vitest';
import { evaluateEndings, type EvaluableEnding } from './story-runtime';

const ending = (over: Partial<EvaluableEnding>): EvaluableEnding => ({
  id: 'e',
  name: '엔딩',
  resultText: '결말',
  condition: [],
  priority: 0,
  ...over,
});

describe('evaluateEndings (#51 결정론)', () => {
  it('AND 전부 충족 → 트리거', () => {
    const e = ending({
      id: 'good',
      name: '해피엔딩',
      resultText: '둘은 행복했다',
      condition: [
        { stat: '호감도', op: '>=', value: 80 },
        { stat: '신뢰', op: '>=', value: 50 },
      ],
    });
    const res = evaluateEndings({ 호감도: 85, 신뢰: 60 }, [e]);
    expect(res).toEqual({ id: 'good', name: '해피엔딩', resultText: '둘은 행복했다' });
  });

  it('AND 중 하나라도 미충족 → 트리거 안 함', () => {
    const e = ending({
      condition: [
        { stat: '호감도', op: '>=', value: 80 },
        { stat: '신뢰', op: '>=', value: 50 },
      ],
    });
    expect(evaluateEndings({ 호감도: 85, 신뢰: 40 }, [e])).toBeNull();
  });

  it('동시 충족 → priority 낮은 1개만', () => {
    const a = ending({ id: 'a', priority: 5, condition: [{ stat: '호감도', op: '>=', value: 50 }] });
    const b = ending({ id: 'b', priority: 1, condition: [{ stat: '호감도', op: '>=', value: 50 }] });
    expect(evaluateEndings({ 호감도: 90 }, [a, b])?.id).toBe('b');
  });

  it('priority 동률 → 입력 순서(안정 정렬)로 첫 번째', () => {
    const a = ending({ id: 'a', priority: 0, condition: [{ stat: '호감도', op: '>=', value: 50 }] });
    const b = ending({ id: 'b', priority: 0, condition: [{ stat: '호감도', op: '>=', value: 50 }] });
    expect(evaluateEndings({ 호감도: 90 }, [a, b])?.id).toBe('a');
  });

  it('모든 op 경계 정확(>= <= > < ==)', () => {
    expect(evaluateEndings({ s: 10 }, [ending({ condition: [{ stat: 's', op: '>=', value: 10 }] })])).not.toBeNull();
    expect(evaluateEndings({ s: 10 }, [ending({ condition: [{ stat: 's', op: '>', value: 10 }] })])).toBeNull();
    expect(evaluateEndings({ s: 10 }, [ending({ condition: [{ stat: 's', op: '<=', value: 10 }] })])).not.toBeNull();
    expect(evaluateEndings({ s: 10 }, [ending({ condition: [{ stat: 's', op: '<', value: 10 }] })])).toBeNull();
    expect(evaluateEndings({ s: 10 }, [ending({ condition: [{ stat: 's', op: '==', value: 10 }] })])).not.toBeNull();
  });

  it('빈 condition 엔딩은 절대 트리거 안 함(무조건 발동 방지)', () => {
    expect(evaluateEndings({ 호감도: 100 }, [ending({ condition: [] })])).toBeNull();
  });

  it('정의 안 된 스탯 참조 → 미충족', () => {
    expect(
      evaluateEndings({ 호감도: 50 }, [ending({ condition: [{ stat: '없는스탯', op: '>=', value: 1 }] })]),
    ).toBeNull();
  });

  it('엔딩 없음 → null', () => {
    expect(evaluateEndings({ 호감도: 50 }, [])).toBeNull();
  });
});
