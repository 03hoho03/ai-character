# 페르소나 → Gemini system instruction 변환 로직 (#5)

## 목적 / Why
#4 페르소나 스키마를 Gemini가 일관되게 연기하도록 프롬프트로 조립하는 접착제.
이게 없으면 템플릿은 장식이고 챗봇은 Gemini 기본 응답이다.

## 요구사항

### Must
- `packages/shared`에 순수 함수 `buildPersonaPrompt(persona: Persona): PersonaPrompt` 추가
- 반환 타입 `PersonaPrompt`:
  - `systemInstruction: string` — 한국어 지시문. 이름·성격·말투·세계관 반영, `prohibitions` 있으면 금지사항 섹션 포함
  - `fewShotMessages: ChatMessage[]` — `exampleDialogue`를 user/model 교대 turn으로 평탄화 (arch risk 합의: 예시 대화는 instruction 텍스트에 넣지 않음)
- `greeting`은 systemInstruction에 **불포함** (#4 스키마 합의: UI가 채팅 시작 시 첫 model 메시지로 사용)
- 호출측 사용법: `messages: [...fewShotMessages, ...history]` — 별도 변환 없이 ChatRequest에 바로 합류 가능한 형태
- 순수 함수 — 입력 persona를 변형하지 않음
- 단위 테스트 (#4에서 구축한 shared vitest 인프라 재사용)

### Nice-to-have
- `PERSONA_TEMPLATES` 5종 전체에 대해 빌더가 비정상 출력 없이 동작하는 스모크 테스트

## 성공 기준 (검증 가능)
- [ ] `systemInstruction`에 persona의 `name`/`personality`/`speechStyle`/`worldview` 원문이 모두 포함된다
- [ ] `prohibitions`가 있으면 각 항목이 `systemInstruction`에 포함되고, 없으면(undefined 또는 빈 배열) 금지사항 섹션 자체가 등장하지 않는다
- [ ] `greeting`과 `exampleDialogue` 내용은 `systemInstruction`에 포함되지 않는다
- [ ] `fewShotMessages`는 길이가 `exampleDialogue.length × 2`이고, user→model 역할이 교대하며, 내용이 원본 turn 쌍과 일치한다
- [ ] 함수 호출 후 입력 persona 객체가 변형되지 않는다
- [ ] `pnpm --filter @ai-character/shared test` 통과 (기존 #4 테스트 포함 전체 GREEN)
- [ ] `pnpm typecheck` (모노레포 전체) 통과
