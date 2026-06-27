# Sprint sp_2026_06_27_story_mode — PM vs Architect 충돌

PM agent와 Architect agent를 독립 sub-agent로 병렬 호출. 합의: 6티켓 전원 include, #46 둘 다 decompose.
충돌은 분할선·범위·urgency에서 발생.

| 이슈 | PM | Architect | 충돌 축 | 사용자 break |
|---|---|---|---|---|
| #46 | decompose 2분할 (세션CRUD / delta+엔딩) | decompose 3분할 (세션영속 / delta검증 / 엔딩평가) | 분할 granularity | **3분할** (#49/#50/#51) |
| #43 | include (선제약 점검 권고) | include + 구체 스키마 강제 (Stat 정규화 / condition Json / statValues Json) | 설계 결정 깊이 | **Architect 권고 확정** |
| #47 | urgency medium (시드 우회 가능) | include + 범위 cut 권고 (단일 StartSetting) | urgency·범위 | **범위 유지**(다중 StartSetting) |
| #44 | include | include + 중첩 PATCH 후속 분리 권고 | 범위 | **범위 유지**(전체 PATCH) |

## 사용자 결정 기록
- #46 → 3분할 (Architect): delta 검증을 독립 검증 단위로 격리. 신뢰경계(§4.2) + structured output 선례 0건 리스크.
- #43 → Architect 스키마 권고 확정: Stat=정규화 테이블, Ending.condition=Json 규칙, StorySession.statValues=Json, dev예시/추천답변/shortcuts=Json. l_2026_06_19(토대 분할 후속 제약 미예견) 교훈 반영.
- 범위 → 좁히지 않음: #47 다중 StartSetting · #44 전체 PATCH 유지. 사이클 경계 초과 위험은 plan.yaml risk에 기록.
- cut=0 전원 include 확정: backlog가 이미 MVP로 좁혀졌고 미디어/키워드북 등 5건 out_of_scope defer됨.

## 메타 (충돌 가시화 가치)
- 두 에이전트가 #46 decompose에 합의했으나 *분할선이 달랐다* — 같은 모델 self-disagreement지만 granularity 차이가 실측됨(게이트 #3 충돌 ≥1 통과).
- Architect가 코드 탐색(17 tool calls)으로 "structured output 선례 0건"을 발견 — PM은 알 수 없는 기술 리스크. 모드 분리의 실효.
- 가장 큰 회귀 위험 양 에이전트 일치: #50 [46b] delta 검증.
