# 캐릭터 목록 홈 화면 (#7)

## 목적 / Why
현재 홈은 #3의 임시 텍스트 링크. 캐릭터를 카드로 둘러보고 채팅에 진입하는 정식 홈으로 교체하고,
#6(캐릭터 생성 폼) 진입점을 마련한다.

## 요구사항

### Must
- **shared 스키마**: `Persona`에 `tagline: string`(카드용 한줄소개, 필수) 추가, 템플릿 5종에 각각 작성
  - 캐릭터 톤이 드러나는 1문장 (예: 엘베리아 — "천 년의 마법을 연구하는 오만하고 다정한 엘프")
- **홈 카드 그리드** (`apps/web/src/app/page.tsx` 교체):
  - 카드: 아바타 placeholder(이름 첫 글자) + 이름 + tagline
  - 카드 클릭 → `/chat/<personaId>` 이동 (Link)
  - 반응형 그리드 (모바일 1열 → 데스크톱 2~3열, Tailwind)
- **'새 캐릭터 만들기' 진입점**: 그리드에 + 카드 → `/characters/new` 링크
- **`/characters/new` 준비 중 페이지**: placeholder (#6이 폼으로 교체), 홈으로 돌아가는 링크 포함
- **테스트**:
  - shared(vitest): 템플릿 5종 모두 tagline non-empty 검증 (#4 스펙 패턴 따름)
  - web(vitest + testing-library): 홈 렌더 — 카드 5종(이름·tagline), `/chat/<id>` href, 새 캐릭터 카드 `/characters/new` href
    (vitest esbuild jsx 설정 추가 필요 — tsconfig `jsx: preserve` 대응)

### Nice-to-have
- 카드 hover 시 greeting 1줄 미리보기

## 성공 기준 (검증 가능)
- [ ] `Persona.tagline` 필수 필드 존재, 템플릿 5종 tagline non-empty (vitest)
- [ ] 홈 렌더 테스트: 템플릿 5종의 이름·tagline 표시 + 각각 `/chat/<id>` 링크 (vitest)
- [ ] 홈 렌더 테스트: '새 캐릭터 만들기' → `/characters/new` 링크 (vitest)
- [ ] `/characters/new` 페이지 존재 — 준비 중 안내 + 홈 링크 (코드 확인 + 브라우저)
- [ ] 회귀 전부 PASS: `pnpm --filter @ai-character/shared test`, `pnpm --filter @ai-character/web test`, `cd apps/api && npx jest`, `pnpm typecheck`, web lint
- [ ] 브라우저 검증: 홈 그리드 렌더(5카드 + 새 캐릭터 카드), 카드 클릭 → 채팅 화면 이동, /characters/new 표시 — verify_report에 기록
