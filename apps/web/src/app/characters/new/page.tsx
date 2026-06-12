import Link from 'next/link';

// #7 진입점 placeholder — #6 캐릭터 생성/편집 폼이 이 페이지를 교체한다
export default function NewCharacterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 font-sans">
      <h1 className="text-2xl font-bold">캐릭터 만들기</h1>
      <p className="text-sm text-zinc-500">준비 중입니다 — 곧 템플릿에서 시작해 나만의 캐릭터를 만들 수 있어요.</p>
      <Link href="/" className="text-sm underline hover:text-zinc-600">
        ← 홈으로 돌아가기
      </Link>
    </main>
  );
}
