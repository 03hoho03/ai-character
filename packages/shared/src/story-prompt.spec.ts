/**
 * #45 buildStoryPrompt / buildStoryResponseSchema 테스트 — story-mode-design §4.1/4.2 성공 기준 1:1 매핑.
 * 내용 단언 원칙(l_2026_06_18_x): 존재만이 아니라 *값*을 단언한다.
 */
import { describe, expect, it } from 'vitest';
import {
  buildStoryPrompt,
  buildStoryResponseSchema,
  STORY_RESPONSE_SCHEMA,
} from './story-prompt';
import type { StartSettingDef, Story, StatValues } from './story';

const startSetting: StartSettingDef = {
  name: '첫 만남',
  prologue: '오래된 도서관, 먼지 냄새가 코끝을 스친다.',
  startSituation: '비 오는 밤, 당신은 처음으로 그녀와 마주친다.',
  playGuide: '호감도를 80 이상으로 올리면 해피엔딩이다.',
  suggestedReplies: ['안녕하세요?', '여기서 뭐 하세요?'],
  stats: [
    { name: '호감도', initialValue: 35, minValue: 0, maxValue: 100 },
    { name: '신뢰', initialValue: 12, minValue: 0, maxValue: 100 },
  ],
  endings: [
    {
      name: '해피엔딩',
      condition: [{ stat: '호감도', op: '>=', value: 80 }],
      resultText: '두 사람은 영원히 행복했다.',
    },
  ],
};

const story: Story = {
  id: 'story-1',
  name: '도서관의 비밀',
  tagline: '비 오는 밤의 운명적 만남',
  promptTemplateId: 'tpl-romance-1',
  storyInfo: '이곳은 시간이 멈춘 듯한 오래된 대학 도서관이다. 모든 사건은 이 안에서 벌어진다.',
  developmentExamples: [
    { input: '그녀에게 다가간다.', output: '그녀가 고개를 들어 당신을 바라본다.' },
    { input: '책을 건넨다.', output: '"고마워요." 그녀가 미소짓는다.' },
  ],
  shortcuts: [{ label: '둘러보기', command: '주변을 둘러본다.' }],
  startSettings: [startSetting],
};

const statValues: StatValues = { 호감도: 35, 신뢰: 12 };

describe('buildStoryPrompt (#45)', () => {
  it('systemInstruction에 storyInfo와 startSituation 원문이 포함된다', () => {
    const { systemInstruction } = buildStoryPrompt(story, startSetting, statValues);
    expect(systemInstruction).toContain(story.storyInfo);
    expect(systemInstruction).toContain(startSetting.startSituation);
  });

  it('systemInstruction에 promptTemplateId가 있으면 표기된다', () => {
    const { systemInstruction } = buildStoryPrompt(story, startSetting, statValues);
    expect(systemInstruction).toContain('tpl-romance-1');
  });

  it('systemInstruction에 각 스탯명과 현재값이 "이름: 값/최대" 형태로 주입된다', () => {
    const { systemInstruction } = buildStoryPrompt(story, startSetting, statValues);
    expect(systemInstruction).toContain('현재 상태');
    expect(systemInstruction).toContain('호감도: 35/100');
    expect(systemInstruction).toContain('신뢰: 12/100');
  });

  it('statValues에 없는 스탯은 initialValue로 폴백 표기된다', () => {
    const partial: StatValues = { 호감도: 50 };
    const { systemInstruction } = buildStoryPrompt(story, startSetting, partial);
    expect(systemInstruction).toContain('호감도: 50/100');
    // 신뢰는 statValues에 없으므로 initialValue(12)로 표기
    expect(systemInstruction).toContain('신뢰: 12/100');
  });

  it('delta 출력 지시 블록이 존재한다(statDeltas를 내야 한다는 실제 지시 텍스트)', () => {
    const { systemInstruction } = buildStoryPrompt(story, startSetting, statValues);
    // 단순히 키워드 존재가 아니라, 모델에게 구조화 출력을 시키는 지시 텍스트를 단언(l_2026_06_18_x).
    expect(systemInstruction).toContain('## 응답 형식');
    expect(systemInstruction).toContain('statDeltas');
    // 보안 핵심: 정의된 스탯명만 허용하고 임의 스탯명을 금지한다는 지시(화이트리스트 prose 강제).
    expect(systemInstruction).toContain('임의 스탯명 금지');
    // 허용 스탯명이 지시 블록에 실제로 열거된다.
    expect(systemInstruction).toContain('호감도, 신뢰');
  });

  it('정의된 스탯이 없으면 statDeltas를 빈 객체로 두라는 지시가 나온다(빈 분기)', () => {
    const noStats: StartSettingDef = { ...startSetting, stats: [] };
    const { systemInstruction } = buildStoryPrompt(story, noStats, statValues);
    expect(systemInstruction).toContain('## 응답 형식');
    expect(systemInstruction).toContain('빈 객체로 둔다');
    // 스탯이 없으면 "## 현재 상태" 섹션도 등장하지 않는다.
    expect(systemInstruction).not.toContain('## 현재 상태');
  });

  it('fewShotMessages는 developmentExamples×2 길이로 user→model 교대하며 내용이 일치한다', () => {
    const { fewShotMessages } = buildStoryPrompt(story, startSetting, statValues);
    expect(fewShotMessages).toHaveLength(story.developmentExamples.length * 2);
    story.developmentExamples.forEach((ex, i) => {
      expect(fewShotMessages[i * 2]).toEqual({ role: 'user', content: ex.input });
      expect(fewShotMessages[i * 2 + 1]).toEqual({ role: 'model', content: ex.output });
    });
  });

  it('prologue/suggestedReplies/엔딩 resultText는 systemInstruction에 포함되지 않는다(UI가 소비)', () => {
    const { systemInstruction } = buildStoryPrompt(story, startSetting, statValues);
    expect(systemInstruction).not.toContain(startSetting.prologue);
    for (const reply of startSetting.suggestedReplies) {
      expect(systemInstruction).not.toContain(reply);
    }
    expect(systemInstruction).not.toContain('두 사람은 영원히 행복했다.');
  });

  it('developmentExamples 내용은 systemInstruction에 욱여넣지 않는다(few-shot 분리)', () => {
    const { systemInstruction } = buildStoryPrompt(story, startSetting, statValues);
    for (const ex of story.developmentExamples) {
      expect(systemInstruction).not.toContain(ex.input);
      expect(systemInstruction).not.toContain(ex.output);
    }
  });

  it('promptTemplateId가 없으면 템플릿 섹션이 없어도 정상 동작한다', () => {
    const noTpl: Story = { ...story, promptTemplateId: undefined };
    const { systemInstruction } = buildStoryPrompt(noTpl, startSetting, statValues);
    expect(systemInstruction).toContain(story.storyInfo);
    expect(systemInstruction.trim()).not.toBe('');
  });

  it('opts.matchedKeywords가 주어지면 systemInstruction에 주입된다', () => {
    const { systemInstruction } = buildStoryPrompt(story, startSetting, statValues, {
      matchedKeywords: ['숨겨진 지하서고는 위험하다'],
    });
    expect(systemInstruction).toContain('숨겨진 지하서고는 위험하다');
  });

  it('입력 객체를 변형하지 않는다 (순수 함수)', () => {
    const sIn = structuredClone(story);
    const ssIn = structuredClone(startSetting);
    const svIn = structuredClone(statValues);
    buildStoryPrompt(sIn, ssIn, svIn);
    expect(sIn).toEqual(story);
    expect(ssIn).toEqual(startSetting);
    expect(svIn).toEqual(statValues);
  });
});

describe('buildStoryResponseSchema (#45)', () => {
  it('reply 필드가 STRING 타입으로 존재한다', () => {
    const schema = buildStoryResponseSchema(startSetting) as Record<string, any>;
    expect(schema.type).toBe('OBJECT');
    expect(schema.properties.reply).toBeDefined();
    expect(schema.properties.reply.type).toBe('STRING');
  });

  it('statDeltas는 OBJECT이며 정의된 스탯명만 NUMBER 프로퍼티로 화이트리스트된다', () => {
    const schema = buildStoryResponseSchema(startSetting) as Record<string, any>;
    const statDeltas = schema.properties.statDeltas;
    expect(statDeltas.type).toBe('OBJECT');
    expect(Object.keys(statDeltas.properties).sort()).toEqual(['신뢰', '호감도']);
    expect(statDeltas.properties['호감도'].type).toBe('NUMBER');
    expect(statDeltas.properties['신뢰'].type).toBe('NUMBER');
  });

  it('정의되지 않은 스탯명은 statDeltas 스키마에 등장하지 않는다', () => {
    const schema = buildStoryResponseSchema(startSetting) as Record<string, any>;
    const statDeltas = schema.properties.statDeltas;
    expect(statDeltas.properties['용기']).toBeUndefined();
    expect(statDeltas.properties['적개심']).toBeUndefined();
  });

  it('스탯이 다른 startSetting이면 화이트리스트도 그에 맞춰 달라진다', () => {
    const other: StartSettingDef = {
      ...startSetting,
      stats: [{ name: '용기', initialValue: 0, minValue: 0, maxValue: 50 }],
    };
    const schema = buildStoryResponseSchema(other) as Record<string, any>;
    expect(Object.keys(schema.properties.statDeltas.properties)).toEqual(['용기']);
    expect(schema.properties.statDeltas.properties['호감도']).toBeUndefined();
  });

  it('reply는 required에 포함된다', () => {
    const schema = buildStoryResponseSchema(startSetting) as Record<string, any>;
    expect(schema.required).toContain('reply');
  });

  it('STORY_RESPONSE_SCHEMA 베이스 상수는 reply STRING + statDeltas OBJECT 골격을 가진다', () => {
    const base = STORY_RESPONSE_SCHEMA as Record<string, any>;
    expect(base.type).toBe('OBJECT');
    expect(base.properties.reply.type).toBe('STRING');
    expect(base.properties.statDeltas.type).toBe('OBJECT');
  });
});
