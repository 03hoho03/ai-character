# Lessons Index — ai-character

> Learn skill이 누적하는 lesson store. 한 줄 = 한 lesson. 분류는 카테고리·confidence·seed taxonomy 세 축.
> 사람이 1분 안에 "이 프로젝트에서 반복되는 함정"을 식별할 수 있어야 한다.

**Last updated**: 2026-06-27
**Total lessons**: 13 (X:4, Y:5, W:4, Z:0) — 회고 sp_2026_06_27_story_mode(#43~#51) 신규 3건(X:1, W:2). 기존 lesson 준수·완화 다수(아래 회고 노트).
**Disconfirmed**: 0

---

## By Category

### X — Verifier Weakness

| ID | Title | n | Confidence | Patch Target |
|---|---|---|---|---|
| l_2026_06_11_x_vacuous_red_baseline | 재귀 러너 검증, 패키지 0개일 때 공허 PASS → RED 오염 | 1 | tentative | next_goal_context |
| l_2026_06_11_x_dev_server_check_side_effects | 포트 사전 점유 위양성 + pkill -f 부수 피해 | 1 | tentative | next_goal_context |
| l_2026_06_18_x_config_presence_only_assertion | 보안/설정 상수 테스트가 존재(Array.isArray+length)만 단언 — 내용 회귀 미감지 | 1 | tentative | next_goal_context |
| l_2026_06_27_x_green_test_not_exercising_claimed_path | GREEN 테스트가 criterion이 겨눈 속성/경로를 실제로 안 탐(구조요소 누락·경로 divergence·조건 비격리) — 독립 verify가 적발 | 3 | weak | next_goal_context |

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
| l_2026_06_27_w_worktree_agent_branch_integration | 병렬 worktree 에이전트 산출이 사이드 브랜치(feat/* in 메인트리)로 들어와 명시적 통합(ff-merge·브랜치 위치 확인) 필요 | 2 | weak | next_goal_context |
| l_2026_06_27_w_parallel_agent_timeout_partial_recovery | 병렬 에이전트 스트림 타임아웃 → worktree 부분 산출(RED 테스트) 잔존 → 폐기 말고 인수 복구 | 1 | tentative | next_goal_context |

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
| `orchestration_integration_gap` (후보) | learn 제안 (#47/#48, 2026-06-27) | 2 — w_worktree_agent_branch_integration. 병렬 에이전트 산출이 사이드 브랜치로 들어와 명시적 통합 필요. 위 surrogate_break와 함께 '병렬 오케스트레이션 통합/실패'축 형성 — n 누적 시 상위 묶음 검토 |
| `agent_turn_interruption_recovery` (후보) | learn 제안 (#50, 2026-06-27) | 1 — w_parallel_agent_timeout_partial_recovery. 에이전트 턴 중단 시 부분 산출 회수·인수. surrogate_break(턴 중단·중간유실)와 인접 |

---

## Next Goal Context Queue

> 다음 goal-extract / dev-cycle 호출 시 사전 주입할 컨텍스트.

- [x_vacuous_red_baseline] Test First의 RED 실행 후 "FAIL이어야 할 기준이 PASS인 항목" 명시 점검. 재귀 러너 체크엔 대상 존재 가드를 짝으로.
- [x_dev_server_check_side_effects] 서버 기동 검증: 포트 사전 점유 체크 → 점유 시 즉시 FAIL-with-reason. 정리는 패턴 pkill 금지, 기록한 PID만 종료.
- [w_red_summary_overclaim] 기록물에 "전부/모두" 전칭 표현 금지 — PASS/FAIL 카운트 원문 인용 (예: "4 PASS / 4 FAIL").
- [y_unverified_command_in_criteria] PRD 성공 기준에 명령(`build`/`lint`/커스텀 script)을 적기 전 대상 package.json scripts 실존 확인. 없으면 실존 명령으로.
- [y_endpoint_http_test_gap] 신규 NestJS 엔드포인트는 성공 기준에 supertest HTTP 계약 테스트 ≥1(라우트 매칭+status+DTO 거부). 리터럴/`:param` 경로 공존 시 라우트 순서 테스트 필수. ✅ #23에서 선적용 — /chat·/chat/stream HTTP 테스트(strip·400·404) 동반, 갭 미발생.
- [x_config_presence_only_assertion] 보안/정책 상수(safetySettings·contentRating·권한 플래그) 테스트는 존재가 아니라 *내용*을 단언 — 필수 키 집합 + 핵심 값(threshold/등급). "baseline이 약화돼도 GREEN"이면 weak_check. **확장(#34)**: 데이터 마이그레이션(dedupe 등 DML)도 SQL *문자열 존재*만 단언하면 동작 미검증(weak_check) → 실 DB BEGIN/ROLLBACK 스크립트로 *행동* 검증(seed→실행→assert→throw로 rollback, dev DB 무오염). 스크립트가 마이그레이션의 실제 SQL을 마커(`-- #N-dedupe-start/end`)로 추출해 실행하면 테스트가 진짜 아티팩트에 묶임(동치 대체 회피). jest 스위트는 DB 비의존 유지(스키마/SQL 내용 단언만), 행동은 별도 스크립트로 분리해 CI DB 비의존 보존.
- [migration-tooling] prisma `migrate dev`는 인터랙티브 전용 — 비인터랙티브(에이전트/CI) 환경서 실패. 우회: 스키마 수정 → `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel ... --script`로 DDL 생성 → 마이그레이션 폴더 수작업 구성(데이터 정리 SQL을 DDL 앞에 배치) → `prisma migrate deploy`로 적용. 커스텀 데이터 마이그레이션(dedupe 후 제약 추가)은 단일 .sql에 순서대로(정리 DELETE → ALTER → CREATE UNIQUE INDEX).
- [y_premise_stated_without_code_check] 이슈 body/PRD '현재 X가 안 된다/없다' 전제는 grep/Read 코드 대조 후 채택. 틀리면 요구사항·성공 기준 재정의(독립 Architect/코드확인 게이트).
- [y_split_migration_foundation_gap] 스키마를 토대+전환으로 분할할 때, 토대 PRD에서 후속 티켓이 요구할 *기존 컬럼 제약*(NOT NULL 완화/unique 방향/FK)을 미리 점검. 토대 verify에 "이 스키마로 다음 티켓이 추가 마이그레이션 없이 진행되나" 자문. ✅ #34에서 *회피* — 토대(browserId nullable + (userId,personaId) unique)를 함께 처리해 #40이 추가 마이그레이션 0으로 진행. 완화책 실효 확인.
- [y_identity_change_state_invalidation_gap] 소유 식별자/전역 컨텍스트를 도입·전환하는 티켓의 failure_modes에 "옛 식별자에 묶인 2차 상태" 점검 의무화 — (1) 런타임: load-once/메모이즈 캐시(싱글톤 store·useSyncExternalStore·SWR 키)를 전환점에 무효화+재로드, (2) 테스트: Provider 소비 컴포넌트를 공유 화면에 주입 시 그 화면 기존 spec을 grep해 wrapper 갱신 동반. 성공 기준이 'A 운반 + B 노출' 2절이면 B를 메커니즘(A)이 자동 보장한다고 가정 금지. ✅ 준수: #33(클레임→reloadUserCharacters 순서), #40(테스트 하네스 OwnerContext 갱신), #42(인박스). **완화 메뉴 확장(#42)**: 소유자별 파생 상태는 load-once 전역 캐시+무효화 대신 *page-local fresh fetch(영속 캐시 부재, 세션 식별자 의존 useEffect)*를 우선 — 단일 화면 소비면 캐시 자체를 안 만드는 게 stale 원천 차단. 전역 공유 필요할 때만 store+무효화.
- [w_subagent_surrogate_serialization_break] 코드베이스를 읽어 raw 텍스트를 반환하는 sub-agent(특히 병렬 다수)를 호출하는 오케스트레이터(sprint-pm Phase 3·4, verify/code-review)는 에이전트 프롬프트에 인코딩 가드 명시("한글+ASCII만, 이모지·surrogate 문자 금지, 코드 특수문자는 ASCII 플레이스홀더"). 병렬 부분 실패 시 성공분은 트랜스크립트 회수 + 실패분만 재실행. `API 400 no low surrogate` 관측 시 '직전 sub-agent 출력의 lone surrogate'로 직행 진단.
- [x_green_test_not_exercising_claimed_path] dev-cycle Phase 4 독립 verify에 "GREEN ≠ 커버" 3자문: (1) criterion이 명시한 *각 구조요소*(인덱스/제약/키)가 개별 단언되는가, (2) 테스트가 *프로덕션과 같은 경로*를 타는가(mock/리터럴/입력형이 실제 런타임 입력과 다른지 — 예: `JSON.parse('{"__proto__":..}')` own-key vs 객체 리터럴 `{__proto__:..}`), (3) 단언 대상 속성이 *격리*되는가("이 속성을 끄면 RED인가?" — 조건이 pre/post 값 모두 충족하면 그 속성 미증명). 구현자 self-GREEN으론 미감지 — 처음-보는-눈 독립 verifier가 적발 기제.
- [w_worktree_agent_branch_integration] 병렬 worktree 에이전트 fan-out 시 통합 프로토콜 *착수 전* 고정: 각 반환 후 `git status -sb`+`git worktree list`로 산출 위치 확인(feat/* in 메인트리 → checkout main + merge --ff-only / .claude/worktrees/agent-* → merge --no-ff + worktree remove + branch -D), 통합 후 `git log origin/main..HEAD`로 미푸시 확인('up-to-date' 오인 방지). shared 공통파일(index.ts/story.ts) additive 충돌은 순차 머지로 양쪽 보존. '커밋했다'는 에이전트 보고만 믿지 말 것.
- [w_parallel_agent_timeout_partial_recovery] 병렬 에이전트가 타임아웃/에러로 최종 응답 못 줄 때: 죽었다 단정 말고 worktree git status로 부분 산출 회수. RED 테스트만 있고 구현 미시작이면 테스트 품질 검토 후 채택 + 메인이 직접 구현 완성(고위험 티켓은 인수가 신중함 확보에 유리). SendMessage 재개는 단순 이어쓰기일 때만. 인수해도 독립 verify는 생략 금지.

---

## Counter-Evidence Log

- _(반증 0건)_ 이번 세션(2026-06-14) 4 dev-cycle은 기존 3 lesson을 모두 *준수*: RED는 비공허(모듈/메서드 부재로 실패), 기록물은 PASS/FAIL 카운트 인용(api 59 / web 57 / shared 38), pkill 부수피해 없음(테스트 기반 검증). 준수는 반증이 아니므로 라벨 변경 없음.
- _(적용 성공, 2026-06-18 #23)_ y_endpoint_http_test_gap의 권장(HTTP 계약 테스트)을 PRD 성공 기준에 *선반영* → /chat·/chat/stream에 strip·400·404 HTTP 테스트 동반, 컨트롤러 배선 갭 미발생. 반증 아님(약점은 실재) — 완화책이 작동한 긍정 증거. CLAUDE.md 승격 근거 강화.
- _(완화 정착, 2026-06-19 #26/#28/#32)_ x_config_presence_only_assertion의 권장(보안/정책 상수 *내용* 단언)이 CLAUDE.md 규약으로 반영된 뒤 #26(contentRating 등급값)·#28(쿠키 httpOnly/sameSite/maxAge + argon2 verify 왕복)·#32(userId 위조 data.userId===undefined)에서 일관 준수 — trigger 반복·symptom 미발생. 반증 아님(약점 실재, 완화 작동). 부수: verifier 자가교정(PASS 중 갭 in-cycle 적발) #23·#28 2회 — verifier 강점 패턴, 약점 카테고리 미수용으로 lesson화 보류.
- _(경계 단언 적용, 2026-06-20 #36)_ x_config_presence_only_assertion의 정신(존재가 아니라 *경계/내용* 단언)을 #36 credentials 테스트에 자발 적용 — 소유 경로는 credentials:'include' 운반을 단언하되, 공개 목록(fetchPublicCharacters)은 *미운반*을 명시 단언(`init?.credentials).toBeUndefined()`). "공개 경로에 자격이 새도 GREEN"이 되는 weak_check를 사전 차단. 반증 아님(완화 정신이 새 표면으로 확장된 긍정 증거).
- _(완화 실효 + 신규 약점, 스프린트 sp_2026_06_27_story_mode 회고, 2026-06-27 #43~#51)_ **준수/실효**: ① y_split_migration_foundation_gap *회피* — #43 토대가 sprint-pm Architect 권고(Stat 정규화·condition/statValues Json·ownerContext 이중축)를 선반영해 후속 #44/#50 추가 마이그레이션 0. ② y_endpoint_http_test_gap 일관 준수 — 신규 stories/story-sessions 엔드포인트(생성·turn·이어하기)에 HTTP 계약 테스트 동반(소유 404·DTO 400·라우트 순서). ③ x_config_presence_only 정신 확장 — #45 buildStoryResponseSchema 화이트리스트를 정확 키 집합+미정의 부재로 단언. **신규 약점 3건**(반증 아님, 약점 실재): x_green_test_not_exercising_claimed_path(#43 인덱스 누락/#50 __proto__ 경로 divergence/#51 clamp 비격리 — 독립 verify가 in-cycle 적발·보강), w_worktree_agent_branch_integration(#47/#48 사이드 브랜치 통합), w_parallel_agent_timeout_partial_recovery(#50 타임아웃 인수). **긍정 관찰**: 독립 verifier(dev-cycle Phase 4)가 GREEN 통과 중 weak_check 3건을 처음-보는-눈으로 적발 → 전부 in-cycle 보강(인덱스 단언/JSON.parse __proto__ own-key 케이스/clamp 격리 케이스). verifier 강점 패턴 4회째 관측(#23·#28·#42에 이어).
- _(3 lesson 동시 준수, 2026-06-22 #33)_ ① y_identity_change_state_invalidation_gap — 클레임(식별자 변경)의 2차 상태를 열거: 캐릭터 캐시는 claim→reloadUserCharacters *순서*로 무효화, 대화 캐시는 conversations가 browserId 키를 유지(#40 전까지)해 비이슈임을 *명시 추론*(가정 회피). ② x_config_presence_only_assertion — updateMany의 where{browserId,userId:null}+data{userId}를 toHaveBeenCalledWith로 *내용* 단언, browserId 보존은 `'browserId' in data === false` 명시(멱등·충돌skip·보존이 구조로 보장됨을 박제). ③ y_premise_stated_without_code_check — PRD 전제("characters는 #32에서 userId 우선 조회라 클레임 전 빈 목록")를 Explore 서브에이전트가 코드로 확인 후 채택. 셋 다 반증 아님(약점 실재, 완화 작동).
- _(스프린트 sp_2026_06_22_conv_ownership 회고, 2026-06-24 #34/#40/#41/#42 — 신규 약점 0, 준수 다수)_ ① **y_split_migration_foundation_gap 회피** — #34가 토대(browserId nullable + unique 방향)를 함께 처리해 #40 추가 마이그레이션 0(재발 추적 지점에서 완화 실효, lesson yaml counter_evidence 추가). ② **y_identity_change_state_invalidation_gap 준수+확장** — #40 테스트 하네스 OwnerContext 갱신 + #42 page-local fetch로 *캐시 자체를 없애* 해소(완화 메뉴 확장). ③ **x_config_presence_only_assertion 정신 확장** — #34 마이그레이션 dedupe를 SQL 문자열 존재가 아니라 실 DB BEGIN/ROLLBACK 행동 검증(마커로 실제 SQL 추출), #40/#41 소유 404·where·N+1 호출횟수 내용 단언. ④ **y_endpoint_http_test_gap(CLAUDE.md) 일관 준수** — #40/#41 신규 conversations 엔드포인트(get-or-create/list/delete)에 HTTP 계약 테스트 신설(공격 시나리오 타 browserId/userId → 404 단언, 라우트 매칭). 전부 반증 아님(약점 실재, 완화 작동·확장).

---

## Pending Patch Approvals

- ✅ **[y_endpoint_http_test_gap → <project>/CLAUDE.md]** (weak, **2026-06-18 사용자 승인·적용 완료**): CLAUDE.md 테스트 규약에 "신규 NestJS 엔드포인트엔 supertest HTTP 계약 테스트 ≥1" + 라우트 순서 + 보안상수 내용단언 반영. lesson applied=true.
- _(대기 없음)_ 나머지 tentative lesson들은 next_goal_context 큐로만 운용(confidence < moderate).

---

## Meta

- **첫 lesson 추출**: 2026-06-11
- **마지막 학습 사이클**: 2026-06-27 (회고 모드 — dev-cycle 구현·검증 + 병렬 worktree 오케스트레이션 기반, 정식 run.yaml 아님. 대상 #43~#51 = 스프린트 sp_2026_06_27_story_mode 종료 회고)
- **누적된 run 수**: 0 (정식) / 24 (dev-cycle 회고: ...2026-06-23~24 ×4[#34/#40/#41/#42], 2026-06-27 ×8[#43/#44/#45/#47/#48/#49/#50/#51 — wave1/wave2 병렬 worktree 포함])
- **paired된 goal 수**: 0
- **긍정 관찰 (verifier 강점, lesson화 보류)**: 독립 verifier가 GREEN 통과 중 커버리지 갭/weak_check를 처음-보는-눈으로 in-cycle 적발·보강. #23(safetySettings 강화)·#28(만료 토큰)·#42(삭제 핸들러 unhandled rejection)·**sp_2026_06_27 ×3(#43 @@index 단언 누락 / #50 __proto__ JSON.parse own-key 경로 / #51 clamp 격리 미검증 → 전부 보강)** = 누적 6+회 관측. 이 강점은 신규 약점 x_green_test_not_exercising_claimed_path의 *적발 기제*이기도 함(약점과 강점이 짝). 약점 카테고리에 자리 없어 보류하나 Execute/positive 카테고리 신설 시 박제 1순위.
- **Z 후보 관찰 (lesson화 보류, Execute skill 표준화 대기)**: ① pnpm 엄격 격리로 peer 도구(ts-loader) 미해석 ② nest 기본 webpack이 workspace 패키지를 external 처리 → 런타임 크래시 ③ (2026-06-14) best-effort 영속의 순서 보장 부재 이론적 race ④ **(2026-06-23) prisma `migrate dev`가 비인터랙티브 환경서 실패 → migrate diff+수작업 폴더+migrate deploy 우회**(next_goal_context [migration-tooling]에 레시피화) ⑤ **(2026-06-24) FE fire-and-forget async 핸들러 `onClick={()=>void doAsync()}`가 reject 삼킴 → 실패 무피드백+unhandled rejection(catch로 사용자 피드백 동반 권장)**. 모두 CLAUDE.md/Execute 후보.
