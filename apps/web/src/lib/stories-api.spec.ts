/**
 * #47 stories API 클라이언트 테스트 — fetch 모킹. #44 백엔드 엔드포인트에 매핑.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateStoryRequest, Story } from '@ai-character/shared';
import {
  createStory,
  createStorySession,
  deleteStory,
  fetchOwnedStories,
  fetchStory,
  fetchStorySession,
  turnStorySession,
  updateStory,
} from './stories-api';

const BASE = 'http://localhost:4000';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const request = (over: Partial<CreateStoryRequest> = {}): CreateStoryRequest => ({
  name: '스토리',
  tagline: '한줄',
  storyInfo: '설정',
  developmentExamples: [],
  shortcuts: [],
  contentRating: 'all',
  visibility: 'private',
  commentsClosed: false,
  startSettings: [
    {
      name: '시작',
      prologue: '프롤로그',
      startSituation: '상황',
      suggestedReplies: [],
      stats: [],
      endings: [],
    },
  ],
  ...over,
});

const story = (over: Partial<Story> = {}): Story => ({
  id: 'st-1',
  name: '스토리',
  tagline: '한줄',
  storyInfo: '설정',
  developmentExamples: [],
  shortcuts: [],
  startSettings: [],
  ...over,
});

describe('stories-api (#47)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('fetchOwnedStories', () => {
    it('GET /stories?browserId= 로 호출하고 배열을 반환한다', async () => {
      const list = [story()];
      fetchMock.mockResolvedValueOnce(jsonResponse(list));

      const result = await fetchOwnedStories('b1');

      expect(result).toEqual(list);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/stories?browserId=b1`);
      expect((init as RequestInit | undefined)?.method ?? 'GET').toBe('GET');
      expect((init as RequestInit).credentials).toBe('include');
    });

    it('실패/네트워크 에러면 빈 배열(best-effort)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'err' }, 500));
      expect(await fetchOwnedStories('b1')).toEqual([]);
      fetchMock.mockRejectedValueOnce(new Error('network'));
      expect(await fetchOwnedStories('b1')).toEqual([]);
    });
  });

  describe('fetchStory', () => {
    it('GET /stories/:id?browserId= 로 호출한다', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(story()));
      const result = await fetchStory('st-1', 'b1');
      expect(result).toEqual(story());
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/stories/st-1?browserId=b1`);
      expect((init as RequestInit).credentials).toBe('include');
    });

    it('404/실패면 null', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'nf' }, 404));
      expect(await fetchStory('st-1', 'b1')).toBeNull();
    });
  });

  describe('createStory', () => {
    it('POST /stories 에 request + browserId 를 보낸다', async () => {
      const req = request();
      fetchMock.mockResolvedValueOnce(jsonResponse(story()));

      const result = await createStory(req, 'b1');

      expect(result).toEqual(story());
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/stories`);
      expect((init as RequestInit).method).toBe('POST');
      expect((init as RequestInit).credentials).toBe('include');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toMatchObject({ browserId: 'b1', name: '스토리' });
      // 중첩 startSettings가 그대로 직렬화된다
      expect(body.startSettings[0]).toMatchObject({ name: '시작', prologue: '프롤로그' });
    });

    it('non-ok면 throw (쓰기 실패 전파)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'nf' }, 404));
      await expect(createStory(request(), 'b1')).rejects.toThrow();
    });
  });

  describe('updateStory', () => {
    it('PATCH /stories/:id 에 patch + browserId 를 보낸다', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(story({ name: '수정' })));

      const result = await updateStory('st-1', { name: '수정' }, 'b1');

      expect(result.name).toBe('수정');
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/stories/st-1`);
      expect((init as RequestInit).method).toBe('PATCH');
      expect((init as RequestInit).credentials).toBe('include');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toEqual({ name: '수정', browserId: 'b1' });
    });

    it('non-ok면 throw', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'nf' }, 404));
      await expect(updateStory('st-1', { name: 'x' }, 'b1')).rejects.toThrow();
    });
  });

  describe('deleteStory', () => {
    it('DELETE /stories/:id?browserId= 로 호출한다', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
      await deleteStory('st-1', 'b1');
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/stories/st-1?browserId=b1`);
      expect((init as RequestInit).method).toBe('DELETE');
      expect((init as RequestInit).credentials).toBe('include');
    });

    it('non-ok면 throw', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'nf' }, 404));
      await expect(deleteStory('st-1', 'b1')).rejects.toThrow();
    });
  });

  describe('createStorySession (#48)', () => {
    it('POST /story-sessions 에 storyId/startSettingId/browserId 를 보낸다', async () => {
      const session = { id: 'ss-1', storyId: 'st-1', startSettingId: 'set-1', statValues: {} };
      fetchMock.mockResolvedValueOnce(jsonResponse(session));

      const result = await createStorySession('st-1', 'set-1', 'b1');

      expect(result).toEqual(session);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/story-sessions`);
      expect((init as RequestInit).method).toBe('POST');
      expect((init as RequestInit).credentials).toBe('include');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toEqual({ storyId: 'st-1', startSettingId: 'set-1', browserId: 'b1' });
    });

    it('non-ok면 throw (진입 불가 전파)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'nf' }, 404));
      await expect(createStorySession('st-1', 'set-1', 'b1')).rejects.toThrow();
    });
  });

  describe('fetchStorySession (#48)', () => {
    it('GET /story-sessions/:id?browserId= 로 호출한다', async () => {
      const session = { id: 'ss-1', storyId: 'st-1', startSettingId: 'set-1', statValues: {} };
      fetchMock.mockResolvedValueOnce(jsonResponse(session));

      const result = await fetchStorySession('ss-1', 'b1');

      expect(result).toEqual(session);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/story-sessions/ss-1?browserId=b1`);
      expect((init as RequestInit).credentials).toBe('include');
    });

    it('404/실패면 null (best-effort)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'nf' }, 404));
      expect(await fetchStorySession('ss-1', 'b1')).toBeNull();
      fetchMock.mockRejectedValueOnce(new Error('network'));
      expect(await fetchStorySession('ss-1', 'b1')).toBeNull();
    });
  });

  describe('turnStorySession (#48)', () => {
    it('POST /story-sessions/:id/turn 에 message/browserId 를 보내고 StoryTurnResult 를 반환한다', async () => {
      const turnResult = {
        reply: '답변',
        statValues: { 호감도: 5 },
        rejectedKeys: [],
        ended: false,
        ending: null,
      };
      fetchMock.mockResolvedValueOnce(jsonResponse(turnResult));

      const result = await turnStorySession('ss-1', '안녕', 'b1');

      expect(result).toEqual(turnResult);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/story-sessions/ss-1/turn`);
      expect((init as RequestInit).method).toBe('POST');
      expect((init as RequestInit).credentials).toBe('include');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toEqual({ message: '안녕', browserId: 'b1' });
    });

    it('non-ok면 throw', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'err' }, 500));
      await expect(turnStorySession('ss-1', '안녕', 'b1')).rejects.toThrow();
    });
  });
});
