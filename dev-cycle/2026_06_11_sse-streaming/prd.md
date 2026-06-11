# [#2b] SSE 스트리밍 전환 (#12)

## 목적 / Why
실시간 대화 체감 품질의 핵심. #2a 비스트리밍 e2e 위에 스트리밍 경로를 추가하고,
가장 까다로운 프론트 SSE 파싱 로직까지 이번에 해소해 #3의 부담을 낮춘다.

## 요구사항

### Must
- **이벤트 규약** (`packages/shared`): SSE named event 2종 — 에러 이벤트는 #13에서 확장
  - `event: delta` / `data: {"text": "<증분>"}`
  - `event: done` / `data: {"message": {"role":"model","content":"<완성본>"}}`
  - 타입 `ChatStreamEvent = { type: 'delta'; text: string } | { type: 'done'; message: ChatMessage }`
- **API** (`apps/api`): `POST /chat/stream` 신설 — body는 기존 `ChatRequestDto` 재사용
  - `generateContentStream`으로 Gemini 호출, chunk → `delta` 이벤트 변환
  - 스트림 종료 시 합산 전체 텍스트를 담은 `done` 이벤트 송출
  - `Content-Type: text/event-stream` 응답
  - 클라이언트 연결 중단 시 업스트림 Gemini 호출 abort (AbortController)
  - 기존 규약 유지: GEMINI_API_KEY 미설정 → 503, body 검증 실패 → 400
  - **기존 `POST /chat` 비스트리밍 경로 무변경**
- **파서 유틸** (`packages/shared`): `parseChatStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<ChatStreamEvent>`
  - fetch `response.body`를 바로 넘기는 프레임워크 무관 유틸 (#3이 import만 하면 됨)
  - 이벤트가 임의 chunk 경계에서 잘려 도착해도 정상 파싱
- 단위 테스트: shared(vitest) 파서 + api(jest) 스트리밍 서비스/HTTP

### Nice-to-have
- 라운드트립 테스트: `/chat/stream`의 실제 SSE 응답 본문을 shared 파서로 파싱해 이벤트 복원

## 성공 기준 (검증 가능)
- [ ] `POST /chat/stream`이 mock Gemini 스트림(chunk 2개 이상) 기준 `delta` × N → `done` 순서의 SSE를 `text/event-stream`으로 송출한다
- [ ] `done` 이벤트의 `message.content`가 모든 chunk 텍스트의 합산과 일치한다
- [ ] 클라이언트 연결이 중단되면 Gemini 업스트림에 전달된 AbortSignal이 aborted 상태가 된다 (테스트로 확인)
- [ ] `parseChatStream`이 이벤트 중간에서 잘린 chunk 시퀀스도 올바른 `ChatStreamEvent` 배열로 복원한다
- [ ] `/chat/stream`: 키 미설정 503, 빈 messages 400 (기존 `/chat`과 동일 규약)
- [ ] 기존 `POST /chat` 동작·테스트 무변경 (api jest 전체 GREEN)
- [ ] `pnpm --filter @ai-character/shared test` GREEN (기존 19개 포함)
- [ ] `pnpm typecheck` (모노레포 전체) GREEN
