# Sprint sp_2026_06_11_ai_chat_mvp — PM vs Architect 충돌

평가 대상 10 issue 중 recommendation 불일치 1건.

| issue | PM | Architect | 충돌 축 |
|---|---|---|---|
| #2 NestJS ↔ Gemini 연동 | include (sprint 심장, 한 ticket으로 week 1 최우선) | decompose (2a 비스트리밍 e2e → 2b SSE → 2c 에러 규약. "주니어에게 한 번에 시키면 sprint 최대 병목") | 분해 필요성 (ticket 크기 평가) |

## 사용자 결정

- **#2 → decompose** (Architect 손 들어줌). 2a 비스트리밍 e2e를 먼저 뚫어 critical path 위험 감소. child issue #11(2a)/#12(2b)/#13(2c) 생성, milestone 포함. #2는 tracking parent.

## 충돌 외 결정 사항

- Architect의 "#7(홈)을 #6(생성 폼)에 병합" 제안 → **사용자 거부**, 독립 ticket 유지 (dev-cycle 단위 실행 용이).

## 합의 항목 (표 미포함)

- include: #1, #3, #4, #5, #6, #7
- defer: #8 (벤치마크 spike), #9 (DB persistence)
- cut: #10 (인증)

## agent 메타 코멘트 발췌

- **PM**: 가장 confidence 낮은 평가는 #9 defer — "대화가 증발하는 MVP"의 demo 품질 위험을 localStorage 임시방편이 막아줄지 불확실. Architect가 #9를 부분 include로 끌어올릴 것으로 예측했으나 실제로는 Architect도 defer (예측 빗나감).
- **Architect**: sprint 내 최대 위험은 #2 — 모든 것이 의존하는 API contract이므로 2a를 week 1 초반에 반드시 완료할 것. 계획된 부채: "캐릭터는 localStorage, 대화는 휘발성" — #2a/#6 타입에 id 필드 선납으로 이전 비용 완화.
