# Verify Report — 대화 히스토리 프론트 복원 연동 (#14, 2/2)

테스트: vitest 단위(browser-id / conversations-api fetch 모킹 / useChatStream persistence 주입) + 실 API+DB 라운드트립(verifier).
설계: useChatStream에 `persistence?` 선택적 주입 — 미주입 시 기존 동작/테스트 불변. 영속화는 모두 best-effort.

## Iteration 1 — 2026-06-13
- tests: web `pnpm test` → 38 passed (기존 25 + 신규 13: browser-id 2 / conversations-api 6 / useChatStream +5) · api 32 · shared 31 (회귀 0) · typecheck · lint · build 통과
- 실 라이브: verifier가 API를 PORT=4555 + 실 Postgres로 기동, 프론트 호출 시퀀스(ensure→append user→append model→GET) 왕복 → 두 turn 시간순 반환, ensure 멱등, greeting 미저장 확인
- 성공 기준:
  - [x] browser-id: uuid 생성·재사용
  - [x] conversations-api: 404→null / ensure·append URL·바디·메서드
  - [x] restore가 저장 turn을 greeting 뒤에 복원
  - [x] send 시 onUserMessage / 성공 done 시 onModelMessage, 에러 시 미호출
  - [x] persistence 미주입 시 기존 7테스트 불변
  - [x] ChatScreen이 useChatPersistence 연결
  - [x] 영속화 실패해도 스트리밍 정상 (best-effort)
  - [x] web/api/shared 전체 통과
  - [x] (라이브) ensure→append→GET 영속 round-trip 시간순
- verdict: **PASS** (실제 버그 없음)
- notes (verifier): persistence 주입 진짜 비침투(diff +96/-0, 모든 분기 `if(persistence)` 게이트), best-effort에 unhandled rejection 경로 없음, conversation lazy 생성 dedupe 정상, greeting UI 전용·중복 없음, localStorage SSR 가드.

## 후속 하드닝 (verifier가 flag한 이론적 edge 차단)
- verifier가 "restore가 send 완료 후 resolve되면 UI 메시지를 덮어쓸 수 있음(실DB 영향 없음, 현실적 불가)"을 비결함으로 flag.
- 가드 추가: restore 적용 조건에 `messagesRef.current.length > 1`이면 skip — greeting만 있는 초기 상태에서만 복원. 12 useChatStream 테스트 재통과.

## #14 종료
- 1/2 백엔드 + 2/2 프론트 모두 완료 → 새로고침 후 대화 복원 동작. 이슈 close 대상.
