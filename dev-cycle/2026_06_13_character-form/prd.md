# 캐릭터 생성/편집 폼 (#6)

## 목적 / Why
스프린트 goal의 나머지 절반 — "템플릿에서 *자기 캐릭터를 만들고* 대화". 지금은 템플릿으로 바로 채팅만 되고, 사용자가 자기 캐릭터를 갖는 경로가 없다(`/characters/new`는 placeholder). 이 티켓이 목록→생성→채팅 MVP 루프를 닫는다.

## 요구사항

### Must
- **저장소 (localStorage, #9 defer 전제)**
  - 사용자 캐릭터를 localStorage에 저장/조회/수정/삭제하는 순수 모듈 (`apps/web` 내). 키 컨벤션 고정, 캐릭터 id는 `usr-<…>` prefix로 템플릿(`tpl-`)과 구분.
  - 페르소나 스키마는 `@ai-character/shared`의 `Persona` 그대로 사용(신규 타입 금지).
- **생성 플로우**: 템플릿 선택 → 폼이 해당 템플릿 값으로 프리필 → 전 필드 편집 → 저장 → **그 캐릭터로 바로 채팅(`/chat/<id>`) 진입**.
- **편집 플로우**: 저장된 사용자 캐릭터를 다시 열어 전 필드 수정 후 저장.
- **삭제 플로우**: 저장된 사용자 캐릭터 삭제.
- **전 필드 편집 가능** (Persona 스키마 전체):
  - 단순 텍스트: name, tagline, personality, speechStyle, worldview, greeting
  - 배열 — **동적 추가/삭제**:
    - exampleDialogue: user/model 쌍 turn을 행 단위로 추가/삭제/수정
    - prohibitions: 항목을 행 단위로 추가/삭제/수정 (optional — 0개 허용)
- **연동**:
  - 홈(#7): 템플릿 + 사용자 캐릭터를 함께 노출 (사용자 캐릭터 편집/삭제 진입점 포함).
  - 채팅(#3): `/chat/<id>`가 템플릿 + 사용자 캐릭터 양쪽에서 persona를 resolve (현재 서버 컴포넌트가 템플릿만 보고 `notFound()` → localStorage 합류 위해 클라이언트 resolve로 전환).
- **검증**: 저장 시 최소 name 비어있지 않음. exampleDialogue turn은 user/model 둘 다 채워진 행만 저장.

### Nice-to-have
- 미저장 변경 이탈 경고
- 템플릿 미리보기(저장 전 greeting 등)

## 성공 기준 (검증 가능)
- [ ] localStorage CRUD 모듈에 단위 테스트 — create/get/list/update/remove 왕복, id `usr-` prefix, 템플릿과 충돌 없음
- [ ] 저장 검증 로직 테스트 — name 공백이면 거부, 빈 user/model turn은 필터링
- [ ] 홈에서 사용자 캐릭터가 템플릿과 함께 렌더되고, 각각 편집/삭제 진입점이 보인다
- [ ] `/chat/<usr-id>`로 진입 시 저장된 사용자 캐릭터의 persona가 resolve되어 `notFound()` 나지 않는다 (템플릿 id도 기존대로 동작 — 회귀 없음)
- [ ] 생성 폼: 템플릿 선택 시 전 필드가 프리필되고, exampleDialogue/prohibitions 행을 추가·삭제할 수 있다
- [ ] 저장 직후 해당 캐릭터의 채팅 화면으로 이동한다
- [ ] 편집 후 저장 시 같은 id로 갱신되고, 삭제 시 목록에서 사라진다
- [ ] 기존 테스트(web/shared) 전부 통과 — 회귀 없음
