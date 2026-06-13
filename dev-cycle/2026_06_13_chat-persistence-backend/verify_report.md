# Verify Report — 대화 히스토리 DB 영속화 백엔드 (#14, 1/2)

테스트: api jest 단위(Prisma 모킹) + 실DB 통합(verifier가 Docker Postgres 기동 후 직접 round-trip).
인프라 결정: Prisma 7이 driver-adapter(prisma.config.ts+@prisma/adapter-pg)를 강제해 설정이 무거워짐 →
sprint plan의 "tooling 늪 금지" 리스크 고려해 검증된 **Prisma 6**으로 핀 고정 (url=env() + 단순 PrismaClient).

## 구현 중 자체 스모크에서 잡아 수정한 건
- **updatedAt 미갱신**: append를 `conversation.update({ data: { messages: { create } } })` 관계-only
  nested write로 처리하니 부모 row가 SQL UPDATE되지 않아 `@updatedAt`이 자동 갱신되지 않음
  (실DB 스모크에서 updatedAt==createdAt 확인). → `data`에 `updatedAt: new Date()`를 명시 추가해 해결,
  실DB로 갱신(.610→.649) 재확인.

## Iteration 1 — 2026-06-13
- tests: api `pnpm test` → 32 passed / web 25 / shared 31 (회귀 없음) · typecheck · build 통과
- 실DB 통합: verifier가 PORT=4123로 기동 후 get-or-create(동일 id 재사용)→append→GET(시간순)
  → updatedAt 전진, 소유권 위반 404(non-leaking), DTO 검증 400, FK Cascade(2→0) 직접 확인
- 성공 기준:
  - [x] docker compose + migration 스키마 적용
  - [x] Conversation/Message + (browserId,personaId) 유니크 + Message FK Cascade
  - [x] getOrCreate 재사용 vs 신규 분기 (단위)
  - [x] append 소유권 불일치 404 / 일치 저장 (단위 + 실DB)
  - [x] GET 메시지 시간순
  - [x] 컨트롤러 3개 엔드포인트 + class-validator 필수 검증(400)
  - [x] 공유 패키지 DTO 타입 + api 사용
  - [x] 기존 api/web/shared 테스트 통과
  - [x] (실DB) create→append→get 영속 round-trip
- verdict: **PASS** (버그/회귀 없음)
- notes (verifier): ownership 진짜 non-leaking(404 동일 메시지), `whitelist:true` app-wide로 mass-assignment 차단(주입 id 무시 확인), Prisma 파라미터화로 SQLi 없음. GET 부재=404는 의도된 설계(프론트는 새 대화 시작).

## 차기 사이클 (#14 2/2)
- 프론트 복원 연동: 채팅 진입 시 GET으로 메시지 복원, send/done 시 POST append.
- 익명 browserId를 프론트 localStorage uuid로 생성·전송.
- 비고: content `@IsNotEmpty` — 빈 model placeholder 저장 필요 시 재검토.
