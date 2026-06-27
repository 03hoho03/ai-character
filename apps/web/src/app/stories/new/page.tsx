'use client';

/**
 * #47 스토리 제작 — 4탭 폼 → 저장(POST /stories) → 제작한 스토리 편집 화면으로 이동.
 */
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StoryForm } from '../story-form';
import { createStory } from '../../../lib/stories-api';
import { getBrowserId } from '../../../lib/browser-id';

export default function NewStoryPage() {
  const router = useRouter();

  return (
    <main className="font-sans">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 pt-6">
        <h1 className="text-2xl font-bold">스토리 만들기</h1>
        <Link href="/" className="text-sm underline hover:text-zinc-600">
          ← 홈
        </Link>
      </div>
      <StoryForm
        submitLabel="스토리 저장"
        onSubmit={async (request) => {
          const saved = await createStory(request, getBrowserId());
          router.push(`/stories/${saved.id}/edit`);
        }}
      />
    </main>
  );
}
