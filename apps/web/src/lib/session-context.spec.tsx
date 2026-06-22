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
  claimAnonymousData: vi.fn(),
}));
vi.mock('./character-store', () => ({ reloadUserCharacters: vi.fn() }));
vi.mock('./browser-id', () => ({ getBrowserId: vi.fn(() => 'b1') }));

import * as authApi from './auth-api';
import { reloadUserCharacters } from './character-store';
import { SessionProvider, useSession } from './session-context';

const mocked = vi.mocked(authApi);
const reloadMock = vi.mocked(reloadUserCharacters);
const claimMock = vi.mocked(authApi.claimAnonymousData);
const wrapper = ({ children }: { children: ReactNode }) => (
  <SessionProvider>{children}</SessionProvider>
);

describe('SessionProvider / useSession (#35)', () => {
  beforeEach(() => {
    mocked.fetchMe.mockReset();
    mocked.login.mockReset();
    mocked.signup.mockReset();
    mocked.logout.mockReset();
    reloadMock.mockReset();
    claimMock.mockReset();
    claimMock.mockResolvedValue({ characters: 0, conversations: 0 });
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
    expect(reloadMock).toHaveBeenCalled(); // #36 새 계정 자격으로 캐릭터 재로드
  });

  it('login 시 #33 클레임을 browserId로 호출하고, 클레임 완료 후에 캐릭터를 재로드한다(순서)', async () => {
    mocked.fetchMe.mockResolvedValue(null);
    mocked.login.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    await act(async () => {
      await result.current.login('a@b.com', 'password123');
    });

    expect(claimMock).toHaveBeenCalledWith('b1'); // 익명 소유물 재소유
    expect(reloadMock).toHaveBeenCalled();
    // 클레임이 reload보다 먼저 — userId 부여된 캐릭터가 재로드에 잡히도록
    expect(claimMock.mock.invocationCallOrder[0]).toBeLessThan(
      reloadMock.mock.invocationCallOrder[0],
    );
  });

  it('signup 시에도 클레임 후 재로드한다', async () => {
    mocked.fetchMe.mockResolvedValue(null);
    mocked.signup.mockResolvedValue({ id: 'u2', email: 'new@b.com' });

    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    await act(async () => {
      await result.current.signup('new@b.com', 'password123');
    });

    expect(claimMock).toHaveBeenCalledWith('b1');
    expect(reloadMock).toHaveBeenCalled();
  });

  it('클레임 실패(null)여도 로그인은 authenticated로 유지된다(best-effort)', async () => {
    mocked.fetchMe.mockResolvedValue(null);
    mocked.login.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    claimMock.mockResolvedValue(null);

    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    await act(async () => {
      await result.current.login('a@b.com', 'password123');
    });

    expect(result.current.status).toBe('authenticated');
    expect(reloadMock).toHaveBeenCalled();
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
    expect(reloadMock).toHaveBeenCalled(); // 익명 자격으로 되돌려 재로드
  });

  it('Provider 밖에서 useSession 호출 시 throw', () => {
    expect(() => renderHook(() => useSession())).toThrow(/SessionProvider/);
  });
});
