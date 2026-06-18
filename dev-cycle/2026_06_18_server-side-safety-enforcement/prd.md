# 안전 집행 — 서버측 instruction 재조립 (클라 신뢰 부채 해소) · #23 (#19 1/2)

## 목적 / Why
현재 systemInstruction(prohibitions 포함)은 클라이언트(`useChatStream` → `buildPersonaPrompt`)에서 조립돼 서버로 전달되고 `chat.service`가 **무검증 신뢰**한다. 악의적 클라가 prohibitions를 빼거나 instruction을 통째로 바꿔 캐릭터 설정·금지사항을 우회할 수 있다. 공개 발견(#17)으로 노출이 늘기 전, **서버가 신뢰 소스에서 프롬프트를 재조립**해 이 우회 통로를 차단한다.

## 접근 (사용자 결정)
**A. 전면 서버 재조립** + `/chat`·`/chat/stream` 양 경로 + safetySettings 보강.
클라는 `personaId`만 보내고, 서버가 신뢰 소스에서 persona를 조회해 프롬프트를 만든다.

## 요구사항
### Must
- **계약 변경** (`shared.ChatRequest` + `ChatRequestDto`):
  - 추가: `personaId: string`(필수), `browserId: string`(필수)
  - 제거: `systemInstruction` — 서버가 빌드. 전역 `ValidationPipe({whitelist:true})`가 클라가 보낸 잔여 `systemInstruction`을 자동 strip(집행의 지렛대)
  - 유지: `messages`(실제 대화 history), `conversationSummary?`
- **신뢰 소스 persona 조회** (서버):
  - `tpl-*` id → shared `PERSONA_TEMPLATES`에서 조회
  - 그 외(`usr-*`) → `CharactersService.getOne(id, browserId)` (소유자거나 공개면 반환, 아니면 404 — 기존 #16 규약 재사용)
  - 미존재 → 404
- **서버측 프롬프트 조립**: 조회한 신뢰 persona로 `buildPersonaPrompt(persona)` 서버 실행 → `systemInstruction`(+ `conversationSummary` 블록 접합 유지) + `fewShotMessages`를 contents 앞에 prepend. 클라가 보낸 어떤 instruction도 사용하지 않음.
- **양 경로 적용**: 비스트리밍 `POST /chat`, 스트리밍 `POST /chat/stream` 모두 동일 집행.
- **safetySettings 보강**: Gemini 호출(`generateContent`/`generateContentStream`) config에 서버 제어 safetySettings 상수 적용(클라 영향 불가). 성인/일반 등급별 차등은 #26(19b)로 분리 — 여기서는 비성인 유해 카테고리 baseline.
- **클라 전환**(`useChatStream`): body를 `{ personaId, browserId, messages: assembled, conversationSummary? }`로. `buildPersonaPrompt`/`systemInstruction`/`fewShotMessages` 전송 제거.
- safety-block(#13) error event 규약 정합 유지(기존 `isSafetyBlocked` 경로 보존).

### Nice-to-have
- Character row → Persona 매핑 헬퍼(작은 순수 함수)로 단위 테스트 용이화.

## 비목표 (이번 #23 제외)
- 성인/일반 등급 컬럼·필터(#26/19b), 태그·카테고리(#25)
- prohibitions 문구 작성/검수, rate limiting, 별도 응답 후처리 필터

## 성공 기준 (검증 가능)
- [ ] `ChatRequestDto`에서 `systemInstruction` 제거 → 클라가 `systemInstruction`을 함께 보내도 whitelist로 strip되어 서버가 무시함을 **HTTP 레벨 테스트**가 단언
- [ ] 클라가 prohibitions를 누락/조작해도, 서버가 신뢰 persona의 prohibitions를 포함한 systemInstruction으로 Gemini를 호출함을 서비스 단위 테스트가 단언(`tpl-*` + `usr-*` 양쪽)
- [ ] `personaId`/`browserId` 누락 → 400, 미존재/비공개 타인 persona → 404 (HTTP 레벨)
- [ ] `generateContent`·`generateContentStream` 호출 config에 safetySettings가 포함됨을 단언
- [ ] 클라 `useChatStream`이 새 계약(personaId/browserId, fewShot/systemInstruction 미전송)으로 전송함을 web 테스트가 단언
- [ ] 기존 chat/chat-stream/conversations 회귀 없음 (api 전체 + web 전체 green)
- [ ] **신규/변경 엔드포인트는 controller/HTTP 레벨 테스트 동반** (lesson l_2026_06_14_y_endpoint_http_test_gap)
