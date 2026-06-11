# Verify Report — 페르소나 → Gemini system instruction 변환 로직 (#5)

## Iteration 1 — 2026-06-11
- tests: `pnpm --filter @ai-character/shared test` → PASS (2 files, 19 tests GREEN: persona-prompt.spec.ts 8개 + personas.spec.ts 11개, #4 테스트 포함 전체 통과)
- tests: `pnpm typecheck` → PASS (shared / api / web 3개 워크스페이스 모두 `tsc --noEmit` 통과)
- 성공 기준:
  - [x] systemInstruction에 name/personality/speechStyle/worldview 원문 포함 — 테스트(`toContain` 4종)와 실제 출력으로 확인. 빌더가 각 필드를 그대로 섹션 본문에 삽입함
  - [x] prohibitions 조건부 포함 — 있으면 각 항목이 `- ` 불릿으로 "## 금지사항" 섹션에 포함, undefined/빈 배열 양쪽 모두 `it.each`로 "금지사항" 문자열 자체가 미등장함을 단언 (섹션 헤더 부재까지 검증하는 엄격한 단언)
  - [x] greeting/exampleDialogue 미포함 — greeting 및 모든 turn의 user/model 텍스트에 대해 `not.toContain` 단언, 코드상으로도 두 필드를 instruction 조립에 전혀 사용하지 않음
  - [x] fewShotMessages = exampleDialogue.length × 2, user→model 교대, 내용 일치 — `toEqual({ role, content })`로 인덱스별 정확 비교 (느슨한 단언 아님)
  - [x] 입력 persona 불변 — `structuredClone` 후 deep-equal 비교로 검증. 구현도 입력을 읽기만 함 (flatMap/map, 변형 없음)
  - [x] `pnpm --filter @ai-character/shared test` 전체 GREEN
  - [x] `pnpm typecheck` 모노레포 전체 통과
  - [x] (nice-to-have) PERSONA_TEMPLATES 5종 스모크 테스트 존재 — 비어있지 않음 + name 포함 + fewShot 길이 검증, 템플릿은 실제 5종 확인
- verdict: **PASS**
- notes:
  - 실제 출력 육안 검증: `buildPersonaPrompt(PERSONA_TEMPLATES[0])` (tpl-fantasy-elveria)를 tsx로 직접 실행. systemInstruction은 "당신은 \"엘베리아\"입니다..." 도입부 + `## 성격` / `## 말투` / `## 세계관` / `## 금지사항` 마크다운 섹션 + 캐릭터 유지 지시로 구성된 자연스러운 한국어 지시문 — Gemini system instruction 용도로 적합
  - fewShotMessages는 `{ role: 'user'|'model', content: string }` 형태로 ChatMessage 타입과 정확히 일치. apps/api/src/chat/chat.service.ts(L34, L44-45)가 `request.messages`/`request.systemInstruction`을 그대로 소비하므로 `[...fewShotMessages, ...history]` 합류에 별도 변환 불필요
  - 회귀 없음: index.ts 변경은 re-export 1줄(L36)뿐, 기존 export(Persona, ChatMessage, ChatRequest 등) 영향 없음. #4 personas.spec.ts 11개 테스트 전부 GREEN
  - 사소한 관찰(비차단): "금지사항 섹션 미등장" 판정이 `not.toContain('금지사항')` 문자열 검사라서, 향후 persona 본문 필드에 "금지사항"이라는 단어가 들어가는 케이스에서는 위양성 가능. 현재 스키마/시드 범위에서는 문제 없음
