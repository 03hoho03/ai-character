# Verify Report — 대화 요약/장기기억 자동 요약 코어 (#15)

## Iteration 1 — 2026-06-14

독립 verifier sub-agent가 PRD 성공 기준에 대해 검증.

- tests:
  - `pnpm --filter @ai-character/api test` → **PASS** (59/59, 6 suites). 출력의 `Gemini 스트림 중단` ERROR 로그는 의도된 에러 경로 fixture.
  - `pnpm --filter @ai-character/api typecheck` → **PASS**.
  - `pnpm --filter @ai-character/web test` → **PASS** (57/57, 7 suites).
  - `pnpm --filter @ai-character/web typecheck` → **PASS**.
  - `pnpm --filter @ai-character/shared test` → **PASS** (38/38, 4 suites).
  - `pnpm --filter @ai-character/shared typecheck` → **PASS**.

- 성공 기준:
  - [x] api/web/shared 각 test+typecheck green (신규 테스트 포함)
  - [x] schema Conversation summary/summarizedCount + 신규 마이그레이션(20260614072233_add_conversation_summary)
  - [x] assembleHistory (a) summary 없으면 full (b) 있으면 최근 N (c) 토큰 상한 초과 시 오래된 것부터 trim(최소 1 보존) — 단언
  - [x] ChatService.summarize Gemini 호출+요약 반환, conversationSummary가 systemInstruction 접합 — 단언
  - [x] summarizeIfNeeded (a) 임계 이하 no-op (b) 초과 시 요약·영속 (c) 소유자 불일치 404 — 단언
  - [x] useChatStream summary 시 '요약+최근 N'+conversationSummary 전송, 부재 시 full 보존 — 단언
  - [x] 기존 chat/chat-stream/useChatStream 무회귀

- 독립 검증 포인트:
  - 토큰 가드: summaryTokens + 메시지 토큰 합 기준, `assembled.length > 1` 가드로 무한루프/공집합 불가, 최소 1 보존.
  - 하위호환: `...(summary ? { conversationSummary } : {})` 스프레드로 부재 시 키 자체 생략(직렬화 undefined 아님). `assembleHistory(history, null)` 원본 그대로 반환.
  - 트리거: done(성공) 분기 내에서만, `shouldSummarize(messagesRef.length - 1)`(greeting 제외)로 호출. 에러 경로 미발동. retry/regenerate/edit done에도 발동하나 서버가 DB 기준 재카운트·no-op이라 무해.
  - summaryRef 시딩: ref라 run 시점 최신값 읽음(stale closure 없음). loadSummary 해소 전 send는 요약 없이 조립 — 허용 가능한 graceful degradation.
  - 백엔드 경계: `length <= THRESHOLD` no-op vs `>` = shouldSummarize와 일치. older=slice(0, len-N) 비공집합, 최근 N 유지. 소유자 불일치 404(403 아님), Gemini 호출 전 throw. 직전 요약 누적 전달.
  - systemInstruction fold: base undefined + summary 있으면 요약 블록 단독 생성, summary 부재 시 base 그대로.
  - DI: ConversationsModule→ChatModule import, ChatModule이 ChatService export, 역참조 없음 → 순환 의존 없음.
  - best-effort: summarizeConversation/loadSummary/summarize 모두 실패 시 null·채팅 비차단.
  - getByOwner: select 없이 findUnique+include라 summary/summarizedCount 스칼라 포함 → restore가 요약 운반.

- verdict: **PASS**

- notes: 없음(클린).
```
