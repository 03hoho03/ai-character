'use client';

/**
 * #6 채팅 진입 resolve — 템플릿 + 사용자 캐릭터(localStorage) 양쪽에서 persona를 찾는다.
 * localStorage는 클라이언트 전용이라 서버 컴포넌트 대신 마운트 후 resolve.
 */
import Link from 'next/link';
import { useHydrated, useResolvedPersona } from '@/lib/use-characters';
import { ChatScreen } from './chat-screen';

export function ChatResolver({ personaId }: { personaId: string }) {
  const hydrated = useHydrated();
  const persona = useResolvedPersona(personaId);

  // 하이드레이션 전엔 localStorage 미확인 — usr- 캐릭터의 not-found 깜빡임 방지
  if (!hydrated) {
    return <main className="p-6 font-sans text-sm text-zinc-500">불러오는 중…</main>;
  }

  if (!persona) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 p-6 font-sans">
        <p className="text-sm text-zinc-500">이 캐릭터를 찾을 수 없어요.</p>
        <Link href="/" className="text-sm underline hover:text-zinc-600">
          ← 홈으로
        </Link>
      </main>
    );
  }

  return <ChatScreen persona={persona} />;
}
