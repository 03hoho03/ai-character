'use client';

/**
 * #35 로그인/회원가입 페이지. 인증 성공 시 홈으로 복귀.
 * 이미 로그인 상태면 머무를 이유가 없어 홈으로 리다이렉트한다.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '../../lib/session-context';
import { AuthForm } from './auth-form';

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status, router]);

  return (
    <main className="mx-auto flex max-w-sm flex-col px-4 py-16 font-sans">
      <AuthForm onSuccess={() => router.replace('/')} />
    </main>
  );
}
