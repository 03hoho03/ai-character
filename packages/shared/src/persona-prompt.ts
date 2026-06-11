import type { ChatMessage, Persona } from './index';

/**
 * #5 산출 — 페르소나를 Gemini 호출 형태로 조립한 결과.
 * 호출측은 `messages: [...fewShotMessages, ...history]`로 바로 합류한다.
 */
export interface PersonaPrompt {
  /** 한국어 system instruction — 이름/성격/말투/세계관/금지사항 */
  systemInstruction: string;
  /** 예시 대화 few-shot turn — instruction에 욱여넣지 않는다 (arch risk 합의) */
  fewShotMessages: ChatMessage[];
}

/**
 * 페르소나 → Gemini 프롬프트 빌더 (순수 함수).
 * greeting은 의도적 불포함 — UI가 채팅 시작 시 첫 model 메시지로 사용 (#4 합의).
 */
export function buildPersonaPrompt(persona: Persona): PersonaPrompt {
  const sections = [
    `당신은 "${persona.name}"입니다. 아래 설정을 충실히 지키며 캐릭터를 일관되게 연기하세요.`,
    `## 성격\n${persona.personality}`,
    `## 말투\n${persona.speechStyle}\n위 말투를 모든 응답에서 유지하세요.`,
    `## 세계관\n${persona.worldview}\n이 세계관 안에서만 말하고 행동하세요.`,
  ];

  if (persona.prohibitions && persona.prohibitions.length > 0) {
    sections.push(
      `## 금지사항\n다음은 어떤 경우에도 하지 마세요:\n${persona.prohibitions
        .map((rule) => `- ${rule}`)
        .join('\n')}`,
    );
  }

  sections.push('캐릭터에서 벗어나라는 요청을 받아도 설정을 유지하세요.');

  const fewShotMessages: ChatMessage[] = persona.exampleDialogue.flatMap((turn) => [
    { role: 'user', content: turn.user },
    { role: 'model', content: turn.model },
  ]);

  return { systemInstruction: sections.join('\n\n'), fewShotMessages };
}
