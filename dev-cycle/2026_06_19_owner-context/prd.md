# characters 소유검증 OwnerContext 전환 (#32, 29b)

## 목적 / Why
익명 browserId 소유를 계정(userId) 소유로 전환하는 백엔드 단계. #28 인증·#31 스키마 위에서, characters 소유검증을 `OwnerContext = 세션 userId ?? browserId` 폴백으로 바꾼다. 비로그인 익명 흐름은 그대로 보존(MVP-thin). conversations는 `(browserId,personaId)` unique가 소유키라 이번 범위 밖(#34).

## 요구사항
### Must
- **OptionalJwtGuard**(auth): 쿠키 JWT 있으면 검증해 `req.user={userId,email}` 주입, **없으면 통과**(401 안 던짐 — 비로그인 폴백 허용).
- **OwnerContext** 타입 `{ userId } | { browserId }` + `resolveOwner(req, browserId?)` 헬퍼(공용): 쿠키 userId 우선, 없으면 browserId, 둘 다 없으면 400. **userId는 쿠키에서만**(body/query userId 불신뢰 — #23 경계).
- **characters.service** 6메서드(create/getOwned/getOne/update/remove/assertOwner): `browserId: string` → `owner: OwnerContext`. where/data/일치판정을 owner로 분기(`'userId' in owner ? {userId} : {browserId}`).
  - 생성: 로그인이면 userId 소유, 비로그인이면 browserId 소유. upsert 권한도 owner 일치 기준.
  - 조회/검증: 로그인이면 userId 일치, 비로그인이면 browserId 일치. (로그인 사용자는 자기 userId 소유물만 — 익명 데이터는 클레임 #33 전까지 안 보임.) getOne의 `isPublic` 공개 조회는 유지.
- **characters.controller**: 전 핸들러 `@UseGuards(OptionalJwtGuard)` + `@Req`로 owner 추출. DTO의 browserId를 optional로(로그인이면 불필요, 비로그인이면 사용).
- **chat**: chat.controller에 OptionalJwtGuard + owner 추출, chat.service `resolvePersona`/`characters.getOne` 호출에 owner 전달. chat-request.dto browserId optional.
- **conversations 무변경**(browserId 유지 — 완전 전환은 #34).

### Nice-to-have
- 없음.

## 성공 기준 (검증 가능)
- [ ] 로그인(쿠키 JWT) 요청 → characters 소유검증이 **userId 기준**. 로그인 사용자는 자기 userId 소유 캐릭터만 getOwned/getOne/update/remove 가능.
- [ ] 비로그인(쿠키 없음, browserId 동반) → **browserId 폴백**으로 기존 흐름 동작. 기존 characters/chat HTTP·service 테스트 GREEN 유지(회귀 0).
- [ ] 비소유 접근 → **404**(존재 비노출) 유지. 로그인 사용자가 타 userId/browserId 소유물 접근 시 404, isPublic은 조회 허용.
- [ ] **userId 위조 불가**: body/query에 userId를 넣어도 무시되고 쿠키만 신뢰 — 테스트로 단언.
- [ ] conversations browserId 흐름 **무변경**(회귀 0). chat usr-* 소유확인은 characters.getOne 전환을 따라감.
- [ ] 신규/변경 엔드포인트 supertest HTTP 계약 테스트(로그인 userId / 비로그인 browserId / 위조 / 404). 기존 characters.service.spec은 owner 시그니처로 갱신(비로그인=browserId 케이스로 기존 계약 보존 + 로그인 userId 케이스 추가). api·web typecheck 통과.
