# 대화 요약/장기기억 — 자동 요약 코어 (#15)

## 목적 / Why
full-history 전송(useChatStream)이 컨텍스트·토큰 비용의 한계(B1). 임계 초과 시 과거 turn을 서버에서 Gemini로 자동 요약해 Conversation에 영속하고, 채팅 요청을 '요약 + 최근 N turn' 조립으로 교체한다. 토큰 상한 가드를 둔다. (사용자 기억 직접 편집 UI는 #22로 분리 — 이번은 자동 요약 코어만)

## 결정 (planning)
- 요약 실행: 전용 엔드포인트 `POST /conversations/:id/summarize` + 프론트 오케스트레이션(/chat/stream stateless 유지, #14 패턴).
- 임계: 저장 turn 수 트리거 + 조립 페이로드 토큰 상한 가드.
- 주입: `ChatRequest.conversationSummary`를 서버가 systemInstruction에 접합.

## 요구사항
### Must
- **shared — 조립/임계 단일 출처**
  - 상수: `SUMMARY_TURN_THRESHOLD`(예 12), `SUMMARY_RECENT_TURNS`(예 6), `SUMMARY_TOKEN_CAP`.
  - `estimateTokens(text)` 휴리스틱, `shouldSummarize(turnCount)`, `assembleHistory(history, summary)` — summary 있으면 최근 N turn만, 없으면 full; 두 경우 모두 토큰 상한 초과 시 오래된 것부터 trim(최소 1 보존).
  - `ChatRequest`에 `conversationSummary?: string` 추가. `ConversationWithMessages`/`ConversationRecord`에 `summary?: string | null` 추가. `SummarizeRequest { browserId }` 신설.
- **백엔드 — 요약 생성·영속**
  - Prisma `Conversation`에 `summary String?` + `summarizedCount Int @default(0)` + 마이그레이션.
  - `ChatService.summarize(priorSummary, turns)` — Gemini generateContent로 한국어 요약 생성(기존 withTimeout 재사용, 직전 요약 누적 반영). ChatModule이 ChatService export.
  - `chat()`/`chatStream()`이 `request.conversationSummary`를 systemInstruction에 '이전 대화 요약' 블록으로 접합.
  - `ConversationsService.summarizeIfNeeded(id, browserId)` — 소유자 가드(불일치 404). 저장 turn ≤ 임계면 no-op(현 summary 반환), 초과면 오래된 turn(최근 N 제외)을 요약해 `summary`/`summarizedCount` 영속·반환. ConversationsModule이 ChatModule import.
  - `POST /conversations/:id/summarize` 라우트(`SummarizeDto`).
  - `getByOwner`가 summary를 포함해 복원.
- **프론트 — 조립 교체 + 트리거**
  - `conversations-api.summarizeConversation(id, browserId)` → POST, `{summary, summarizedCount}` 반환. restore가 summary 운반.
  - `useChatStream` 요청 조립을 `assembleHistory(history, summary) + conversationSummary` 전송으로 교체(full-history 직접 전송 폐기). summary 없을 땐 기존 동작 보존.
  - turn 성공 후 `shouldSummarize` 충족 시 `persistence.summarize()` best-effort 호출 → 최신 summary 보관(다음 요청 반영).
- **토큰 가드**: 조립 페이로드가 `SUMMARY_TOKEN_CAP`을 넘지 않도록 `assembleHistory`가 보장.

### Nice-to-have
- 요약 진행 인디케이터 / 요약 열람·편집 UI — #22.
- 토크나이저 정밀 추정 — 이번은 휴리스틱.

## 성공 기준 (검증 가능)
- [ ] `pnpm --filter @ai-character/api test` + `typecheck`, `pnpm --filter @ai-character/web test` + `typecheck`, `pnpm --filter @ai-character/shared test` + `typecheck` 모두 green (신규 테스트 포함).
- [ ] schema.prisma `Conversation`에 `summary`/`summarizedCount` + 신규 마이그레이션 디렉터리 생성.
- [ ] shared `assembleHistory`가 (a) summary 없으면 full 반환 (b) summary 있으면 최근 N turn 반환 (c) 토큰 상한 초과 시 오래된 것부터 trim 함을 테스트가 단언.
- [ ] `ChatService.summarize`가 Gemini를 호출해 요약 문자열을 반환하고, `conversationSummary`가 systemInstruction에 접합됨을 테스트가 단언.
- [ ] `summarizeIfNeeded`가 (a) 임계 이하 no-op (b) 초과 시 오래된 turn 요약·`summary`/`summarizedCount` 영속 (c) 소유자 불일치 404임을 테스트가 단언.
- [ ] `useChatStream`이 summary 존재 시 '요약 + 최근 N turn'으로 요청을 조립하고 `conversationSummary`를 전송하며, summary 부재 시 기존 full-history 동작을 보존함을 테스트가 단언.
- [ ] 기존 chat/chat-stream/useChatStream 테스트 무회귀.
