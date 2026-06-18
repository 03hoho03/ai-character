# 캐릭터 Postgres 영속화 백엔드 (#16, 1/2 백엔드)

## 목적 / Why
캐릭터가 아직 localStorage 전용(비공개 고정)이라 공유·탐색·랭킹의 전제(B2)가 없다.
캐릭터를 Postgres로 옮기고 공개/비공개 플래그 + browserId 소유권을 갖춘 CRUD API를 만들어 공유 인프라의 백엔드 토대를 깐다. (프론트 fetch 전환·데이터 마이그레이션은 #21, 타 사용자 채팅 허용은 #19로 분리)

## 요구사항
### Must
- **Prisma `Character` 모델 + 마이그레이션**
  - PK = 클라이언트 제공 id(`usr-<uuid>`). 소유자 = 익명 `browserId`.
  - shared `Persona` 필드 매핑: `name`, `tagline`, `personality`, `speechStyle`, `worldview`, `greeting`.
  - 구조화 필드는 **Json 컬럼**: `exampleDialogue`(`{user,model}[]`), `prohibitions`(`string[] | null`).
  - `isPublic Boolean @default(false)`, `createdAt`/`updatedAt`.
  - 공개 목록 조회용 인덱스: `@@index([isPublic, updatedAt])`.
- **공개/비공개 + browserId 권한**
  - 쓰기(생성/수정/삭제): 소유 `browserId` 일치 필수. 불일치/부재 → 404(존재 비노출, conversations 패턴 동일).
  - 읽기: 소유자는 본인 것 전부. 비소유자는 `isPublic === true`인 것만 상세 조회 가능.
- **Character CRUD API** (conversations 모듈 패턴 재사용: controller + service + dto + module, app.module 등록)
  - `POST   /characters` — 생성(본문에 browserId + Persona + isPublic). 같은 id 재요청은 소유자면 upsert.
  - `GET    /characters?browserId=` — 내 캐릭터 목록(updatedAt desc).
  - `GET    /characters/public` — 공개 캐릭터 목록(updatedAt desc).
  - `GET    /characters/:id?browserId=` — 단건. 소유자거나 isPublic이면 200, 아니면 404.
  - `PATCH  /characters/:id` — 수정(소유자만, 부분 갱신). 불일치 → 404.
  - `DELETE /characters/:id` — 삭제(소유자만). 불일치 → 404.
- **shared에 Character DTO/contract 추가** (`packages/shared/src/index.ts`)
  - `CharacterRecord`(Persona + browserId + isPublic + createdAt/updatedAt ISO 문자열), 요청 contract(`CreateCharacterRequest`, `UpdateCharacterRequest`). web/api 단일 출처.

### Nice-to-have
- 공개 목록 응답을 카드 필드(id/name/tagline 등)로 슬림화 — 이번엔 전체 반환해도 무방.
- 정렬/페이지네이션 — 이번 sprint 비대상.

## 성공 기준 (검증 가능)
- [ ] `pnpm --filter @ai-character/api test` 통과 (신규 `characters.service` 단위 테스트 포함, 전부 green).
- [ ] `pnpm --filter @ai-character/api typecheck` 및 `pnpm --filter @ai-character/shared build` 통과 (타입 에러 0).
- [ ] `schema.prisma`에 `Character` 모델 존재 + `apps/api/prisma/migrations/`에 신규 마이그레이션 디렉터리 생성됨.
- [ ] `getOwned`(내 목록), `listPublic`(공개 목록), `getOne`(소유자/공개 200·그 외 404), `create`/`update`/`remove`(소유자만, 불일치 404) 로직이 단위 테스트로 검증됨.
- [ ] shared `index.ts`에 `CharacterRecord`/`CreateCharacterRequest`/`UpdateCharacterRequest` export 존재, api DTO가 이 contract를 `implements`.
- [ ] 비소유자 쓰기·비공개 타인 캐릭터 읽기가 404로 거부됨(존재 비노출)을 테스트가 단언.
