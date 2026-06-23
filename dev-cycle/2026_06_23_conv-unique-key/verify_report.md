# Verify Report — 대화 유니크키 전환 스키마 토대 (#34)

## Iteration 1 — 2026-06-23

- tests:
  - `npx jest conversations-schema conversations-migration` → PASS 8/8
  - `npx jest` (api 전체) → PASS 126/126 (13 suites)
  - `node scripts/verify-dedupe.mjs` (실 DB, ROLLBACK) → PASS 5/5
  - `prisma migrate status` → up to date (9 migrations) / `prisma validate` → valid
  - api `tsc --noEmit` → EXIT 0 / web `tsc --noEmit` → EXIT 0 / web vitest → 98/98
- 성공 기준:
  - [x] 스키마: browserId nullable(String?) + @@unique([browserId,personaId])·@@unique([userId,personaId]) 둘 다 존재(내용 단언)
  - [x] 마이그레이션 SQL: dedupe DELETE → DROP NOT NULL → CREATE UNIQUE INDEX 순서(deleteIdx < createIdx 단언)
  - [x] dedupe 동작(실 DB): 최신 1건 생존·older 삭제·비로그인(userId null) 무변경·메시지 cascade. 스크립트가 마이그레이션의 실제 dedupe SQL을 마커 추출해 실행(테스트가 진짜 SQL에 묶임)
  - [x] 마이그레이션 dev DB clean 적용(status up to date, validate valid)
  - [x] get-or-create 회귀 없음 — browserId 키 유지(#34 경계 준수, userId 키 전환 안 함)
  - [x] api 전체 jest + tsc + web GREEN
- verdict: **PASS** (독립 verifier, 결함 none)
- notes:
  - weak_check 경계 통과 — 스키마는 두 unique 튜플 *공존*을 각각 단언 + NOT NULL 잔존 차단, dedupe는 실 DB 행동을 마커-추출 실제 SQL로 검증(존재 아님).
  - userId nullable + @@unique([userId,personaId])의 비로그인 미집행(Postgres NULL-distinct)을 dedupe의 C(userId null) 무변경으로 실증 — 비로그인 get-or-create 정합 보존.
  - dedupe tie-break(updatedAt desc → msg_count → id) — id가 PK라 결정적.
  - 비가역 삭제(dedupe)는 사용자 결정(최신 유지·삭제) 범위. 마이그레이션 주석에 정책·순서 근거 명시.
  - lesson l_2026_06_19_y_split_migration_foundation_gap 재발 추적 지점이었음 → 토대(#34)가 후속 제약(unique 방향·browserId nullable)을 *이번에* 함께 처리해 #40이 추가 마이그레이션 없이 진행 가능 → 함정 회피.

## 경계 메모
- #34 = 스키마 토대(마이그레이션)까지. get-or-create의 userId 키 전환 + 컨트롤러 가드 배선 + HTTP 계약 테스트는 #40(38a).
- shared ConversationRecord.browserId optional화 동반(DB nullable 정합).
