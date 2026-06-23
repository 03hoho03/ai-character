# 대화 유니크키 전환 — 스키마 토대 (#34)

스프린트 sp_2026_06_22_conv_ownership · #33(클레임) 완료 게이트 통과 · 2026-06-23

## 목적 / Why
로그인 계정(userId) 기준으로 "1인 1캐릭터 1대화" 정합성을 보장하기 위해 Conversation에 `(userId, personaId)` 유니크를 추가한다. #33 클레임으로 userId가 주입된 대화에 무결성을 확정하고, #40(OwnerContext 런타임 전환)이 userId 키로 get-or-create를 전환할 *토대*를 깐다.

## 경계 (사용자 결정)
- **#34 = 스키마 토대만**: 마이그레이션(browserId nullable + unique(userId,personaId) 추가 + dedupe). get-or-create는 browserId 키 유지. userId 키 전환·가드 배선은 #40.
- **unique 공존**: `@@unique([browserId,personaId])` 유지 + `@@unique([userId,personaId])` 추가. (userId nullable이라 Postgres가 NULL을 distinct로 처리 → 비로그인=browserId축, 로그인=userId축 자연 partial.)
- **dedupe**: (userId,personaId) 중복 그룹에서 최신(updatedAt desc, 동률→메시지 많은, 그래도 동률→id) 1건 유지, 나머지 삭제(메시지 onDelete:Cascade로 함께 삭제).

## 요구사항
### Must
- 스키마(`apps/api/prisma/schema.prisma`) Conversation:
  - `browserId String` → `browserId String?` (nullable — 로그인 전용 생성 대비, #40 토대)
  - `@@unique([userId, personaId])` 추가, `@@unique([browserId, personaId])` 유지
- 커스텀 마이그레이션 1개(단일 .sql, **순서 보장**):
  1. **dedupe**: userId NOT NULL인 (userId,personaId) 중복 그룹에서 최신 1건만 남기고 나머지 Conversation 삭제(메시지 cascade)
  2. `ALTER TABLE "Conversation" ALTER COLUMN "browserId" DROP NOT NULL`
  3. `CREATE UNIQUE INDEX ... ON "Conversation"("userId","personaId")`
  - dedupe가 index 생성보다 *먼저* 와야 unique violation 없이 적용됨.
- dev DB에 마이그레이션 적용 후 `prisma migrate status` = up to date, `prisma validate` 통과.
- get-or-create는 browserId 키 그대로 동작(비로그인 의미 불변) — 회귀 없음.
- shared `ConversationRecord.browserId`도 optional 정합(필요 시).

### Nice-to-have
- 마이그레이션 주석으로 dedupe 정책(최신 유지) 명시.

## 성공 기준 (검증 가능)
- [ ] schema.prisma: `Conversation.browserId`가 `String?`(nullable) + `@@unique([browserId, personaId])`와 `@@unique([userId, personaId])` *둘 다* 존재 (테스트가 두 튜플 내용 단언).
- [ ] 신규 마이그레이션 .sql이 (a) dedupe DELETE(최신 유지 semantics) (b) browserId DROP NOT NULL (c) CREATE UNIQUE INDEX(userId, personaId)를 *이 순서로* 포함 (테스트가 SQL 내용 단언).
- [ ] **dedupe 동작 정확성**(실 DB BEGIN/ROLLBACK 스크립트): 같은 (u1, pA)에 updatedAt 다른 2건+메시지 seed → dedupe 후 최신 1건만 생존(older 대화+메시지 삭제), 비로그인(userId null) 같은 personaId 행은 무변경.
- [ ] 마이그레이션이 dev DB에 clean 적용(`migrate status` up to date, `validate` 통과).
- [ ] get-or-create 회귀 없음 — 비로그인 (browserId, personaId) get-or-create 기존 conversations.service.spec GREEN, 신규 생성 시 browserId 영속.
- [ ] api 전체 jest + tsc GREEN.

## 테스트 전략 메모
- jest 스위트는 **DB 비의존 유지**(기존 계약) — 스키마 내용 + 마이그레이션 SQL 내용 단언만 jest로.
- dedupe 동작은 실 Postgres 필요 → 별도 스크립트(`$transaction` 내 seed→dedupe→assert→throw로 ROLLBACK)로 Phase 4에서 검증, jest 스위트에 미편입(CI DB 비의존 보존).
