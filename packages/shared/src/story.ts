/**
 * #43 스토리 모드(인터랙티브 픽션) 도메인 타입.
 * Prisma 스키마(apps/api/prisma/schema.prisma)의 형태를 공유 경계로 박제 — #44 제작/#45 빌더가 소비.
 * 설계: docs/story-mode-design.md.
 */
import type { ContentRating } from './index';

/** 공개 범위 — 크랙 등록 탭. 기본 비공개. */
export type StoryVisibility = 'public' | 'private' | 'link';

/** 스탯 정의(정규화 테이블 Stat). 호감도류 변수. 시작설정별 ≤7. */
export interface StatDef {
  /**
   * 영속 행 id(서버 응답에만 존재). #44/#47 생성 경로는 클라가 보내지 않으므로 optional —
   * 서버가 GET /stories/:id 응답에 이미 포함해 반환하던 값을 #48 play UI가 소비하기 위해 박제한다.
   */
  id?: string;
  name: string;
  initialValue: number;
  minValue: number;
  maxValue: number;
}

/** 엔딩 조건 비교 연산자. #51 결정론 평가가 해석. */
export type EndingOp = '>=' | '<=' | '==' | '>' | '<';

/** 엔딩 조건 1절 — `스탯 op 값`. condition은 이 절들의 AND. */
export interface EndingRule {
  stat: string;
  op: EndingOp;
  value: number;
}

/** 엔딩(시작설정별 ≤10). condition AND 충족 시 후보, priority로 먼저 1개만 트리거. */
export interface EndingDef {
  name: string;
  /** [{stat,op,value}] AND 규칙 */
  condition: EndingRule[];
  resultText: string;
  /** 동시충족 시 정렬 우선순위(낮을수록 먼저) */
  priority?: number;
}

/** 전개 예시 1쌍 — 스토리 설정 탭. */
export interface DevelopmentExample {
  input: string;
  output: string;
}

/** 단축어 1개(story-level ≤20). */
export interface Shortcut {
  label: string;
  command: string;
}

/** 시작 설정(분기 시나리오 단위). 스탯·엔딩이 이 단위로 스코프된다. */
export interface StartSettingDef {
  /**
   * 영속 행 id(서버 응답에만 존재). #44/#47 생성 경로는 클라가 보내지 않으므로 optional —
   * 서버가 GET /stories/:id 응답에 이미 포함해 반환하던 값을 #48 play UI가 세션 생성
   * (CreateStorySessionRequest.startSettingId)에 쓰기 위해 박제한다.
   */
  id?: string;
  name: string;
  prologue: string;
  startSituation: string;
  /** AI 비기억, 사용자에게만 보이는 가이드 */
  playGuide?: string;
  /** 추천 첫 답변 ≤3 */
  suggestedReplies: string[];
  stats: StatDef[];
  endings: EndingDef[];
}

/** 스토리 본체(제작 산출). 런타임 가변 상태는 StorySession 쪽. */
export interface Story {
  id: string;
  profileImage?: string;
  name: string;
  tagline: string;
  promptTemplateId?: string;
  storyInfo: string;
  developmentExamples: DevelopmentExample[];
  shortcuts: Shortcut[];
  contentRating?: ContentRating;
  visibility?: StoryVisibility;
  commentsClosed?: boolean;
  startSettings: StartSettingDef[];
}

/** 런타임 스탯 상태 — { [statName]: number }. StorySession.statValues. */
export type StatValues = Record<string, number>;

/**
 * POST /stories 요청(#44) — Story 본체 + 중첩 StartSetting/Stat/Ending 일괄 생성.
 * id는 서버가 cuid로 부여(클라 미제공). browserId는 비로그인 폴백 소유 식별자(로그인이면 쿠키 userId 우선, #23).
 * contentRating은 한번 설정 후 불변(#44 등록 탭) — 갱신은 UpdateStoryRequest에서 제외.
 */
export interface CreateStoryRequest {
  browserId?: string;
  profileImage?: string;
  name: string;
  tagline: string;
  promptTemplateId?: string;
  storyInfo: string;
  developmentExamples: DevelopmentExample[];
  shortcuts: Shortcut[];
  contentRating?: ContentRating;
  visibility?: StoryVisibility;
  commentsClosed?: boolean;
  startSettings: StartSettingDef[];
}

/**
 * PATCH /stories/:id 요청(#44) — 부분 갱신(소유자만). id는 경로에서 받는다.
 * contentRating은 의도적으로 제외 — 한번 설정 후 불변(#44 등록 탭).
 * 중첩 startSettings를 보내면 자식(StartSetting/Stat/Ending) 전체 교체 갱신.
 */
export interface UpdateStoryRequest {
  browserId?: string;
  profileImage?: string;
  name?: string;
  tagline?: string;
  promptTemplateId?: string;
  storyInfo?: string;
  developmentExamples?: DevelopmentExample[];
  shortcuts?: Shortcut[];
  visibility?: StoryVisibility;
  commentsClosed?: boolean;
  startSettings?: StartSettingDef[];
}

/**
 * #49 플레이 세션 영속 contract — StorySession(Conversation의 스토리판) HTTP 단일 출처.
 * 날짜는 JSON 직렬화 형태(ISO 문자열) 기준. statValues는 생성 시 Stat.initialValue로 초기화된다.
 */
export interface StorySessionRecord {
  id: string;
  storyId: string;
  startSettingId: string;
  /** 현재 스탯 상태 { [statName]: number } — 생성 시 시작설정 Stat.initialValue로 초기화 */
  statValues: StatValues;
  /** 도달한 엔딩 id(null=진행중). #51 엔딩 평가 전까지 항상 null */
  endedWith: string | null;
  /** ownerContext 이중축 — 로그인 userId / 비로그인 browserId(둘 중 하나만 set) */
  browserId?: string | null;
  userId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** POST /story-sessions 요청 — 세션 생성(get-or-create는 후속). browserId는 비로그인 폴백(로그인이면 쿠키 userId 우선). */
export interface CreateStorySessionRequest {
  browserId?: string;
  storyId: string;
  startSettingId: string;
}

/** POST /story-sessions/:id/turn 요청(#50) — 플레이 한 턴. */
export interface TurnStorySessionRequest {
  browserId?: string;
  message: string;
}

/**
 * POST /story-sessions/:id/turn 응답(#50/#51) — 모델 reply + 검증·clamp된 statValues + 엔딩.
 * ended=true면 ending(resultText)이 채워지고 세션은 종료(endedWith 영속). rejectedKeys=거부된 모델 스탯 키.
 */
export interface StoryTurnResult {
  reply: string;
  statValues: StatValues;
  rejectedKeys: string[];
  ended: boolean;
  ending: { id: string; name: string; resultText: string } | null;
}
