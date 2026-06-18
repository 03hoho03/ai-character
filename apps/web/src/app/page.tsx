import Link from 'next/link';
import { PERSONA_TEMPLATES } from '@ai-character/shared';
import { UserCharacterList } from './user-character-list';

// #7 캐릭터 목록 홈 — 카드 그리드 + 새 캐릭터 진입점(#6)
export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 font-sans">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">AI 캐릭터 챗</h1>
        <Link href="/discover" className="text-sm font-medium underline hover:text-zinc-600">
          캐릭터 탐색
        </Link>
      </div>
      <UserCharacterList />
      <h2 className="mb-4 mt-10 text-xl font-semibold">템플릿에서 시작하기</h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PERSONA_TEMPLATES.map((persona) => (
          <li key={persona.id}>
            <Link
              href={`/chat/${persona.id}`}
              className="flex h-full flex-col gap-3 rounded-xl border border-zinc-200 p-5 transition hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:hover:border-zinc-600"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold dark:bg-zinc-700">
                {persona.name.charAt(0)}
              </span>
              <span className="text-base font-semibold">{persona.name}</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">{persona.tagline}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/characters/new"
            className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 p-5 text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
          >
            <span className="text-2xl">＋</span>
            <span className="text-sm font-medium">새 캐릭터 만들기</span>
          </Link>
        </li>
      </ul>
    </main>
  );
}
