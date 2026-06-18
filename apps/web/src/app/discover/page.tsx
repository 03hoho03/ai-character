'use client';

/**
 * #24/#25 캐릭터 탐색 — 공개 캐릭터 목록 + 키워드 검색 + 태그/카테고리 필터.
 * 검색은 이름/한줄소개(서버 ?q=), #25 카테고리·태그 칩 클릭 시 해당 필터로 재조회(?category=/?tag=).
 * 셋은 함께 적용 가능(서버 AND). 활성 필터는 상단 바에서 개별 해제한다.
 */
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { CharacterRecord } from '@ai-character/shared';
import { fetchPublicCharacters } from '../../lib/characters-api';

export default function DiscoverPage() {
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [tag, setTag] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [filtered, setFiltered] = useState(false);

  const load = useCallback(
    async (q?: string, filters: { category?: string; tag?: string } = {}) => {
      const list = await fetchPublicCharacters(q, filters);
      setCharacters(list);
      setFiltered(Boolean(q?.trim() || filters.category || filters.tag));
      setLoaded(true);
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void load(query, { category, tag });
  };

  const filterByCategory = (c: string) => {
    setCategory(c);
    void load(query, { category: c, tag });
  };
  const filterByTag = (t: string) => {
    setTag(t);
    void load(query, { category, tag: t });
  };
  const clearCategory = () => {
    setCategory(undefined);
    void load(query, { category: undefined, tag });
  };
  const clearTag = () => {
    setTag(undefined);
    void load(query, { category, tag: undefined });
  };

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">캐릭터 탐색</h1>
        <Link href="/" className="text-sm underline hover:text-zinc-600">
          홈
        </Link>
      </div>

      <form role="search" onSubmit={onSubmit} className="mb-4 flex gap-2">
        <input
          type="search"
          placeholder="캐릭터 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-5 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          검색
        </button>
      </form>

      {(category || tag) && (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">필터:</span>
          {category && (
            <button
              type="button"
              onClick={clearCategory}
              className="rounded-full bg-zinc-200 px-3 py-1 dark:bg-zinc-700"
            >
              카테고리: {category} ✕
            </button>
          )}
          {tag && (
            <button
              type="button"
              onClick={clearTag}
              className="rounded-full bg-zinc-200 px-3 py-1 dark:bg-zinc-700"
            >
              #{tag} ✕
            </button>
          )}
        </div>
      )}

      {loaded && characters.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">
          {filtered ? '검색 결과가 없습니다.' : '공개 캐릭터가 없습니다.'}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((c) => (
            <li
              key={c.id}
              className="flex h-full flex-col gap-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
            >
              <Link href={`/chat/${c.id}`} className="flex flex-col gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold dark:bg-zinc-700">
                  {c.name.charAt(0)}
                </span>
                <span className="text-base font-semibold">{c.name}</span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{c.tagline}</span>
              </Link>
              {(c.category || (c.tags && c.tags.length > 0)) && (
                <div className="flex flex-wrap gap-1.5">
                  {c.category && (
                    <button
                      type="button"
                      onClick={() => filterByCategory(c.category!)}
                      className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs text-white hover:opacity-80 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      {c.category}
                    </button>
                  )}
                  {(c.tags ?? []).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => filterByTag(t)}
                      className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
