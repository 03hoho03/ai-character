/**
 * #35 auth API 클라이언트 테스트 — fetch 모킹. #28 /auth 엔드포인트에 매핑.
 * 핵심: 모든 호출이 credentials:'include'(쿠키 송수신)인지, me/logout이 실패를 삼키는지.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError, claimAnonymousData, fetchMe, login, logout, signup } from './auth-api';

const BASE = 'http://localhost:4000';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('auth-api (#35)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('signup', () => {
    it('POST /auth/signup 에 credentials:include + 이메일/비번을 보내고 AuthUser를 반환한다', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ id: 'u1', email: 'a@b.com', createdAt: '2026-06-20' }),
      );

      const user = await signup('a@b.com', 'password123');

      expect(user).toEqual({ id: 'u1', email: 'a@b.com' });
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/auth/signup`);
      expect((init as RequestInit).method).toBe('POST');
      expect((init as RequestInit).credentials).toBe('include');
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({
        email: 'a@b.com',
        password: 'password123',
      });
    });

    it('non-ok면 status를 담은 AuthError를 throw한다', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ message: '중복' }, 409));
      const err = await signup('a@b.com', 'password123').catch((e) => e);
      expect(err).toBeInstanceOf(AuthError);
      expect(err).toMatchObject({ status: 409 });
    });
  });

  describe('login', () => {
    it('POST /auth/login 에 credentials:include로 호출하고 AuthUser를 반환한다', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ id: 'u1', email: 'a@b.com', createdAt: '2026-06-20' }),
      );

      const user = await login('a@b.com', 'password123');

      expect(user).toEqual({ id: 'u1', email: 'a@b.com' });
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/auth/login`);
      expect((init as RequestInit).credentials).toBe('include');
    });

    it('자격 불일치(401)면 AuthError(status 401)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: '불일치' }, 401));
      await expect(login('a@b.com', 'nope')).rejects.toMatchObject({ status: 401 });
    });
  });

  describe('logout', () => {
    it('POST /auth/logout 을 credentials:include로 호출한다', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
      await logout();
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/auth/logout`);
      expect((init as RequestInit).credentials).toBe('include');
    });

    it('네트워크 에러여도 throw하지 않는다(익명 폴백)', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network'));
      await expect(logout()).resolves.toBeUndefined();
    });
  });

  describe('fetchMe', () => {
    it('GET /auth/me 를 credentials:include로 호출하고 {userId,email}을 AuthUser로 정규화한다', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ userId: 'u1', email: 'a@b.com' }));

      const user = await fetchMe();

      expect(user).toEqual({ id: 'u1', email: 'a@b.com' });
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/auth/me`);
      expect((init as RequestInit).credentials).toBe('include');
    });

    it('미인증(401)이면 null(익명 폴백 신호)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'unauth' }, 401));
      expect(await fetchMe()).toBeNull();
    });

    it('네트워크 에러면 null', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network'));
      expect(await fetchMe()).toBeNull();
    });
  });

  describe('claimAnonymousData (#33)', () => {
    it('POST /auth/claim 에 credentials:include + {browserId}를 보내고 건수를 반환한다', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ characters: 2, conversations: 1 }));

      const result = await claimAnonymousData('b1');

      expect(result).toEqual({ characters: 2, conversations: 1 });
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/auth/claim`);
      expect((init as RequestInit).method).toBe('POST');
      expect((init as RequestInit).credentials).toBe('include');
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({ browserId: 'b1' });
    });

    it('non-ok면 null(best-effort — 로그인 흐름을 막지 않는다)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'unauth' }, 401));
      expect(await claimAnonymousData('b1')).toBeNull();
    });

    it('네트워크 에러여도 throw하지 않고 null', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network'));
      await expect(claimAnonymousData('b1')).resolves.toBeNull();
    });
  });
});
