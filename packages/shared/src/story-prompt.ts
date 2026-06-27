/**
 * #45 스토리 모드 system instruction 빌더 (순수 함수).
 * buildPersonaPrompt(#5) 패턴의 확장 — 서버가 신뢰 소스(Story DB)에서 매 턴 재조립.
 * 신뢰 경계(CLAUDE.md #23): 클라가 보낸 instruction류는 주입하지 않는다. 여기 입력은 모두 서버 조회분.
 * 설계: docs/story-mode-design.md §4.1/4.2.
 */
import type { ChatMessage } from './index';
import type { StartSettingDef, StatValues, Story } from './story';

/**
 * #45 산출 — 스토리를 Gemini 호출 형태로 조립한 결과.
 * 호출측은 `messages: [...fewShotMessages, ...history]`로 합류한다(persona-prompt 선례).
 */
export interface StoryPrompt {
  /** 한국어 system instruction — 스토리정보/시작상황/현재 스탯/delta 출력 지시 */
  systemInstruction: string;
  /** 전개 예시 few-shot turn — instruction에 욱여넣지 않는다(persona-prompt arch 합의) */
  fewShotMessages: ChatMessage[];
}

/**
 * Gemini structured output 스키마의 최소 표현 타입.
 * shared는 @google/genai에 런타임 의존하지 않는다(번들/버전 결합 회피) — type 문자열은
 * @google/genai의 `Type` enum 값(OBJECT/STRING/NUMBER/INTEGER/...)과 동일하게 맞춰
 * #46b가 responseSchema로 그대로 주입할 수 있게 한다.
 */
export type StorySchemaType =
  | 'OBJECT'
  | 'STRING'
  | 'NUMBER'
  | 'INTEGER'
  | 'BOOLEAN'
  | 'ARRAY';

export interface StorySchema {
  type: StorySchemaType;
  description?: string;
  properties?: Record<string, StorySchema>;
  required?: string[];
  items?: StorySchema;
}

/**
 * 스토리 응답 스키마의 베이스 골격(스탯 화이트리스트 미적용).
 * 실제 주입에는 startSetting 기준 `buildStoryResponseSchema`를 쓴다 — statDeltas 키가 동적이므로.
 */
export const STORY_RESPONSE_SCHEMA: StorySchema = {
  type: 'OBJECT',
  properties: {
    reply: {
      type: 'STRING',
      description: '플레이어에게 보여줄 다음 전개(스토리 본문). 스탯 수치는 본문에 넣지 않는다.',
    },
    statDeltas: {
      type: 'OBJECT',
      description: '이번 턴의 스탯 변화량. 정의된 스탯명만 키로 허용한다.',
      properties: {},
    },
  },
  required: ['reply'],
};

/**
 * startSetting.stats 기준으로 responseSchema를 생성한다(스탯 키 동적).
 * statDeltas의 properties는 **정의된 스탯명만** NUMBER로 화이트리스트 — 모델이 임의 스탯명을
 * 만들지 못하게 막는다(§4.2 신뢰 경계). #46b가 이 객체를 Gemini responseSchema에 주입.
 */
export function buildStoryResponseSchema(startSetting: StartSettingDef): StorySchema {
  const statProps: Record<string, StorySchema> = {};
  for (const stat of startSetting.stats) {
    statProps[stat.name] = {
      type: 'NUMBER',
      description: `${stat.name}의 이번 턴 변화량(증감, 음수 가능). 범위 ${stat.minValue}~${stat.maxValue}로 서버가 clamp한다.`,
    };
  }

  return {
    type: 'OBJECT',
    properties: {
      reply: {
        type: 'STRING',
        description: '플레이어에게 보여줄 다음 전개(스토리 본문). 스탯 수치는 본문에 넣지 않는다.',
      },
      statDeltas: {
        type: 'OBJECT',
        description: '이번 턴의 스탯 변화량. 아래 정의된 스탯명만 키로 허용한다.',
        properties: statProps,
      },
    },
    required: ['reply'],
  };
}

/**
 * 스토리 → Gemini 프롬프트 빌더 (순수 함수).
 * prologue/suggestedReplies/엔딩 resultText는 의도적 불포함 — UI가 첫 메시지/추천답변/엔딩 표시에
 * 사용한다(persona-prompt greeting 선례). developmentExamples는 few-shot turn으로 분리.
 *
 * @param statValues 런타임 현재 스탯. 누락 키는 stat.initialValue로 폴백.
 * @param opts.matchedKeywords [후속 #?] 키워드북 매칭 노트(서버 스캔분). 주어지면 주입.
 */
export function buildStoryPrompt(
  story: Story,
  startSetting: StartSettingDef,
  statValues: StatValues,
  opts?: { matchedKeywords?: string[] },
): StoryPrompt {
  const sections: string[] = [];

  sections.push(
    `당신은 인터랙티브 픽션 "${story.name}"의 게임 마스터입니다. 아래 설정을 충실히 지키며 이야기를 일관되게 전개하세요.`,
  );

  if (story.promptTemplateId) {
    sections.push(`## 프롬프트 템플릿\n${story.promptTemplateId}`);
  }

  sections.push(`## 스토리 정보\n${story.storyInfo}`);

  sections.push(
    `## 시작 상황 (시작 설정: ${startSetting.name})\n${startSetting.startSituation}\n이 상황을 기점으로 이야기를 이어가세요.`,
  );

  // 현재 스탯 상태 주입 — "호감도: 35/100" 형태. 누락 키는 initialValue 폴백.
  const statLines = startSetting.stats.map((stat) => {
    const current = Object.prototype.hasOwnProperty.call(statValues, stat.name)
      ? statValues[stat.name]
      : stat.initialValue;
    return `${stat.name}: ${current}/${stat.maxValue}`;
  });
  if (statLines.length > 0) {
    sections.push(`## 현재 상태\n${statLines.join('\n')}`);
  }

  if (opts?.matchedKeywords && opts.matchedKeywords.length > 0) {
    sections.push(
      `## 참고 설정\n다음 정보는 현재 상황과 관련된 배경이다. 자연스럽게 반영하라:\n${opts.matchedKeywords
        .map((note) => `- ${note}`)
        .join('\n')}`,
    );
  }

  // 스탯 delta 출력 지시 (§4.2) — 정의된 스탯명만 statDeltas 키로 허용.
  const statNames = startSetting.stats.map((s) => s.name);
  const deltaInstruction = [
    '## 응답 형식',
    '응답은 반드시 구조화된 JSON으로 내라. `reply`에는 이야기 본문을, `statDeltas`에는 이번 턴 스탯 변화량을 담는다.',
    statNames.length > 0
      ? `statDeltas의 키는 다음 스탯명만 허용된다(그 외 임의 스탯명 금지): ${statNames.join(', ')}.`
      : 'statDeltas는 빈 객체로 둔다(정의된 스탯이 없다).',
    '변화가 없는 스탯은 생략하거나 0으로 둔다. 수치는 본문(reply)에 직접 쓰지 마라.',
  ].join('\n');
  sections.push(deltaInstruction);

  const fewShotMessages: ChatMessage[] = story.developmentExamples.flatMap((ex) => [
    { role: 'user', content: ex.input },
    { role: 'model', content: ex.output },
  ]);

  return { systemInstruction: sections.join('\n\n'), fewShotMessages };
}
