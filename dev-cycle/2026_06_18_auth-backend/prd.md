# User 모델 + 인증 백엔드 (#28, d2)

## 목적 / Why
익명 browserId 소유 모델을 탈피하기 위한 계정 토대. #27 spike 결정(이메일+비번 / httpOnly 쿠키 stateless JWT)을 구현해, 후속 소유권 전환(#31/#32)·프론트(#35/#36)가 매달릴 인증 백엔드를 세운다. 이 티켓은 **인증 모듈만** — 기존 Character/Conversation 소유 모델은 건드리지 않는다.

## 요구사항
### Must
- Prisma `User` 모델: `id`(cuid), `email`(@unique), `passwordHash`, `createdAt`. 마이그레이션 1개. **기존 Character/Conversation 미변경**.
- 의존성 추가: `@nestjs/jwt`, `argon2`, `cookie-parser`(+`@types/cookie-parser`).
- 신규 `auth` 모듈(module/controller/service/guard/dto):
  - `POST /auth/signup` — email+password 받아 argon2 해시로 User 생성. 중복 email은 **409**. 가입 성공 시 **자동 로그인**(JWT 쿠키 발급) + 사용자 정보 반환.
  - `POST /auth/login` — 자격 검증 후 JWT를 **httpOnly 쿠키**로 발급. 실패(미존재/비번불일치)는 **401**(존재 비노출 위해 동일 메시지).
  - `GET /auth/me` — 쿠키 JWT guard로 보호. 유효하면 `{ userId, email }`, 없거나 위조/만료면 **401**.
- JWT: stateless, 서명키 `JWT_SECRET`(env), 만료 7d. 쿠키 속성 `httpOnly:true`, `sameSite:'lax'`, `secure:`(prod에서 true), `maxAge: 7d`.
- 비번: argon2 해시. 최소 길이 **8자**(DTO 검증), email은 `@IsEmail`.
- `main.ts`: `enableCors({ origin:'http://localhost:3000', credentials:true })` + `app.use(cookieParser())`.
- JWT guard: 쿠키에서 토큰 추출·검증 → `req.user = { userId, email }` 주입.

### Nice-to-have
- 로그아웃 `POST /auth/logout`(쿠키 clear) — 작으면 포함.

## 성공 기준 (검증 가능)
- [ ] `apps/api` 빌드/typecheck 통과, 마이그레이션 적용되어 `User` 테이블 생성.
- [ ] `POST /auth/signup` 신규 email → 201/200 + `Set-Cookie`에 JWT(httpOnly) 동반, 응답에 passwordHash **미노출**.
- [ ] 중복 email signup → **409**. 잘못된 형식(email 아님 / 비번 <8자) → **400**(DTO 거부).
- [ ] `POST /auth/login` 올바른 자격 → 200 + httpOnly JWT 쿠키. 틀린 비번/미존재 email → **401**.
- [ ] `GET /auth/me` 유효 쿠키 → 200 + `{userId,email}`. 쿠키 없음/위조/만료 토큰 → **401**.
- [ ] HTTP 계약 테스트(supertest, PrismaService override)로 위 라우트·status·DTO거부 단언.
- [ ] 보안 상수 **내용** 단언(lesson l_2026_06_18_x): 발급 쿠키의 `httpOnly`·`sameSite`·`maxAge` 값, argon2 검증 경로, 401/409 분기. 존재만 단언하는 weak_check 금지.
