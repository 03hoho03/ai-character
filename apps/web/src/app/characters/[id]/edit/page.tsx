'use client';

/**
 * #6 사용자 캐릭터 편집/삭제 — localStorage에서 로드 → 폼 편집 → 저장(같은 id 갱신) 또는 삭제.
 */
import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CharacterForm } from '../../character-form';
import { removeUserCharacter, saveUserCharacter } from '../../../../lib/character-store';
import { useHydrated, useUserCharacter } from '../../../../lib/use-characters';

export default function EditCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const hydrated = useHydrated();
  const persona = useUserCharacter(id);

  if (!hydrated) {
    return <main className="p-6 font-sans text-sm text-zinc-500">불러오는 중…</main>;
  }

  if (!persona) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 p-6 font-sans">
        <p className="text-sm text-zinc-500">캐릭터를 찾을 수 없어요. 이미 삭제됐을 수 있어요.</p>
        <Link href="/" className="text-sm underline hover:text-zinc-600">
          ← 홈으로
        </Link>
      </main>
    );
  }

  return (
    <main className="font-sans">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 pt-6">
        <h1 className="text-2xl font-bold">캐릭터 편집</h1>
        <Link href="/" className="text-sm underline hover:text-zinc-600">
          ← 홈
        </Link>
      </div>
      <CharacterForm
        initial={persona}
        submitLabel="저장하고 채팅 시작"
        onSubmit={(updated) => {
          saveUserCharacter(updated);
          router.push(`/chat/${updated.id}`);
        }}
        onDelete={() => {
          removeUserCharacter(persona.id);
          router.push('/');
        }}
      />
    </main>
  );
}
