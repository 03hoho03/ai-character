# Verify Report — #23 서버측 안전 집행 (클라 신뢰 부채 해소)

## Iteration 1 — 2026-06-18

- tests:
  - `apps/api && pnpm test` → **6 suites / 71 tests PASS**
  - `apps/web && pnpm test` → **7 files / 57 tests PASS**
  - `pnpm -r typecheck` → **3/3 projects Done**
  - (api stderr stack는 timeout/upstream-error/abort 음성경로의 의도된 logger.error — 실패 아님)

- 성공 기준 (PRD 7항목):
  - [x] DTO에서 systemInstruction 제거 + 전역 ValidationPipe(whitelist:true) strip — HTTP 테스트가 systemInstruction 동봉 시 400 아닌 정상경로(503/200) 통과로 단언
  - [x] 클라 조작/누락에도 신뢰 prohibitions 강제 — usr-*(악의적 instruction 무시 + 금지사항 강제), tpl-*(getOne 미호출 + 템플릿 instruction) 양쪽 단언
  - [x] personaId/browserId 누락 → 400, 미존재/비공개 타인 → 404. resolvePersona가 requireClient보다 선행 → 키 미설정 상태에서도 미존재는 404(503 아님) 단언
  - [x] safetySettings가 generateContent·generateContentStream 양 config에 포함 (강화: 유해 카테고리 4종 단언)
  - [x] 클라 useChatStream 새 계약(personaId/browserId/messages) — fewShot/systemInstruction 미전송 단언
  - [x] 기존 chat/conversations/characters/web 회귀 없음
  - [x] 신규/변경 엔드포인트 controller/HTTP 레벨 테스트 동반 (lesson l_2026_06_14_y_endpoint_http_test_gap)

- 독립 검증 포인트:
  - 순환 의존 없음 — 단방향 conversations → chat → characters (characters는 역참조 없음). app.init() 부팅 통과.
  - usr-* 비공개 타인 캐릭터 채팅 시도 → CharactersService.getOne의 `!character || (browserId 불일치 && !isPublic)` 규약으로 404. resolvePersona가 그대로 위임/전파. tpl-* 미스도 직접 404.
  - safety-block(#13) 경로 무변경 — finishReason SAFETY + promptFeedback.blockReason 양쪽 green.
  - safetySettings: HARASSMENT/HATE/DANGEROUS = MEDIUM_AND_ABOVE, SEXUALLY_EXPLICIT = ONLY_HIGH. 성인/일반 차등은 #26(19b)로 분리한다는 PRD 의도와 일치.

- verdict: **PASS**

- notes:
  - (해소) safetySettings 단언이 Array.isArray + length만 보던 약한 체크 → 유해 카테고리 4종 + threshold 존재까지 단언하도록 강화(iteration 1 내 반영).
  - (non-blocking) toPersona의 exampleDialogue/prohibitions 이중 캐스팅은 Prisma Json 필드 특성상 불가피. 신뢰 소스(자체 DB)라 범위 내 수용.
