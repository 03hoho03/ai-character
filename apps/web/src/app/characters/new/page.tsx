'use client';

/**
 * #6 캐릭터 생성 — 템플릿 선택 → 폼 프리필 → 편집 → 저장 → 그 캐릭터로 바로 채팅.
 * (placeholder를 교체한다)
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERSONA_TEMPLATES, type Persona } from '@ai-character/shared';
import { CharacterForm } from '../character-form';
import { newDraftFromTemplate, saveUserCharacter } from '../../../lib/character-store';

export default function NewCharacterPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<Persona | null>(null);

  if (!draft) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6 font-sans">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">캐릭터 만들기</h1>
          <Link href="/" className="text-sm underline hover:text-zinc-600">
            ← 홈
          </Link>
        </div>
        <p className="text-sm text-zinc-500">시작할 템플릿을 골라보세요. 모든 내용은 다음 단계에서 수정할 수 있어요.</p>
        <ul className="flex flex-col gap-2">
          {PERSONA_TEMPLATES.map((tpl) => (
            <li key={tpl.id}>
              <button
                type="button"
                onClick={() => setDraft(newDraftFromTemplate(tpl))}
                className="flex w-full flex-col rounded-lg border border-zinc-200 p-4 text-left hover:border-zinc-400 dark:border-zinc-800"
              >
                <span className="text-base font-semibold">{tpl.name}</span>
                <span className="text-sm text-zinc-500">{tpl.tagline}</span>
              </button>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="font-sans">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 pt-6">
        <h1 className="text-2xl font-bold">캐릭터 편집</h1>
        <button type="button" onClick={() => setDraft(null)} className="text-sm underline hover:text-zinc-600">
          ← 템플릿 다시 고르기
        </button>
      </div>
      <CharacterForm
        initial={draft}
        submitLabel="저장하고 채팅 시작"
        onSubmit={async (persona) => {
          await saveUserCharacter(persona);
          router.push(`/chat/${persona.id}`);
        }}
      />
    </main>
  );
}
