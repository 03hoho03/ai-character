# verify_report — 채팅 화면 UI (#3)

## Iteration 1 — 2026-06-12
- tests:
  - `pnpm --filter @ai-character/web test` → PASS (1 file, 7 tests — useChatStream.spec.ts)
  - `pnpm --filter @ai-character/shared test` → PASS (3 files, 30 tests)
  - `cd apps/api && npx jest` → PASS (4 suites, 25 tests — 회귀 없음)
  - `pnpm typecheck` → PASS (shared / web / api 모두 tsc --noEmit 통과)
  - `pnpm --filter @ai-character/web lint` → PASS (경고/에러 0)
- 브라우저 검증 (chrome-devtools MCP, api:4000 GEMINI_API_KEY 미설정 / web:3000):
  - `http://localhost:3000` → 템플릿 5종 링크 모두 노출 (엘베리아 / 김하루 / 서이안 / NOVA-7 / 장박사 → `/chat/tpl-*`) → OK
  - `/chat/tpl-fantasy-elveria` → greeting("아·실레나… 인간이 이 탑의 결계를 넘다니…")이 첫 캐릭터 메시지로 렌더, 이름(엘베리아) + 아바타 placeholder("엘") 표시, 입력 비어 있을 때 전송 버튼 disabled → OK
  - `/chat/없는-id` → Next 404 페이지, HTTP 상태 404 확인 → OK
  - 메시지 "안녕하세요!" 전송 → `POST /chat/stream` 503(키 미설정) → 에러 배너 "⚠ 응답이 중단되었습니다." + 재시도 버튼 노출, user 메시지는 목록에 보존 → OK
  - 재시도 클릭 → 두 번째 `POST /chat/stream` [503] 발생, 에러 배너 재노출, user 메시지 유지 → OK
  - 콘솔 → 503 리소스 로드 에러(의도된 시나리오) 외 치명적 에러 없음 → OK
  - 검증 후 양쪽 dev 서버 종료 확인 (포트 3000/4000 리스너 없음)
- 성공 기준:
  - [x] `/chat/tpl-fantasy-elveria` greeting 첫 캐릭터 메시지 + 존재하지 않는 id 404 — 코드(page.tsx `notFound()`) + 브라우저 모두 확인
  - [x] 훅 테스트: delta 누적 → done 시 model 메시지 확정 + streamingText null 해제 — spec "delta를 streamingText로 누적하고 done 시 메시지로 확정한다"가 실제로 검증
  - [x] 훅 테스트: error 이벤트 시 partial 보존 + `error.code` 노출 — spec에서 messages에 partial model 메시지 포함과 `{code:'timeout', ...}` 모두 단언
  - [x] 훅 테스트: streaming 중 send() 무시 — fetch 1회 + 두 번째 user 메시지 미추가 단언
  - [x] 훅 테스트: retry()가 마지막 user 메시지로 재요청 — 2번째 요청 body에서 실패 partial 제외·user 메시지가 마지막임을 단언, 성공 후 error 해제까지 확인
  - [x] 훅 테스트: 요청 body에 systemInstruction + fewShotMessages + greeting 포함 히스토리 — `buildPersonaPrompt` 결과와 직접 비교 단언
  - [x] 홈에 템플릿 5종 링크 — page.tsx가 `PERSONA_TEMPLATES.map`으로 렌더, 브라우저에서 5개 확인
  - [x] web test / typecheck / shared / api 테스트 전부 PASS
  - [x] 수동 검증(브라우저): 전송 → 에러 배너(503 유발) → 재시도 재요청 확인. 단, **실제 Gemini 스트리밍(delta 렌더→done 완료)은 API 키 부재로 미검증 — 사용자 수동 확인 필요**
- verdict: PASS
- notes:
  - **사용자 수동 확인 필요**: GEMINI_API_KEY 설정 후 실제 전송→스트리밍 partial 실시간 렌더→완료, SSE error 이벤트(code별 메시지: safety_block/timeout 등) 배너 노출. 이번 검증의 에러 경로는 HTTP 503(fetch throw → `upstream_error` 일반 메시지)으로만 유발됨.
  - 비차단 코드 리뷰 소견:
    - race/누수: `busyRef` 가드는 async run 본문이 첫 await 전까지 동기 실행되므로 동일 tick 이중 send도 차단됨. unmount 시 cleanup이 abort → reader.read() reject → `abort.signal.aborted` 체크 후 setState 없이 return — unmount 후 setState 누수 없음. AbortController는 완료 후 abort돼도 no-op이라 정리 누락 없음.
    - partial 보존은 #13 규약(error는 종결 이벤트, 이후 done 없음)과 일치 — done/error 없는 스트림 단절도 `upstream_error`로 수렴.
    - retry는 `findLastIndex`로 마지막 user까지 slice — user 메시지가 없으면(greeting만) no-op으로 안전. 실패 partial model 메시지는 재요청 히스토리에서 정상 제외.
    - XSS 안전: 메시지를 JSX 텍스트 노드로만 렌더(`{message.content}`), innerHTML/dangerouslySetInnerHTML 미사용.
    - (사소) 입력 state가 ChatScreen 최상위에 있어 키 입력마다 메시지 목록 전체가 리렌더됨. MessageBubble이 가벼워 현재 규모에서는 무해하나, 히스토리가 길어지면 `React.memo` 또는 입력 폼 분리 고려.
    - (사소) MessageBubble key가 배열 index — retry로 목록이 잘려도 stateless 컴포넌트라 실질 문제 없음.
    - (사소) `Array.prototype.findLastIndex`는 ES2023 — 최신 브라우저만 지원(Chrome 97+/Safari 15.4+). 타깃 정책상 문제 없으면 무시 가능.
    - (사소) unmount 중 abort 시나리오는 훅 테스트에 없음(코드 검토로만 확인).

## 후속 — 2026-06-13 (잔여 수동 확인 해소)
- GEMINI_API_KEY 설정 후 실제 Gemini 스트리밍 E2E 확인:
  - `curl -N POST /chat/stream` → `delta` 2건 → `done` 합산 메시지, #12/#13 wire 규약 그대로 송출 → OK
- Iteration 1의 "사용자 수동 확인 필요" 항목 해소됨 (API 레벨 검증 — 브라우저 delta 렌더는 훅 테스트 + 503 브라우저 검증으로 커버)
