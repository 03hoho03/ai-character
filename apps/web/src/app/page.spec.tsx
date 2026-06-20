/**
 * #7 캐릭터 목록 홈 테스트 — prd.md 성공 기준에 매핑.
 * Home은 동기 서버 컴포넌트라 jsdom에서 직접 렌더 가능하다.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PERSONA_TEMPLATES } from '@ai-character/shared';
import { SessionProvider } from '../lib/session-context';
import Home from './page';

// #35 Home 헤더가 SessionStatus(useSession)를 포함 — 세션 마운트는 익명 폴백으로 모킹
vi.mock('../lib/auth-api', () => ({
  AuthError: class extends Error {},
  fetchMe: vi.fn().mockResolvedValue(null),
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
}));

const renderHome = () => render(<Home />, { wrapper: SessionProvider });

describe('Home (#7)', () => {
  afterEach(cleanup);

  it('템플릿 5종 카드에 이름·tagline을 표시하고 /chat/<id>로 링크한다', () => {
    renderHome();

    for (const persona of PERSONA_TEMPLATES) {
      const link = screen.getByRole('link', { name: new RegExp(persona.name) });
      expect(link.getAttribute('href'), persona.id).toBe(`/chat/${persona.id}`);
      expect(screen.getByText(persona.tagline), persona.id).toBeTruthy();
    }
  });

  it("'새 캐릭터 만들기' 카드가 /characters/new로 링크한다", () => {
    renderHome();

    const link = screen.getByRole('link', { name: /새 캐릭터 만들기/ });
    expect(link.getAttribute('href')).toBe('/characters/new');
  });
});
