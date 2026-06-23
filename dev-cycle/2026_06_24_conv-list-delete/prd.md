# 대화 목록/삭제 API (#41, 38b)

스프린트 sp_2026_06_22_conv_ownership · 선행 #40(OwnerContext) 완료 · 2026-06-24

## 목적 / Why
계정 기준 대화 인박스(#42)의 백엔드 토대. 소유자의 대화 목록(최신순, 마지막 메시지·캐릭터명 포함)을 읽고, 개별 대화를 삭제한다. #40의 OwnerContext를 그대로 활용.

## 핵심 설계 결정 (사용자 확인됨)
- **목록 경로**: 기존 `GET /conversations?personaId=`(단건 복원)와 충돌하므로 **`GET /conversations/list`** 신설.
- **캐릭터명**: 백엔드가 채운다 — `tpl-*` → shared PERSONA_TEMPLATES name, `usr-*` → Character DB name(배치 조회, N+1 없음), 삭제/미존재 캐릭터 → null.
- **lastMessage**: 마지막 메시지 `{role, content, createdAt}` 또는 null(빈 대화). 정렬은 대화 updatedAt 최신순.
- **삭제**: `DELETE /conversations/:id`, ownerMatches 불일치 404(존재 비노출), 메시지 onDelete:Cascade, 204.

## 요구사항
### Must
- **서비스**(`conversations.service.ts`):
  - `listOwned(owner)`: `findMany({ where: ownerWhere(owner), orderBy: { updatedAt: 'desc' }, include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } } })`. 캐릭터명 배치 해석(usr-* personaId 모아 `character.findMany({ where: { id: { in } }, select: { id, name } })` 1회 + tpl-*는 PERSONA_TEMPLATES). 항목 `{ id, personaId, characterName, lastMessage, updatedAt }` 매핑.
  - `remove(id, owner)`: id로 찾고 `!ownerMatches` 404, 아니면 `conversation.delete`(메시지 cascade).
- **컨트롤러**(`conversations.controller.ts`):
  - `@Get('list') @UseGuards(OptionalJwtGuard)` → `listOwned(resolveOwner(req, query.browserId))`.
  - `@Delete(':id') @UseGuards(OptionalJwtGuard) @HttpCode(204)` → `remove(id, resolveOwner(req, query.browserId))`.
- **DTO**: 목록용 browserId-only 쿼리 DTO(personaId 없음, browserId optional). 삭제는 기존 browserId optional 쿼리.
- **shared**: `ConversationListItem` 타입 추가({id, personaId, characterName: string|null, lastMessage: {role,content,createdAt}|null, updatedAt}).
- **라우트 매칭/순서**: `GET /conversations/list`(리터럴)가 단건 `GET /conversations`·`:id` 계열과 공존 — 매칭 회귀 테스트(CLAUDE.md). 기존 `GET /conversations?personaId=` 단건 복원 불변.
- **HTTP 계약 테스트**: 목록 status + 소유 분리(로그인=userId/비로그인=browserId 목록) + 삭제 소유 404 + 삭제 성공 204.

### Nice-to-have
- 빈 목록(대화 0건) → `[]` 200.

## 성공 기준 (검증 가능)
- [ ] `GET /conversations/list` → 소유자 대화 목록, updatedAt 최신순. 각 항목 `{id, personaId, characterName, lastMessage, updatedAt}`.
- [ ] characterName: tpl-* → 템플릿 name, usr-* → Character DB name, 삭제/미존재 → null. usr-* 다건이어도 character.findMany 1회(N+1 없음 — 호출 횟수 단언).
- [ ] lastMessage: 마지막 메시지 `{role,content,createdAt}`(take:1 desc) 또는 빈 대화면 null.
- [ ] 소유 분리: 로그인 owner는 `where.userId`로, 비로그인은 `where.browserId`로 findMany(타 소유 미노출, where 내용 단언).
- [ ] `DELETE /conversations/:id` 소유자 → 204 + conversation.delete 호출, 비소유 → 404(delete 미호출).
- [ ] 라우트 매칭: `GET /conversations/list`가 목록 반환(단건 핸들러에 안 잡힘), 기존 단건 `GET /conversations?personaId=` 불변, `DELETE :id`가 삭제 핸들러 도달.
- [ ] HTTP 계약 테스트 + conversations.service.spec(listOwned/remove) GREEN. api 전체 + tsc GREEN, web 회귀 없음.
