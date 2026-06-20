'use client';

/**
 * #35 헤더 세션 표시 — 로그인 시 이메일 + 로그아웃, 비로그인 시 로그인 링크.
 * status==='loading'(최초 me 조회 중)에는 깜빡임 방지로 아무것도 렌더하지 않는다.
 */
import Link from 'next/link';
import { useSession } from '../lib/session-context';

export function SessionStatus() {
  const { status, user, logout } = useSession();

  if (status === 'loading') return null;

  if (status === 'authenticated' && user) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">{user.email}</span>
        <button
          type="button"
          onClick={() => void logout()}
          className="font-medium underline hover:text-zinc-600"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <Link href="/login" className="text-sm font-medium underline hover:text-zinc-600">
      로그인
    </Link>
  );
}
