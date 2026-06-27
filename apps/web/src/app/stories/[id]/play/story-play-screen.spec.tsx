/**
 * #48 StoryPlayScreen 테스트 — non-streaming turn API(#50/#51) 소비.
 * fetch를 url/method로 라우팅(세션 생성 + turn)해 프롤로그 첫 메시지·스탯 HUD·추천답변 칩·엔딩 화면을 검증.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Story, StoryTurnResult } from '@ai-character/shared';
import { StoryPlayScreen } from './story-play-screen';

const story = (over: Partial<Story> = {}): Story => ({
  id: 'st-1',
  name: '비밀의 정원',
  tagline: '한줄',
  storyInfo: '설정',
  developmentExamples: [],
  shortcuts: [],
  startSettings: [
    {
      id: 'set-1',
      name: '봄의 시작',
      prologue: '정원에 봄이 왔다.',
      startSituation: '당신은 문 앞에 섰다.',
      suggestedReplies: ['문을 연다', '주변을 살핀다'],
      stats: [{ id: 'stat-1', name: '호감도', initialValue: 10, minValue: 0, maxValue: 100 }],
      endings: [],
    },
  ],
  ...over,
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const turnResult = (over: Partial<StoryTurnResult> = {}): StoryTurnResult => ({
  reply: '문이 열렸다.',
  statValues: { 호감도: 15 },
  rejectedKeys: [],
  ended: false,
  ending: null,
  ...over,
});

describe('StoryPlayScreen (#48)', () => {
  const fetchMock = vi.fn();
  const calls: { url: string; method: string; body?: unknown }[] = [];
  let turnQueue: StoryTurnResult[];

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.clear();
    localStorage.setItem('ai-character:browser-id', 'b1');
    calls.length = 0;
    turnQueue = [];
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ url, method, body });
      if (url.includes('/turn')) return jsonResponse(turnQueue.shift() ?? turnResult());
      if (url.endsWith('/story-sessions') && method === 'POST') {
        return jsonResponse({
          id: 'ss-1',
          storyId: 'st-1',
          startSettingId: 'set-1',
          statValues: { 호감도: 10 },
          endedWith: null,
        });
      }
      return jsonResponse({ ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it('진입 시 세션을 생성하고 프롤로그를 첫 메시지로, 스탯 HUD(값/최대)를 노출한다', async () => {
    render(<StoryPlayScreen story={story()} startSettingId="set-1" />);

    await waitFor(() =>
      expect(calls.some((c) => c.url.endsWith('/story-sessions') && c.method === 'POST')).toBe(true),
    );
    // 세션 생성 본문에 storyId/startSettingId/browserId
    const create = calls.find((c) => c.url.endsWith('/story-sessions'));
    expect(create?.body).toEqual({ storyId: 'st-1', startSettingId: 'set-1', browserId: 'b1' });

    // 프롤로그 첫 메시지
    await waitFor(() => expect(screen.getByText(/정원에 봄이 왔다/)).toBeTruthy());
    // 스탯 HUD: 값/최대
    const hud = screen.getByLabelText('스탯');
    expect(hud.textContent).toContain('호감도');
    expect(hud.textContent).toContain('10/100');
  });

  it('추천 첫 답변 칩 클릭 시 입력창을 채운다(전송 아님)', async () => {
    render(<StoryPlayScreen story={story()} startSettingId="set-1" />);
    await waitFor(() => expect(screen.getByText(/정원에 봄이 왔다/)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: '문을 연다' }));

    const input = screen.getByLabelText('메시지 입력') as HTMLInputElement;
    expect(input.value).toBe('문을 연다');
    // 칩 클릭만으로는 turn 호출이 일어나지 않는다
    expect(calls.some((c) => c.url.includes('/turn'))).toBe(false);
  });

  it('전송 시 turn API를 호출하고 reply 메시지 추가 + 스탯 HUD를 갱신한다', async () => {
    turnQueue.push(turnResult({ reply: '문이 열렸다.', statValues: { 호감도: 15 } }));
    render(<StoryPlayScreen story={story()} startSettingId="set-1" />);
    await waitFor(() => expect(screen.getByText(/정원에 봄이 왔다/)).toBeTruthy());

    fireEvent.change(screen.getByLabelText('메시지 입력'), { target: { value: '문을 연다' } });
    fireEvent.click(screen.getByRole('button', { name: '전송' }));

    await waitFor(() => expect(screen.getByText('문이 열렸다.')).toBeTruthy());
    // turn 본문 검증
    const turn = calls.find((c) => c.url.includes('/turn'));
    expect(turn?.url).toContain('/story-sessions/ss-1/turn');
    expect(turn?.body).toEqual({ message: '문을 연다', browserId: 'b1' });
    // HUD 갱신
    expect(screen.getByLabelText('스탯').textContent).toContain('15/100');
  });

  it('ended=true면 엔딩 화면(resultText)을 노출하고 입력창을 숨긴다', async () => {
    turnQueue.push(
      turnResult({
        ended: true,
        ending: { id: 'end-1', name: '해피엔딩', resultText: '둘은 행복하게 살았다.' },
      }),
    );
    render(<StoryPlayScreen story={story()} startSettingId="set-1" />);
    await waitFor(() => expect(screen.getByText(/정원에 봄이 왔다/)).toBeTruthy());

    fireEvent.change(screen.getByLabelText('메시지 입력'), { target: { value: '고백한다' } });
    fireEvent.click(screen.getByRole('button', { name: '전송' }));

    await waitFor(() => expect(screen.getByLabelText('엔딩')).toBeTruthy());
    expect(screen.getByText('해피엔딩')).toBeTruthy();
    expect(screen.getByText('둘은 행복하게 살았다.')).toBeTruthy();
    // 입력창 사라짐
    expect(screen.queryByLabelText('메시지 입력')).toBeNull();
  });
});
