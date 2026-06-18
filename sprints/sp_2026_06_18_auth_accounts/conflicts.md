# Sprint sp_2026_06_18_auth_accounts — PM vs Architect 충돌

테마: 익명 browserId → 계정/인증 소유 모델 도입. 길이: 무기한(scope 우선).
PM agent / Architect agent 독립 평가(general-purpose sub-agent, 2026-06-18).

## 충돌 표

| issue | PM | Architect | 충돌 축 |
|---|---|---|---|
| #27 인증 전략 spike | include (high) | include | ✅ 합의 |
| #28 User+인증 백엔드 | include (high) | include | ✅ 합의 |
| #29 소유권 전환 | decompose — **2조각**(29a 스키마+소유검증 / 29b 클레임) | decompose — **4조각**(29a 스키마 / 29b 소유검증 / 29c 클레임 / 29d 유니크키) | **분해 입도** |
| #30 프론트 플로우 | **defer**(UI 코어 include, 클레임 트리거만 미룸) | **decompose — 3조각**(30a UI / 30b fetch / 30c 클레임트리거) | **defer vs decompose** |

## 두 agent 공통 신호
#29·#30을 통째로 두지 말고 **"익명 데이터 클레임"을 분리**하라.
- Architect(코드 확인): browserId가 FK 없는 평문 컬럼 + 클라 제공 `usr-<uuid>` id가 DB id로 직행 → 클레임은 매핑 테이블 없는 신규 로직. `Conversation.@@unique([browserId, personaId])`를 userId로 옮기는 마이그레이션이 클레임과 **순서 의존**(중복 대화로 마이그레이션 깨질 위험).
- PM: 사용자가 체감하는 "로그인 됨"은 클레임 없이 #28+UI로 성립 → 클레임은 MVP 경계 밖.

## 사용자 결정 (break, 2026-06-18)
- **Scope 경계 → MVP-thin (클레임 제외)**: 로그인 + 신규 계정 userId 소유까지(29a/29b/30a/30b) include. 익명 데이터 클레임(29c)·유니크키 전환(29d)·프론트 클레임 트리거(30c)는 **다음 sprint defer**.
- **#29/#30 분해 입도 → Architect(세밀) 채택**: #29→29a(#31)/29b(#32)/29c(#33)/29d(#34), #30→30a(#35)/30b(#36)/30c(#37). 근거: 각 조각이 독립 회귀면 + 순서 의존이라 dev-cycle 단위로 안전(데이터 정합성).
  - 결과적으로 #30은 "defer vs decompose" 충돌에서 **decompose로 통일**하되, 그중 클레임 트리거(30c)만 defer → PM의 defer 의도와 Architect의 분해 권고를 동시 충족.

## 메타 (agent 예측 적중)
- PM 예측: "Architect는 #29를 더 잘게 쪼개거나 마이그레이션 정합성을 근거로 분해선 이견" → **적중**(2조각 vs 4조각).
- Architect 예측: "PM은 #29를 L 한 덩어리/굵게 유지, 나는 4조각 강제" → **부분 적중**(PM도 decompose했으나 2조각). 실제 충돌은 include-vs-decompose가 아니라 **입도**였음.
- 삭제 후보: none(4개 모두 인증 전환 필수 경로).
