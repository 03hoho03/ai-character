/**
 * 공용 타입 패키지 엔트리.
 */

/** 예시 대화 1턴 — #5에서 Gemini few-shot turn 쌍으로 그대로 매핑 */
export interface ExampleDialogueTurn {
  user: string;
  model: string;
}

/**
 * 페르소나 스키마 (#4 확정).
 * 템플릿/사용자 캐릭터 단일 타입 — 템플릿은 id가 `tpl-<genre>-*` 컨벤션.
 * #6 폼에서 템플릿을 복사해 id만 갈아끼우면 캐릭터가 된다.
 */
export interface Persona {
  /** #2a/#6에서 DB 이전 비용 선납을 위해 id를 처음부터 포함 (sprint plan 합의) */
  id: string;
  /** 이름 */
  name: string;
  /** 성격 */
  personality: string;
  /** 말투 */
  speechStyle: string;
  /** 세계관 */
  worldview: string;
  /** 첫 인사말 — 채팅 시작 시 모델 첫 메시지로 사용 */
  greeting: string;
  /** 예시 대화 — few-shot turn 쌍 (#5 risk 합의: contents turn으로 분리, system instruction에 욱여넣지 않음) */
  exampleDialogue: ExampleDialogueTurn[];
  /** 금지사항 — 스키마 후변경 파급 완화를 위해 optional로 선납 (sprint plan arch 합의) */
  prohibitions?: string[];
}

export { PERSONA_TEMPLATES } from './personas';
export { buildPersonaPrompt, type PersonaPrompt } from './persona-prompt';
export {
  parseChatStream,
  serializeChatStreamEvent,
  type ChatStreamErrorCode,
  type ChatStreamEvent,
} from './chat-stream';

export const SHARED_PACKAGE_NAME = '@ai-character/shared';

/** Chat API contract (#2a) — web/api가 공유하는 단일 출처 */
export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ChatRequest {
  /** 페르소나 system instruction. 조립 로직은 #5 — 여기서는 문자열만 운반 */
  systemInstruction?: string;
  messages: ChatMessage[];
}

export interface ChatResponse {
  message: ChatMessage;
}
