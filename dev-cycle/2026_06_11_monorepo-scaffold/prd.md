# 모노레포 스캐폴딩 (Next.js + NestJS + 공용 타입)

GitHub issue: #1 / Sprint: sp_2026_06_11_ai_chat_mvp

## 목적 / Why
AI 캐릭터 챗 MVP의 전 ticket(#2a~#7)이 올라설 기반 구조. 프론트/백엔드/공용 타입을
한 리포에서 관리해 1인 개발자의 컨텍스트 스위칭 비용을 최소화한다.

## 요구사항

### Must
- 순수 pnpm workspace 모노레포 (turbo/nx 사용 금지)
  - `apps/web` — Next.js (App Router, TypeScript, Tailwind CSS)
  - `apps/api` — NestJS (TypeScript)
  - `packages/shared` — 공용 타입 패키지 (`@ai-character/shared`)
- `packages/shared`의 타입을 web/api 양쪽에서 import 가능 (TS 소스 직접 소비 — 별도 빌드 단계 없음)
- 루트에서 한 명령으로 web + api 동시 기동: `pnpm dev`
  - web: http://localhost:3000 / api: http://localhost:4000 (포트 충돌 방지)
- 공통 설정: 루트 tsconfig base, Prettier 설정 1개, ESLint는 각 앱 스캐폴드 기본값 유지
- `.gitignore` 정비 (node_modules, .next, dist, .env 등)
- `.env.example` (api의 GEMINI_API_KEY 자리만)

### Nice-to-have
- README에 실행 방법 3줄
- api에 `/health` 엔드포인트 (동시 기동 확인용)

## 성공 기준 (검증 가능)
- [ ] `pnpm install` 루트에서 에러 없이 완료
- [ ] `packages/shared`에 정의한 타입(예: `Persona` placeholder)을 `apps/web`과 `apps/api` 양쪽 코드에서 import하고 typecheck 통과 (`pnpm -r typecheck`)
- [ ] `pnpm dev` 한 명령으로 두 앱 동시 기동: http://localhost:3000 가 200 응답, http://localhost:4000/health 가 200 응답
- [ ] 리포 루트에 turbo.json / nx.json 부재 (순수 pnpm workspace 제약 준수)
- [ ] `pnpm -r build` 두 앱 모두 빌드 성공

## 제외 (sprint plan 강제)
CI, husky, 공용 UI 패키지, 배포 설정 — 이번 ticket에 넣지 않음.
