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
