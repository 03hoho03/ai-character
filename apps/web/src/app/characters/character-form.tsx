'use client';

/**
 * #6 캐릭터 생성/편집 공용 폼 — Persona 전 필드 편집.
 * exampleDialogue/prohibitions는 행 단위 동적 추가/삭제.
 * 저장 검증은 sanitizeForSave에 위임 — 통과 시 onSubmit(정리된 persona) 호출.
 */
import { useState } from 'react';
import type { Persona } from '@ai-character/shared';
import { sanitizeForSave } from '../../lib/character-store';

const TEXT_FIELDS: { key: keyof Persona; label: string; textarea?: boolean }[] = [
  { key: 'name', label: '이름' },
  { key: 'tagline', label: '한줄소개' },
  { key: 'category', label: '카테고리 (선택)' },
  { key: 'personality', label: '성격', textarea: true },
  { key: 'speechStyle', label: '말투', textarea: true },
  { key: 'worldview', label: '세계관', textarea: true },
  { key: 'greeting', label: '첫 인사말', textarea: true },
];

/** #25 쉼표 구분 입력 문자열 → 태그 배열(트림·빈값 제거·중복 제거) */
function parseTags(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t !== ''),
    ),
  );
}

const fieldClass =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900';
const sectionTitle = 'text-sm font-semibold text-zinc-700 dark:text-zinc-300';
const btn = 'rounded-md px-3 py-1.5 text-sm font-medium';

export function CharacterForm({
  initial,
  submitLabel,
  onSubmit,
  onDelete,
}: {
  initial: Persona;
  submitLabel: string;
  onSubmit: (persona: Persona) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<Persona>(initial);
  const [tagsText, setTagsText] = useState<string>((initial.tags ?? []).join(', '));
  const [errors, setErrors] = useState<string[]>([]);

  const setText = (key: keyof Persona, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const updateTurn = (i: number, side: 'user' | 'model', value: string) =>
    setDraft((d) => ({
      ...d,
      exampleDialogue: d.exampleDialogue.map((t, idx) =>
        idx === i ? { ...t, [side]: value } : t,
      ),
    }));
  const addTurn = () =>
    setDraft((d) => ({ ...d, exampleDialogue: [...d.exampleDialogue, { user: '', model: '' }] }));
  const removeTurn = (i: number) =>
    setDraft((d) => ({ ...d, exampleDialogue: d.exampleDialogue.filter((_, idx) => idx !== i) }));

  const prohibitions = draft.prohibitions ?? [];
  const updateRule = (i: number, value: string) =>
    setDraft((d) => ({
      ...d,
      prohibitions: (d.prohibitions ?? []).map((r, idx) => (idx === i ? value : r)),
    }));
  const addRule = () =>
    setDraft((d) => ({ ...d, prohibitions: [...(d.prohibitions ?? []), ''] }));
  const removeRule = (i: number) =>
    setDraft((d) => ({ ...d, prohibitions: (d.prohibitions ?? []).filter((_, idx) => idx !== i) }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = sanitizeForSave({ ...draft, tags: parseTags(tagsText) });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    onSubmit(result.persona);
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-6">
      {TEXT_FIELDS.map(({ key, label, textarea }) => (
        <label key={key} className="flex flex-col gap-1">
          <span className={sectionTitle}>{label}</span>
          {textarea ? (
            <textarea
              className={`${fieldClass} min-h-20`}
              value={String(draft[key] ?? '')}
              onChange={(e) => setText(key, e.target.value)}
            />
          ) : (
            <input
              className={fieldClass}
              value={String(draft[key] ?? '')}
              onChange={(e) => setText(key, e.target.value)}
            />
          )}
        </label>
      ))}

      <label className="flex flex-col gap-1">
        <span className={sectionTitle}>태그 (선택, 쉼표로 구분)</span>
        <input
          className={fieldClass}
          placeholder="예: 판타지, 마법, 엘프"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.contentRating === 'adult'}
          onChange={(e) =>
            setDraft((d) => ({ ...d, contentRating: e.target.checked ? 'adult' : 'all' }))
          }
        />
        <span className={sectionTitle}>성인 콘텐츠 (공개 탐색에서 기본 숨김)</span>
      </label>

      <fieldset className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <legend className={sectionTitle}>예시 대화</legend>
          <button type="button" onClick={addTurn} className={`${btn} bg-zinc-100 dark:bg-zinc-800`}>
            + 대화 추가
          </button>
        </div>
        {draft.exampleDialogue.map((turn, i) => (
          <div key={i} className="flex flex-col gap-1 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <input
              className={fieldClass}
              placeholder="사용자 발화"
              aria-label={`예시 대화 ${i + 1} 사용자`}
              value={turn.user}
              onChange={(e) => updateTurn(i, 'user', e.target.value)}
            />
            <input
              className={fieldClass}
              placeholder="캐릭터 응답"
              aria-label={`예시 대화 ${i + 1} 캐릭터`}
              value={turn.model}
              onChange={(e) => updateTurn(i, 'model', e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeTurn(i)}
              className="self-end text-xs text-red-500 hover:underline"
            >
              이 대화 삭제
            </button>
          </div>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <legend className={sectionTitle}>금지사항 (선택)</legend>
          <button type="button" onClick={addRule} className={`${btn} bg-zinc-100 dark:bg-zinc-800`}>
            + 항목 추가
          </button>
        </div>
        {prohibitions.map((rule, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={fieldClass}
              aria-label={`금지사항 ${i + 1}`}
              value={rule}
              onChange={(e) => updateRule(i, e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeRule(i)}
              className="shrink-0 text-xs text-red-500 hover:underline"
            >
              삭제
            </button>
          </div>
        ))}
      </fieldset>

      {errors.length > 0 && (
        <ul className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/40">
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
