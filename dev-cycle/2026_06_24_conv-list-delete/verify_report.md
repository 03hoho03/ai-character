# Verify Report — 대화 목록/삭제 API (#41, 38b)

## Iteration 1 — 2026-06-24

- tests:
  - `npx jest conversations.service conversations-list` → PASS 35/35
  - `npx jest` (api 전체) → PASS 155/155 (15 suites)
  - api `tsc --noEmit` → EXIT 0 / web `tsc --noEmit` → EXIT 0 / web vitest → 98/98
- 성공 기준:
  - [x] GET /conversations/list → 소유자 목록(updatedAt desc), 항목 {id, personaId, characterName, lastMessage, updatedAt}
  - [x] characterName: tpl-*→템플릿 name / usr-*→Character DB name / 미존재→null. character.findMany 1회 + id:{in} 배치(N+1 없음, 호출 횟수 단언)
  - [x] lastMessage: messages take:1 desc → 마지막 1건 또는 null(빈 대화)
  - [x] 소유 분리: 로그인 where.userId / 비로그인 where.browserId(내용 단언, 타 소유 미노출)
  - [x] DELETE /conversations/:id 소유자 204 + delete, 비소유 404(delete 미호출), 메시지 cascade
  - [x] 라우트 매칭: /list가 목록 핸들러, 단건 GET ?personaId= 불변(findUnique), DELETE :id 삭제 도달
  - [x] HTTP 계약 + service.spec(listOwned/remove) GREEN, api 전체 + 양쪽 tsc + web GREEN
- verdict: **PASS** (독립 verifier, 결함 none)
- 공격: (a) 비로그인 attacker 타 browserId 삭제 → 404, (b) 로그인 타 userId 삭제 → 404
- notes:
  - weak_check 경계 통과 — 목록 where·character.findMany 호출 횟수/배치·삭제 delete 호출/미호출까지 단언.
  - usrIds 필터 정확(tpl-* 혼입 없음), 빈 목록 시 character.findMany 생략(불필요 쿼리 회피).
  - Date(Prisma) vs string(ConversationListItem 직렬화 계약) 임피던스: service 반환 타입 미강제(추론) → tsc clean, HTTP 직렬화로 string 일관.
  - DELETE @HttpCode(204) + remove void(본문 없음).

## 경계 메모
- 캐릭터명은 백엔드 해석(사용자 결정). 프론트 #42는 personaId/characterName 그대로 표시 + 클릭 시 /chat/<personaId> 진입.
- 목록은 검색·정렬·아카이브 out_of_scope. #42(인박스 UI)가 이 API 소비.
