/**
 * #47 스토리 제작 폼 모델 — 순수 함수(draft 생성 / sanitize 검증).
 * character-store의 sanitizeForSave 패턴을 스토리(중첩 StartSetting/Stat/Ending)로 확장한다.
 * UI(React)와 분리해 폼이 생산하는 CreateStoryRequest payload 형태를 단독 테스트 가능하게 한다.
 */
import type {
  ContentRating,
  CreateStoryRequest,
  EndingDef,
  EndingOp,
  EndingRule,
  StartSettingDef,
  StatDef,
  Story,
  StoryVisibility,
} from '@ai-character/shared';

/** 시작설정별 스탯 ≤7 (docs/story-mode-design.md §2) */
export const MAX_STATS = 7;
/** 시작설정별 엔딩 ≤10 */
export const MAX_ENDINGS = 10;
/** 시작설정별 추천답변 ≤3 */
export const MAX_SUGGESTED_REPLIES = 3;
/** 스토리 전개예시 ≤3 */
export const MAX_DEVELOPMENT_EXAMPLES = 3;
/** 엔딩 조건절(엔딩별 AND 규칙 행) 합리적 상한 — 스탯 수만큼 */
export const ENDING_OPS: EndingOp[] = ['>=', '<=', '==', '>', '<'];

/** 폼 편집용 엔딩 규칙 행 — value는 입력 중 문자열로 보관(빈 입력 허용) */
export interface EndingRuleDraft {
  stat: string;
  op: EndingOp;
  value: string;
}

export interface EndingDraft {
  name: string;
  condition: EndingRuleDraft[];
  resultText: string;
  priority: string;
}

export interface StatDraft {
  name: string;
  initialValue: string;
  minValue: string;
  maxValue: string;
}

export interface StartSettingDraft {
  name: string;
  prologue: string;
  startSituation: string;
  playGuide: string;
  suggestedReplies: string[];
  stats: StatDraft[];
  endings: EndingDraft[];
}

export interface StoryDraft {
  profileImage: string;
  name: string;
  tagline: string;
  promptTemplateId: string;
  storyInfo: string;
  developmentExamples: { input: string; output: string }[];
  contentRating: ContentRating;
  visibility: StoryVisibility;
  commentsClosed: boolean;
  startSettings: StartSettingDraft[];
}

export function emptyStat(): StatDraft {
  return { name: '', initialValue: '0', minValue: '0', maxValue: '100' };
}

export function emptyEndingRule(): EndingRuleDraft {
  return { stat: '', op: '>=', value: '0' };
}

export function emptyEnding(): EndingDraft {
  return { name: '', condition: [emptyEndingRule()], resultText: '', priority: '' };
}

export function emptyStartSetting(): StartSettingDraft {
  return {
    name: '',
    prologue: '',
    startSituation: '',
    playGuide: '',
    suggestedReplies: [''],
    stats: [],
    endings: [],
  };
}

/** 신규 작성용 빈 draft — 시작설정 1개를 기본 제공 */
export function emptyStoryDraft(): StoryDraft {
  return {
    profileImage: '',
    name: '',
    tagline: '',
    promptTemplateId: '',
    storyInfo: '',
    developmentExamples: [],
    contentRating: 'all',
    visibility: 'private',
    commentsClosed: false,
    startSettings: [emptyStartSetting()],
  };
}

/**
 * 서버 Story(편집 로드)를 폼 편집용 draft로 역직렬화한다.
 * 숫자는 문자열 입력으로, 비어있는 동적 배열은 그대로(빈 배열) 보존한다.
 */
export function storyToDraft(story: Story): StoryDraft {
  return {
    profileImage: story.profileImage ?? '',
    name: story.name,
    tagline: story.tagline,
    promptTemplateId: story.promptTemplateId ?? '',
    storyInfo: story.storyInfo,
    developmentExamples: story.developmentExamples.map((ex) => ({
      input: ex.input,
      output: ex.output,
    })),
    contentRating: story.contentRating ?? 'all',
    visibility: story.visibility ?? 'private',
    commentsClosed: story.commentsClosed ?? false,
    startSettings:
      story.startSettings.length > 0
        ? story.startSettings.map((ss) => ({
            name: ss.name,
            prologue: ss.prologue,
            startSituation: ss.startSituation,
            playGuide: ss.playGuide ?? '',
            suggestedReplies: ss.suggestedReplies.length > 0 ? [...ss.suggestedReplies] : [''],
            stats: ss.stats.map((s) => ({
              name: s.name,
              initialValue: String(s.initialValue),
              minValue: String(s.minValue),
              maxValue: String(s.maxValue),
            })),
            endings: ss.endings.map((e) => ({
              name: e.name,
              resultText: e.resultText,
              priority: e.priority === undefined ? '' : String(e.priority),
              condition:
                e.condition.length > 0
                  ? e.condition.map((c) => ({ stat: c.stat, op: c.op, value: String(c.value) }))
                  : [emptyEndingRule()],
            })),
          }))
        : [emptyStartSetting()],
  };
}

export type SanitizeStoryResult =
  | { ok: true; request: CreateStoryRequest }
  | { ok: false; errors: string[] };

/** 숫자 입력 파싱 — 비어있거나 NaN이면 fallback */
function toNumber(text: string, fallback = 0): number {
  const n = Number(text.trim());
  return text.trim() === '' || Number.isNaN(n) ? fallback : n;
}

/**
 * 저장 전 검증/정리 — 필수(name/tagline/storyInfo/시작설정≥1, 각 시작설정 name/prologue/startSituation)
 * 누락 시 차단. 빈 추천답변·빈 전개예시·이름 없는 스탯/엔딩·빈 조건절은 필터링한다.
 * 통과 시 CreateStoryRequest 형태로 직렬화(중첩 startSettings/stats/endings, condition=[{stat,op,value}]).
 */
export function sanitizeStoryForSave(draft: StoryDraft): SanitizeStoryResult {
  const errors: string[] = [];
  const name = draft.name.trim();
  const tagline = draft.tagline.trim();
  const storyInfo = draft.storyInfo.trim();
  if (!name) errors.push('스토리 이름은 비워둘 수 없어요.');
  if (!tagline) errors.push('한줄소개는 비워둘 수 없어요.');
  if (!storyInfo) errors.push('스토리 설정/정보는 비워둘 수 없어요.');

  const developmentExamples = draft.developmentExamples
    .map((ex) => ({ input: ex.input.trim(), output: ex.output.trim() }))
    .filter((ex) => ex.input !== '' && ex.output !== '');

  if (draft.startSettings.length === 0) {
    errors.push('시작 설정을 최소 1개 추가해주세요.');
  }

  const startSettings: StartSettingDef[] = draft.startSettings.map((ss, i) => {
    const ssName = ss.name.trim();
    const prologue = ss.prologue.trim();
    const startSituation = ss.startSituation.trim();
    const label = ssName || `${i + 1}번째 시작 설정`;
    if (!ssName) errors.push(`${i + 1}번째 시작 설정의 이름을 입력해주세요.`);
    if (!prologue) errors.push(`${label}의 프롤로그를 입력해주세요.`);
    if (!startSituation) errors.push(`${label}의 시작 상황을 입력해주세요.`);

    const suggestedReplies = ss.suggestedReplies
      .map((r) => r.trim())
      .filter((r) => r !== '');

    const stats: StatDef[] = ss.stats
      .filter((s) => s.name.trim() !== '')
      .map((s) => ({
        name: s.name.trim(),
        initialValue: toNumber(s.initialValue),
        minValue: toNumber(s.minValue, 0),
        maxValue: toNumber(s.maxValue, 100),
      }));

    const endings: EndingDef[] = ss.endings
      .filter((e) => e.name.trim() !== '')
      .map((e) => {
        const condition: EndingRule[] = e.condition
          .filter((c) => c.stat.trim() !== '')
          .map((c) => ({ stat: c.stat.trim(), op: c.op, value: toNumber(c.value) }));
        const priorityText = e.priority.trim();
        const ending: EndingDef = {
          name: e.name.trim(),
          condition,
          resultText: e.resultText.trim(),
        };
        if (priorityText !== '' && !Number.isNaN(Number(priorityText))) {
          ending.priority = Number(priorityText);
        }
        return ending;
      });

    return {
      name: ssName,
      prologue,
      startSituation,
      playGuide: ss.playGuide.trim() || undefined,
      suggestedReplies,
      stats,
      endings,
    };
  });

  if (errors.length > 0) return { ok: false, errors };

  const profileImage = draft.profileImage.trim();
  const promptTemplateId = draft.promptTemplateId.trim();

  const request: CreateStoryRequest = {
    name,
    tagline,
    storyInfo,
    developmentExamples,
    shortcuts: [],
    contentRating: draft.contentRating,
    visibility: draft.visibility,
    commentsClosed: draft.commentsClosed,
    startSettings,
  };
  if (profileImage) request.profileImage = profileImage;
  if (promptTemplateId) request.promptTemplateId = promptTemplateId;

  return { ok: true, request };
}
