# Verify Report — 캐릭터 생성/편집 폼 (#6)

테스트 인프라: vitest + jsdom + @testing-library/react (apps/web).
단위 테스트 가능 영역(저장소 CRUD/검증/resolve)은 TDD로 RED→GREEN.
UI 플로우(폼/홈/채팅 연동)는 독립 verifier가 컴포넌트 코드 wiring을 직접 검사 + 프로덕션 빌드로 확인.

## Iteration 1 — 2026-06-13
- tests: `pnpm test` (apps/web) → 24 passed / 0 failed
- lint / typecheck / `next build` → 모두 통과 (5 라우트 생성)
- 성공 기준:
  - [x] localStorage CRUD 단위 테스트 (왕복/usr- prefix/충돌 없음)
  - [x] 저장 검증 테스트 (name 공백 거부, 빈 turn 필터)
  - [x] 홈에 사용자 캐릭터 + 편집/삭제 진입점
  - [x] `/chat/<usr-id>` resolve, 템플릿 회귀 없음
  - [x] 폼 프리필 + exampleDialogue/prohibitions 행 추가·삭제
  - [x] 저장 직후 해당 캐릭터 채팅으로 이동
  - [x] 편집 같은 id 갱신 / 삭제 시 목록에서 제거 (※ live-refresh 결함 — 아래)
  - [x] 기존 web/shared 테스트 통과
- verdict: **FAIL** (1 correctness bug)
- notes (독립 verifier):
  - **B1 (medium)**: `saveUserCharacter`가 캐시 배열을 제자리 변형 후 동일 참조 재할당 → `useSyncExternalStore`가 `Object.is`로 변화 미감지 → 이미 마운트된 홈 목록이 생성/편집 후 stale. (삭제는 filter라 새 배열 → 정상)
  - **B2 (low)**: 같은 근본 원인으로 SSR/parse-fail 경로의 공유 `EMPTY` 센티넬이 변형될 잠재 위험.

## Iteration 2 — 2026-06-13 (B1/B2 수정)
- 원인: `writeAll(readAll())` 패턴의 제자리 변형 + 동일 참조 재할당.
- 수정: `saveUserCharacter`를 항상 새 배열 생성으로 변경
  (`idx>=0 ? all.map(...) : [...all, persona]`). `removeUserCharacter`는 이미 filter.
- 추가: 스냅샷 참조 교체 + 이전 스냅샷 불변을 검증하는 회귀 테스트 (구버전이면 FAIL).
- tests: `pnpm test` → 25 passed / 0 failed · lint · typecheck 통과
- 독립 verifier 재검증: **B1 PASS, B2 PASS**, 회귀 테스트가 구버전을 실제로 잡아냄 확인, 신규 이슈 없음.
- verdict: **PASS**

## 비고 (회귀 아님, 차기 참고)
- `saveUserCharacter`가 전달된 persona를 clone 없이 참조 저장 — 현재 호출부는 `sanitizeForSave`가 spread로 만든 신선한 객체를 넘기므로 무해. DB 이전(#14) 시 자연 해소.
