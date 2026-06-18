# Verify Report — 답변 재생성 + 사용자 메시지 편집 (#18)

## Iteration 1 — 2026-06-14

독립 verifier sub-agent가 PRD 성공 기준에 대해 검증.

- tests:
  - `pnpm --filter @ai-character/api test` → **PASS** (6 suites, 50 passed; replaceMessages 서비스 테스트 4 포함).
  - `pnpm --filter @ai-character/api typecheck` → **PASS**.
  - `pnpm --filter @ai-character/web test` → **PASS** (7 files, 51 passed; useChatStream 16 / conversations-api 7 / chat-screen 3 포함).
  - `pnpm --filter @ai-character/web typecheck` → **PASS**.
  - `pnpm --filter @ai-character/shared typecheck` → **PASS**.

- 성공 기준:
  - [x] api test + typecheck 통과 (replaceMessages 서비스 테스트 포함)
  - [x] web test + typecheck 통과 (regenerate/editUser/replaceMessages/chat-screen 테스트 포함)
  - [x] replaceMessages (a) deleteMany로 비움 (b) 순서대로 nested create 재삽입 (c) 소유자 불일치 404 — $transaction 사용, 삭제→삽입 순서(invocationCallOrder)·404(트랜잭션 미실행) 단언
  - [x] shared ReplaceMessagesRequest export + ReplaceMessagesDto implements
  - [x] conversations-api.replaceMessages가 PUT으로 {browserId, messages} 전송 — 단언
  - [x] regenerate(마지막 user 기준 재실행+답변 대체) / editUser(편집 index 이후 truncate+재실행) — replace payload·재요청 history·최종 messages 단언
  - [x] chat-screen 재생성 버튼 + user 편집 UI 렌더/동작 (3 상호작용 테스트 green)

- 독립 검증 포인트:
  - 영속 정합/race: rerun이 `await persistence.replace(history.slice(1))`를 run 이전에 await → deleteMany+재삽입 완료 후 스트림 시작, 새 model은 done에서 append → replace가 새 append를 되살릴 race 없음. busyRef 가드로 직전 run 완료 후 진입.
  - 순서 보존: createdAt = base + i (ms 증가), restore는 createdAt asc → 입력 순서 보존.
  - 소유 가드: 불일치/부재 404(403 아님), findUnique 선행으로 미소유 시 $transaction 미호출.
  - greeting: replace(history.slice(1))로 index 0 제외.
  - editUser 가드: index 0(greeting)·model role·빈 공백·스트리밍 중 모두 거부. regenerate user turn 없으면 no-op.
  - DTO: 빈 messages([]) 허용(truncate-to-empty), ValidationPipe whitelist strip, nested @Type 변환.
  - 회귀: 기존 send/retry/restore + chat/chat-stream 모듈 green.

- verdict: **PASS**

- notes (non-blocking):
  1. 직전 turn의 onModelMessage append(POST)가 in-flight인 상태에서 즉시 재생성 시, fire-and-forget POST와 PUT replace의 서버 도착 순서가 이론상 어긋나 stale append가 남을 수 있음. replace는 직전 run 완료(idle) 이후에만 발동해 append가 거의 항상 먼저 끝나며, #14가 채택한 best-effort 영속 정책 범위 내 — 재현 가능성 낮음, 버그 아님.
  2. PUT 엔드포인트 controller/HTTP 레벨 테스트는 없음(서비스 단위만) — 기존 conversations 엔드포인트들도 동일 패턴이라 누락/회귀 아님.
