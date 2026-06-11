# Verify Report — 모노레포 스캐폴딩 (#1)

## Phase 2 note — Test First 판단
단위 테스트 인프라가 존재하지 않음 (이 ticket이 그 기반을 만드는 작업).
대신 PRD 성공 기준 5개를 `scripts/verify-scaffold.sh`로 인코딩 — 실행 가능한 검증으로 대체.
작성 직후 실행 결과: **RED (전 항목 FAIL — 구현 전이므로 정상)**.

## Iteration 1 — 2026-06-11
- tests: `bash scripts/verify-scaffold.sh` → 9/9 PASS, exit 0
- 성공 기준:
  - [x] pnpm install 에러 없음
  - [x] shared 타입 web/api 양쪽 import + `pnpm -r typecheck` 통과 (verifier가 grep 약점을 소스 직독으로 보강 확인 — 양쪽 모두 `Persona`를 실제 타입 어노테이션으로 소비)
  - [x] `pnpm dev` → :3000 200, :4000/health 200
  - [x] turbo.json/nx.json 부재
  - [x] `pnpm -r build` 성공 (api: webpack bundle, web: Next 정적 빌드)
- verdict: **PASS**
- notes (verifier):
  - 스크립트 약점 2건 기록: (a) 검증 전 :3000/:4000에 무관한 서버가 떠 있으면 위양성 가능, (b) `pkill -f "next dev"`가 타 프로젝트 dev 서버를 죽일 수 있음 — 이번 실행에선 둘 다 해당 없음.
  - 보안: .env 미존재/미추적, .env.example만 존재. CORS localhost:3000 한정.
  - 구현 중 FAIL→fix 2건 (메인 기록): ① pnpm 격리로 ts-loader 미해석 → api devDep 명시 추가, ② nest 기본 webpack이 shared를 external 처리해 런타임 크래시 → webpack.config.js에서 `@ai-character/*` allowlist 번들링.
