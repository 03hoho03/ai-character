'use client';

/**
 * #47 스토리 제작 마법사 — MVP 4탭(+등록) 폼.
 * character-form 패턴 확장: 다중 StartSetting(중첩 동적 배열)·스탯·엔딩 행 추가/삭제.
 * 검증/직렬화는 story-form-model의 sanitizeStoryForSave에 위임 — 통과 시 onSubmit(CreateStoryRequest) 호출.
 * 미디어/키워드북/단축어는 out_of_scope(제외, docs §5 MVP 경계).
 */
import { useState } from 'react';
import type { CreateStoryRequest, StoryVisibility } from '@ai-character/shared';
import {
  ENDING_OPS,
  MAX_DEVELOPMENT_EXAMPLES,
  MAX_ENDINGS,
  MAX_STATS,
  MAX_SUGGESTED_REPLIES,
  emptyEnding,
  emptyEndingRule,
  emptyStartSetting,
  emptyStat,
  emptyStoryDraft,
  sanitizeStoryForSave,
  type StoryDraft,
} from './story-form-model';

const fieldClass =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900';
const sectionTitle = 'text-sm font-semibold text-zinc-700 dark:text-zinc-300';
const btn = 'rounded-md px-3 py-1.5 text-sm font-medium';
const addBtn = `${btn} bg-zinc-100 dark:bg-zinc-800`;
const removeLink = 'shrink-0 text-xs text-red-500 hover:underline';

const TABS = [
  { key: 'profile', label: '프로필' },
  { key: 'story', label: '스토리 설정' },
  { key: 'starts', label: '시작 설정' },
  { key: 'register', label: '등록' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const VISIBILITY_OPTIONS: { value: StoryVisibility; label: string }[] = [
  { value: 'private', label: '비공개' },
  { value: 'public', label: '공개' },
  { value: 'link', label: '링크 공유' },
];

export function StoryForm({
  initial,
  submitLabel,
  onSubmit,
  onDelete,
}: {
  initial?: StoryDraft;
  submitLabel: string;
  onSubmit: (request: CreateStoryRequest) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<StoryDraft>(initial ?? emptyStoryDraft());
  const [tab, setTab] = useState<TabKey>('profile');
  const [errors, setErrors] = useState<string[]>([]);

  const set = <K extends keyof StoryDraft>(key: K, value: StoryDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // --- 전개 예시(스토리 설정 탭) ---
  const updateExample = (i: number, side: 'input' | 'output', value: string) =>
    setDraft((d) => ({
      ...d,
      developmentExamples: d.developmentExamples.map((ex, idx) =>
        idx === i ? { ...ex, [side]: value } : ex,
      ),
    }));
  const addExample = () =>
    setDraft((d) =>
      d.developmentExamples.length >= MAX_DEVELOPMENT_EXAMPLES
        ? d
        : { ...d, developmentExamples: [...d.developmentExamples, { input: '', output: '' }] },
    );
  const removeExample = (i: number) =>
    setDraft((d) => ({
      ...d,
      developmentExamples: d.developmentExamples.filter((_, idx) => idx !== i),
    }));

  // --- 시작 설정(다중) ---
  const mutateSetting = (
    si: number,
    fn: (s: StoryDraft['startSettings'][number]) => StoryDraft['startSettings'][number],
  ) =>
    setDraft((d) => ({
      ...d,
      startSettings: d.startSettings.map((s, idx) => (idx === si ? fn(s) : s)),
    }));

  const addSetting = () =>
    setDraft((d) => ({ ...d, startSettings: [...d.startSettings, emptyStartSetting()] }));
  const removeSetting = (si: number) =>
    setDraft((d) => ({ ...d, startSettings: d.startSettings.filter((_, idx) => idx !== si) }));

  const setSettingField = (
    si: number,
    key: 'name' | 'prologue' | 'startSituation' | 'playGuide',
    value: string,
  ) => mutateSetting(si, (s) => ({ ...s, [key]: value }));

  // 추천답변(시작설정별 ≤3)
  const updateReply = (si: number, ri: number, value: string) =>
    mutateSetting(si, (s) => ({
      ...s,
      suggestedReplies: s.suggestedReplies.map((r, idx) => (idx === ri ? value : r)),
    }));
  const addReply = (si: number) =>
    mutateSetting(si, (s) =>
      s.suggestedReplies.length >= MAX_SUGGESTED_REPLIES
        ? s
        : { ...s, suggestedReplies: [...s.suggestedReplies, ''] },
    );
  const removeReply = (si: number, ri: number) =>
    mutateSetting(si, (s) => ({
      ...s,
      suggestedReplies: s.suggestedReplies.filter((_, idx) => idx !== ri),
    }));

  // 스탯(시작설정별 ≤7)
  const updateStat = (
    si: number,
    sti: number,
    key: 'name' | 'initialValue' | 'minValue' | 'maxValue',
    value: string,
  ) =>
    mutateSetting(si, (s) => ({
      ...s,
      stats: s.stats.map((st, idx) => (idx === sti ? { ...st, [key]: value } : st)),
    }));
  const addStat = (si: number) =>
    mutateSetting(si, (s) =>
      s.stats.length >= MAX_STATS ? s : { ...s, stats: [...s.stats, emptyStat()] },
    );
  const removeStat = (si: number, sti: number) =>
    mutateSetting(si, (s) => ({ ...s, stats: s.stats.filter((_, idx) => idx !== sti) }));

  // 엔딩(시작설정별 ≤10)
  const updateEnding = (
    si: number,
    ei: number,
    key: 'name' | 'resultText' | 'priority',
    value: string,
  ) =>
    mutateSetting(si, (s) => ({
      ...s,
      endings: s.endings.map((e, idx) => (idx === ei ? { ...e, [key]: value } : e)),
    }));
  const addEnding = (si: number) =>
    mutateSetting(si, (s) =>
      s.endings.length >= MAX_ENDINGS ? s : { ...s, endings: [...s.endings, emptyEnding()] },
    );
  const removeEnding = (si: number, ei: number) =>
    mutateSetting(si, (s) => ({ ...s, endings: s.endings.filter((_, idx) => idx !== ei) }));

  // 엔딩 조건절([{stat,op,value}] AND)
  const updateRule = (
    si: number,
    ei: number,
    ci: number,
    key: 'stat' | 'op' | 'value',
    value: string,
  ) =>
    mutateSetting(si, (s) => ({
      ...s,
      endings: s.endings.map((e, idx) =>
        idx === ei
          ? {
              ...e,
              condition: e.condition.map((c, cIdx) =>
                cIdx === ci ? { ...c, [key]: value } : c,
              ),
            }
          : e,
      ),
    }));
  const addRule = (si: number, ei: number) =>
    mutateSetting(si, (s) => ({
      ...s,
      endings: s.endings.map((e, idx) =>
        idx === ei ? { ...e, condition: [...e.condition, emptyEndingRule()] } : e,
      ),
    }));
  const removeRule = (si: number, ei: number, ci: number) =>
    mutateSetting(si, (s) => ({
      ...s,
      endings: s.endings.map((e, idx) =>
        idx === ei ? { ...e, condition: e.condition.filter((_, cIdx) => cIdx !== ci) } : e,
      ),
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = sanitizeStoryForSave(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    onSubmit(result.request);
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-6">
      {/* 탭 네비게이션 */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`${btn} -mb-px border-b-2 ${
              tab === t.key
                ? 'border-zinc-900 dark:border-white'
                : 'border-transparent text-zinc-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. 프로필 */}
      {tab === 'profile' && (
        <section className="flex flex-col gap-4" aria-label="프로필">
          <label className="flex flex-col gap-1">
            <span className={sectionTitle}>이름</span>
            <input
              className={fieldClass}
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={sectionTitle}>한줄소개</span>
            <input
              className={fieldClass}
              value={draft.tagline}
              onChange={(e) => set('tagline', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={sectionTitle}>대표 이미지 URL (선택)</span>
            <input
              className={fieldClass}
              placeholder="https://… (업로드는 후속)"
              value={draft.profileImage}
              onChange={(e) => set('profileImage', e.target.value)}
            />
          </label>
        </section>
      )}

      {/* 2. 스토리 설정 */}
      {tab === 'story' && (
        <section className="flex flex-col gap-4" aria-label="스토리 설정">
          <label className="flex flex-col gap-1">
            <span className={sectionTitle}>스토리 설정/정보 (세계관·설정·등장인물)</span>
            <textarea
              className={`${fieldClass} min-h-32`}
              value={draft.storyInfo}
              onChange={(e) => set('storyInfo', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={sectionTitle}>프롬프트 템플릿 ID (선택)</span>
            <input
              className={fieldClass}
              value={draft.promptTemplateId}
              onChange={(e) => set('promptTemplateId', e.target.value)}
            />
          </label>

          <fieldset className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <legend className={sectionTitle}>전개 예시 (최대 {MAX_DEVELOPMENT_EXAMPLES})</legend>
              <button type="button" onClick={addExample} className={addBtn}>
                + 예시 추가
              </button>
            </div>
            {draft.developmentExamples.map((ex, i) => (
              <div
                key={i}
                className="flex flex-col gap-1 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <input
                  className={fieldClass}
                  placeholder="입력(유저)"
                  aria-label={`전개 예시 ${i + 1} 입력`}
                  value={ex.input}
                  onChange={(e) => updateExample(i, 'input', e.target.value)}
                />
                <input
                  className={fieldClass}
                  placeholder="출력(전개)"
                  aria-label={`전개 예시 ${i + 1} 출력`}
                  value={ex.output}
                  onChange={(e) => updateExample(i, 'output', e.target.value)}
                />
                <button type="button" onClick={() => removeExample(i)} className="self-end text-xs text-red-500 hover:underline">
                  이 예시 삭제
                </button>
              </div>
            ))}
          </fieldset>
        </section>
      )}

      {/* 3. 시작 설정(다중) */}
      {tab === 'starts' && (
        <section className="flex flex-col gap-5" aria-label="시작 설정">
          <div className="flex items-center justify-between">
            <span className={sectionTitle}>시작 설정 ({draft.startSettings.length}개)</span>
            <button type="button" onClick={addSetting} className={addBtn}>
              + 시작 설정 추가
            </button>
          </div>

          {draft.startSettings.map((ss, si) => (
            <div
              key={si}
              className="flex flex-col gap-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700"
            >
              <div className="flex items-center justify-between">
                <span className={sectionTitle}>시작 설정 {si + 1}</span>
                {draft.startSettings.length > 1 && (
                  <button type="button" onClick={() => removeSetting(si)} className={removeLink}>
                    이 시작 설정 삭제
                  </button>
                )}
              </div>

              <label className="flex flex-col gap-1">
                <span className={sectionTitle}>이름</span>
                <input
                  className={fieldClass}
                  aria-label={`시작 설정 ${si + 1} 이름`}
                  value={ss.name}
                  onChange={(e) => setSettingField(si, 'name', e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={sectionTitle}>프롤로그</span>
                <textarea
                  className={`${fieldClass} min-h-20`}
                  aria-label={`시작 설정 ${si + 1} 프롤로그`}
                  value={ss.prologue}
                  onChange={(e) => setSettingField(si, 'prologue', e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={sectionTitle}>시작 상황</span>
                <textarea
                  className={`${fieldClass} min-h-20`}
                  aria-label={`시작 설정 ${si + 1} 시작 상황`}
                  value={ss.startSituation}
                  onChange={(e) => setSettingField(si, 'startSituation', e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={sectionTitle}>플레이 가이드 (선택, AI 비기억)</span>
                <textarea
                  className={`${fieldClass} min-h-16`}
                  aria-label={`시작 설정 ${si + 1} 플레이 가이드`}
                  value={ss.playGuide}
                  onChange={(e) => setSettingField(si, 'playGuide', e.target.value)}
                />
              </label>

              {/* 추천 답변 */}
              <fieldset className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <legend className={sectionTitle}>추천 답변 (최대 {MAX_SUGGESTED_REPLIES})</legend>
                  <button type="button" onClick={() => addReply(si)} className={addBtn}>
                    + 답변 추가
                  </button>
                </div>
                {ss.suggestedReplies.map((r, ri) => (
                  <div key={ri} className="flex gap-2">
                    <input
                      className={fieldClass}
                      aria-label={`시작 설정 ${si + 1} 추천 답변 ${ri + 1}`}
                      value={r}
                      onChange={(e) => updateReply(si, ri, e.target.value)}
                    />
                    <button type="button" onClick={() => removeReply(si, ri)} className={removeLink}>
                      삭제
                    </button>
                  </div>
                ))}
              </fieldset>

              {/* 스탯 */}
              <fieldset className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <legend className={sectionTitle}>스탯 (최대 {MAX_STATS})</legend>
                  <button type="button" onClick={() => addStat(si)} className={addBtn}>
                    + 스탯 추가
                  </button>
                </div>
                {ss.stats.map((st, sti) => (
                  <div
                    key={sti}
                    className="flex flex-col gap-1 rounded-md border border-zinc-200 p-2 dark:border-zinc-800"
                  >
                    <input
                      className={fieldClass}
                      placeholder="스탯 이름 (예: 호감도)"
                      aria-label={`시작 설정 ${si + 1} 스탯 ${sti + 1} 이름`}
                      value={st.name}
                      onChange={(e) => updateStat(si, sti, 'name', e.target.value)}
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        className={fieldClass}
                        placeholder="초기값"
                        aria-label={`시작 설정 ${si + 1} 스탯 ${sti + 1} 초기값`}
                        value={st.initialValue}
                        onChange={(e) => updateStat(si, sti, 'initialValue', e.target.value)}
                      />
                      <input
                        type="number"
                        className={fieldClass}
                        placeholder="최소"
                        aria-label={`시작 설정 ${si + 1} 스탯 ${sti + 1} 최소값`}
                        value={st.minValue}
                        onChange={(e) => updateStat(si, sti, 'minValue', e.target.value)}
                      />
                      <input
                        type="number"
                        className={fieldClass}
                        placeholder="최대"
                        aria-label={`시작 설정 ${si + 1} 스탯 ${sti + 1} 최대값`}
                        value={st.maxValue}
                        onChange={(e) => updateStat(si, sti, 'maxValue', e.target.value)}
                      />
                    </div>
                    <button type="button" onClick={() => removeStat(si, sti)} className="self-end text-xs text-red-500 hover:underline">
                      스탯 삭제
                    </button>
                  </div>
                ))}
              </fieldset>

              {/* 엔딩 */}
              <fieldset className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <legend className={sectionTitle}>엔딩 (최대 {MAX_ENDINGS})</legend>
                  <button type="button" onClick={() => addEnding(si)} className={addBtn}>
                    + 엔딩 추가
                  </button>
                </div>
                {ss.endings.map((e, ei) => (
                  <div
                    key={ei}
                    className="flex flex-col gap-2 rounded-md border border-zinc-200 p-2 dark:border-zinc-800"
                  >
                    <input
                      className={fieldClass}
                      placeholder="엔딩 이름"
                      aria-label={`시작 설정 ${si + 1} 엔딩 ${ei + 1} 이름`}
                      value={e.name}
                      onChange={(ev) => updateEnding(si, ei, 'name', ev.target.value)}
                    />
                    <textarea
                      className={`${fieldClass} min-h-16`}
                      placeholder="결말 텍스트"
                      aria-label={`시작 설정 ${si + 1} 엔딩 ${ei + 1} 결말`}
                      value={e.resultText}
                      onChange={(ev) => updateEnding(si, ei, 'resultText', ev.target.value)}
                    />
                    <input
                      type="number"
                      className={fieldClass}
                      placeholder="우선순위 (선택, 낮을수록 먼저)"
                      aria-label={`시작 설정 ${si + 1} 엔딩 ${ei + 1} 우선순위`}
                      value={e.priority}
                      onChange={(ev) => updateEnding(si, ei, 'priority', ev.target.value)}
                    />

                    {/* 조건절 AND */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">조건 (AND)</span>
                      <button type="button" onClick={() => addRule(si, ei)} className={`${addBtn} py-1 text-xs`}>
                        + 조건
                      </button>
                    </div>
                    {e.condition.map((c, ci) => (
                      <div key={ci} className="flex gap-2">
                        <input
                          className={fieldClass}
                          placeholder="스탯"
                          aria-label={`시작 설정 ${si + 1} 엔딩 ${ei + 1} 조건 ${ci + 1} 스탯`}
                          value={c.stat}
                          onChange={(ev) => updateRule(si, ei, ci, 'stat', ev.target.value)}
                        />
                        <select
                          className={fieldClass}
                          aria-label={`시작 설정 ${si + 1} 엔딩 ${ei + 1} 조건 ${ci + 1} 연산자`}
                          value={c.op}
                          onChange={(ev) => updateRule(si, ei, ci, 'op', ev.target.value)}
                        >
                          {ENDING_OPS.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          className={fieldClass}
                          placeholder="값"
                          aria-label={`시작 설정 ${si + 1} 엔딩 ${ei + 1} 조건 ${ci + 1} 값`}
                          value={c.value}
                          onChange={(ev) => updateRule(si, ei, ci, 'value', ev.target.value)}
                        />
                        <button type="button" onClick={() => removeRule(si, ei, ci)} className={removeLink}>
                          삭제
                        </button>
                      </div>
                    ))}

                    <button type="button" onClick={() => removeEnding(si, ei)} className="self-end text-xs text-red-500 hover:underline">
                      엔딩 삭제
                    </button>
                  </div>
                ))}
              </fieldset>
            </div>
          ))}
        </section>
      )}

      {/* 4. 등록 */}
      {tab === 'register' && (
        <section className="flex flex-col gap-4" aria-label="등록">
          <fieldset className="flex flex-col gap-2">
            <legend className={sectionTitle}>공개 범위</legend>
            {VISIBILITY_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="visibility"
                  checked={draft.visibility === opt.value}
                  onChange={() => set('visibility', opt.value)}
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </fieldset>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.contentRating === 'adult'}
              onChange={(e) => set('contentRating', e.target.checked ? 'adult' : 'all')}
            />
            <span className={sectionTitle}>성인 콘텐츠 (등록 후 변경 불가)</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.commentsClosed}
              onChange={(e) => set('commentsClosed', e.target.checked)}
            />
            <span className={sectionTitle}>댓글 닫기</span>
          </label>
        </section>
      )}

      {errors.length > 0 && (
        <ul role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/40">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className={`${btn} border border-red-300 text-red-600 dark:border-red-800`}
          >
            삭제
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className={`${btn} bg-zinc-900 text-white dark:bg-white dark:text-zinc-900`}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
