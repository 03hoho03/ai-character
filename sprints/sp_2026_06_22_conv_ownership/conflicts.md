# Sprint sp_2026_06_22_conv_ownership — PM vs Architect 충돌

backlog: #33, #34, #37(기존 deferred 합류) + #38, #39(신규 draft)

| issue | PM | Architect | 충돌 축 |
|---|---|---|---|
| #33 클레임 | include (urgency high) | include | — 합의 |
| #34 유니크키 | include (+#33완료 게이트) | **decompose** (34a dedupe → 34b unique) | 마이그레이션 안전 vs 티켓 입도 |
| #37 로그인 트리거 | include (urgency medium) | include (단 대화캐시 무효화 갭 지적) | — 합의 |
| #38 목록/삭제 풀스택 | include (+삭제·홈진입점 첫 컷 후보) | **decompose** (38a 전환 / 38b API / 38c FE) | blast_radius vs 통짜 출시 |
| #39 Gemini 캐싱 | defer | defer | — 합의 |

## 충돌 상세

### #34 — PM include vs Architect decompose
- **PM**: Must 체인 유지, #33 완료 검증을 게이트로 두면 통짜로 충분. 티켓 수 억제.
- **Architect (코드 근거)**: `schema.prisma:40` 현재 `@@unique([browserId, personaId])` + userId nullable. 클레임(#33)이 같은 personaId의 익명+계정 대화를 모두 userId로 만들면 `(userId,personaId)` 중복 → `@@unique([userId,personaId])` 생성 시 **unique violation으로 마이그레이션 실패**. dedupe 선행(34a)과 unique 전환(34b) 분리 주장. (l_2026_06_19_y_split_migration_foundation_gap 재발 지점)

### #38 — PM include vs Architect decompose
- **PM**: 핵심 가치는 "내 대화를 목록으로 본다". 삭제·홈진입점은 첫 컷 후보로 표시해 두고 통짜 진행.
- **Architect (코드 근거)**: conversations.controller 가드 0개 + service 5메서드 browserId raw 비교 + **HTTP 계약 테스트 0개**. OwnerContext 전환을 목록/삭제 신규 기능과 한 티켓에 묶으면 blast_radius 과대 + 테스트 인프라 신설까지 동반. 전환(38a)/API(38b)/FE(38c) 3분할로 리뷰·롤백 단위 합리화.

## 사용자 결정 (2026-06-22 break)

- **#34 → 통짜 include (PM 손)**. 단 Architect의 dedupe 선행 + 비로그인 폴백키 설계 위험을 #34 본문/acceptance 선행 스텝으로 박제(이슈 코멘트 추가). #33 완료 검증을 게이트로.
- **#38 → 3분할 (Architect 손)**: [38a] OwnerContext 전환 + HTTP 계약 테스트 신설 → #40, [38b] GET 목록 + DELETE :id + 라우트 순서 테스트 → #41, [38c] 프론트 인박스 + 홈 진입점 + 세션전환 재로드 → #42. 부모 #38은 needs-decomp 트래킹(milestone 미할당).
- **#39 → defer** (PM·Arch 합의). 소유 체인 완료 후 별도 인프라 sprint.
