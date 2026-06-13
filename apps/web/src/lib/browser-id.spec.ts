/**
 * #14 2/2 익명 browserId 유틸 테스트 — localStorage uuid 1회 생성·재사용.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getBrowserId } from './browser-id';

describe('getBrowserId (#14)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('최초 호출 시 비어있지 않은 id를 만들어 localStorage에 저장한다', () => {
    const id = getBrowserId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
    // 같은 값이 저장돼 있어야 한다 (어떤 키든 그 값이 존재)
    const stored = Object.values(localStorage).includes(id);
    expect(stored).toBe(true);
  });

  it('두 번째 호출은 같은 값을 반환한다 (재생성 안 함)', () => {
    expect(getBrowserId()).toBe(getBrowserId());
  });
});
