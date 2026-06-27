/**
 * #47 story-form-model 순수 함수 테스트 — sanitizeStoryForSave 검증/직렬화 + storyToDraft 역직렬화 round-trip.
 * 컴포넌트 테스트가 못 잡는 편집 로드(서버 Story → draft) 타입 변환 회귀를 직접 단언한다.
 */
import { describe, expect, it } from 'vitest';
import type { Story } from '@ai-character/shared';
import {
  emptyStoryDraft,
  sanitizeStoryForSave,
  storyToDraft,
  type StoryDraft,
} from './story-form-model';

const baseDraft = (): StoryDraft => ({
  ...emptyStoryDraft(),
  name: '스토리',
  tagline: '한줄',
  storyInfo: '설정',
  startSettings: [
    {
      name: '시작',
      prologue: 'p',
      startSituation: 's',
      playGuide: '',
      suggestedReplies: [''],
      stats: [],
      endings: [],
    },
  ],
});

describe('sanitizeStoryForSave (#47)', () => {
  it('필수 누락(name/tagline/storyInfo) 시 ok:false + 에러 메시지', () => {
    const result = sanitizeStoryForSave(emptyStoryDraft());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('스토리 이름은 비워둘 수 없어요.');
      expect(result.errors).toContain('한줄소개는 비워둘 수 없어요.');
      expect(result.errors).toContain('스토리 설정/정보는 비워둘 수 없어요.');
    }
  });

  it('시작 설정 필수(이름/프롤로그/시작상황) 누락 차단', () => {
    const draft = baseDraft();
    draft.startSettings[0].name = '';
    const result = sanitizeStoryForSave(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('시작 설정의 이름'))).toBe(true);
    }
  });

  it('빈 추천답변/빈 전개예시/이름없는 스탯·엔딩/빈 조건절을 필터링한다', () => {
    const draft = baseDraft();
    draft.developmentExamples = [
      { input: '', output: '' },
      { input: 'a', output: 'b' },
    ];
    draft.startSettings[0].suggestedReplies = ['', '응답'];
    draft.startSettings[0].stats = [
      { name: '', initialValue: '0', minValue: '0', maxValue: '100' },
      { name: '호감도', initialValue: '5', minValue: '0', maxValue: '50' },
    ];
    draft.startSettings[0].endings = [
      { name: '', condition: [], resultText: '', priority: '' },
      {
        name: '엔딩',
        resultText: 'r',
        priority: '2',
        condition: [
          { stat: '', op: '>=', value: '0' },
          { stat: '호감도', op: '>=', value: '40' },
        ],
      },
    ];

    const result = sanitizeStoryForSave(draft);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ss = result.request.startSettings[0];
    expect(result.request.developmentExamples).toEqual([{ input: 'a', output: 'b' }]);
    expect(ss.suggestedReplies).toEqual(['응답']);
    expect(ss.stats).toEqual([{ name: '호감도', initialValue: 5, minValue: 0, maxValue: 50 }]);
    expect(ss.endings).toEqual([
      { name: '엔딩', resultText: 'r', priority: 2, condition: [{ stat: '호감도', op: '>=', value: 40 }] },
    ]);
  });

  it('priority 미입력이면 키 자체를 생략한다', () => {
    const draft = baseDraft();
    draft.startSettings[0].endings = [
      { name: '엔딩', resultText: 'r', priority: '', condition: [{ stat: 'x', op: '>', value: '1' }] },
    ];
    const result = sanitizeStoryForSave(draft);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('priority' in result.request.startSettings[0].endings[0]).toBe(false);
  });

  it('profileImage/promptTemplateId는 비어있으면 생략, 있으면 포함', () => {
    const empty = sanitizeStoryForSave(baseDraft());
    expect(empty.ok).toBe(true);
    if (empty.ok) {
      expect('profileImage' in empty.request).toBe(false);
      expect('promptTemplateId' in empty.request).toBe(false);
    }
    const withImg = sanitizeStoryForSave({
      ...baseDraft(),
      profileImage: 'https://x/y.png',
      promptTemplateId: 'tpl-1',
    });
    expect(withImg.ok).toBe(true);
    if (withImg.ok) {
      expect(withImg.request.profileImage).toBe('https://x/y.png');
      expect(withImg.request.promptTemplateId).toBe('tpl-1');
    }
  });
});

describe('storyToDraft (#47 편집 round-trip)', () => {
  const story = (over: Partial<Story> = {}): Story => ({
    id: 'st-1',
    name: '스토리',
    tagline: '한줄',
    storyInfo: '설정',
    profileImage: 'https://img',
    promptTemplateId: 'tpl-2',
    developmentExamples: [{ input: 'i', output: 'o' }],
    shortcuts: [],
    contentRating: 'adult',
    visibility: 'public',
    commentsClosed: true,
    startSettings: [
      {
        name: 'A',
        prologue: 'pa',
        startSituation: 'sa',
        playGuide: 'g',
        suggestedReplies: ['r1'],
        stats: [{ name: '호감도', initialValue: 10, minValue: 0, maxValue: 100 }],
        endings: [
          {
            name: '엔딩A',
            condition: [{ stat: '호감도', op: '>=', value: 80 }],
            resultText: 'res',
            priority: 1,
          },
        ],
      },
    ],
    ...over,
  });

  it('숫자를 문자열로 변환해 draft를 복원한다(스탯/조건/우선순위)', () => {
    const draft = storyToDraft(story());
    expect(draft.contentRating).toBe('adult');
    expect(draft.visibility).toBe('public');
    expect(draft.commentsClosed).toBe(true);
    expect(draft.profileImage).toBe('https://img');
    expect(draft.promptTemplateId).toBe('tpl-2');

    const ss = draft.startSettings[0];
    expect(ss.stats).toEqual([
      { name: '호감도', initialValue: '10', minValue: '0', maxValue: '100' },
    ]);
    expect(ss.endings[0]).toEqual({
      name: '엔딩A',
      resultText: 'res',
      priority: '1',
      condition: [{ stat: '호감도', op: '>=', value: '80' }],
    });
  });

  it('round-trip: storyToDraft → sanitize 가 원본 중첩 값을 보존한다', () => {
    const original = story();
    const result = sanitizeStoryForSave(storyToDraft(original));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ss = result.request.startSettings[0];
    expect(ss.stats).toEqual(original.startSettings[0].stats);
    expect(ss.endings).toEqual(original.startSettings[0].endings);
    expect(result.request.developmentExamples).toEqual(original.developmentExamples);
  });

  it('빈 동적 배열 폴백: 시작설정 0개→1개, 빈 조건절→1행, 빈 추천답변→1행', () => {
    const draft = storyToDraft(
      story({
        startSettings: [
          {
            name: 'B',
            prologue: 'p',
            startSituation: 's',
            suggestedReplies: [],
            stats: [],
            endings: [{ name: 'E', condition: [], resultText: 'r', priority: undefined }],
          },
        ],
      }),
    );
    const ss = draft.startSettings[0];
    expect(ss.suggestedReplies).toEqual(['']);
    expect(ss.endings[0].condition).toHaveLength(1);
    expect(ss.endings[0].priority).toBe('');

    const noSettings = storyToDraft(story({ startSettings: [] }));
    expect(noSettings.startSettings).toHaveLength(1);
  });
});
