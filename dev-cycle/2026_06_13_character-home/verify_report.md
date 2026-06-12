# verify_report — 캐릭터 목록 홈 (#7)

## Iteration 1 — 2026-06-13
- tests:
  - `pnpm --filter @ai-character/shared test` → PASS (3 files, 31 tests — personas.spec 12 / persona-prompt.spec 8 / chat-stream.spec 11)
  - `pnpm --filter @ai-character/web test` → PASS (2 files, 9 tests — page.spec.tsx 2 / useChatStream.spec.ts 7)
  - `cd apps/api && npx jest` → PASS (4 suites, 25 tests — 회귀 무손상)
  - `pnpm typecheck` → PASS (shared / api / web 모두 tsc --noEmit 통과)
  - `pnpm --filter @ai-character/web lint` → PASS (eslint 무경고)
- 브라우저 검증 (chrome-devtools, dev server port 3000):
  - 홈(/) 렌더 → PASS: 카드 5종 모두 아바타 첫 글자(엘/김/서/N/장) + 이름 + tagline 표시, href가 각각 `/chat/tpl-fantasy-elveria`, `/chat/tpl-daily-haru`, `/chat/tpl-romance-seo`, `/chat/tpl-sf-nova`, `/chat/tpl-helper-dr-jang`. '새 캐릭터 만들기' + 카드(점선 테두리) → `/characters/new`. 스크린샷 확인(데스크톱 3열 그리드).
  - 카드 클릭(엘베리아) → PASS: `/chat/tpl-fantasy-elveria` 이동, #3 채팅 화면(홈으로 링크 + greeting 메시지 + 입력 폼) 정상 렌더 — 회귀 없음.
  - '새 캐릭터 만들기' 클릭 → PASS: `/characters/new` 이동, "캐릭터 만들기" 제목 + "준비 중입니다…" 안내 + "← 홈으로 돌아가기" 링크(href `/`) 확인, 스크린샷 확인.
  - 반응형 → PASS: 좁은 폭(<640px)에서 grid-template-columns 1열, 데스크톱에서 3열 (Tailwind `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`).
  - 콘솔 → 치명 에러 없음 (React DevTools 안내 info + HMR 로그만). 검증 후 dev server 종료.
- 성공 기준:
  - [x] `Persona.tagline` 필수 필드 존재(index.ts 비-optional), 템플릿 5종 tagline non-empty — personas.spec.ts의 REQUIRED_STRING_FIELDS에 'tagline' 포함되어 it.each로 5종 전부 typeof string + trim non-empty 실검증
  - [x] 홈 렌더 테스트: 템플릿 5종 이름·tagline + `/chat/<id>` 링크 — page.spec.tsx가 PERSONA_TEMPLATES를 순회하며 getByRole link의 `href` 속성을 정확히 `/chat/${persona.id}`와 비교, tagline은 getByText로 존재 검증 (형식적 테스트 아님)
  - [x] 홈 렌더 테스트: '새 캐릭터 만들기' → `/characters/new` href 직접 비교
  - [x] `/characters/new` 페이지 존재 — 준비 중 안내 + 홈 링크 (코드 + 브라우저 모두 확인)
  - [x] 회귀 전부 PASS (shared/web vitest, api jest, typecheck, web lint)
  - [x] 브라우저 검증 (위 기록)
- verdict: PASS
- notes:
  - tagline 필수화 파급 점검: Persona를 객체 리터럴로 구성하는 곳은 personas.ts(템플릿 5종)와 persona-prompt.spec.ts fixture뿐 — 둘 다 tagline 추가됨. 나머지(chat-screen.tsx, useChatStream, api app.controller)는 타입 참조/PERSONA_TEMPLATES 사용이라 영향 없음. typecheck 전 워크스페이스 통과로 교차 확인.
  - 비차단 사소사항 1: 모든 페이지 `<title>`이 기본값 "Create Next App" — layout metadata 미설정. PRD 범위 밖이라 비차단이나 후속에서 정리 권장.
  - 비차단 사소사항 2: page.spec.tsx의 `new RegExp(persona.name)`은 이스케이프 없이 이름을 정규식으로 사용 — 현재 이름들('NOVA-7' 포함)에서는 안전하나 정규식 특수문자가 든 이름 추가 시 깨질 수 있음.
  - 비차단 사소사항 3: 홈 렌더 테스트는 아바타 첫 글자 표시를 검증하지 않음 — PRD 성공 기준(이름·tagline·href)에는 명시되지 않아 기준 위반은 아니며, 브라우저에서 표시 확인함.
