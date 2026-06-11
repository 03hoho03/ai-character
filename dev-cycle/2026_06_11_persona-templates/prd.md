# 페르소나 템플릿 데이터 모델 + 샘플 템플릿 5종 (#4)

## 목적 / Why
템플릿에서 캐릭터를 만들 수 있어야 한다는 사용자 핵심 요구의 데이터 기반.
이 스키마가 #5(system instruction 빌더)와 #6(생성 폼)의 입력이므로 week 1 안에 확정한다.

## 요구사항

### Must
- `packages/shared`의 placeholder `Persona`를 풀 스키마로 확장 (단일 타입 — 템플릿도 `Persona`):
  - `id: string` — 템플릿은 `tpl-*` prefix 컨벤션
  - `name: string` — 이름
  - `personality: string` — 성격
  - `speechStyle: string` — 말투
  - `worldview: string` — 세계관
  - `greeting: string` — 인사말
  - `exampleDialogue: { user: string; model: string }[]` — 예시 대화 (few-shot turn 쌍)
  - `prohibitions?: string[]` — 금지사항 (sprint plan arch 합의: optional로 선납)
- 샘플 템플릿 5종 시드 데이터 `PERSONA_TEMPLATES: Persona[]` — 장르: 판타지 / 일상 / 로맨스 / SF / 조력자, 모두 한국어 콘텐츠
- 기존 `Persona { id, name }` 소비처와 하위 호환 (필드 추가만, 제거/개명 없음)
- `packages/shared`에 vitest 도입 + 시드 검증 테스트

### Nice-to-have
- 장르 식별용 주석 또는 id 네이밍 (`tpl-fantasy-…` 등)으로 5종 구분 가시화

## 성공 기준 (검증 가능)
- [ ] `pnpm --filter @ai-character/shared typecheck` 통과 — 모노레포 전체 typecheck도 깨지지 않음 (apps/api, apps/web)
- [ ] `Persona` 타입에 위 8개 필드가 명세대로 존재 (`prohibitions`만 optional)
- [ ] `PERSONA_TEMPLATES` 길이 5, 모든 id가 `tpl-` prefix이며 유니크
- [ ] 시드 5종 각각: 모든 필수 string 필드 non-empty, `exampleDialogue` 최소 1쌍 이상이며 각 쌍의 user/model non-empty
- [ ] 시드 5종이 서로 다른 5개 장르(판타지/일상/로맨스/SF/조력자)를 커버
- [ ] `pnpm --filter @ai-character/shared test` 로 위 검증이 자동 테스트로 통과
