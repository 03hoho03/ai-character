'use client';

/**
 * #24 캐릭터 탐색 — 공개 캐릭터 목록 + 키워드 검색.
 * 검색은 이름/한줄소개 대상(서버 ?q=). 제출 시 재조회. (#17 1/3 — 태그 필터는 17b)
 */
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { CharacterRecord } from '@ai-character/shared';
import { fetchPublicCharacters } from '../../lib/characters-api';

export default function DiscoverPage() {
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [searched, setSearched] = useState(false);

  const load = useCallback(async (q?: string) => {
    const list = await fetchPublicCharacters(q);
    setCharacters(list);
    setSearched(Boolean(q?.trim()));
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void load(query);
  };

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">캐릭터 탐색</h1>
        <Link href="/" className="text-sm underline hover:text-zinc-600">
          홈
        </Link>
      </div>

      <form role="search" onSubmit={onSubmit} className="mb-8 flex gap-2">
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

      {loaded && characters.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">
          {searched ? '검색 결과가 없습니다.' : '공개 캐릭터가 없습니다.'}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((c) => (
            <li
              key={c.id}
              className="flex h-full flex-col rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
            >
              <Link href={`/chat/${c.id}`} className="flex flex-col gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold dark:bg-zinc-700">
                  {c.name.charAt(0)}
                </span>
                <span className="text-base font-semibold">{c.name}</span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{c.tagline}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
