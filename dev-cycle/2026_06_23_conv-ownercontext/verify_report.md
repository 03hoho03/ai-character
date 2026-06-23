# Verify Report — conversations OwnerContext 전환 (#40, 38a)

## Iteration 1 — 2026-06-23

- tests:
  - `npx jest conversations.service conversations-ownership` → PASS 29/29
  - `npx jest` (api 전체) → PASS 140/140 (14 suites)
  - api `tsc --noEmit` → EXIT 0 / web `tsc --noEmit` → EXIT 0 / web vitest → 98/98
- 성공 기준:
  - [x] 컨트롤러 5라우트 OptionalJwtGuard + resolveOwner(body/query userId 무시 — 쿠키만 신뢰)
  - [x] 서비스 5메서드 OwnerContext. get-or-create 로그인→userId_personaId / 비로그인→browserId_personaId 키(내용 단언)
  - [x] 로그인 생성=userId 소유(browserId 없음), 비로그인=browserId 소유(userId 없음 — characters #32 일관)
  - [x] append/replace/summarize 소유 불일치 404(ownerMatches: 로그인 userId / 비로그인 browserId)
  - [x] body userId 위조 무시(resolveOwner가 body 미참조)
  - [x] HTTP 계약 테스트 신설(라우트+status+404+위조+DTO400) + service.spec OwnerContext 갱신 GREEN
  - [x] api 전체 + 양쪽 tsc + web GREEN, 비로그인 흐름 불변
- verdict: **PASS** (독립 verifier, 결함 none)
- 공격 시나리오: (a) 비로그인 attacker 타 browserId append → 404, (b) 로그인 타 userId append → 404, (c) body userId 위조 무시 — 전부 확인
- notes:
  - weak_check 경계 통과 — get-or-create 키를 toEqual로 *내용* 단언(로그인/비로그인 각각), 소유 404는 update 미호출까지 단언.
  - ownerMatches 양쪽 null 안전: owner는 항상 한쪽({userId}|{browserId})이라 null===owner.x = false → 거부.
  - 라우트 충돌 없음: bare `:id` 부재(`:id/messages`·`:id/summarize`만), GET/POST `/`는 verb 분리.
  - l_2026_06_20 적용: 식별자 변경의 테스트 2차 상태 — conversations.service.spec 하네스를 owner 객체로 갱신.

## 경계/후속 메모
- 의도된 거동: 로그인 사용자의 *미클레임* 익명 대화(userId=null)는 ownerMatches=false → get-or-create가 새 userId 대화 생성(기존 익명 row 보존, 유실 아님). #33 클레임이 로그인 시 userId를 채우는 전제 — 정상 경로에선 발생 안 함.
- 프론트(conversations-api/use-chat-persistence)는 여전히 browserId 운반 — 로그인 시 쿠키 userId가 서버에서 우선. 프론트 변경은 #42(인박스) 범위. 이번 티켓은 백엔드 OwnerContext + HTTP 계약까지(38a).
- #41(38b 목록/삭제 API)·#42(38c 인박스)가 이 토대 위에 얹힘.
