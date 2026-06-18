# Lessons Index — ai-character

> Learn skill이 누적하는 lesson store. 한 줄 = 한 lesson. 분류는 카테고리·confidence·seed taxonomy 세 축.
> 사람이 1분 안에 "이 프로젝트에서 반복되는 함정"을 식별할 수 있어야 한다.

**Last updated**: 2026-06-18
**Total lessons**: 7 (X:3, Y:3, W:1, Z:0)
**Disconfirmed**: 0

---

## By Category

### X — Verifier Weakness

| ID | Title | n | Confidence | Patch Target |
|---|---|---|---|---|
| l_2026_06_11_x_vacuous_red_baseline | 재귀 러너 검증, 패키지 0개일 때 공허 PASS → RED 오염 | 1 | tentative | next_goal_context |
| l_2026_06_11_x_dev_server_check_side_effects | 포트 사전 점유 위양성 + pkill -f 부수 피해 | 1 | tentative | next_goal_context |
| l_2026_06_18_x_config_presence_only_assertion | 보안/설정 상수 테스트가 존재(Array.isArray+length)만 단언 — 내용 회귀 미감지 | 1 | tentative | next_goal_context |

### Y — Define Weakness

| ID | Title | n | Confidence | Patch Target |
|---|---|---|---|---|
| l_2026_06_14_y_unverified_command_in_criteria | PRD 성공 기준이 실존 미확인 명령(`shared build`) 가정 → verifier 동치 대체 통과 | 1 | tentative | next_goal_context |
| l_2026_06_14_y_endpoint_http_test_gap | 신규 HTTP 엔드포인트가 서비스 단위 테스트만 — controller 배선은 추론으로만 검증 | 2 | weak | next_goal_context / CLAUDE.md(승인대기) |
| l_2026_06_18_y_premise_stated_without_code_check | 티켓/PRD 전제를 코드 미확인 채 사실로 단정 — Architect 코드 확인이 정정 | 1 | tentative | next_goal_context |

### W — Collab Antipattern

| ID | Title | n | Confidence | Patch Target |
|---|---|---|---|---|
| l_2026_06_11_w_red_summary_overclaim | RED 요약 "전 항목 FAIL" — 실제 로그는 4 PASS / 4 FAIL | 1 | tentative | next_goal_context |

### Z — Execute Pattern

| ID | Title | n | Confidence | Patch Target |
|---|---|---|---|---|
| _(Execute skill 미구축 — 후크만. 단, 후보 관찰 2건은 아래 Meta 참조)_ | | | | |

---

## By Confidence

### Strong (n≥3 + 명확 패턴)
- _(없음)_

### Moderate (n≥2 + 비슷한 trigger-symptom)
- _(없음)_

### Weak (n≥2이지만 형태 다양)
- l_2026_06_14_y_endpoint_http_test_gap

### Tentative (n=1, 가설)
- l_2026_06_11_x_vacuous_red_baseline
- l_2026_06_11_x_dev_server_check_side_effects
- l_2026_06_11_w_red_summary_overclaim
- l_2026_06_14_y_unverified_command_in_criteria
- l_2026_06_18_x_config_presence_only_assertion
- l_2026_06_18_y_premise_stated_without_code_check

### Disconfirmed (이전 lesson이 새 데이터로 반박됨)
- _(없음)_

---

## Seed Taxonomy 매칭 분포

| Code | 출처 | 매칭된 lesson 수 |
|---|---|---|
| `silent_skip` | 사용자 명명 (whatMeow Stage 1) | 1 |
| `weak_check` | 사용자 명명 (whatMeow Stage 1) | 4 |
| `intent_drift` | 사용자 명명 (whatMeow Stage 1) | 1 |
| `unverified_premise` (후보) | learn 제안 (#19, 2026-06-18) | 1 — y_premise_stated_without_code_check. y_unverified_command와 병합 후보 |

---

## Next Goal Context Queue

> 다음 goal-extract / dev-cycle 호출 시 사전 주입할 컨텍스트.

- [x_vacuous_red_baseline] Test First의 RED 실행 후 "FAIL이어야 할 기준이 PASS인 항목" 명시 점검. 재귀 러너 체크엔 대상 존재 가드를 짝으로.
- [x_dev_server_check_side_effects] 서버 기동 검증: 포트 사전 점유 체크 → 점유 시 즉시 FAIL-with-reason. 정리는 패턴 pkill 금지, 기록한 PID만 종료.
- [w_red_summary_overclaim] 기록물에 "전부/모두" 전칭 표현 금지 — PASS/FAIL 카운트 원문 인용 (예: "4 PASS / 4 FAIL").
- [y_unverified_command_in_criteria] PRD 성공 기준에 명령(`build`/`lint`/커스텀 script)을 적기 전 대상 package.json scripts 실존 확인. 없으면 실존 명령으로.
- [y_endpoint_http_test_gap] 신규 NestJS 엔드포인트는 성공 기준에 supertest HTTP 계약 테스트 ≥1(라우트 매칭+status+DTO 거부). 리터럴/`:param` 경로 공존 시 라우트 순서 테스트 필수. ✅ #23에서 선적용 — /chat·/chat/stream HTTP 테스트(strip·400·404) 동반, 갭 미발생.
- [x_config_presence_only_assertion] 보안/정책 상수(safetySettings·contentRating·권한 플래그) 테스트는 존재가 아니라 *내용*을 단언 — 필수 키 집합 + 핵심 값(threshold/등급). "baseline이 약화돼도 GREEN"이면 weak_check.
- [y_premise_stated_without_code_check] 이슈 body/PRD '현재 X가 안 된다/없다' 전제는 grep/Read 코드 대조 후 채택. 틀리면 요구사항·성공 기준 재정의(독립 Architect/코드확인 게이트).

---

## Counter-Evidence Log

- _(반증 0건)_ 이번 세션(2026-06-14) 4 dev-cycle은 기존 3 lesson을 모두 *준수*: RED는 비공허(모듈/메서드 부재로 실패), 기록물은 PASS/FAIL 카운트 인용(api 59 / web 57 / shared 38), pkill 부수피해 없음(테스트 기반 검증). 준수는 반증이 아니므로 라벨 변경 없음.
- _(적용 성공, 2026-06-18 #23)_ y_endpoint_http_test_gap의 권장(HTTP 계약 테스트)을 PRD 성공 기준에 *선반영* → /chat·/chat/stream에 strip·400·404 HTTP 테스트 동반, 컨트롤러 배선 갭 미발생. 반증 아님(약점은 실재) — 완화책이 작동한 긍정 증거. CLAUDE.md 승격 근거 강화.

---

## Pending Patch Approvals

- ✅ **[y_endpoint_http_test_gap → <project>/CLAUDE.md]** (weak, **2026-06-18 사용자 승인·적용 완료**): CLAUDE.md 테스트 규약에 "신규 NestJS 엔드포인트엔 supertest HTTP 계약 테스트 ≥1" + 라우트 순서 + 보안상수 내용단언 반영. lesson applied=true.
- _(대기 없음)_ 나머지 tentative lesson들은 next_goal_context 큐로만 운용(confidence < moderate).

---

## Meta

- **첫 lesson 추출**: 2026-06-11
- **마지막 학습 사이클**: 2026-06-18 (회고 모드 — dev-cycle verify_report + sprint conflicts 기반, 정식 run.yaml 아님)
- **누적된 run 수**: 0 (정식) / 6 (dev-cycle 회고: 2026-06-11 ×1, 2026-06-14 ×4, 2026-06-18 ×1)
- **paired된 goal 수**: 0
- **Z 후보 관찰 (lesson화 보류, Execute skill 표준화 대기)**: ① pnpm 엄격 격리로 peer 도구(ts-loader) 미해석 ② nest 기본 webpack이 workspace 패키지를 external 처리 → 런타임 크래시 ③ (2026-06-14) best-effort 영속(#14)의 순서 보장 부재로 이론적 race — #18 in-flight append POST vs PUT replace 도착 순서 미보장. 셋 다 CLAUDE.md/Execute 후보.
