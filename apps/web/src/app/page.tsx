import Link from 'next/link';
import { PERSONA_TEMPLATES } from '@ai-character/shared';

// #3: 채팅 진입용 임시 템플릿 링크 — #7 캐릭터 목록 홈으로 대체 예정
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 font-sans">
      <h1 className="text-3xl font-bold">AI 캐릭터 챗</h1>
      <ul className="flex flex-col gap-2">
        {PERSONA_TEMPLATES.map((persona) => (
          <li key={persona.id}>
            <Link
              href={`/chat/${persona.id}`}
              className="block rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {persona.name}와 대화하기 →
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
