/**
 * #4 시드 검증 테스트 — prd.md 성공 기준에 1:1 매핑.
 * 장르 커버리지는 id 네이밍 컨벤션(tpl-<genre>-*)으로 검증.
 */
import { describe, expect, it } from 'vitest';
import { PERSONA_TEMPLATES, type Persona } from './index';

const GENRES = ['fantasy', 'daily', 'romance', 'sf', 'helper'] as const;

const REQUIRED_STRING_FIELDS = [
  'id',
  'name',
  'tagline', // #7 카드용 한줄소개
  'personality',
  'speechStyle',
  'worldview',
  'greeting',
] as const satisfies readonly (keyof Persona)[];

describe('PERSONA_TEMPLATES (#4)', () => {
  it('템플릿이 정확히 5종이다', () => {
    expect(PERSONA_TEMPLATES).toHaveLength(5);
  });

  it('모든 id가 tpl- prefix이며 유니크하다', () => {
    const ids = PERSONA_TEMPLATES.map((p) => p.id);
    for (const id of ids) {
      expect(id).toMatch(/^tpl-/);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('서로 다른 5개 장르(판타지/일상/로맨스/SF/조력자)를 id 네이밍으로 커버한다', () => {
    for (const genre of GENRES) {
      const matches = PERSONA_TEMPLATES.filter((p) =>
        p.id.startsWith(`tpl-${genre}-`),
      );
      expect(matches, `tpl-${genre}-* 템플릿은 정확히 1종`).toHaveLength(1);
    }
  });

  it.each(REQUIRED_STRING_FIELDS)(
    '필수 필드 %s 가 모든 템플릿에서 non-empty string이다',
    (field) => {
      for (const persona of PERSONA_TEMPLATES) {
        const value = persona[field];
        expect(typeof value, `${persona.id}.${field}`).toBe('string');
        expect((value as string).trim(), `${persona.id}.${field}`).not.toBe('');
      }
    },
  );

  it('exampleDialogue가 최소 1쌍이며 각 쌍의 user/model이 non-empty이다', () => {
    for (const persona of PERSONA_TEMPLATES) {
      expect(
        persona.exampleDialogue.length,
        `${persona.id}.exampleDialogue`,
      ).toBeGreaterThanOrEqual(1);
      for (const [i, turn] of persona.exampleDialogue.entries()) {
        expect(turn.user.trim(), `${persona.id}.exampleDialogue[${i}].user`).not.toBe('');
        expect(turn.model.trim(), `${persona.id}.exampleDialogue[${i}].model`).not.toBe('');
      }
    }
  });

  it('prohibitions가 있으면 non-empty string 배열이다 (optional)', () => {
    for (const persona of PERSONA_TEMPLATES) {
      if (persona.prohibitions === undefined) continue;
      for (const [i, rule] of persona.prohibitions.entries()) {
        expect(rule.trim(), `${persona.id}.prohibitions[${i}]`).not.toBe('');
      }
    }
  });
});
