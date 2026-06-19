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
  /** 카드용 한줄소개 (#7) */
  tagline: string;
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
  /**
   * #25 분류 카테고리(단일) — 발견 필터용 메타데이터. 프롬프트에는 주입하지 않는다(buildPersonaPrompt 미참조).
   * 템플릿/기존 캐릭터 호환을 위해 optional.
   */
  category?: string;
  /** #25 태그(다중) — 발견 필터용 메타데이터. 프롬프트 미주입. 미지정/빈 배열 허용 */
  tags?: string[];
  /**
   * #26 콘텐츠 등급 — 성인/일반 분리. 미지정은 'all'(일반)로 취급한다.
   * 공개 발견 기본값은 일반만 노출이며 성인은 명시 opt-in으로만 노출(안전 기본값).
   */
  contentRating?: ContentRating;
}

/** #26 콘텐츠 등급 — 'all'(일반) | 'adult'(성인). 공개목록 필터·폼 플래그의 단일 출처 */
export type ContentRating = 'all' | 'adult';

export { PERSONA_TEMPLATES } from './personas';
export { buildPersonaPrompt, type PersonaPrompt } from './persona-prompt';
export {
  SUMMARY_TURN_THRESHOLD,
  SUMMARY_RECENT_TURNS,
  SUMMARY_TOKEN_CAP,
  estimateTokens,
  shouldSummarize,
  assembleHistory,
} from './conversation-summary';
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
  /**
   * #23 신뢰 소스 조회 키. 서버가 이 id로 persona를 재조회해 system instruction을 재조립한다.
   * 클라가 instruction을 직접 전송하던 통로를 제거 — `tpl-*`는 템플릿, 그 외는 Character DB.
   */
  personaId: string;
  /** #23/#32 usr-* 비공개 캐릭터 소유 확인용 익명 browserId(비로그인 폴백). 로그인이면 쿠키 userId 우선 → optional */
  browserId?: string;
  messages: ChatMessage[];
  /** #15 과거 대화 요약 — 서버가 systemInstruction에 접합해 장기기억으로 주입 */
  conversationSummary?: string;
}

export interface ChatResponse {
  message: ChatMessage;
}

/**
 * 대화 영속화 contract (#14) — web/api 공용 단일 출처.
 * 날짜는 JSON 직렬화 형태(ISO 문자열) 기준.
 */
export interface PersistedMessage {
  id: string;
  role: ChatMessage['role'];
  content: string;
  createdAt: string;
}

export interface ConversationRecord {
  id: string;
  browserId: string;
  /** #31 계정 소유(nullable, browserId 병행). 소유검증/유니크키 전환은 #32/#34 */
  userId?: string | null;
  personaId: string;
  createdAt: string;
  updatedAt: string;
  /** #15 과거 turn 자동 요약(장기기억). 없으면 null */
  summary?: string | null;
  /** #15 summary에 접힌 선행 turn 수 — 증분 요약 기준점 */
  summarizedCount?: number;
}

export interface ConversationWithMessages extends ConversationRecord {
  messages: PersistedMessage[];
}

/** POST /conversations/:id/summarize 요청 (#15) */
export interface SummarizeRequest {
  browserId: string;
}

/** 요약 결과 — summarizeConversation 응답/영속 단위 */
export interface SummaryResult {
  summary: string | null;
  summarizedCount: number;
}

/** POST /conversations 요청 — (browserId, personaId) get-or-create */
export interface CreateConversationRequest {
  browserId: string;
  personaId: string;
}

/**
 * 캐릭터 영속화 contract (#16) — web/api 공용 단일 출처.
 * 캐릭터 = 소유자(browserId)가 붙고 공개/비공개를 갖는 Persona. id는 클라이언트 제공(`usr-<uuid>`).
 * 날짜는 JSON 직렬화 형태(ISO 문자열) 기준.
 */
export interface CharacterRecord extends Persona {
  /** 소유자 = 익명 browserId. #32 로그인 캐릭터는 userId 소유라 browserId가 null일 수 있다 */
  browserId?: string | null;
  /** #31/#32 계정 소유(nullable, browserId 병행) */
  userId?: string | null;
  /** 공개 목록/탐색 노출 여부 (#16: 목록+상세 조회까지, 타 사용자 채팅은 #19) */
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

/** POST /characters 요청 — Persona(id 포함) + 소유자 + 공개 여부. 같은 id 재요청은 소유자면 upsert.
 *  #32 browserId는 비로그인 폴백 소유 식별자(로그인이면 쿠키 userId 우선) → optional. */
export interface CreateCharacterRequest extends Persona {
  browserId?: string;
  isPublic?: boolean;
}

/** PATCH /characters/:id 요청 — 부분 갱신 필드. id는 경로에서 받는다. #32 browserId optional(비로그인 폴백) */
export interface UpdateCharacterRequest extends Partial<Omit<Persona, 'id'>> {
  browserId?: string;
  isPublic?: boolean;
}

/** POST /conversations/:id/messages 요청 */
export interface AppendMessageRequest {
  browserId: string;
  role: ChatMessage['role'];
  content: string;
}

/**
 * PUT /conversations/:id/messages 요청 (#18) — 메시지 열 전체 교체.
 * 편집/재생성 시 후속 turn truncate를 '전체 교체'로 달성한다(append-only 한계 해소).
 */
export interface ReplaceMessagesRequest {
  browserId: string;
  messages: ChatMessage[];
}
