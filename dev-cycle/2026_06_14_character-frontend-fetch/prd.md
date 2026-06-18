# 캐릭터 프론트 데이터레이어 fetch 전환 + 마이그레이션 (#21, 2/2 프론트)

## 목적 / Why
#16에서 백엔드 Character CRUD API가 생겼다. 프론트의 캐릭터 출처를 localStorage(동기)에서 서버 fetch로 옮겨 #16 백엔드와 합류시키고, 기존 localStorage 캐릭터를 서버로 일회성 마이그레이션한다. 이로써 공유·탐색(다음 sprint)의 프론트 전제가 선다. (공개/비공개 토글·탐색 화면 UI는 이번 비대상 — 데이터레이어만)

## 요구사항
### Must
- **characters-api.ts 신설** (conversations-api 패턴: 평이한 async fetch 함수, `NEXT_PUBLIC_API_URL`)
  - `fetchOwnedCharacters(browserId)` → GET `/characters?browserId=`
  - `createCharacter(persona, browserId)` → POST `/characters` (isPublic=false 고정)
  - `updateCharacter(id, patch, browserId)` → PATCH `/characters/:id`
  - `deleteCharacter(id, browserId)` → DELETE `/characters/:id`
  - 실패 시 throw(쓰기) / best-effort(읽기는 빈 목록 fallback 금지 — 로딩/에러 구분 위해 throw 후 상위에서 처리). 단순화를 위해 읽기는 실패 시 빈 배열.
- **character-store.ts 재작성 — 서버 백드 외부스토어**
  - useSyncExternalStore 계약(구독/스냅샷) **유지** → 6개 소비처 시그니처 churn 최소.
  - 인메모리 캐시를 서버에서 1회 로드(`ensureLoaded`, in-flight 가드) → 변경(저장/삭제) 후 캐시 갱신 + 구독자 통지.
  - `saveUserCharacter`/`removeUserCharacter`는 **async**로 전환(서버 호출 후 캐시 반영).
  - **순수 함수 보존**(시그니처 불변): `createCharacterId`, `newDraftFromTemplate`, `sanitizeForSave`, `resolvePersona`.
  - 초기 로드 완료 여부 게이트 제공(`useCharactersLoaded` 또는 기존 `useHydrated` 의미를 '로드 완료'로 확장) — not-found 깜빡임 방지.
- **소비처 동반 수정**
  - `user-character-list.tsx` — 삭제 버튼 async(`await removeUserCharacter`), 로드 게이트 반영.
  - `characters/new/page.tsx` — 저장 async(`await saveUserCharacter` 후 router.push).
  - `characters/[id]/edit/page.tsx` — 로드 게이트로 단건 조회, 저장/삭제 async.
  - `chat/[personaId]/chat-resolver.tsx` — 템플릿(동기) + 사용자(서버 로드) 합류, 로드 완료 게이트로 not-found 판정.
  - `character-form.tsx` — `sanitizeForSave`만 의존(순수, 변경 없음) 확인.
- **일회성 마이그레이션 (자동 import + 원본 보존)**
  - 앱 첫 로드(스토어 최초 읽기) 시 1회: 기존 localStorage 키(`ai-character:user-characters`) 캐릭터를 POST `/characters`(upsert)로 import.
  - 완료 플래그(`ai-character:characters-migrated`) 저장 → 재실행 skip. id가 `usr-`라 upsert 멱등이므로 플래그 유실 시 재import해도 안전.
  - 원본 localStorage 캐릭터는 **삭제하지 않음**(롤백 대비).

### Nice-to-have
- 쓰기 실패 사용자 피드백 토스트 — 이번엔 콘솔/throw로 충분.
- 공개/비공개 토글, 공개 탐색 화면 — 다음 ticket.

## 성공 기준 (검증 가능)
- [ ] `pnpm --filter @ai-character/web test` 통과 (재작성된 store 테스트 + 신규 마이그레이션 테스트 포함, 전부 green).
- [ ] `pnpm --filter @ai-character/web typecheck` 통과 (타입 에러 0).
- [ ] `characters-api.ts`에 fetchOwned/create/update/delete 4함수가 #16 엔드포인트로 매핑되어 존재.
- [ ] `character-store.ts`가 localStorage 직접 읽기/쓰기를 캐릭터 출처로 더는 쓰지 않음(서버 fetch 기반). 단, 마이그레이션 원본 읽기·migrated 플래그는 예외.
- [ ] 순수 함수(`sanitizeForSave`/`resolvePersona`/`newDraftFromTemplate`/`createCharacterId`) 시그니처·동작 보존을 기존/갱신 테스트가 단언.
- [ ] 마이그레이션이 (a) localStorage 캐릭터를 POST upsert로 보내고 (b) `migrated` 플래그로 2회차 skip하며 (c) 원본 localStorage를 보존함을 테스트가 fetch mock으로 단언.
- [ ] 6개 소비처가 async 전환 후 typecheck/test 통과, 신규 캐릭터 생성 시 isPublic=false로 전송됨.
