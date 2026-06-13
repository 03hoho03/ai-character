# 대화 히스토리 DB 영속화 — 백엔드 (#14, 1/2)

## 목적 / Why
대화가 새로고침에 휘발된다(메모리 히스토리, #3). 이어하기를 위해 conversation/message를 Postgres에 영속화한다. 이번 사이클은 **백엔드만** — Prisma+Postgres 도입 + conversations CRUD API + 서비스/테스트. (프론트 복원 연동은 다음 사이클.)

## 요구사항

### Must
- **인프라**
  - 리포 루트에 `docker-compose.yml` — Postgres 1개 서비스 (`docker compose up -d`로 기동). 포트/계정/DB명 고정, 볼륨으로 영속.
  - `apps/api`에 Prisma 도입(`@prisma/client` + `prisma`), `schema.prisma`, 초기 마이그레이션.
  - `apps/api/.env`에 `DATABASE_URL` 추가(Gemini 키와 공존). `.env`는 gitignore — `.env.example` 갱신.
- **데이터 모델** (Prisma)
  - `Conversation`: id, browserId, personaId, createdAt, updatedAt. `(browserId, personaId)` 유니크 — 캐릭터당 한 대화 = 이어하기 단위.
  - `Message`: id, conversationId(FK, onDelete Cascade), role(`user`|`model`), content, createdAt. conversationId+createdAt 정렬.
- **API** (`apps/api`, 소유자=익명 browserId, 요청에 동반)
  - `POST /conversations` `{ browserId, personaId }` → 해당 (browserId, personaId) 대화를 **get-or-create**하고 반환.
  - `GET /conversations?browserId=&personaId=` → 대화 + 메시지(시간순) 반환. 없으면 빈/없음 표현.
  - `POST /conversations/:id/messages` `{ browserId, role, content }` → 메시지 append, conversation.updatedAt 갱신.
  - **소유권 강제**: browserId 불일치로 남의 대화 접근/쓰기 시 노출 없이 404.
- **공유 타입**: conversation/message API DTO는 `@ai-character/shared`에 단일 출처로 추가(web/api 공용, 기존 컨벤션).
- **검증 가능성**: 서비스 로직은 Prisma를 모킹한 jest 단위 테스트로 RED→GREEN. 실 DB 통합 확인은 verifier가 Docker 기동 후 수행.

### Nice-to-have
- 대화 삭제 엔드포인트
- 메시지 페이지네이션

## 성공 기준 (검증 가능)
- [ ] `docker compose up -d`로 Postgres가 뜨고, `prisma migrate`(또는 `db push`)가 스키마를 적용한다
- [ ] `schema.prisma`에 Conversation/Message가 정의되고 `(browserId, personaId)` 유니크 + Message FK Cascade가 걸려 있다
- [ ] ConversationsService 단위 테스트(Prisma 모킹): get-or-create가 기존 대화 재사용 vs 신규 생성을 올바로 분기한다
- [ ] 단위 테스트: 메시지 append 시 소유 browserId 불일치면 거부(404), 일치면 저장된다
- [ ] 단위 테스트: GET 조회가 메시지를 시간순으로 반환한다
- [ ] 컨트롤러가 위 3개 엔드포인트를 노출하고 DTO 검증(class-validator)이 걸려 있다 — browserId/personaId/role/content 필수
- [ ] 공유 패키지에 conversation/message DTO 타입이 추가되고 api가 이를 사용한다
- [ ] 기존 api/web/shared 테스트 전부 통과 — 회귀 없음
- [ ] (verifier 실DB 통합) Docker Postgres 기동 후 create→append→get 왕복이 실제로 영속된다
