# Verify Report — 익명 데이터 클레임 (#33, #37 흡수)

## Iteration 1 — 2026-06-22

- tests:
  - `cd apps/api && npx jest auth-claim` → PASS 7/7
  - `cd apps/api && npx jest` (전체) → PASS 118/118 (11 suites)
  - `cd apps/web && npx vitest run` (전체) → PASS 98/98 (11 files)
  - api `npx tsc --noEmit` → PASS / web `npx tsc --noEmit` → PASS
  - eslint(신규/변경 파일) → clean
- 성공 기준:
  - [x] 쿠키 없이 POST /auth/claim → 401 (JwtAuthGuard)
  - [x] 쿠키 + {browserId} → 200 + {characters, conversations}, userId null row만 userId set, browserId 유지
  - [x] 멱등 — where {userId:null} 필터로 2회차 0건 (구조 보장, 내용 단언)
  - [x] 충돌 skip — 동일 필터로 타 userId 소유 row 무변경
  - [x] DTO 거부(browserId 누락 400) + body userId 무시(쿠키 신원, whitelist strip)
  - [x] HTTP 계약 + 트랜잭션 단위 테스트 GREEN
  - [x] 프론트 login/signup이 claim(getBrowserId()) → reloadUserCharacters() 순서, 클레임 실패해도 로그인 유지
  - [x] api + web 전체 스위트 GREEN(회귀 없음)
- verdict: **PASS** (독립 verifier 판정, 결함 none)
- notes:
  - weak_check 경계 통과 — updateMany의 where/data를 `toHaveBeenCalledWith`로 내용 단언(존재 확인 아님). browserId 보존은 `'browserId' in data === false` 명시.
  - 원자성: 두 updateMany가 단일 $transaction 콜백 내(service.spec에서 $transaction 1회 호출 단언).
  - conversations 런타임 회귀 없음 — Conversation.browserId NOT NULL 유지, 클레임은 userId만 추가하므로 기존 browserId 키 조회 정상(#40 전환 전까지 안전).
  - (userId,personaId) 중복 가능성은 현재 unique가 (browserId,personaId)축이라 DB 위반 없음 — dedup은 #34 책임(이번 티켓 범위 밖).

## 경계 메모
- 본 티켓은 #33 백엔드 + #37(프론트 로그인 트리거·캐시 재소유)을 사용자 결정으로 **한 티켓에 흡수**. → #37 close 대상.
- 대화 캐시(use-chat-persistence 컴포넌트 ref) 무효화는 conversations가 browserId 키를 유지하는 한 불필요 — #40(OwnerContext 전환)에서 userId 키로 바뀔 때 재검토(lesson l_2026_06_20).
