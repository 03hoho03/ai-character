'use client';

/**
 * #6 채팅 진입 resolve — 템플릿(동기) + 사용자 캐릭터(서버 로드) 양쪽에서 persona를 찾는다.
 * #21: 사용자 캐릭터는 서버 fetch라 로드 완료 전엔 usr- 캐릭터의 not-found를 판정하지 않는다.
 */
import Link from 'next/link';
import { useCharactersLoaded, useResolvedPersona } from '@/lib/use-characters';
import { ChatScreen } from './chat-screen';

export function ChatResolver({ personaId }: { personaId: string }) {
  const loaded = useCharactersLoaded();
  const persona = useResolvedPersona(personaId);

  // 템플릿 id는 동기 resolve되므로 로드 완료를 기다리지 않고 바로 렌더
  if (persona) {
    return <ChatScreen persona={persona} />;
  }

  // 사용자 캐릭터 서버 로드 전엔 not-found 판정 보류(깜빡임 방지)
  if (!loaded) {
    return <main className="p-6 font-sans text-sm text-zinc-500">불러오는 중…</main>;
  }

  // 로드 완료 후에도 못 찾으면 not-found
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 p-6 font-sans">
      <p className="text-sm text-zinc-500">이 캐릭터를 찾을 수 없어요.</p>
      <Link href="/" className="text-sm underline hover:text-zinc-600">
        ← 홈으로
      </Link>
    </main>
  );
}
