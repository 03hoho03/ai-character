/**
 * #50 [46b] 스토리 런타임 — delta 서버검증·clamp (순수 함수).
 * 신뢰 경계(CLAUDE.md #23, 설계 §4.2): 모델이 낸 statDeltas를 **무검증 신뢰하지 않는다**.
 * 정의된 스탯명만 화이트리스트, 숫자(유한)만 채택, min/max로 clamp. 그 외는 rejectedKeys로 수집.
 */
import type { StatDef, StatValues } from './story';

export interface ApplyStatDeltasResult {
  /** 갱신된 스탯 상태(정의된 스탯만, 전부 정수, clamp 적용) */
  statValues: StatValues;
  /** 거부된 키(미정의 스탯명 / 비유한 숫자 delta) */
  rejectedKeys: string[];
}

/** 정수 라운딩 + [min,max] clamp. statValues는 정수 의미. */
function clampInt(value: number, stat: StatDef): number {
  const rounded = Math.round(value);
  return Math.max(stat.minValue, Math.min(stat.maxValue, rounded));
}

/**
 * 모델 statDeltas(rawDeltas)를 검증·clamp해 새 statValues를 만든다.
 * - base: 정의된 모든 스탯을 current 값(없으면 stat.initialValue)으로 채운 뒤 clamp.
 * - delta: 정의된 스탯명 + 유한 숫자만 채택. 적용 후 다시 clamp. 그 외 키는 rejectedKeys.
 * - rawDeltas가 객체가 아니면(null/배열/원시값) 변화 없이 base 반환.
 * Map 기반 조회로 프로토타입 오염(__proto__ 등) 키를 자연 차단한다.
 */
export function applyStatDeltas(
  current: StatValues,
  stats: StatDef[],
  rawDeltas: unknown,
): ApplyStatDeltasResult {
  const statValues: StatValues = {};
  for (const stat of stats) {
    const has = Object.prototype.hasOwnProperty.call(current, stat.name);
    const base = has ? current[stat.name] : stat.initialValue;
    statValues[stat.name] = clampInt(base, stat);
  }

  const rejectedKeys: string[] = [];
  if (rawDeltas === null || typeof rawDeltas !== 'object' || Array.isArray(rawDeltas)) {
    return { statValues, rejectedKeys };
  }

  const statByName = new Map(stats.map((s) => [s.name, s] as const));
  for (const key of Object.keys(rawDeltas as Record<string, unknown>)) {
    const stat = statByName.get(key);
    if (!stat) {
      rejectedKeys.push(key);
      continue;
    }
    const delta = (rawDeltas as Record<string, unknown>)[key];
    if (typeof delta !== 'number' || !Number.isFinite(delta)) {
      rejectedKeys.push(key);
      continue;
    }
    statValues[stat.name] = clampInt(statValues[stat.name] + delta, stat);
  }

  return { statValues, rejectedKeys };
}
