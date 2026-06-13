'use client';

/**
 * #6 홈의 사용자 캐릭터 섹션 — localStorage에서 로드, 각 카드에 채팅/편집/삭제 진입점.
 * 템플릿 카드(서버 렌더)와 분리해 기존 #7 홈 테스트를 깨지 않는다.
 */
import Link from 'next/link';
import { removeUserCharacter } from '../lib/character-store';
import { useUserCharacters } from '../lib/use-characters';

export function UserCharacterList() {
  const characters = useUserCharacters();

  if (characters.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xl font-semibold">내 캐릭터</h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {characters.map((persona) => (
          <li
            key={persona.id}
            className="flex h-full flex-col gap-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
          >
            <Link href={`/chat/${persona.id}`} className="flex flex-col gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold dark:bg-zinc-700">
                {persona.name.charAt(0)}
              </span>
              <span className="text-base font-semibold">{persona.name}</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">{persona.tagline}</span>
            </Link>
            <div className="mt-auto flex gap-3 text-sm">
              <Link href={`/characters/${persona.id}/edit`} className="underline hover:text-zinc-600">
                편집
              </Link>
              <button
                type="button"
                onClick={() => removeUserCharacter(persona.id)}
                className="text-red-500 hover:underline"
              >
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
