# Verify Report — #24 캐릭터 검색 (공개 캐릭터 키워드 검색)

## Iteration 1 — 2026-06-18

- tests:
  - `apps/api && pnpm test` → **7 suites / 77 tests PASS**
  - `apps/web && pnpm test` → **8 files / 63 tests PASS**
  - `pnpm -r typecheck` → **3/3 Done**

- 성공 기준 (PRD 7항목):
  - [x] service `listPublic(q)` where 구성 — q 있을 때 `{isPublic:true, OR:[name/tagline contains insensitive]}`, q 부재/공백 시 `{isPublic:true}`. 단위 테스트 toHaveBeenCalledWith 정확 단언
  - [x] HTTP 계약 테스트(CLAUDE.md 규약) — `characters.http.spec.ts`: q없음 200 + 라우트순서(findMany 호출로 public이 :id보다 먼저 매칭 실증), q=마법 200 + OR 필터 전달
  - [x] q 배열 → 400 (Query DTO @IsString 거부, transform:true에도 실증)
  - [x] 비공개 항상 제외 — where.isPublic:true 고정, 전용 단언
  - [x] fetchPublicCharacters(q) — q 있을 때 ?q= 인코딩 동반, 실패(500/network) 시 빈 배열
  - [x] /discover 페이지 — 마운트 로드 + 검색 제출 시 fetchPublicCharacters(q) 호출 + 결과 렌더 + 빈 상태
  - [x] 회귀 없음 — api 77 / web 63 / typecheck green. 홈 /discover 링크 추가가 page.spec 미충돌

- 독립 검증 포인트:
  - 라우트 순서(public vs :id) 회귀를 HTTP 테스트가 findMany 호출로 실증(추론 아님)
  - Prisma 실제 row 필터링은 stub이라 단위로 안 잡히는 한계 → 서비스 단위에서 where 객체(insensitive mode 포함) 정확 단언으로 보완 (CLAUDE.md weak_check 우려 대응)
  - Query DTO whitelist 보존, 기존 q 없는 동작 유지

- verdict: **PASS**

- notes:
  - (해소) 검색 후 빈 결과는 "검색 결과가 없습니다.", 초기 빈 목록은 "공개 캐릭터가 없습니다."로 문구 구분(iteration 1 내 반영).
  - (non-blocking) 로딩 중 명시 상태 표시 없음(빈 ul) — PRD 최소 충족. 디바운스 대신 검색 버튼 채택(단순한 쪽).
