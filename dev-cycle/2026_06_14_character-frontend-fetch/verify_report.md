# Verify Report — 캐릭터 프론트 데이터레이어 fetch 전환 + 마이그레이션 (#21)

## Iteration 1 — 2026-06-14

독립 verifier sub-agent가 PRD 성공 기준에 대해 검증.

- tests:
  - `pnpm --filter @ai-character/web test` → **PASS** (43 passed, 6 files; characters-api 9 + character-store 12 포함).
  - `pnpm --filter @ai-character/web typecheck` → **PASS** (tsc --noEmit, 0 err).

- 성공 기준:
  - [x] web test 통과 (재작성 store + 신규 마이그레이션 테스트 포함, 43 green)
  - [x] web typecheck 통과 (0 err)
  - [x] characters-api 4함수가 #16 엔드포인트로 매핑(fetchOwned GET / create POST / update PATCH / delete DELETE)
  - [x] store가 캐릭터 출처로 localStorage 직접 R/W 안 함 — fetch 기반, localStorage는 마이그레이션 원본(LEGACY_KEY)·플래그(MIGRATED_KEY)만
  - [x] 순수 함수(sanitizeForSave/resolvePersona/newDraftFromTemplate/createCharacterId) 시그니처·동작 보존 — 테스트 단언
  - [x] 마이그레이션 (a) POST upsert 전송 (b) migrated 플래그로 2회차 skip (c) 원본 보존 — fetch mock 테스트 단언
  - [x] 6개 소비처 async 전환 + 생성 시 isPublic=false 전송

- 독립 검증 포인트:
  - 외부스토어 정합성: listUserCharacters 안정 참조(로드 전 공유 EMPTY), 변경 시 cache 새 배열 교체(제자리 변형 없음) → useSyncExternalStore 무한 렌더 위험 없음.
  - in-flight 가드: loadPromise 1회 설정(의도적 load-once), GET 1회. 마이그레이션 throw는 try/catch 흡수, fetch 실패는 [] fallback이라 loaded=true 도달.
  - chat-resolver 게이트: 템플릿 id는 동기 resolve로 즉시 렌더(로드 대기 없음), 미지 usr- id는 로드 완료 후에만 not-found(깜빡임 없음).
  - SSR/window 가드: migrateLegacyOnce/ensureLoaded 내부 typeof window 가드. API base 기본값 존재.
  - stale refs: useHydrated 실사용 0(주석만), async save/remove 모두 await/void 호출.

- verdict: **PASS**

- notes: 없음(클린). cache는 Persona[]로 선언되나 서버 CharacterRecord(=Persona + 추가 필드)를 담음 — 구조적 호환, 읽기엔 무해.
```
