'use client';

/**
 * #35 세션 컨텍스트 — 인증 상태의 단일 진실원천. 마운트 시 /auth/me로 쿠키 세션을
 * 하이드레이트하고, login/signup/logout 액션이 상태를 갱신한다.
 * 비로그인(status==='anonymous')은 에러가 아니라 정상 폴백 — 기존 browserId 경로 유지(MVP-thin).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  type AuthUser,
  claimAnonymousData,
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  signup as apiSignup,
} from './auth-api';
import { getBrowserId } from './browser-id';
import { reloadUserCharacters } from './character-store';

/** loading: 최초 me 조회 중 / authenticated: 로그인 / anonymous: 비로그인(폴백) */
export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

export type SessionValue = {
  user: AuthUser | null;
  status: SessionStatus;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');

  // 최초 1회 쿠키 세션 하이드레이트. null이면 익명 폴백.
  useEffect(() => {
    let alive = true;
    void fetchMe().then((me) => {
      if (!alive) return;
      setUser(me);
      setStatus(me ? 'authenticated' : 'anonymous');
    });
    return () => {
      alive = false;
    };
  }, []);

  // #33 로그인/가입 직후 익명 소유물을 계정으로 재소유한 뒤 캐릭터를 재로드한다.
  // 클레임이 reload보다 먼저여야 userId가 부여된 캐릭터가 '내 캐릭터' 재로드에 잡힌다(순서 의존).
  // 클레임은 best-effort(throw 안 함) — 실패해도 로그인 상태는 유지.
  const claimThenReload = useCallback(async () => {
    await claimAnonymousData(getBrowserId());
    void reloadUserCharacters();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const me = await apiLogin(email, password);
      setUser(me);
      setStatus('authenticated');
      await claimThenReload();
    },
    [claimThenReload],
  );

  const signup = useCallback(
    async (email: string, password: string) => {
      const me = await apiSignup(email, password);
      setUser(me);
      setStatus('authenticated');
      await claimThenReload();
    },
    [claimThenReload],
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setStatus('anonymous');
    void reloadUserCharacters(); // 익명 browserId 자격으로 되돌려 재로드
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ user, status, login, signup, logout }),
    [user, status, login, signup, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession은 SessionProvider 내부에서만 사용할 수 있습니다');
  return ctx;
}
