# 캐릭터 검색 — 공개 캐릭터 키워드 검색 · #24 (#17 1/3)

## 목적 / Why
공개 캐릭터를 키워드로 찾을 수 있게 해 발견 경험(B3)의 첫 조각을 만든다. 현재 홈은 템플릿 + 내 캐릭터만 보이고 공개 캐릭터를 탐색할 표면이 없다.

## 요구사항
### Must
- **백엔드** `GET /characters/public?q=<keyword>`:
  - `q` 있으면 `isPublic: true` AND (name OR tagline에 `contains`, 대소문자 무시) 필터, 최신순
  - `q` 없거나 빈 문자열이면 기존 동작(전체 공개 목록, 최신순) 유지
  - 비공개 캐릭터는 어떤 경우에도 비노출
  - Query DTO(`q?: string`)로 받고 전역 ValidationPipe(whitelist) 적용. 라우트 순서(`public`이 `:id`보다 먼저) 유지
- **프론트 클라** `characters-api.ts`에 `fetchPublicCharacters(q?: string)` 추가 — `q` 있으면 `?q=` 동반, best-effort(실패 시 빈 배열)
- **프론트 페이지** 새 `/discover`:
  - 공개 캐릭터 카드 목록(채팅 `/chat/:id` 진입) + 검색 입력
  - 검색어 입력 → 제출 시 `fetchPublicCharacters(q)`로 목록 갱신
  - 빈 결과/초기 상태 처리
  - 홈(page.tsx)에 `/discover` 진입 링크 추가
- 대소문자 무시(Postgres `mode: 'insensitive'`), `q` 부재 시 전체 — 확정된 기본값

### Nice-to-have
- 입력 디바운스 또는 검색 버튼(둘 중 단순한 쪽)

## 성공 기준 (검증 가능)
- [ ] service `listPublic(q)`가 `q` 있을 때 `where: { isPublic: true, OR: [{name contains q insensitive}, {tagline contains q insensitive}] }`로 prisma를 호출함을 단위 테스트가 단언 (q 부재 시 `{ isPublic: true }`만)
- [ ] **HTTP 계약 테스트**(CLAUDE.md 규약): `GET /characters/public?q=foo` → 200 + 서비스에 q 전달, `GET /characters/public`(q 없음) → 200. 라우트 매칭 + status. (prisma.character.findMany는 stub)
- [ ] `q`가 잘못된 타입(배열 등)이면 400 — Query DTO 검증
- [ ] 비공개 캐릭터가 검색/목록에 포함되지 않음을 단언(where에 `isPublic: true` 항상 포함)
- [ ] `fetchPublicCharacters(q)`가 `q` 있을 때 `?q=` 쿼리로 GET, 실패 시 빈 배열을 web 테스트가 단언
- [ ] `/discover` 페이지가 공개 캐릭터를 렌더하고, 검색 제출 시 `fetchPublicCharacters(q)`를 호출함을 컴포넌트 테스트가 단언
- [ ] 기존 characters/chat/conversations + web 회귀 없음 (api 전체 + web 전체 green, typecheck green)
