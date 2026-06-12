# 채팅 화면 UI — 메시지 목록 / 입력 / 스트리밍 / 에러 상태 (#3)

## 목적 / Why
백엔드 SSE 파이프라인(#2)과 shared 파서가 완성됐지만 사용자가 대화할 화면이 없다.
캐릭터와 실시간 스트리밍 대화가 가능한 핵심 화면을 만든다. 히스토리는 메모리만 — DB 영속화는 #14로 분리.

## 요구사항

### Must
- **라우트**: `/chat/[personaId]` — `PERSONA_TEMPLATES`에서 id 매칭, 없으면 `notFound()`
  - 홈(`page.tsx`)에 템플릿 5종으로 가는 임시 링크 추가 (#7이 정식 홈으로 대체 예정)
- **useChatStream 훅** (`apps/web`, 클라이언트):
  - 상태: `messages: ChatMessage[]`, `streamingText: string | null`(수신 중 partial), `status: 'idle' | 'streaming' | 'error'`, `error: { code, message } | null`
  - `send(text)`: user 메시지 추가 → `POST {API_URL}/chat/stream` fetch → `parseChatStream`으로 소비
    - 요청 body: `buildPersonaPrompt(persona)`의 `systemInstruction` + `messages: [...fewShotMessages, ...히스토리]`
    - greeting은 첫 model 메시지로 화면·히스토리에 포함 (#4 합의: API 프롬프트가 아닌 UI 책임)
  - `delta` → streamingText 누적, `done` → 메시지로 확정, `error` → **partial 보존**(받은 만큼 메시지로 확정) + error 상태 set
  - 스트림이 error/done 없이 끊기면 `upstream_error`로 간주
  - `retry()`: error 상태에서 마지막 user 메시지 재전송 (직전 partial/실패 턴은 정리)
  - streaming 중 `send` 무시 (이중 전송 가드), unmount/재전송 시 AbortController로 진행 중 fetch 중단
  - API URL: `NEXT_PUBLIC_API_URL` env, 기본값 `http://localhost:4000`
- **채팅 화면 UI** (Tailwind v4):
  - 메시지 목록: user 우측 / 캐릭터 좌측 정렬, 캐릭터는 아바타 placeholder + 이름 표시
  - 수신 중 partial 텍스트 실시간 렌더 + 스트리밍 인디케이터
  - 입력창 + 전송 버튼 (Enter 전송), streaming 중 전송 비활성
  - error 시 메시지 목록 아래 에러 배너(code별 메시지) + 재시도 버튼
  - 새 메시지 도착 시 목록 하단 자동 스크롤
- **테스트**: apps/web에 vitest(+ jsdom, @testing-library/react) 도입, `useChatStream` 훅 테스트
  - mock fetch(ReadableStream)로: delta 누적 → done 확정, error 시 partial 보존 + error 상태, streaming 중 send 가드, retry 동작, 요청 body 구성(systemInstruction/fewShot/히스토리)
  - UI 컴포넌트 렌더는 테스트 범위 외 — Phase 4에서 수동/브라우저 검증

### Nice-to-have
- 스트리밍 중 [중지] 버튼 (abort 후 partial 확정)
- greeting 타이핑 연출

## 성공 기준 (검증 가능)
- [ ] `/chat/tpl-fantasy-elveria` 접속 시 greeting이 첫 캐릭터 메시지로 표시, 존재하지 않는 id는 404 (코드 확인 + 브라우저)
- [ ] 훅 테스트: delta 누적 → done 시 messages에 model 메시지 확정, streamingText 해제 (vitest)
- [ ] 훅 테스트: error 이벤트 시 partial이 메시지로 보존되고 `error.code` 노출 (vitest)
- [ ] 훅 테스트: streaming 중 send() 호출 무시 (vitest)
- [ ] 훅 테스트: retry()가 마지막 user 메시지로 재요청 (vitest)
- [ ] 훅 테스트: 요청 body에 systemInstruction + fewShotMessages + greeting 포함 히스토리가 들어감 (vitest)
- [ ] 홈에 템플릿 5종 링크 존재 (코드 확인)
- [ ] `pnpm --filter @ai-character/web test`, `pnpm typecheck`, 기존 테스트(`shared`, `api`) 전부 PASS
- [ ] 수동 검증(브라우저): 실제 백엔드 대상 전송→스트리밍 렌더→완료, 에러 배너(백엔드 중단 등으로 유발) 확인 — verify_report에 기록
