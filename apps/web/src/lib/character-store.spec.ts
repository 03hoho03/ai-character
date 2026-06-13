/**
 * #6 캐릭터 저장소 + 검증 + resolve 단위 테스트 — prd.md 성공 기준에 매핑.
 * localStorage는 jsdom에서 제공된다.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PERSONA_TEMPLATES } from '@ai-character/shared';
import type { Persona } from '@ai-character/shared';
import {
  createCharacterId,
  getUserCharacter,
  listUserCharacters,
  newDraftFromTemplate,
  removeUserCharacter,
  resolvePersona,
  sanitizeForSave,
  saveUserCharacter,
} from './character-store';

const validDraft = (over: Partial<Persona> = {}): Persona => ({
  id: 'usr-test-1',
  name: '나의 캐릭터',
  tagline: '한줄소개',
  personality: '성격',
  speechStyle: '말투',
  worldview: '세계관',
  greeting: '안녕!',
  exampleDialogue: [{ user: '안녕?', model: '응 안녕!' }],
  prohibitions: ['금지1'],
  ...over,
});

describe('character-store (#6)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('createCharacterId', () => {
    it("'usr-' prefix를 갖고 템플릿 컨벤션(tpl-)과 겹치지 않는다", () => {
      const id = createCharacterId();
      expect(id.startsWith('usr-')).toBe(true);
      expect(id.startsWith('tpl-')).toBe(false);
    });
    it('호출마다 고유하다', () => {
      expect(createCharacterId()).not.toBe(createCharacterId());
    });
  });

  describe('newDraftFromTemplate', () => {
    it('템플릿 전 필드를 복사하되 새 usr- id를 부여한다', () => {
      const tpl = PERSONA_TEMPLATES[0];
      const draft = newDraftFromTemplate(tpl);
      expect(draft.id).not.toBe(tpl.id);
      expect(draft.id.startsWith('usr-')).toBe(true);
      expect(draft.name).toBe(tpl.name);
      expect(draft.worldview).toBe(tpl.worldview);
      expect(draft.exampleDialogue).toEqual(tpl.exampleDialogue);
    });
    it('깊은 복사라 draft 변형이 원본 템플릿에 영향을 주지 않는다', () => {
      const tpl = PERSONA_TEMPLATES[0];
      const snapshot = structuredClone(tpl);
      const draft = newDraftFromTemplate(tpl);
      draft.exampleDialogue.push({ user: 'x', model: 'y' });
      draft.name = '바뀐 이름';
      expect(tpl).toEqual(snapshot);
    });
  });

  describe('CRUD 왕복', () => {
    it('save → list/get로 조회된다', () => {
      const p = validDraft();
      saveUserCharacter(p);
      expect(listUserCharacters()).toHaveLength(1);
      expect(getUserCharacter(p.id)).toEqual(p);
    });
    it('같은 id 재저장은 추가가 아니라 갱신(upsert)이다', () => {
      const p = validDraft();
      saveUserCharacter(p);
      saveUserCharacter({ ...p, name: '수정됨' });
      expect(listUserCharacters()).toHaveLength(1);
      expect(getUserCharacter(p.id)?.name).toBe('수정됨');
    });
    it('remove하면 목록에서 사라진다', () => {
      const p = validDraft();
      saveUserCharacter(p);
      removeUserCharacter(p.id);
      expect(getUserCharacter(p.id)).toBeUndefined();
      expect(listUserCharacters()).toHaveLength(0);
    });
    it('빈 저장소에서 list는 빈 배열, get은 undefined', () => {
      expect(listUserCharacters()).toEqual([]);
      expect(getUserCharacter('usr-none')).toBeUndefined();
    });

    // useSyncExternalStore 계약: write 후 스냅샷 참조가 바뀌어야 구독자가 갱신을 본다
    it('save/upsert는 list 스냅샷의 참조를 교체한다 (제자리 변형 금지)', () => {
      const p = validDraft();
      saveUserCharacter(p);
      const before = listUserCharacters();
      saveUserCharacter({ ...p, name: '수정됨' });
      const after = listUserCharacters();
      expect(after).not.toBe(before);
      expect(before[0].name).toBe('나의 캐릭터'); // 이전 스냅샷은 불변
      expect(after[0].name).toBe('수정됨');
    });
  });

  describe('sanitizeForSave', () => {
    it('name이 공백뿐이면 거부한다', () => {
      const r = sanitizeForSave(validDraft({ name: '   ' }));
      expect(r.ok).toBe(false);
    });
    it('user/model 한쪽이라도 빈 exampleDialogue turn은 필터링한다', () => {
      const r = sanitizeForSave(
        validDraft({
          exampleDialogue: [
            { user: '유효', model: '응답' },
            { user: '', model: '응답만' },
            { user: '질문만', model: '   ' },
          ],
        }),
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.persona.exampleDialogue).toEqual([{ user: '유효', model: '응답' }]);
    });
    it('공백뿐인 prohibitions 항목은 제거된다', () => {
      const r = sanitizeForSave(validDraft({ prohibitions: ['진짜금지', '  ', ''] }));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.persona.prohibitions).toEqual(['진짜금지']);
    });
    it('유효한 draft는 통과시킨다', () => {
      const r = sanitizeForSave(validDraft());
      expect(r.ok).toBe(true);
    });
  });

  describe('resolvePersona (템플릿 + 사용자 합류)', () => {
    it('템플릿 id는 PERSONA_TEMPLATES에서 resolve된다', () => {
      const tpl = PERSONA_TEMPLATES[0];
      expect(resolvePersona(tpl.id)).toEqual(tpl);
    });
    it('usr- id는 저장소에서 resolve된다', () => {
      const p = validDraft();
      saveUserCharacter(p);
      expect(resolvePersona(p.id)).toEqual(p);
    });
    it('어디에도 없는 id는 undefined', () => {
      expect(resolvePersona('usr-ghost')).toBeUndefined();
    });
  });
});
