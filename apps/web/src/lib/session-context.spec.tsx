/**
 * #35 세션 컨텍스트 테스트 — auth-api를 모킹하고 하이드레이트/로그인/로그아웃 상태 전이를 단언.
 * 성공 기준의 "세션 상태 노출"을 useSession 훅 관점에서 검증한다.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('./auth-api', () => ({
  AuthError: class AuthError extends Error {},
  fetchMe: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
}));

import * as authApi from './auth-api';
import { SessionProvider, useSession } from './session-context';

const mocked = vi.mocked(authApi);
const wrapper = ({ children }: { children: ReactNode }) => (
  <SessionProvider>{children}</SessionProvider>
);

describe('SessionProvider / useSession (#35)', () => {
  beforeEach(() => {
    mocked.fetchMe.mockReset();
    mocked.login.mockReset();
    mocked.signup.mockReset();
    mocked.logout.mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('me가 사용자면 authenticated로 하이드레이트하고 user를 노출한다', async () => {
    mocked.fetchMe.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('me가 null이면 anonymous 폴백(비로그인 정상 상태)', async () => {
    mocked.fetchMe.mockResolvedValue(null);

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(result.current.user).toBeNull();
  });

  it('login 성공 시 user 설정 + authenticated 전이', async () => {
    mocked.fetchMe.mockResolvedValue(null);
    mocked.login.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    await act(async () => {
      await result.current.login('a@b.com', 'password123');
    });

    expect(mocked.login).toHaveBeenCalledWith('a@b.com', 'password123');
    expect(result.current.status).toBe('authenticated');
    expect(result.current.user).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('logout 시 user 제거 + anonymous 전이', async () => {
    mocked.fetchMe.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    mocked.logout.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.user).toBeNull();
  });

  it('Provider 밖에서 useSession 호출 시 throw', () => {
    expect(() => renderHook(() => useSession())).toThrow(/SessionProvider/);
  });
});
