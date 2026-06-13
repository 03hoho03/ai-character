# 대화 히스토리 프론트 복원 연동 (#14, 2/2)

## 목적 / Why
백엔드(1/2)의 conversations API를 프론트에 연결해 새로고침 후 대화를 복원한다 — #14의 사용자 체감 deliverable. `/chat/stream`은 stateless 유지, 영속화는 conversations API로 분리.

## 요구사항

### Must
- **익명 browserId**: 최초 1회 localStorage에 uuid 생성·보관, 이후 재사용. 브라우저당 1개(페르소나 공통).
- **conversations API 클라이언트** (`apps/web/src/lib`): GET 복원 / POST get-or-create(ensure) / POST append. `NEXT_PUBLIC_API_URL ?? http://localhost:4000` 사용.
- **복원**: 채팅 진입 시 `GET /conversations`로 저장된 대화를 불러와, greeting(UI 첫 메시지)을 맨 앞에 두고 그 뒤에 저장된 user/model turn을 이어 표시. 이력 없으면(404) greeting만.
- **저장(성공 turn만)**: user 메시지는 전송 시 append, model 메시지는 스트리밍 `done`(성공) 시 append. 에러/partial 턴은 저장하지 않음. conversation은 첫 전송 시 lazy get-or-create.
- **best-effort**: 영속화(GET/POST) 실패해도 채팅 스트리밍은 정상 동작 — 영속화 예외는 흡수.
- **useChatStream 비침투**: persistence를 선택적 주입으로 받아, 미주입 시 기존 동작/테스트 불변. ChatScreen이 `useChatPersistence(persona.id)`를 연결.
- greeting은 #4 합의대로 UI 전용 — DB에 저장하지 않는다.

### Nice-to-have
- 복원 중 로딩 표시
- append 실패 재시도 큐

## 성공 기준 (검증 가능)
- [ ] browser-id 유틸: 최초 호출 시 uuid 생성·localStorage 저장, 이후 동일 값 반환 (단위 테스트)
- [ ] conversations-api: GET 404→null, 200→파싱 / ensure(POST)·append(POST) URL·바디·메서드 정확 (fetch 모킹 단위)
- [ ] useChatStream에 persistence 주입 시 마운트 restore가 저장 turn을 greeting 뒤에 복원한다 (단위, 페이크 persistence)
- [ ] useChatStream: user 전송 시 onUserMessage, 성공 done 시 onModelMessage 호출 / 에러·단절 시 onModelMessage 미호출 (단위)
- [ ] persistence 미주입 시 기존 useChatStream 동작 불변 — 기존 7테스트 통과 (회귀)
- [ ] ChatScreen이 useChatPersistence(persona.id)를 useChatStream에 연결한다 (코드)
- [ ] 영속화 호출이 실패해도(rejected) 스트리밍 상태머신은 정상 진행한다 (단위/코드)
- [ ] 기존 web/api/shared 테스트 전부 통과 — 회귀 없음
- [ ] (verifier 라이브) 프론트 호출 시퀀스(ensure→append user→append model)가 실 API+DB로 왕복하고, 이후 GET restore가 같은 turn을 시간순 반환한다
