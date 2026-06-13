# Sprint sp_2026_06_13_char_share_memory — PM vs Architect 충돌

PM agent와 Architect agent를 독립 호출(모드 분리). recommendation이 갈린 issue만 표기.

## 합의 (충돌 없음)
| issue | PM | Architect | 처리 |
|---|---|---|---|
| #15 요약/장기기억 | decompose | decompose | 코어 슬라이스(자동요약+토큰가드+주입)만 include, 사용자 기억편집은 #22로 분리 defer |
| #18 재생성+편집 | include | include | include. Arch 경고: append-only 영속이라 truncate-replace 백엔드 작업 숨음 → 본문 반영 |
| #17 탐색 | defer | defer | defer (#16 종속) |
| #19 안전필터 | defer | defer | defer (#16 종속) |

## 충돌 + 사용자 break
| issue | PM | Architect | 충돌 축 | **사용자 결정** |
|---|---|---|---|---|
| #16 캐릭터 DB+공개 | include (B2 핵심, 최소 scope) | decompose (모델+API+프론트 동기→비동기+마이그레이션 과다, character-store 동기 계약 6개 UI 의존) | 단일 include vs 분해 | **include + decompose (코어 전체 이번 sprint)** — #16(백엔드)+#21(프론트) 둘 다 include |
| #20 멀티모달 이미지 | cut (기본기 아님, 코어 잠식) | defer (전 스택 재설계 epic) | 폐기 vs 보류 | **defer** (추적 유지, milestone 미할당) |

## 결과
- include: #15, #16, #21, #18 (4)
- defer: #17, #19, #20, #22 (4) — deferred 비율 50%
- cut: 0 (PM이 #20 cut 제안했으나 사용자가 defer 선택)
