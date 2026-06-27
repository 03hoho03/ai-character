'use client';

/**
 * #48 스토리 플레이 라우트(/stories/[id]/play?startSettingId=) — 서버에서 Story 로드 후
 * StoryPlayScreen에 위임. 목록/상세 페이지는 범위 밖(2A) — 진입점 링크는 후속.
 */
import { use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Story } from '@ai-character/shared';
import { fetchStory } from '@/lib/stories-api';
import { getBrowserId } from '@/lib/browser-id';
import { StoryPlayScreen } from './story-play-screen';

export default function PlayStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const startSettingId = searchParams.get('startSettingId') ?? undefined;

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

  return <StoryPlayScreen story={story} startSettingId={startSettingId} />;
}
