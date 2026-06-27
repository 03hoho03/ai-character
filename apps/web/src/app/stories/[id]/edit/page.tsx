'use client';

/**
 * #47 스토리 편집/삭제 — 서버에서 로드 → draft 역직렬화 → 폼 편집 → PATCH(부분 갱신) 또는 DELETE.
 * contentRating은 불변이라 UpdateStoryRequest에서 제외(서버 DTO도 strip).
 */
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Story, UpdateStoryRequest } from '@ai-character/shared';
import { StoryForm } from '../../story-form';
import { storyToDraft } from '../../story-form-model';
import { deleteStory, fetchStory, updateStory } from '../../../../lib/stories-api';
import { getBrowserId } from '../../../../lib/browser-id';

export default function EditStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [story, setStory] = useState<Story | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const result = await fetchStory(id, getBrowserId());
      if (!alive) return;
      setStory(result);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (!loaded) {
    return <main className="p-6 font-sans text-sm text-zinc-500">불러오는 중…</main>;
  }

  if (!story) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 p-6 font-sans">
        <p className="text-sm text-zinc-500">스토리를 찾을 수 없어요. 이미 삭제됐을 수 있어요.</p>
        <Link href="/" className="text-sm underline hover:text-zinc-600">
          ← 홈으로
        </Link>
      </main>
    );
  }

  return (
    <main className="font-sans">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 pt-6">
        <h1 className="text-2xl font-bold">스토리 편집</h1>
        <Link href="/" className="text-sm underline hover:text-zinc-600">
          ← 홈
        </Link>
      </div>
      <StoryForm
        initial={storyToDraft(story)}
        submitLabel="변경 저장"
        onSubmit={async (request) => {
          // contentRating은 불변 — UpdateStoryRequest에서 제외(서버 DTO도 strip)
          const patch: UpdateStoryRequest = {
            profileImage: request.profileImage,
            name: request.name,
            tagline: request.tagline,
            promptTemplateId: request.promptTemplateId,
            storyInfo: request.storyInfo,
            developmentExamples: request.developmentExamples,
            shortcuts: request.shortcuts,
            visibility: request.visibility,
            commentsClosed: request.commentsClosed,
            startSettings: request.startSettings,
          };
          await updateStory(story.id, patch, getBrowserId());
          router.push('/');
        }}
        onDelete={async () => {
          await deleteStory(story.id, getBrowserId());
          router.push('/');
        }}
      />
    </main>
  );
}
