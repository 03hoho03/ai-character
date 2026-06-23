# conversations OwnerContext 전환 (#40, 38a)

스프린트 sp_2026_06_22_conv_ownership · characters #32 패턴 복제 · #34 토대 위 · 2026-06-23

## 목적 / Why
conversations는 아직 가드 0개 + service 5메서드가 browserId를 raw 비교한다. characters가 #32에서 한 OwnerContext 전환(OptionalJwtGuard + resolveOwner + ownerWhere/ownerMatches)을 복제해, 로그인 사용자가 자기 대화를 userId 기준으로 get-or-create/조회/수정하게 한다. #41(목록/삭제)·#42(인박스)의 선행 토대.

## 핵심 설계 결정 (Phase 1 확인 대상)
- **get-or-create 키**(#34 토대): 로그인이면 `userId_personaId`, 비로그인이면 `browserId_personaId`로 findUnique/create 분기.
- **로그인 생성 시 소유**: characters #32와 동일하게 `ownerWhere(owner)`만 set → 로그인 생성 대화는 **userId만**(browserId 없이). 비로그인 생성은 browserId만(기존 계약 보존).
- **소유검증**: append/replace/summarize는 id로 찾고 `ownerMatches(conv, owner)` 불일치 시 404(존재 비노출). 로그인 owner는 userId로, 비로그인 owner는 browserId로 비교.
- **신원**: userId는 쿠키 JWT(OptionalJwtGuard)에서만 — body/query의 userId·browserId 중 browserId만 폴백 신뢰(#23).

## 요구사항
### Must
- **컨트롤러**(`conversations.controller.ts`): 5개 라우트(POST `/`, GET `/`, POST `/:id/messages`, PUT `/:id/messages`, POST `/:id/summarize`)에 `@UseGuards(OptionalJwtGuard)` + `@Req()` + `resolveOwner(req, body|query.browserId)` 배선. `OwnedRequest` 타입 도입.
- **서비스**(`conversations.service.ts`): 5메서드 시그니처 `browserId: string` → `owner: OwnerContext`.
  - getOrCreate(owner, personaId): owner별 복합 unique 키로 findUnique, 없으면 `ownerWhere(owner)`로 create.
  - getByOwner(owner, personaId): owner별 복합 unique 키 findUnique(+messages).
  - appendMessage/replaceMessages/summarizeIfNeeded(id, owner, ...): id로 찾고 ownerMatches 불일치 404.
- **DTO**(`dto/conversation.dto.ts`): 4개 DTO의 browserId `@IsOptional()`화(characters BrowserIdQueryDto 패턴). shared 요청 타입(CreateConversationRequest/AppendMessageRequest/ReplaceMessagesRequest/SummarizeRequest/GetConversation*)의 browserId optional 정합.
- **ConversationsModule**이 OptionalJwtGuard를 쓰도록 AuthModule import(미import면 추가).
- **HTTP 계약 테스트 신설**(현재 conversations HTTP 0개): 라우트 매칭+성공 status + 로그인=userId 소유/비로그인=browserId 소유 + 소유 불일치 404 + body userId 위조 무시.
- **conversations.service.spec 갱신**: owner 객체(`{browserId:'b1'}`/`{userId:'u1'}`) 전달로 하네스 갱신, ownerWhere 키 단언(l_2026_06_20 — 식별자 변경의 테스트 2차 상태).

### Nice-to-have
- 라우트 순서 회귀(POST `/` vs POST `/:id/messages` 등 status 매칭) 테스트.

## 성공 기준 (검증 가능)
- [ ] 컨트롤러 5라우트가 OptionalJwtGuard + resolveOwner 사용. body/query의 userId는 무시(쿠키만 신뢰).
- [ ] 서비스 5메서드가 OwnerContext 수신. get-or-create: 로그인→`userId_personaId` 키, 비로그인→`browserId_personaId` 키(테스트가 키 내용 단언).
- [ ] 로그인 생성 대화는 userId 소유(create data.browserId 없음), 비로그인 생성은 browserId 소유(create data.userId 없음 — 기존 계약 보존).
- [ ] append/replace/summarize 소유 불일치 → 404(존재 비노출). 로그인 owner는 userId로, 비로그인은 browserId로 ownerMatches.
- [ ] body에 userId 위조해도 소유는 쿠키 userId(없으면 browserId) — 위조 무시.
- [ ] HTTP 계약 테스트 신설 통과(라우트 매칭+status+404+위조) + conversations.service.spec 갱신 GREEN.
- [ ] api 전체 jest + 양쪽 tsc GREEN, web 회귀 없음. get-or-create 비로그인 흐름(기존 프론트) 불변.
