# verify_report — SSE 에러 이벤트 규약 (#13)

## Iteration 1 — 2026-06-12
- tests:
  - `pnpm --filter @ai-character/shared test` → PASS (3 files, 30 tests — chat-stream.spec 11개에 #13 4개 포함)
  - `cd apps/api && npx jest` → PASS (4 suites, 25 tests — 기존 #2a/#12 테스트 회귀 없음)
  - `pnpm typecheck` → PASS (shared/api/web 모두 clean)
- 성공 기준:
  - [x] shared: `ChatStreamEvent`에 error variant + `ChatStreamErrorCode` export, serializer가 `event: error` wire 직렬화 — `chat-stream.ts:4,12-21`, `index.ts:40`에서 export 확인. 테스트(`chat-stream.spec.ts:102-106`)가 wire 문자열을 정확히(exact string) 검증.
  - [x] `parseChatStream` error 복원 + 미지 code → `upstream_error` 강등 — `chat-stream.ts:77-83`. vitest 테스트 존재: 복원(spec:108-111), 강등(spec:113-118), message 비문자열 블록 무시(spec:120-123). 강등 로직은 known-list(`ERROR_CODES`) 화이트리스트 방식으로 정확. non-string code도 강등되는데 이는 PRD("그 외 문자열이면")보다 넓지만 안전한 방향.
  - [x] api: SAFETY chunk → `{type:'error', code:'safety_block'}` 후 done 없음 — `chat.service.ts:95-102` yield 후 `return`으로 종결. jest 테스트(chat-stream.service.spec.ts:96-109)가 이벤트 배열 전체를 `toEqual`로 비교하므로 done 부재까지 실제 검증됨. `promptFeedback.blockReason` 분기도 별도 테스트(spec:111-122).
  - [x] api: 30초 무응답 → `{type:'error', code:'timeout'}` — `withTimeout(upstream.next())`(service:91)로 chunk 간 idle 타이머가 매 next마다 재설정됨(PRD의 idle 의미와 일치). fake timer 테스트(spec:124-139)가 `advanceTimersByTimeAsync(30_000)`으로 검증.
  - [x] api: iteration throw → `{type:'error', code:'upstream_error'}` — service:109-117 catch. 테스트(spec:141-154)가 delta 이후 error만 오고 done 없음을 검증.
  - [x] api: 텍스트 0자 정상 종료 → 빈 done 대신 `upstream_error` — service:120-128 (`!full` 가드). 테스트(spec:156-164)가 `[undefined, '']` chunk로 검증, done 부재 포함.
  - [x] 기존 테스트 전부 PASS — 위 3개 커맨드 모두 green. 비스트리밍 `chat()` 경로는 diff상 변경 없음(withTimeout은 #2a부터 존재, 재사용만 함).
- verdict: **PASS**
- notes:
  - **error 종결성 확인**: 세 에러 경로(safety/catch/빈응답) 모두 yield 직후 `return` — error 뒤 delta/done이 새는 경로 없음. 컨트롤러 backstop과의 이중 송출도 불가: service가 iteration 에러를 전부 흡수해 generator가 정상 종료되므로 controller catch(controller.ts:49-60)에 도달하는 건 serialize/`res.write` 자체 실패뿐이고, 그 경우에도 `writableEnded` 가드가 있다.
  - **(비차단) 타임아웃 시 업스트림 정리의 간접성**: service:113의 `upstream.return(undefined)`은 async generator 의미론상 pending `next()` 뒤에 큐잉되므로, 무응답 중인 업스트림을 즉시 중단하지 못한다. 실제 abort는 컨트롤러 경로에서만 일어난다 — error 이벤트 후 `res.end()` → res `'close'` → `abort.abort()` → `generateContentStream`에 전달된 `abortSignal`로 SDK fetch 중단. end-to-end로는 정리되지만, PRD Must의 "업스트림 abort"를 직접 검증하는 테스트는 없다. service 단독 사용 시(컨트롤러 없이) 누수 가능성이 남는다. 개선안: 타임아웃용 내부 AbortController를 service가 직접 들고 `generateContentStream`의 signal과 합치기(AbortSignal.any).
  - **(비차단) 초기 연결 hang 미커버**: `generateContentStream(...)` 자체의 await(service:68, SSE 헤더 송출 전)에는 withTimeout이 없어 응답 헤더 수신 전 hang 시 무한 대기. 이 단계는 일반 HTTP 에러로 떨어질 수 있는 위치라 withTimeout으로 감싸면 504로 처리 가능.
  - **(비차단) 클라이언트 disconnect 시 로그 소음**: 클라이언트가 끊으면 SDK abort 에러가 service catch에 잡혀 `upstream_error` 이벤트를 yield하고 ERROR 로그를 남긴다. 컨트롤러의 `abort.signal.aborted` 체크 덕에 wire로 안 나가지만, 사용자 이탈이 에러 로그로 집계된다. abort 에러는 catch에서 조용히 return하는 게 깔끔.
  - **보안 확인**: 업스트림 에러 원문(`err.stack`)은 로그로만 가고, 이벤트 message는 전부 하드코딩된 안전 문구 — 누출 없음. 컨트롤러 backstop도 동일.
  - **(사소) e2e wire 레벨 error 이벤트 테스트 부재**: HTTP 계약 테스트(chat-stream.http.spec.ts)에는 error 이벤트 케이스가 없고 서비스 단위 테스트만 있다. serializer는 shared에서 단위 검증되므로 조합 리스크는 낮음. PRD 요구 범위는 충족.
