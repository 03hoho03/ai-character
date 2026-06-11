# [#2a] 비스트리밍 POST /chat — Gemini 2.5 Flash 연결

GitHub issue: #11 (parent #2) / Sprint: sp_2026_06_11_ai_chat_mvp

## 목적 / Why
sprint의 심장인 Gemini 연동의 첫 분해분. 비스트리밍으로 API contract(요청/응답 스키마)를
확정해 #3~#7이 진행 가능한 상태를 만든다. 스트리밍(#12)·에러 규약(#13)은 후속.

## 요구사항

### Must
- **shared DTO** (`packages/shared`): API contract의 중심축
  - `ChatMessage { role: 'user' | 'model'; content: string }`
  - `ChatRequest { systemInstruction?: string; messages: ChatMessage[] }` (변환 로직 없음 — #5 경계)
  - `ChatResponse { message: ChatMessage }`
- **NestJS chat 모듈** (`apps/api`):
  - `POST /chat` → Gemini `gemini-2.5-flash` 비스트리밍 호출 (`@google/genai` SDK)
  - systemInstruction + 대화 히스토리를 Gemini `contents` 형식으로 매핑
  - 모델명은 `GEMINI_MODEL` env로 오버라이드 가능 (기본 `gemini-2.5-flash`)
- **키 관리**: `GEMINI_API_KEY`를 `.env`에서 로드 (`@nestjs/config`). 키 미설정 시 부팅은 되되
  `/chat` 호출에 명확한 503 + 안내 메시지
- **입력 검증**: 빈 messages / 잘못된 role → 400 (ValidationPipe)
- **에러 매핑**: Gemini 호출 실패(인증/쿼터/네트워크) → 502, 타임아웃(30s) → 504.
  업스트림 에러 원문은 로그로만, 응답엔 안전한 메시지
- **단위 테스트** (jest, SDK mock): 히스토리 매핑 / systemInstruction 전달 / 정상 응답 추출 /
  에러→502 / 타임아웃→504 / 키 미설정→503

### Nice-to-have
- `curl` 예시를 README 또는 모듈 주석에 1개

## 성공 기준 (검증 가능)
- [ ] `pnpm --filter @ai-character/api test` → chat 모듈 단위 테스트 전부 통과 (mocked SDK)
- [ ] `pnpm -r typecheck` && `pnpm -r build` 통과 (기존 회귀 없음)
- [ ] api 기동 후(키 미설정) `POST /chat` 유효 body → **503** + 키 안내 메시지 (실키 없이 검증 가능한 런타임 계약)
- [ ] `POST /chat` 빈 messages 또는 잘못된 role → **400**
- [ ] `ChatRequest/ChatResponse/ChatMessage` 타입이 `@ai-character/shared`에서 export되고 api가 이를 import (계약 단일 출처)

## 검증 범위 한계 (Phase 0 합의)
실제 Gemini 호출 e2e는 **이번 cycle 검증에서 제외** — 사용자가 API 키 발급 후
`apps/api/.env`에 기입하고 수동 확인 (절차는 verify_report에 기록).

## lesson queue 적용 (goals/lessons/INDEX.md)
- RED 실행 후 공허 PASS 항목 명시 점검
- 서버 기동 검증: 포트 사전 점유 체크 + PID 기반 정리
- 기록물에 PASS/FAIL 카운트 원문 인용
