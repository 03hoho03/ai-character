# Sprint sp_2026_06_18_discover_safety — PM vs Architect 충돌

PM agent와 Architect agent를 독립 병렬 호출(모드 분리). top-line recommendation은 4건 모두 일치했으나, 그 아래 **분해 형태·시퀀싱**에서 실질 충돌 발생 → 자동 봉합하지 않고 사용자 break.

## 합의 (충돌 없음)
| issue | PM | Architect | 처리 |
|---|---|---|---|
| #22 기억편집 UI | defer | defer | defer — goal 무관 + summary 단일필드 vs 항목편집 모델 불일치 |
| #20 멀티모달 | defer | defer | defer — 그린필드 + 모델·저장소·비용 미결정 외부 의존 |

## Architect의 사실 정정 (결정 근거)
> #19 전제 "prohibitions 미집행"은 부정확. prohibitions는 **이미 클라이언트에서 프롬프트에 주입**(`persona-prompt.ts`)되고 있고, 진짜 갭은 **서버가 클라 조립 instruction을 무검증 신뢰**(`chat.service.ts`)하는 구조 — 클라가 어떤 금지/등급도 우회 가능. → #19의 본질을 "서버측 집행"으로 재정의.

## 충돌 + 사용자 break
| issue | PM | Architect | 충돌 축 | **사용자 결정** |
|---|---|---|---|---|
| #17 탐색 | decompose → 검색+태그=MVP include, 랭킹 #17b로 우선순위↓ (**2분할**) | decompose → 17a검색/17b태그/17c랭킹 (**3분할**), 랭킹은 FK 부재 집계 리스크로 **별도 cycle** | 분해 granularity + **랭킹을 이번 sprint에 넣나** | **검색+태그 include, 랭킹(17c) defer** (Architect의 FK 리스크 수용 + PM의 MVP 라인) |
| #19 안전 | **단일 include**, dependency [#17] — 노출 늘기 전 켜져야 하는 **출시 게이트(#17 병행/직후)** | **19a집행/19b등급 분해**, 19a를 **#17보다 먼저** (클라 신뢰 부채가 공개 노출 근본 리스크) | #19가 **#17 앞 / 병행·직후** + 분해 여부 | **19a 집행을 #17보다 먼저** + 19b 등급분리 함께 include (Architect 손) |

## 결과
- include: #23(19a), #24(17a), #25(17b), #26(19b) — 4
- defer: 17c 랭킹, #22, #20 — 3 (work-unit 기준 3/7 = 43%)
- cut: 0
- 실행 순서: 19a → 17a → 17b → 19b

## 메타 (agent 자기 예측 vs 실제)
- PM 예측: "Architect가 #17 랭킹을 검색·태그와 데이터 모델 공유로 단일 유지 주장할 수도" → **빗나감**. Architect는 오히려 랭킹을 FK 리스크로 **분리 강화**.
- Architect 예측: "PM은 #17을 단일 코어로 묶고, 나는 3분해 주장" → **적중**. 분해 granularity가 핵심 충돌.
- 두 agent 모두 #19를 #17 선결로 본 점은 수렴, 단 "앞이냐 병행이냐"에서 갈림.
