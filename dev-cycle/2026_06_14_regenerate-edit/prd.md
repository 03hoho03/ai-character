# 답변 재생성 + 사용자 메시지 편집 (#18)

## 목적 / Why
크랙 표준 채팅 UX(B4). 현재는 에러용 retry만 존재(useChatStream). 정상 답변 재생성과 사용자 메시지 편집-후-재실행을 추가하고, 편집/재생성 시 후속 turn을 영속 계층에서 정리(truncate-after)해 restore 시 옛 turn이 부활하지 않게 한다. (분기/대화 트리는 비대상)

## 요구사항
### Must
- **백엔드 — conversations 전체 교체 연산 신설**
  - `PUT /conversations/:id/messages` — 주어진 메시지 배열로 **전체 교체**(트랜잭션: 기존 deleteMany → 순서대로 createMany). 소유 browserId 불일치/부재 → 404(존재 비노출, 기존 패턴).
  - append-only 한계 해소: 편집/재생성이 후속 turn을 남기지 않도록 truncate-after를 이 교체로 달성.
  - shared contract `ReplaceMessagesRequest { browserId; messages: {role, content}[] }` 신설.
- **프론트 — API/영속 어댑터**
  - `conversations-api.ts`에 `replaceMessages(conversationId, browserId, messages)` → PUT. best-effort.
  - `ChatPersistence`에 `replace(messages: ChatMessage[])` 추가(adapter는 ensureConv로 id 확보 후 PUT). greeting 제외 turn만 운반.
- **프론트 — useChatStream 액션 신설** (기존 retry/run 인프라 재사용)
  - `regenerate()` — **마지막 model 답변** 재생성. 직전 user turn까지로 history 구성 → `replace`로 옛 답변 truncate → `run`으로 새 답변(append). user turn 없으면 no-op.
  - `editUser(index, newContent)` — **임의의 user 메시지** 편집. 해당 index까지 + 편집된 user로 history 구성 → `replace`로 후속 truncate → `run` 재실행. 빈 내용/스트리밍 중이면 no-op.
- **프론트 — chat-screen UI**
  - 마지막 model 버블(비스트리밍·idle·직전 user 존재)에 **재생성** 버튼.
  - user 버블에 **편집** 어포던스 → 인라인 textarea + 저장/취소 → `editUser` 호출.
- **영속 정합**: 편집/재생성 후 `restore`가 메모리와 동일한 turn 열을 돌려준다(옛 후속 turn 부재).

### Nice-to-have
- 편집 중 다른 메시지 편집 잠금, 재생성 로딩 스피너 — 기본 disabled로 충분.
- 분기(여러 후보 답변 비교) — #18 비대상.

## 성공 기준 (검증 가능)
- [ ] `pnpm --filter @ai-character/api test` + `typecheck` 통과 (신규 `replaceMessages` 서비스 테스트 포함, green).
- [ ] `pnpm --filter @ai-character/web test` + `typecheck` 통과 (신규 regenerate/editUser/replaceMessages 테스트 포함, green).
- [ ] 백엔드 `replaceMessages`가 (a) 기존 메시지를 비우고 (b) 주어진 배열을 순서대로 재삽입하며 (c) 소유자 불일치 시 404임을 테스트가 단언(트랜잭션 사용).
- [ ] shared에 `ReplaceMessagesRequest` export + api DTO가 `implements`.
- [ ] `conversations-api.replaceMessages`가 PUT `/conversations/:id/messages`로 browserId+messages를 보냄을 테스트가 단언.
- [ ] useChatStream `regenerate`가 마지막 user turn 기준으로 재실행하고 직전 답변을 대체함을, `editUser`가 편집 index 이후를 truncate하고 재실행함을 테스트가 단언(persistence.replace 호출 payload 포함).
- [ ] chat-screen에 재생성 버튼과 user 메시지 편집 UI가 렌더되고 동작함(렌더/상호작용 테스트 또는 기존 테스트 무회귀).
