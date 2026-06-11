# Verify Report — [#2b] SSE 스트리밍 전환 (#12)

## Iteration 1 — 2026-06-11
- tests:
  - `cd apps/api && npx jest` → **PASS** (4 suites, 20 tests — 기존 #2a `chat.service.spec.ts`/`chat.http.spec.ts` 회귀 포함 GREEN. 로그의 "401 API key not valid" ERROR는 기존 #2a 에러-경로 테스트의 의도된 로그이며 테스트는 PASS)
  - `pnpm --filter @ai-character/shared test` → **PASS** (3 files, 26 tests = 기존 19 + 신규 chat-stream 7)
  - `pnpm typecheck` (모노레포 전체) → **PASS** (shared / api / web 모두 GREEN)
- 성공 기준:
  - [x] `POST /chat/stream`이 mock Gemini 스트림(chunk 2개) 기준 `delta`×2 → `done` 순서의 SSE를 `text/event-stream`으로 송출 — `apps/api/test/chat-stream.http.spec.ts` 첫 테스트가 실제 HTTP 응답 status 200 + Content-Type 검증
  - [x] `done.message.content` = 모든 chunk 합산 — 서비스 단위(`chat-stream.service.spec.ts`, undefined/빈 chunk 스킵 포함) + HTTP 계약 양쪽에서 검증 ('안녕'+'하세요' → '안녕하세요')
  - [x] 클라이언트 연결 중단 → 업스트림 AbortSignal aborted — **순환 mock 아님 확인**: 테스트는 ephemeral port에 실제 listen 후 raw `http.request`로 첫 chunk 수신 시 `req.destroy()` → 실제 Express `res 'close'` 이벤트 → controller의 `abort.abort()` → `generateContentStream`에 실제로 전달된 `config.abortSignal`을 캡처해 aborted 폴링 확인. mock은 signal을 캡처만 하고 스스로 abort하지 않음. 코드 경로도 실재: `chat.controller.ts:33-37` (`res.once('close', ...)` → `chatStream(body, abort.signal)`) → `chat.service.ts:75` (`config.abortSignal`). 실제 Gemini SDK가 abortSignal로 HTTP를 취소하는지는 SDK 계약에 위임 (PRD 기준 "전달된 AbortSignal이 aborted 상태" 충족)
  - [x] `parseChatStream` chunk 경계 견고성 — 분할 지점을 직접 계산해 의미 있는 분할임을 확인:
    - 문자열 cut [0,5)/(5,30)/(30,31)/(31,…): `'event'` / `': delta\ndata: {"text":"안녕'` / `'"'` — event 라인 중간 + JSON 문자열 중간 분할 맞음
    - `byteStreamOf(wire, 3)`: byte 27-30 = `[0x22, 0xEC, 0x95]` — '안'(3바이트)의 1·2번째 바이트가 chunk 경계로 갈라짐(진짜 멀티바이트 분할). 또한 두 번째 이벤트의 `\n\n` 구분자(byte 77-78)도 chunk 경계(75-78/78-81)에 걸쳐 분할됨
    - 다중 이벤트 단일 chunk, 알 수 없는 event 무시(#13 forward-compat)도 커버
  - [x] `/chat/stream` 키 미설정 503 / 빈 messages 400 — 503은 `requireClient()`가 `await this.chatService.chatStream(...)` 시점(= `setHeader`/`flushHeaders` 이전, `chat.controller.ts:37` vs 39-42)에 throw되어 Nest exception filter가 일반 JSON HTTP 에러로 응답. 테스트가 503 status + body의 'GEMINI_API_KEY' 문자열 확인. 400은 ValidationPipe가 핸들러 진입 전 차단
  - [x] 기존 `POST /chat` 무변경 — git diff 직접 검토: `requireClient`/`toContents` 추출은 인라인 코드와 1:1 의미 동일 (503 메시지, contents 매핑, systemInstruction 조건부 spread, withTimeout 모두 보존). 기존 #2a jest 테스트 전부 GREEN
  - [x] `pnpm --filter @ai-character/shared test` GREEN (기존 19개 포함, 총 26)
  - [x] `pnpm typecheck` 모노레포 전체 GREEN
  - [x] (nice-to-have) 라운드트립 — HTTP 테스트가 실제 SSE 응답 본문을 shared `parseChatStream`으로 복원해 이벤트 배열 비교
- verdict: **PASS**
- notes:
  - SSE wire format 표준 부합: `event: <type>\ndata: <json>\n\n` — named event + 단일 data 라인 + 빈 줄 구분, serializer가 송출/파서 테스트의 단일 출처로 사용됨
  - 리소스: `res.once('close')`라 리스너 누수 없음. 단 'close'는 정상 종료 후에도 발화 → 완료 후 `abort.abort()` 호출되나 스트림이 이미 끝난 뒤라 무해한 no-op
  - 사소(비차단) 1: `parseChatStream`에서 소비자가 조기 break 시 `reader.releaseLock()`만 하고 `stream.cancel()`은 안 함 — fetch 연결이 즉시 닫히지 않을 수 있음. #3 소비 측에서 fetch AbortController로 끊으면 무관하므로 차단 사유 아님
  - 사소 2: 스트림 종료 시 `decoder.decode()` 최종 flush 생략 — 마지막 `\n\n` 이후의 불완전 잔여 바이트만 영향이며 어차피 파싱 불가 데이터라 실질 영향 없음
  - 사소 3: `apps/api/package.json` 파일 끝 개행 없음 (cosmetic)
  - working tree의 `app.controller.ts`, `apps/web/src/app/page.tsx` 변경은 이전 dev-cycle(#4/#5 persona) 소산으로 본 변경과 무관, 회귀 없음
  - CORS는 `main.ts`의 기존 `origin: http://localhost:3000` 그대로 — /chat/stream에도 동일 적용, 변경/이슈 없음
