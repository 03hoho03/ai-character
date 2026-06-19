# Verify Report — #32 characters 소유검증 OwnerContext 전환

## Phase 2 — Test First (RED)
- characters-ownership.http.spec.ts 작성 → 로그인 케이스 5 fail / 비로그인 폴백 2 pass(기존 계약 이미 보존). 의도된 RED.

## 구현 중 발견 (PRD 보강)
- `Character.browserId`가 `String`(NOT NULL)이라 로그인 사용자가 browserId 없이 userId만으로 생성 불가 → 타입 에러로 드러남. #31이 userId만 nullable화하고 browserId는 required로 남긴 누락. **#32에 browserId nullable 마이그레이션(20260619072947, DROP NOT NULL) 추가** — OwnerContext 전환의 필수 전제. 순수 additive(데이터 무손상).

## Iteration 1 — 2026-06-19
- tests: `npx jest`(api) → 9 suites / **111 passed**. web vitest → 71 passed. api·web typecheck → 0 errors. 회귀 0.
- 성공 기준 (PRD):
  - [x] 로그인(쿠키) → userId 기준 소유검증(ownerWhere/ownerMatches `'userId' in owner` 분기). 로그인 사용자는 자기 userId 소유분만.
  - [x] 비로그인 browserId 폴백 → 기존 흐름 회귀 0(ownerWhere({browserId}) == 기존 where). 기존 characters/chat/conversations 계약 GREEN.
  - [x] 비소유 404(존재 비노출) 유지 — cross-owner(userId↔browserId) 404 케이스 포함.
  - [x] userId 위조 불가 — resolveOwner는 req.user?.userId(가드)만, body/query userId 미참조 + whitelist strip. 위조 테스트 `data.userId===undefined` 내용 단언.
  - [x] conversations browserId 흐름 무변경. chat usr-* 소유확인은 characters.getOne(owner) 위임으로 따라감.
  - [x] HTTP 계약 테스트(로그인/비로그인/위조/404/isPublic) + service spec userId·browserId 양 케이스 갱신. typecheck 통과.
- verdict: **PASS** (독립 verifier sub-agent)
- notes:
  - 신뢰경계(#23 일관) 견고: OptionalJwtGuard는 토큰 없음/무효/만료를 익명 통과(req.user 미설정) → 위조·만료 토큰으로 userId 소유 획득 불가. 쿠키 payload.sub만 신뢰.
  - 마이그레이션 안전: DROP NOT NULL 단일 구문, UPDATE/DROP COLUMN 없음.
  - 범위 침범 없음: Conversation @@unique([browserId,personaId]) 미전환(#34), 클레임(#33) 미구현.
  - MVP-thin 경계 준수: 로그인 사용자는 browserId 소유 비공개 데이터 안 보임(격리 where 동등성 단언).
