# 익명 데이터 클레임 (#33, #37 흡수)

스프린트 sp_2026_06_22_conv_ownership · Must 체인 첫 원소 · 2026-06-22

## 목적 / Why
익명 browserId로 만든 Character/Conversation을 로그인 시 계정(userId) 소유로 재소유한다. 이게 없으면 로그인 사용자가 자기 익명 데이터를 못 본다(characters는 #32에서 이미 userId 우선 조회로 전환돼, 클레임 전엔 로그인 직후 빈 목록이 보임).

## 경계 (사용자 결정)
- #33 백엔드 + **#37 프론트 로그인 트리거·캐시 재소유까지 한 티켓**에 포함.
- 엔드포인트: **`POST /auth/claim { browserId }`** (JwtAuthGuard 필수).

## 요구사항
### Must — 백엔드
- `POST /auth/claim` — `JwtAuthGuard`(로그인 필수, 미인증 401). body `{ browserId: string }`(ClaimDto, `@IsString`/`@IsNotEmpty`). userId는 **쿠키 JWT에서만**(body의 userId 신뢰 안 함 — #23 신뢰경계, 전역 whitelist가 미선언 필드 strip).
- 단일 트랜잭션에서:
  - `character.updateMany({ where: { browserId, userId: null }, data: { userId } })`
  - `conversation.updateMany({ where: { browserId, userId: null }, data: { userId } })`
- **browserId 병행 보관**(제거 안 함 — #27 결정3, 폴백·감사). id 재발급 없음.
- **멱등**: `userId: null` 필터라 재실행 시 새로 클레임할 row 0건.
- **충돌 시 기존 계정 우선**: 이미 다른 userId 소유 row는 `userId: null` 필터로 자동 skip.
- 응답 `{ characters: number, conversations: number }`(클레임된 건수).
- 중복 (userId,personaId) dedup은 #34 책임 — 클레임은 userId 주입만(현재 unique는 browserId축이라 DB 위반 없음).

### Must — 프론트
- `claim-api` 래퍼: `POST /auth/claim`, `credentials:'include'`, body `{ browserId }`. best-effort(throw 무시).
- `session-context` login·signup 액션: 인증 성공 후 **`claim(getBrowserId())` → 완료 후 `reloadUserCharacters()`** 순서(클레임으로 userId 부여된 캐릭터가 재로드에 잡히게). 클레임 실패가 로그인 자체를 막지 않음.

### Must — 테스트
- **HTTP 계약 테스트 ≥1**(CLAUDE.md): 라우트 매칭 + 성공 status + 미인증 401 + DTO 거부(browserId 누락 400) 중 ≥1. TestingModule+supertest, PrismaService override.
- 클레임 트랜잭션 단위 테스트: 멱등(2회차 0건) + 충돌 skip(타 userId row 무변경) + browserId 보존.
- 프론트: claim-api 래퍼 + session-context(login이 claim 후 reload 순서로 호출) 테스트.

### Nice-to-have
- 클레임 건수 로깅(관측).

## 성공 기준 (검증 가능)
- [ ] `POST /auth/claim` 쿠키 없이 → 401.
- [ ] 쿠키 + `{browserId}` → 2xx, browserId 일치 & userId null인 Character/Conversation에 userId set, browserId 유지. 응답에 건수.
- [ ] 멱등: 동일 호출 2회차 → characters/conversations 클레임 0건.
- [ ] 충돌: 이미 다른 userId 소유 row → 무변경(skip).
- [ ] DTO: browserId 누락/비문자 → 400. body에 userId 넣어도 무시(소유는 쿠키 userId).
- [ ] HTTP 계약 테스트 + 트랜잭션 단위 테스트 GREEN.
- [ ] 프론트 login/signup이 `claim(browserId)` 후 `reloadUserCharacters()` 순서로 호출, 클레임 실패해도 로그인 유지. 테스트로 단언.
- [ ] api + web 전체 스위트 GREEN(회귀 없음).
