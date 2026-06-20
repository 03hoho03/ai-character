/**
 * #35 AuthForm 컴포넌트 테스트 — 로그인/회원가입 플로우를 사용자 관점에서 단언.
 * 세션 컨텍스트는 실제 SessionProvider를 쓰되 auth-api만 모킹해 경계를 좁힌다.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/auth-api', () => ({
  AuthError: class AuthError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
  fetchMe: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
}));

import * as authApi from '../../lib/auth-api';
import { SessionProvider } from '../../lib/session-context';
import { AuthForm } from './auth-form';

const mocked = vi.mocked(authApi);

function renderForm(onSuccess?: () => void) {
  return render(
    <SessionProvider>
      <AuthForm onSuccess={onSuccess} />
    </SessionProvider>,
  );
}

async function fillAndSubmit(email: string, password: string, buttonName: RegExp) {
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
}

describe('AuthForm (#35)', () => {
  beforeEach(() => {
    mocked.fetchMe.mockReset().mockResolvedValue(null); // 마운트 하이드레이트는 익명
    mocked.login.mockReset();
    mocked.signup.mockReset();
  });
  afterEach(cleanup);

  it('로그인 모드에서 이메일/비번 제출 시 login 액션을 호출하고 onSuccess한다', async () => {
    mocked.login.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    const onSuccess = vi.fn();
    renderForm(onSuccess);

    await fillAndSubmit('a@b.com', 'password123', /^로그인$/);

    await waitFor(() => expect(mocked.login).toHaveBeenCalledWith('a@b.com', 'password123'));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('토글로 회원가입 모드 전환 후 제출 시 signup 액션을 호출한다', async () => {
    mocked.signup.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: /회원가입/ }));
    await fillAndSubmit('a@b.com', 'password123', /^회원가입$/);

    await waitFor(() => expect(mocked.signup).toHaveBeenCalledWith('a@b.com', 'password123'));
  });

  it('로그인 실패(401)면 인라인 에러 메시지를 노출한다', async () => {
    mocked.login.mockRejectedValue(new authApi.AuthError(401, 'nope'));
    renderForm();

    await fillAndSubmit('a@b.com', 'wrongpass', /^로그인$/);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/일치하지 않습니다/);
  });

  it('회원가입 모드에서 비번 8자 미만이면 제출하지 않고 클라 가드 메시지를 보인다', async () => {
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: /회원가입/ }));
    await fillAndSubmit('a@b.com', 'short', /^회원가입$/);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(mocked.signup).not.toHaveBeenCalled();
  });
});
