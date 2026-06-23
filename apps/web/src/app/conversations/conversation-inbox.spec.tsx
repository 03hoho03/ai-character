/**
 * #42 ConversationInbox 테스트 — 목록 렌더 + 삭제 플로우 + 세션 전환 재로드.
 * conversations-api·browser-id·auth-api(SessionProvider 의존)를 모킹. 세션 전환은 page-local
 * fetch가 useSession 식별자 변화에 재반응하는지로 검증(lesson l_2026_06_20 — stale 원천 차단).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('../../lib/conversations-api', () => ({
  fetchConversationList: vi.fn(),
  deleteConversation: vi.fn(),
}));
vi.mock('../../lib/browser-id', () => ({ getBrowserId: vi.fn(() => 'b1') }));
vi.mock('../../lib/auth-api', () => ({
  AuthError: class AuthError extends Error {},
  fetchMe: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  claimAnonymousData: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../lib/character-store', () => ({ reloadUserCharacters: vi.fn() }));

import * as convApi from '../../lib/conversations-api';
import * as authApi from '../../lib/auth-api';
import { SessionProvider, useSession } from '../../lib/session-context';
import { ConversationInbox } from './conversation-inbox';

const conv = vi.mocked(convApi);
const auth = vi.mocked(authApi);

const item = (over: Partial<import('@ai-character/shared').ConversationListItem> = {}) => ({
  id: 'c1',
  personaId: 'tpl-fantasy-elveria',
  characterName: '엘베리아',
  lastMessage: { role: 'user' as const, content: '안녕하세요', createdAt: '2026-06-24T00:00:00Z' },
  updatedAt: '2026-06-24T00:00:00Z',
  ...over,
});

const wrap = (node: ReactNode) => render(<SessionProvider>{node}</SessionProvider>);

describe('ConversationInbox (#42)', () => {
  beforeEach(() => {
    auth.fetchMe.mockReset().mockResolvedValue(null); // 익명 마운트
    conv.fetchConversationList.mockReset().mockResolvedValue([]);
    conv.deleteConversation.mockReset().mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it('마운트 시 목록을 불러와 캐릭터명·마지막 메시지·/chat 링크를 렌더한다', async () => {
    conv.fetchConversationList.mockResolvedValue([
      item(),
      item({ id: 'c2', personaId: 'usr-a', characterName: null, lastMessage: null }),
    ]);

    wrap(<ConversationInbox />);

    await waitFor(() => expect(screen.getByText('엘베리아')).toBeTruthy());
    expect(screen.getByText('안녕하세요')).toBeTruthy();
    // 캐릭터명 null/빈 메시지 폴백
    expect(screen.getByText(/삭제된 캐릭터/)).toBeTruthy();
    expect(screen.getByText(/아직 메시지 없음/)).toBeTruthy();
    // 클릭 시 /chat/<personaId> 진입
    const link = screen.getByRole('link', { name: /엘베리아/ });
    expect(link.getAttribute('href')).toBe('/chat/tpl-fantasy-elveria');
    expect(screen.getByRole('link', { name: /삭제된 캐릭터/ }).getAttribute('href')).toBe('/chat/usr-a');
  });

  it('삭제 버튼 클릭 시 deleteConversation 호출 + 항목이 목록에서 사라진다', async () => {
    conv.fetchConversationList.mockResolvedValue([
      item(),
      item({ id: 'c2', personaId: 'usr-b', characterName: '하루' }),
    ]);

    wrap(<ConversationInbox />);
    await waitFor(() => expect(screen.getByText('엘베리아')).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '엘베리아 대화 삭제' }));
    });

    expect(conv.deleteConversation).toHaveBeenCalledWith('c1', 'b1');
    await waitFor(() => expect(screen.queryByText('엘베리아')).toBeNull());
    expect(screen.getByText('하루')).toBeTruthy(); // 나머지는 유지
  });

  it('삭제 실패 시 항목을 유지하고 안내를 보인다(rejection 미전파)', async () => {
    conv.fetchConversationList.mockResolvedValue([item()]);
    conv.deleteConversation.mockRejectedValue(new Error('404'));

    wrap(<ConversationInbox />);
    await waitFor(() => expect(screen.getByText('엘베리아')).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '엘베리아 대화 삭제' }));
    });

    expect(screen.getByText('엘베리아')).toBeTruthy(); // 실패 시 잔존
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });

  it('빈 목록이어도 에러 없이 렌더한다', async () => {
    conv.fetchConversationList.mockResolvedValue([]);
    wrap(<ConversationInbox />);
    await waitFor(() => expect(conv.fetchConversationList).toHaveBeenCalled());
    expect(screen.queryByText('엘베리아')).toBeNull();
  });

  it('세션 전환(로그인) 시 목록을 재로드한다(소유자 변경 반영)', async () => {
    auth.login.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

    function Harness() {
      const { login } = useSession();
      return (
        <>
          <button onClick={() => void login('a@b.com', 'password123')}>do-login</button>
          <ConversationInbox />
        </>
      );
    }

    wrap(<Harness />);
    // 익명 마운트 후 1회 로드
    await waitFor(() => expect(conv.fetchConversationList).toHaveBeenCalledTimes(1));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'do-login' }));
    });

    // 세션 식별자 변화 → 재로드
    await waitFor(() => expect(conv.fetchConversationList.mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});
