# Verify Report — #31 소유 스키마 (Character/Conversation userId)

## Iteration 1 — 2026-06-18
- tests: `npx jest`(api) → 100 passed. `vitest run`(web) → 71 passed. `pnpm typecheck`(shared+api+web) → 0 errors. 회귀 0.
- 성공 기준 (PRD):
  - [x] 마이그레이션 적용 → Character/Conversation userId 컬럼 + User FK + 양방향 relation(typecheck로 타입 노출 확인).
  - [x] 기존 `(browserId,personaId)` unique·browserId/isPublic/category/contentRating/tags 인덱스 보존 — migrations 전체 DROP 0건, 신규 SQL은 ADD COLUMN/CREATE INDEX/ADD CONSTRAINT만.
  - [x] 익명 browserId 흐름 회귀 없음 — api 100 / web 71 GREEN. characters/conversations.service의 browserId 404 가드 그대로(userId 검증 미도입).
  - [x] api·web typecheck 통과 — shared CharacterRecord/ConversationRecord userId? 반영.
  - [x] 런타임 동작 변화 0 — 신규 엔드포인트 없음, 소유검증 로직 미변경.
- verdict: **PASS** (독립 verifier sub-agent)
- notes:
  - 순수 additive 마이그레이션(UPDATE/백필/DROP 없음). FK 양쪽 `ON DELETE SET NULL ON UPDATE CASCADE` → User 삭제 시 Character/Conversation 데이터 보존(browserId 병행 정책 정합, 익명 흐름 무손상).
  - 범위 침범 없음 — `(browserId,personaId)` unique 유지, browserId 컬럼/검증 제거 없음, #32(소유검증 전환)·#34(유니크키 전환) 미선취(userId는 nullable, 어떤 검증/쿼리에도 미사용).
  - Phase 2 신규 단위 테스트 생략은 정당(스키마 토대만, 신규 런타임 동작 0). 회귀 가드(전체 테스트+typecheck)로 대체 검증 완료.
