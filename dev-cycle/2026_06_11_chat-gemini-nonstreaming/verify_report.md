# Verify Report — [#2a] 비스트리밍 POST /chat (#11)

## Phase 2 note — Test First
jest + supertest 인프라를 이 ticket에서 도입 (api 첫 테스트). HTTP 계약 테스트는
TestingModule 기반이라 포트 비점유 — lesson x_dev_server_check_side_effects 회피 설계.

RED 실행 결과 (로그 원문 인용 — lesson w_red_summary_overclaim 적용):
- `Test Suites: 2 failed, 2 total / Tests: 4 failed, 1 passed, 5 total`
- 공허 PASS 점검 (lesson x_vacuous_red_baseline 적용): PASS 1건은 `/health 회귀 없음 → 200`
  — 기존 기능 회귀 가드의 정당한 GREEN, 공허 PASS 아님. service suite는 모듈 부재로
  컴파일 실패(7개 테스트 미실행 상태에서 suite FAIL) — 정상 RED.

## Iteration 1 — 2026-06-11
- tests: `pnpm --filter @ai-character/api test` → `Test Suites: 2 passed, 2 total` / `Tests: 12 passed, 12 total`
- 성공 기준:
  - [x] api 단위 테스트 전부 통과 (mocked SDK) — 12/12, FAIL 0
  - [x] `pnpm -r typecheck` && `pnpm -r build` 통과 — 회귀 없음
  - [x] 키 미설정 런타임 POST /chat 유효 body → 503 + 키 안내 (verifier가 실제 dist 기동, PID 기록·정리, 기동 전 :4000 비점유 확인)
  - [x] 잘못된 body → 400 (빈 messages / 잘못된 role 모두)
  - [x] Chat DTO `@ai-character/shared` 단일 출처 (api는 implements로 소비)
- verdict: **PASS**
- notes (verifier):
  - 테스트 품질: http 테스트는 실제 AppModule(실 ValidationPipe + GENAI_CLIENT factory null 경로) 통과 — mock 과다 우회 없음, 공허 PASS 없음.
  - 보안: 키는 factory에서만 읽고 응답/로그 비노출. 업스트림 에러 원문은 logger로만, 응답은 안전 메시지. .env 미추적.
  - 관찰 (차단 아님): Promise.race 타임아웃은 504 응답 후 underlying 요청을 abort하지 않음 → **#13에서 AbortSignal 고려**.

## 수동 확인 잔여 항목 (Phase 0 합의로 검증 제외)
실키 e2e: https://aistudio.google.com/apikey 에서 키 발급 →
`apps/api/.env`에 `GEMINI_API_KEY=<키>` 기입 → `pnpm dev` →
`curl -X POST localhost:4000/chat -H 'Content-Type: application/json' -d '{"systemInstruction":"너는 마법사다.","messages":[{"role":"user","content":"안녕"}]}'`
→ 200 + `{"message":{"role":"model","content":"..."}}` 확인.
