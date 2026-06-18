# Verify Report — #28 User 모델 + 인증 백엔드

## Iteration 1 — 2026-06-18
- tests: `npx jest auth.http` → 11 passed / 0 failed. `npx jest`(전체) → 99 passed / 0 failed (8 suites). 회귀 없음.
- 성공 기준 (PRD):
  - [x] `apps/api` typecheck 통과, User 마이그레이션/모델 생성(20260618081507_add_user). Character/Conversation 미변경.
  - [x] signup 201 + httpOnly JWT 쿠키 + passwordHash 미노출.
  - [x] 중복 email 409. DTO 거부 400(email 형식 / 비번 <8).
  - [x] login 200 / 401(미존재·비번불일치 동일 — 존재 비노출).
  - [x] /auth/me guard 200 / 401(쿠키 없음·위조).
  - [x] HTTP 계약 테스트(supertest + PrismaService override, 포트 미점유).
  - [x] 보안 상수 **내용** 단언(쿠키 HttpOnly/SameSite=Lax/Max-Age=604800 값, argon2 `$argon2` 포맷 + `argon2.verify` 왕복, 409/401 분기). weak_check 아님.
- verdict: **PASS** (독립 verifier sub-agent)
- notes (verifier 관찰):
  - 비번 평문 미저장 강하게 단언, 신원은 쿠키에서만(#23 신뢰경계 일관), 전역 whitelist와 충돌 없음. logout(nice-to-have)도 구현.
  - **비차단 개선점**: me 가드 테스트가 위조만 커버, **만료 토큰 케이스 부재**(코드는 jwt.verify로 정확히 거부하나 박제 안 됨) → 아래 후속에서 보강.
  - **관찰(범위 밖)**: `JwtModule` useFactory가 `JWT_SECRET ?? 'dev-secret-change-me'` fallback → prod 미설정 시 약한 기본키로 조용히 부팅 가능. 배포 전 fail-fast 권장(다음 sprint/배포 작업 backlog).

## Post-verify 보강 — 만료 토큰 박제
- verifier가 짚은 만료 토큰 갭을 메움: `JwtService`로 `expiresIn:'-1s'` 토큰 발급 → `GET /auth/me` 401 단언 테스트 추가.
- tests: `npx jest auth.http` → **12 passed / 0 failed**. (jsonwebtoken 직접 import는 타입 부재로 실패 → 앱의 JwtService 인스턴스 사용으로 견고화.)
- 결과: 가드의 만료 거부가 테스트로 박제됨(lesson 정신 — 보안 회귀 보호).
