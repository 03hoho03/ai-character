# SSE 에러 이벤트 규약 — 에러/타임아웃/safety-block (#13)

## 목적 / Why
#2b의 SSE 스트리밍은 정상 경로(delta/done)만 다루고, 중간 에러는 로그 후 연결을 끊는다.
프론트(#3)가 사용자에게 원인을 보여줄 수 있도록 에러를 SSE 이벤트로 규약화하고, shared 파서가 타입 안전하게 복원하도록 한다.

## 요구사항

### Must
- **이벤트 규약 (shared)**: `ChatStreamEvent` union에 단일 `error` variant 추가
  - `{ type: 'error'; code: ChatStreamErrorCode; message: string }`
  - `ChatStreamErrorCode = 'safety_block' | 'timeout' | 'upstream_error'` (export)
  - wire format: `event: error\ndata: {"code":"...","message":"..."}\n\n` (기존 serializer 규칙 그대로)
  - `error`는 **종결 이벤트**: 이후 `done`은 오지 않고 스트림이 닫힌다
- **파서 (shared `parseChatStream`)**: `error` 이벤트 파싱
  - `message`는 string 필수, `code`는 알려진 3종이면 그대로, 그 외 문자열이면 `upstream_error`로 강등 (forward-compat)
- **safety-block 감지 (api)**: 스트림 chunk에서
  - `candidates[0].finishReason === 'SAFETY'` 또는 `promptFeedback.blockReason` 존재 시
    → `error` 이벤트 (`code: 'safety_block'`) 송출 후 스트림 종료
  - 스트림이 텍스트 0자로 정상 종료된 경우(빈 응답)도 safety 미검출이면 `upstream_error`로 송출 (빈 `done`을 보내지 않음)
- **타임아웃 (api)**: chunk 간 무응답 30초(idle, 기존 `GEMINI_TIMEOUT_MS` 재사용) 초과 시
  → `error` 이벤트 (`code: 'timeout'`) 송출 후 스트림 종료, 업스트림 abort
- **업스트림 에러 (api)**: Gemini iteration 중 예외 발생 시
  → `error` 이벤트 (`code: 'upstream_error'`) 송출 후 스트림 종료 (원문은 로그로만, message에는 안전한 문구)
- **컨트롤러 backstop**: generator 밖에서 터진 예외도 가능하면 `error` 이벤트를 wire에 쓴 뒤 `res.end()`
- **테스트**: shared(vitest) — serializer/파서의 error 케이스, api(jest) — safety-block/timeout/업스트림 에러/빈 응답 각 시나리오 + 기존 테스트 회귀 없음

### Nice-to-have
- 이미 delta를 일부 송출한 뒤 에러가 난 경우에도 동일 규약 적용 (partial 텍스트는 프론트가 보존할지 #3에서 결정)

## 성공 기준 (검증 가능)
- [ ] `packages/shared`: `ChatStreamEvent`에 `error` variant + `ChatStreamErrorCode` export, `serializeChatStreamEvent`가 error 이벤트를 `event: error` wire로 직렬화
- [ ] `parseChatStream`이 error 이벤트를 복원하고, 미지의 code는 `upstream_error`로 강등 (vitest 테스트 존재)
- [ ] api: mock Gemini가 `finishReason: 'SAFETY'` chunk를 주면 `{type:'error', code:'safety_block'}` 이벤트가 송출되고 그 뒤 done 없음 (jest 테스트)
- [ ] api: mock Gemini가 30초(fake timer) 무응답이면 `{type:'error', code:'timeout'}` 송출 (jest 테스트)
- [ ] api: mock Gemini iteration이 throw하면 `{type:'error', code:'upstream_error'}` 송출 (jest 테스트)
- [ ] api: 텍스트 0자 정상 종료 시 빈 done 대신 `upstream_error` 송출 (jest 테스트)
- [ ] 기존 테스트 전부 PASS: `cd apps/api && npx jest`, `pnpm --filter @ai-character/shared test`, `pnpm typecheck`
