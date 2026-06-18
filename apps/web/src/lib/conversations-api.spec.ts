/**
 * #14 2/2 conversations API 클라이언트 테스트 — fetch 모킹.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConversationWithMessages } from '@ai-character/shared';
import {
  appendMessage,
  ensureConversation,
  fetchConversation,
  replaceMessages,
  summarizeConversation,
} from './conversations-api';

const BASE = 'http://localhost:4000';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('conversations-api (#14)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('fetchConversation', () => {
    it('GET 쿼리로 호출하고 200이면 파싱해 반환한다', async () => {
      const conv: ConversationWithMessages = {
        id: 'c1',
        browserId: 'b1',
        personaId: 'tpl-x',
        createdAt: '2026-06-13T00:00:00.000Z',
        updatedAt: '2026-06-13T00:00:01.000Z',
        messages: [{ id: 'm1', role: 'user', content: '안녕', createdAt: '2026-06-13T00:00:00.500Z' }],
      };
      fetchMock.mockResolvedValueOnce(jsonResponse(conv));

      const result = await fetchConversation('b1', 'tpl-x');

      expect(result).toEqual(conv);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/conversations?browserId=b1&personaId=tpl-x`);
      expect((init as RequestInit | undefined)?.method ?? 'GET').toBe('GET');
    });

    it('404면 null을 반환한다 (이력 없음)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'not found' }, 404));
      expect(await fetchConversation('b1', 'none')).toBeNull();
    });

    it('네트워크 에러면 null을 반환한다 (best-effort 복원)', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network'));
      expect(await fetchConversation('b1', 'x')).toBeNull();
    });

    it('쿼리 값을 인코딩해 파라미터 주입을 막는다', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'nf' }, 404));
      await fetchConversation('b1', 'usr-a&injected=1');
      const url = new URL(String(fetchMock.mock.calls[0][0]));
      // & 가 인코딩돼 값으로 round-trip 되고, 새 쿼리 파라미터로 새지 않는다
      expect(url.searchParams.get('personaId')).toBe('usr-a&injected=1');
      expect(url.searchParams.get('injected')).toBeNull();
    });
  });

  describe('ensureConversation', () => {
    it('POST /conversations에 browserId/personaId를 보내고 결과를 반환한다', async () => {
      const conv = { id: 'c1', browserId: 'b1', personaId: 'tpl-x' };
      fetchMock.mockResolvedValueOnce(jsonResponse(conv));

      const result = await ensureConversation('b1', 'tpl-x');

      expect(result).toEqual(conv);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/conversations`);
      expect((init as RequestInit).method).toBe('POST');
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({
        browserId: 'b1',
        personaId: 'tpl-x',
      });
    });
  });

  describe('appendMessage', () => {
    it('POST /conversations/:id/messages에 browserId/role/content를 보낸다', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ id: 'm1', role: 'user', content: '안녕', createdAt: 'x' }),
      );

      await appendMessage('c1', 'b1', 'user', '안녕');

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/conversations/c1/messages`);
      expect((init as RequestInit).method).toBe('POST');
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({
        browserId: 'b1',
        role: 'user',
        content: '안녕',
      });
    });
  });

  describe('replaceMessages (#18)', () => {
    it('PUT /conversations/:id/messages 에 browserId/messages 를 보낸다', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'c1', messages: [] }));
      const messages = [
        { role: 'user' as const, content: '편집' },
        { role: 'model' as const, content: '새 답변' },
      ];

      await replaceMessages('c1', 'b1', messages);

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/conversations/c1/messages`);
      expect((init as RequestInit).method).toBe('PUT');
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({ browserId: 'b1', messages });
    });
  });

  describe('summarizeConversation (#15)', () => {
    it('POST /conversations/:id/summarize 에 browserId를 보내고 SummaryResult를 반환한다', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ summary: '요약본', summarizedCount: 8 }));

      const result = await summarizeConversation('c1', 'b1');

      expect(result).toEqual({ summary: '요약본', summarizedCount: 8 });
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/conversations/c1/summarize`);
      expect((init as RequestInit).method).toBe('POST');
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({ browserId: 'b1' });
    });

    it('실패 시 null 요약 결과를 반환한다 (best-effort)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'err' }, 500));
      expect(await summarizeConversation('c1', 'b1')).toEqual({ summary: null, summarizedCount: 0 });
    });
  });
});
