/**
 * #5 buildPersonaPrompt 테스트 — prd.md 성공 기준에 1:1 매핑.
 */
import { describe, expect, it } from 'vitest';
import { buildPersonaPrompt } from './persona-prompt';
import { PERSONA_TEMPLATES } from './personas';
import type { Persona } from './index';

const base: Persona = {
  id: 'test-1',
  name: '테스트냥',
  personality: '호기심 많고 장난기 가득한 고양이 요정',
  speechStyle: '문장 끝에 "냥"을 붙이는 발랄한 반말',
  worldview: '고양이들이 비밀 왕국을 이루고 사는 골목길 뒤편의 세계',
  greeting: '어서 와냥! 여기는 처음이지냥?',
  exampleDialogue: [
    { user: '너는 누구야?', model: '나는 골목 왕국의 안내자다냥!' },
    { user: '왕국 구경시켜 줘.', model: '따라오라냥, 발소리는 죽이고냥!' },
  ],
  prohibitions: ['고양이 왕국의 위치를 인간에게 알려주지 않는다'],
};

describe('buildPersonaPrompt (#5)', () => {
  it('systemInstruction에 name/personality/speechStyle/worldview 원문이 포함된다', () => {
    const { systemInstruction } = buildPersonaPrompt(base);
    expect(systemInstruction).toContain(base.name);
    expect(systemInstruction).toContain(base.personality);
    expect(systemInstruction).toContain(base.speechStyle);
    expect(systemInstruction).toContain(base.worldview);
  });

  it('prohibitions가 있으면 각 항목이 systemInstruction에 포함된다', () => {
    const { systemInstruction } = buildPersonaPrompt(base);
    for (const rule of base.prohibitions!) {
      expect(systemInstruction).toContain(rule);
    }
    expect(systemInstruction).toContain('금지사항');
  });

  it.each([
    ['undefined', undefined],
    ['빈 배열', [] as string[]],
  ])('prohibitions가 %s이면 금지사항 섹션이 등장하지 않는다', (_label, prohibitions) => {
    const { systemInstruction } = buildPersonaPrompt({ ...base, prohibitions });
    expect(systemInstruction).not.toContain('금지사항');
  });

  it('greeting과 exampleDialogue 내용은 systemInstruction에 포함되지 않는다', () => {
    const { systemInstruction } = buildPersonaPrompt(base);
    expect(systemInstruction).not.toContain(base.greeting);
    for (const turn of base.exampleDialogue) {
      expect(systemInstruction).not.toContain(turn.user);
      expect(systemInstruction).not.toContain(turn.model);
    }
  });

  it('fewShotMessages는 exampleDialogue×2 길이로 user→model 교대하며 내용이 일치한다', () => {
    const { fewShotMessages } = buildPersonaPrompt(base);
    expect(fewShotMessages).toHaveLength(base.exampleDialogue.length * 2);
    base.exampleDialogue.forEach((turn, i) => {
      expect(fewShotMessages[i * 2]).toEqual({ role: 'user', content: turn.user });
      expect(fewShotMessages[i * 2 + 1]).toEqual({ role: 'model', content: turn.model });
    });
  });

  it('입력 persona를 변형하지 않는다 (순수 함수)', () => {
    const input = structuredClone(base);
    buildPersonaPrompt(input);
    expect(input).toEqual(base);
  });

  it('PERSONA_TEMPLATES 5종 전체에 대해 비정상 출력 없이 동작한다 (스모크)', () => {
    for (const tpl of PERSONA_TEMPLATES) {
      const { systemInstruction, fewShotMessages } = buildPersonaPrompt(tpl);
      expect(systemInstruction.trim(), tpl.id).not.toBe('');
      expect(systemInstruction, tpl.id).toContain(tpl.name);
      expect(fewShotMessages.length, tpl.id).toBe(tpl.exampleDialogue.length * 2);
    }
  });
});
