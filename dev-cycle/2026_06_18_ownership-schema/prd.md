# 소유 스키마 — Character/Conversation에 userId (#31, 29a)

## 목적 / Why
계정 소유 모델 전환(#32)의 **스키마 토대**. Character/Conversation에 nullable `userId` + User FK를 깔아두되, 런타임 소유검증은 바꾸지 않는다(컬럼만, 데이터 무변경). 점진 전환(spike 결정 4)을 위해 browserId와 **병행**한다.

## 요구사항
### Must
- `schema.prisma`:
  - `Character.userId String?` + `User` relation. `Conversation.userId String?` + `User` relation.
  - `User`에 역방향 relation(`characters Character[]`, `conversations Conversation[]`).
  - 마이그레이션은 **컬럼/FK 추가만**. 기존 데이터 무변경. 기존 `Conversation.@@unique([browserId, personaId])`·`browserId`/`isPublic` 인덱스는 **그대로 유지**(이 티켓에서 변경 금지).
  - `userId` 인덱스 추가(소유 조회 대비).
- `packages/shared`: `CharacterRecord`·`ConversationRecord`에 `userId?: string` 선납(파급 완화).

### Nice-to-have
- 없음(토대만).

## 성공 기준 (검증 가능)
- [ ] 마이그레이션 적용 → Character/Conversation에 `userId` 컬럼 + User FK 생성, User↔Character/Conversation relation 성립(Prisma Client에 타입 노출).
- [ ] 기존 `(browserId, personaId)` unique·browserId/isPublic 인덱스 **보존**(마이그레이션 SQL이 drop하지 않음).
- [ ] 기존 익명 browserId 흐름 **회귀 없음** — 전체 api 테스트 GREEN 유지(현재 100), web 테스트 GREEN(현재 71).
- [ ] `apps/api`·`apps/web` typecheck 통과(shared userId? 반영).
- [ ] 런타임 동작 변화 없음(신규 엔드포인트 0, 소유검증 로직 미변경).

## Phase 2 메모
스키마/마이그레이션만이라 신규 런타임 동작이 없음 → **신규 단위 테스트 불필요**. 회귀 가드 = 기존 전체 테스트 GREEN 유지 + typecheck(Prisma Client·shared에 userId 타입 노출). Phase 4 verifier가 마이그레이션 SQL(컬럼 추가만/기존 제약 보존)을 직접 확인.
