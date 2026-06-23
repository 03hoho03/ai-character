# 프론트 대화 인박스 (#42, 38c)

스프린트 sp_2026_06_22_conv_ownership 마지막 티켓 · 선행 #41(목록/삭제 API) 완료 · 2026-06-24

## 목적 / Why
계정/익명 소유자의 대화를 한눈에 보는 인박스. #41의 `GET /conversations/list`·`DELETE /conversations/:id`를 소비해 목록 카드(캐릭터명·마지막 메시지)를 보여주고, 클릭 시 해당 채팅으로 진입, 항목 삭제를 제공한다. 소유 전환 스프린트의 사용자 가시적 페이오프.

## 핵심 설계 결정 (사용자 확인됨)
- **재로드 방식**: 페이지 로컬 fetch — `/conversations` 페이지가 마운트 시 + `useSession`의 세션 식별자(status/user.id) 변화에 의존하는 useEffect로 fetch. **영속 캐시 없음** → stale 원천 차단(lesson l_2026_06_20: 최선의 캐시 무효화는 캐시 부재). session-context 미변경.
- **라우트**: `/conversations`(app/conversations/page.tsx).
- **진입점 노출**: 홈 헤더에 '내 대화' 링크 — 항상 노출(비로그인도 browserId 대화 보유).
- **삭제 UX**: 삭제 버튼 → deleteConversation → 성공 시 목록에서 제거(낙관적).

## 요구사항
### Must
- **conversations-api.ts**:
  - `fetchConversationList(browserId?)`: `GET /conversations/list`(+browserId 쿼리, credentials:'include') → `ConversationListItem[]`. 실패는 `[]`(best-effort, 인박스가 빈 화면으로).
  - `deleteConversation(id, browserId?)`: `DELETE /conversations/:id`(credentials:'include'). 실패(!ok) throw.
- **ConversationInbox 컴포넌트**(app/conversations/conversation-inbox.tsx, 'use client'):
  - `useSession` 사용. 마운트 + 세션 식별자(status!=='loading'일 때 user?.id) 변화 시 `fetchConversationList(getBrowserId())`로 목록 로드.
  - 목록 카드: `characterName`(null이면 '(삭제된 캐릭터)') + `lastMessage` 미리보기(없으면 '아직 메시지 없음') + 클릭 시 `/chat/<personaId>` 링크(Link).
  - 항목 삭제 버튼 → `deleteConversation(id, getBrowserId())` → 성공 시 목록에서 제거.
  - 빈 목록/로딩 상태 처리.
- **app/conversations/page.tsx**: 헤더(타이틀 + SessionStatus + 홈 링크) + `<ConversationInbox />`.
- **홈 헤더**(app/page.tsx): '내 대화'(`/conversations`) 진입점 Link 추가.
- **컴포넌트 테스트**: 목록 렌더(캐릭터명·마지막메시지·/chat 링크 href) + 삭제 플로우(버튼 클릭→delete 호출→항목 제거) + 세션 전환 시 재로드(fetchConversationList 재호출). conversations-api 래퍼 테스트(credentials·URL·return/throw).

### Nice-to-have
- updatedAt 상대시간 표시.

## 성공 기준 (검증 가능)
- [ ] `fetchConversationList(browserId?)` → `GET /conversations/list`(credentials:'include'), 실패 시 `[]`. `deleteConversation(id, browserId?)` → `DELETE /conversations/:id`(credentials:'include'), !ok면 throw. (테스트가 URL·credentials·반환/throw 단언)
- [ ] ConversationInbox가 마운트 시 fetchConversationList로 목록 로드, 각 항목에 characterName + lastMessage 미리보기 표시 + `/chat/<personaId>` 링크 href.
- [ ] 삭제 버튼 클릭 → deleteConversation(id) 호출 + 해당 항목이 목록에서 사라짐(테스트 단언).
- [ ] 세션 전환(anonymous→authenticated) 시 fetchConversationList 재호출(소유자 변경 반영 — page-local 세션 의존).
- [ ] 홈 헤더에 '내 대화' → `/conversations` 링크.
- [ ] 빈 목록/로딩 상태가 깨지지 않음(에러 없이 렌더).
- [ ] web vitest 전체 + tsc GREEN, 회귀 없음.
