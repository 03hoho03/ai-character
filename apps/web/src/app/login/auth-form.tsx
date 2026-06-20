'use client';

/**
 * #35 로그인/회원가입 공용 폼 — 단일 화면에서 모드 토글.
 * 제출은 세션 컨텍스트(useSession) 액션에 위임하고, AuthError는 인라인 메시지로 노출한다.
 * 성공 시 onSuccess 콜백(라우팅은 호출부 책임).
 */
import { useState, type FormEvent } from 'react';
import { AuthError } from '../../lib/auth-api';
import { useSession } from '../../lib/session-context';

type Mode = 'login' | 'signup';

const fieldClass =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900';

/** 백엔드 정책(#28 SignupDto MinLength(8))과 일치 — 제출 전 클라 가드 */
const MIN_PASSWORD = 8;

function messageFor(mode: Mode, err: unknown): string {
  if (err instanceof AuthError) {
    if (mode === 'login' && err.status === 401) return '이메일 또는 비밀번호가 일치하지 않습니다.';
    if (mode === 'signup' && err.status === 409) return '이미 가입된 이메일입니다.';
  }
  return mode === 'login' ? '로그인에 실패했습니다.' : '회원가입에 실패했습니다.';
}

export function AuthForm({ onSuccess }: { onSuccess?: () => void }) {
  const { login, signup } = useSession();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'signup' && password.length < MIN_PASSWORD) {
      setError(`비밀번호는 최소 ${MIN_PASSWORD}자 이상이어야 합니다.`);
      return;
    }
    setSubmitting(true);
    try {
      await (mode === 'login' ? login(email, password) : signup(email, password));
      onSuccess?.();
    } catch (err) {
      setError(messageFor(mode, err));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
    setError(null);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="인증 폼">
      <h1 className="text-2xl font-bold">{mode === 'login' ? '로그인' : '회원가입'}</h1>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">이메일</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">비밀번호</span>
        <input
          type="password"
          required
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={fieldClass}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {submitting ? '처리 중…' : mode === 'login' ? '로그인' : '회원가입'}
      </button>

      <button
        type="button"
        onClick={toggleMode}
        className="text-sm text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
      </button>
    </form>
  );
}
