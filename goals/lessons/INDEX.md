# Lessons Index — ai-character

> Learn skill이 누적하는 lesson store. 한 줄 = 한 lesson. 분류는 카테고리·confidence·seed taxonomy 세 축.
> 사람이 1분 안에 "이 프로젝트에서 반복되는 함정"을 식별할 수 있어야 한다.

**Last updated**: 2026-06-22
**Total lessons**: 10 (X:3, Y:5, W:2, Z:0)
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
| l_2026_06_19_y_split_migration_foundation_gap | 스키마 토대+전환 분할 시 토대가 후속 컬럼 제약(browserId NOT NULL) 미예견 → 후속에서 추가 마이그레이션 | 1 | tentative | next_goal_context |
| l_2026_06_20_y_identity_change_state_invalidation_gap | 소유 식별자/컨텍스트 변경이 2차 상태(load-once 캐시·테스트 Provider 하네스) 무효화 미열거 — '자격만 주입하면 끝' 가정 | 1 | tentative | next_goal_context |

### W — Collab Antipattern

| ID | Title | n | Confidence | Patch Target |
|---|---|---|---|---|
| l_2026_06_11_w_red_summary_overclaim | RED 요약 "전 항목 FAIL" — 실제 로그는 4 PASS / 4 FAIL | 1 | tentative | next_goal_context |
| l_2026_06_22_w_subagent_surrogate_serialization_break | 코드 읽는 병렬 sub-agent의 raw 출력 속 lone surrogate가 합류 시 API 400 → 오케스트레이션 턴 중단·중간유실 | 1 | tentative | next_goal_context |

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
- l_2026_06_18_x_config_presence_only_assertion (완화 준수 3회 확인 — #26/#28/#32, 약점 미재발이라 n 유지)
- l_2026_06_18_y_premise_stated_without_code_check
- l_2026_06_19_y_split_migration_foundation_gap
- l_2026_06_20_y_identity_change_state_invalidation_gap (within-cycle 2표면: 런타임 stale 캐시 + 테스트 Provider 회귀; #33에서 권장 *준수* — 아래 Counter-Evidence)
- l_2026_06_22_w_subagent_surrogate_serialization_break (병렬 sub-agent 출력 인코딩이 합류 단계서 요청 깨뜨림 — 오케스트레이션 도구 실패축)

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
| `foundation_constraint_blindness` (후보) | learn 제안 (#32, 2026-06-19) | 1 — y_split_migration_foundation_gap. 분할 마이그레이션 토대가 후속 제약을 못 봄 |
| `second_order_state_invalidation` (후보) | learn 제안 (#35/#36, 2026-06-20) | 1 — y_identity_change_state_invalidation_gap. 식별자/컨텍스트 변경이 그에 묶인 캐시·테스트 하네스 무효화를 못 봄. foundation_constraint_blindness와 인접(둘 다 2차 의존 맹점) — n 누적 시 상위 묶음 검토 |
| `subagent_output_serialization_break` (후보) | learn 제안 (#33 sprint-pm, 2026-06-22) | 1 — w_subagent_surrogate_serialization_break. 병렬 sub-agent의 raw 출력 인코딩(lone surrogate)이 합류 단계서 API 요청을 깨뜨림. 기존 W(자기봉합)와 다른 '오케스트레이션 도구 실패'축 |

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
- [y_split_migration_foundation_gap] 스키마를 토대+전환으로 분할할 때, 토대 PRD에서 후속 티켓이 요구할 *기존 컬럼 제약*(NOT NULL 완화/unique 방향/FK)을 미리 점검. 토대 verify에 "이 스키마로 다음 티켓이 추가 마이그레이션 없이 진행되나" 자문. ⚠️ #34(유니크키 (browserId,personaId)→(userId,personaId) 전환)에서 동일 함정 재발 추적.
- [y_identity_change_state_invalidation_gap] 소유 식별자/전역 컨텍스트를 도입·전환하는 티켓의 failure_modes에 "옛 식별자에 묶인 2차 상태" 점검 의무화 — (1) 런타임: load-once/메모이즈 캐시(싱글톤 store·useSyncExternalStore·SWR 키)를 전환점에 무효화+재로드, (2) 테스트: Provider 소비 컴포넌트를 공유 화면에 주입 시 그 화면 기존 spec을 grep해 wrapper 갱신 동반. 성공 기준이 'A 운반 + B 노출' 2절이면 B를 메커니즘(A)이 자동 보장한다고 가정 금지. ✅ #33에서 준수(클레임→reloadUserCharacters 순서로 캐릭터 캐시 무효화 + 대화 캐시는 browserId 키 유지로 비이슈임을 *명시 추론*). ⚠️ #34(전환 후 get-or-create 캐시 키)에서 재발 추적.
- [w_subagent_surrogate_serialization_break] 코드베이스를 읽어 raw 텍스트를 반환하는 sub-agent(특히 병렬 다수)를 호출하는 오케스트레이터(sprint-pm Phase 3·4, verify/code-review)는 에이전트 프롬프트에 인코딩 가드 명시("한글+ASCII만, 이모지·surrogate 문자 금지, 코드 특수문자는 ASCII 플레이스홀더"). 병렬 부분 실패 시 성공분은 트랜스크립트 회수 + 실패분만 재실행. `API 400 no low surrogate` 관측 시 '직전 sub-agent 출력의 lone surrogate'로 직행 진단.

---

## Counter-Evidence Log

- _(반증 0건)_ 이번 세션(2026-06-14) 4 dev-cycle은 기존 3 lesson을 모두 *준수*: RED는 비공허(모듈/메서드 부재로 실패), 기록물은 PASS/FAIL 카운트 인용(api 59 / web 57 / shared 38), pkill 부수피해 없음(테스트 기반 검증). 준수는 반증이 아니므로 라벨 변경 없음.
- _(적용 성공, 2026-06-18 #23)_ y_endpoint_http_test_gap의 권장(HTTP 계약 테스트)을 PRD 성공 기준에 *선반영* → /chat·/chat/stream에 strip·400·404 HTTP 테스트 동반, 컨트롤러 배선 갭 미발생. 반증 아님(약점은 실재) — 완화책이 작동한 긍정 증거. CLAUDE.md 승격 근거 강화.
- _(완화 정착, 2026-06-19 #26/#28/#32)_ x_config_presence_only_assertion의 권장(보안/정책 상수 *내용* 단언)이 CLAUDE.md 규약으로 반영된 뒤 #26(contentRating 등급값)·#28(쿠키 httpOnly/sameSite/maxAge + argon2 verify 왕복)·#32(userId 위조 data.userId===undefined)에서 일관 준수 — trigger 반복·symptom 미발생. 반증 아님(약점 실재, 완화 작동). 부수: verifier 자가교정(PASS 중 갭 in-cycle 적발) #23·#28 2회 — verifier 강점 패턴, 약점 카테고리 미수용으로 lesson화 보류.
- _(경계 단언 적용, 2026-06-20 #36)_ x_config_presence_only_assertion의 정신(존재가 아니라 *경계/내용* 단언)을 #36 credentials 테스트에 자발 적용 — 소유 경로는 credentials:'include' 운반을 단언하되, 공개 목록(fetchPublicCharacters)은 *미운반*을 명시 단언(`init?.credentials).toBeUndefined()`). "공개 경로에 자격이 새도 GREEN"이 되는 weak_check를 사전 차단. 반증 아님(완화 정신이 새 표면으로 확장된 긍정 증거).
- _(3 lesson 동시 준수, 2026-06-22 #33)_ ① y_identity_change_state_invalidation_gap — 클레임(식별자 변경)의 2차 상태를 열거: 캐릭터 캐시는 claim→reloadUserCharacters *순서*로 무효화, 대화 캐시는 conversations가 browserId 키를 유지(#40 전까지)해 비이슈임을 *명시 추론*(가정 회피). ② x_config_presence_only_assertion — updateMany의 where{browserId,userId:null}+data{userId}를 toHaveBeenCalledWith로 *내용* 단언, browserId 보존은 `'browserId' in data === false` 명시(멱등·충돌skip·보존이 구조로 보장됨을 박제). ③ y_premise_stated_without_code_check — PRD 전제("characters는 #32에서 userId 우선 조회라 클레임 전 빈 목록")를 Explore 서브에이전트가 코드로 확인 후 채택. 셋 다 반증 아님(약점 실재, 완화 작동).

---

## Pending Patch Approvals

- ✅ **[y_endpoint_http_test_gap → <project>/CLAUDE.md]** (weak, **2026-06-18 사용자 승인·적용 완료**): CLAUDE.md 테스트 규약에 "신규 NestJS 엔드포인트엔 supertest HTTP 계약 테스트 ≥1" + 라우트 순서 + 보안상수 내용단언 반영. lesson applied=true.
- _(대기 없음)_ 나머지 tentative lesson들은 next_goal_context 큐로만 운용(confidence < moderate).

---

## Meta

- **첫 lesson 추출**: 2026-06-11
- **마지막 학습 사이클**: 2026-06-22 (회고 모드 — dev-cycle 구현·검증 기반, 정식 run.yaml 아님. 대상 #33 + 선행 sprint-pm 중단 사건)
- **누적된 run 수**: 0 (정식) / 12 (dev-cycle 회고: 2026-06-11 ×1, 2026-06-14 ×4, 2026-06-18 ×1, 2026-06-19 ×3[#28/#31/#32], 2026-06-20 ×2[#35/#36], 2026-06-22 ×1[#33])
- **paired된 goal 수**: 0
- **긍정 관찰 (verifier 강점, lesson화 보류)**: verifier 자가교정 — PASS 판정 중에도 커버리지 갭을 in-cycle 적발·보강. #23(safetySettings 강화)·#28(만료 토큰 테스트 추가) 2회 관측. 약점 카테고리(X/Y/W)에 자리 없어 보류하나, Execute/positive 카테고리 신설 시 박제 후보.
- **Z 후보 관찰 (lesson화 보류, Execute skill 표준화 대기)**: ① pnpm 엄격 격리로 peer 도구(ts-loader) 미해석 ② nest 기본 webpack이 workspace 패키지를 external 처리 → 런타임 크래시 ③ (2026-06-14) best-effort 영속(#14)의 순서 보장 부재로 이론적 race — #18 in-flight append POST vs PUT replace 도착 순서 미보장. 셋 다 CLAUDE.md/Execute 후보.
