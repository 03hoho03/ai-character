# d1 — 인증 전략 결정 (#27 spike 산출)

sprint: sp_2026_06_18_auth_accounts · 결정일: 2026-06-18 · 결정자: 사용자 break + spike 권고
상태: **확정**. #28~#36의 입력. 각 결정은 코드 제약과 대조해 구체적 변경점에 못박음(추상 금지).

## 확인된 코드 제약 (결정 근거)
- `apps/api/src/main.ts`: `enableCors({ origin: 'http://localhost:3000' })` — **credentials 미설정**.
- `apps/api/src/app.module.ts`: 전역 `ValidationPipe({ whitelist: true, transform: true })` — body/query의 미선언 필드 strip. 현재 `browserId`는 DTO 필드.
- `apps/api/prisma/schema.prisma`: `browserId`는 **FK 없는 평문 String**. `Conversation.@@unique([browserId, personaId])`. Character.id = 클라 제공 `usr-<uuid>` 직행.
- 인증 라이브러리 **전무**(passport/jwt/argon2/cookie-parser 미설치).
- web `apps/web/src/lib/browser-id.ts`: localStorage uuid, fetch 래퍼(`characters-api`/`conversations-api`)가 browserId를 query/body로 운반. `credentials` 미설정.
- web `localhost:3000` ↔ api `localhost:4000`: cross-**origin**이지만 host가 localhost로 동일 → **same-site**(포트는 same-site 판정 무관) → `SameSite=Lax` 쿠키 동작.

## 결정 1 — 인증 방식: 이메일 + 비밀번호 (자체)
- 검증메일 없이 가입·로그인(이메일 인증메일은 out_of_scope). 외부 의존 0, 익명 폴백과 공존 단순.
- 비밀번호 해시: **argon2**(현대 권장, 메모리-하드). 라이브러리 `argon2`.
- **코드 변경점(#28)**: `User { id cuid, email @unique, passwordHash, createdAt }` + 마이그레이션. `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`.
- **보안 상수(테스트 내용 단언 대상, lesson l_2026_06_18_x)**: email 형식 검증(@IsEmail), 비번 최소 길이, argon2 type/옵션, 중복 email 409, 잘못된 자격 401.

## 결정 2 — 세션: httpOnly 쿠키 + stateless JWT
- JWT를 **httpOnly 쿠키**(`Set-Cookie`)에 담음. XSS로 토큰 탈취 불가. 서버 세션 스토어 불필요(stateless).
- 쿠키 속성: `httpOnly: true`, `sameSite: 'lax'`, `secure: prod에서 true`, `maxAge: 7d`. 단일 access 토큰, refresh 없음(만료 시 재로그인 — 토이 규모).
- JWT 서명키: `JWT_SECRET` 환경변수(`apps/api/.env`).
- **코드 변경점(#28)**: 의존성 `@nestjs/jwt`, `argon2`, `cookie-parser`(+types). login/signup이 JWT를 httpOnly 쿠키로 발급. JWT guard가 **쿠키에서** 토큰 추출·검증해 `req.user = { userId }` 주입.
- **코드 변경점(main.ts)**: `enableCors({ origin: 'http://localhost:3000', credentials: true })` + `app.use(cookieParser())`.
- **코드 변경점(web #36)**: 모든 fetch 래퍼에 `credentials: 'include'`.
- **보안 상수(테스트 단언)**: 쿠키 `httpOnly`/`sameSite`/`maxAge` 존재 + 값, 만료/위조 토큰 401, guard 없는 경로 보호.

## 결정 3 — 익명 데이터 클레임 정책 (이번 sprint defer, 29c/29d 입력)
- 로그인 시점에 현재 browserId 소유물(Character/Conversation row)의 **userId 컬럼을 주입**해 재소유. **id 재발급 없음**(usr-<uuid> 직행 모델 유지 → row 식별자 안정).
- **멱등**: 재실행해도 안전(이미 userId 있으면 skip). 충돌(같은 usr-id를 타 계정이 점유) 시 **기존 계정 소유 우선**, 클레임 skip.
- browserId는 클레임 후에도 **병행 보관**(폴백·감사). 제거하지 않음.
- 중복 personaId 대화(같은 personaId를 익명+계정 양쪽 보유)는 클레임(29c) 후 **유니크키 전환(29d)** 단계에서 정합화 — 그래서 29d는 29c에 순서 의존(중복으로 마이그레이션 깨짐 방지).

## 결정 4 — 점진 전환 전략 (browserId 병행)
- `userId`는 **nullable 병행**. 비로그인 흐름은 browserId 경로 그대로 유지(MVP-thin: 익명 사용 계속 가능).
- 소유 식별자 통일: **세션 있으면 `userId`, 없으면 `browserId` 폴백**. 단일 헬퍼(OwnerContext)로 8개 소유검증 메서드가 동일 규칙 사용(#32).
- whitelist 경계: 로그인 요청의 신원은 **쿠키 JWT(guard)** 에서만 — body/query의 userId는 신뢰 안 함(#23 신뢰경계 일관). 비로그인 browserId는 기존대로 DTO 필드 유지.
- 마이그레이션 순서: **29a(컬럼 추가)** → **29b(소유검증 전환·폴백 병행)** → [다음 sprint] **29c(클레임)** → **29d(유니크키 전환)**. 각 단계가 이전 단계 위에서만 안전.

## 실행 영향 요약 (티켓별 선결 입력)
| 티켓 | 이 결정에서 받는 입력 |
|---|---|
| #28 | argon2 해시 + @nestjs/jwt + cookie-parser, User 모델, httpOnly 쿠키 발급, JWT guard, main.ts CORS credentials+cookieParser |
| #31(29a) | User FK + nullable userId 병행(데이터 무변경) |
| #32(29b) | OwnerContext=userId??browserId 헬퍼, guard 기반 신원, browserId 폴백 병행 |
| #35(30a) | 로그인/회원가입 UI, 비로그인 폴백 유지 |
| #36(30b) | fetch `credentials:'include'`, browserId 운반 → 쿠키 세션으로 |
| #33/#34/#37 (defer) | 결정 3(클레임 정책·멱등·충돌·순서의존)을 입력으로 다음 sprint 실행 |
