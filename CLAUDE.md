# CLAUDE.md — ai-character

pnpm monorepo: `apps/api` (NestJS + Prisma + Postgres, Gemini), `apps/web` (Next.js 16 / React 19), `packages/shared` (공유 타입·contract). 익명 browserId 소유 모델(인증 없음).

## 테스트 규약

- **신규/변경 NestJS 엔드포인트는 supertest HTTP 계약 테스트를 ≥1개 동반한다** — 라우트 매칭 + 성공 status + DTO 거부(400) 중 최소 1건. 서비스 단위 테스트만으로 컨트롤러 배선(라우트·status·whitelist)을 추론으로 검증하지 말 것. 같은 컨트롤러에 리터럴 경로와 `:param` 경로가 공존하면 라우트 순서 회귀 테스트 필수.
  - 근거: `goals/lessons/l_2026_06_14_y_endpoint_http_test_gap.yaml` (#16/#18 관측, #23 적용).
- HTTP 계약 테스트는 `TestingModule` + supertest로 포트를 점유하지 않게 작성한다(고정 포트/pkill 회피). 실키 없이 검증할 경로는 `GENAI_CLIENT`/`PrismaService`를 override.
- 보안/정책 성격의 구조화 상수(safetySettings, contentRating, 권한 플래그)는 존재가 아니라 *내용*을 단언한다 — 필수 키 집합 + 핵심 값(threshold/등급). "baseline이 약화돼도 GREEN"이면 weak_check.
  - 근거: `goals/lessons/l_2026_06_18_x_config_presence_only_assertion.yaml`.

## 프롬프트 신뢰 경계 (#23)

채팅 system instruction은 **서버가 신뢰 소스에서 재조립**한다. 클라는 `personaId`/`browserId`만 보내고, 서버가 `tpl-*`→shared 템플릿 / 그 외→Character DB(`CharactersService.getOne`)로 persona를 조회해 `buildPersonaPrompt`를 실행한다. 클라가 보낸 `systemInstruction`은 전역 `ValidationPipe({whitelist:true})`가 strip한다. 새 chat 관련 필드를 추가할 때 이 경계를 깨지 말 것(클라 입력을 프롬프트로 무검증 신뢰 금지).
