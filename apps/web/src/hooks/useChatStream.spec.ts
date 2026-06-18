/**
 * #3 useChatStream 훅 테스트 — prd.md 성공 기준에 매핑.
 * mock fetch + 수동 제어 ReadableStream으로 SSE 수신 시나리오를 재현한다.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PERSONA_TEMPLATES,
  SUMMARY_RECENT_TURNS,
  SUMMARY_TURN_THRESHOLD,
  serializeChatStreamEvent,
  type ChatStreamEvent,
} from '@ai-character/shared';
import { useChatStream } from './useChatStream';

const persona = PERSONA_TEMPLATES[0];
const greeting = { role: 'model' as const, content: persona.greeting };

/** push/close를 외부에서 제어하는 SSE Response */
function sseResponse() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const encoder = new TextEncoder();
  return {
    response: new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }),
    push: (event: ChatStreamEvent) =>
      controller.enqueue(encoder.encode(serializeChatStreamEvent(event))),
    close: () => controller.close(),
  };
}

describe('useChatStream (#3)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('greeting을 첫 model 메시지로 노출한다', () => {
    const { result } = renderHook(() => useChatStream(persona));

    expect(result.current.messages).toEqual([greeting]);
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('delta를 streamingText로 누적하고 done 시 메시지로 확정한다', async () => {
    const sse = sseResponse();
    fetchMock.mockResolvedValueOnce(sse.response);
    const { result } = renderHook(() => useChatStream(persona));

    act(() => result.current.send('안녕'));
    await waitFor(() => expect(result.current.status).toBe('streaming'));

    act(() => sse.push({ type: 'delta', text: '반가' }));
    await waitFor(() => expect(result.current.streamingText).toBe('반가'));

    act(() => {
      sse.push({ type: 'delta', text: '워요' });
      sse.push({ type: 'done', message: { role: 'model', content: '반가워요' } });
      sse.close();
    });

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.streamingText).toBeNull();
    expect(result.current.messages).toEqual([
      greeting,
      { role: 'user', content: '안녕' },
      { role: 'model', content: '반가워요' },
    ]);
  });

  it('요청 body에 personaId/browserId + history를 담고 systemInstruction/fewShot은 보내지 않는다 (#23)', async () => {
    const sse = sseResponse();
    fetchMock.mockResolvedValueOnce(sse.response);
    const { result } = renderHook(() => useChatStream(persona));

    act(() => result.current.send('안녕'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://localhost:4000/chat/stream');
    const body = JSON.parse((init as RequestInit).body as string);
    // 서버가 신뢰 소스에서 재조립 — 클라는 식별자만 보낸다
    expect(body.personaId).toBe(persona.id);
    expect(typeof body.browserId).toBe('string');
    expect(body.browserId.length).toBeGreaterThan(0);
    expect(body.systemInstruction).toBeUndefined();
    // history만 전송(fewShot 미포함 — 서버가 prepend)
    expect(body.messages).toEqual([greeting, { role: 'user', content: '안녕' }]);
  });

  it('error 이벤트 시 partial을 메시지로 보존하고 error 상태를 노출한다', async () => {
    const sse = sseResponse();
    fetchMock.mockResolvedValueOnce(sse.response);
    const { result } = renderHook(() => useChatStream(persona));

    act(() => result.current.send('안녕'));
    await waitFor(() => expect(result.current.status).toBe('streaming'));

    act(() => {
      sse.push({ type: 'delta', text: '옷손을 따라오면' });
      sse.push({ type: 'error', code: 'timeout', message: '응답이 30초를 초과했습니다.' });
      sse.close();
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toEqual({
      code: 'timeout',
      message: '응답이 30초를 초과했습니다.',
    });
    expect(result.current.streamingText).toBeNull();
    // partial 보존 — 받은 만큼 model 메시지로 남는다
    expect(result.current.messages).toEqual([
      greeting,
      { role: 'user', content: '안녕' },
      { role: 'model', content: '옷손을 따라오면' },
    ]);
  });

  it('스트림이 done/error 없이 끊기면 upstream_error로 간주한다', async () => {
    const sse = sseResponse();
    fetchMock.mockResolvedValueOnce(sse.response);
    const { result } = renderHook(() => useChatStream(persona));

    act(() => result.current.send('안녕'));
    await waitFor(() => expect(result.current.status).toBe('streaming'));

    act(() => sse.close()); // 이벤트 없이 종료

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.code).toBe('upstream_error');
  });

  it('streaming 중 send()는 무시한다 (이중 전송 가드)', async () => {
    const sse = sseResponse();
    fetchMock.mockResolvedValueOnce(sse.response);
    const { result } = renderHook(() => useChatStream(persona));

    act(() => result.current.send('하나'));
    await waitFor(() => expect(result.current.status).toBe('streaming'));

    act(() => result.current.send('둘'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.messages).toEqual([greeting, { role: 'user', content: '하나' }]);
  });

  // ── #14 2/2 persistence 주입 ──────────────────────────────
  describe('persistence 연동 (#14)', () => {
    const makePersistence = (turns: { role: 'user' | 'model'; content: string }[] = []) => ({
      restore: vi.fn().mockResolvedValue(turns),
      onUserMessage: vi.fn(),
      onModelMessage: vi.fn(),
    });

    it('마운트 시 restore가 저장 turn을 greeting 뒤에 복원한다', async () => {
      const persistence = makePersistence([
        { role: 'user', content: '이전 질문' },
        { role: 'model', content: '이전 답변' },
      ]);
      const { result } = renderHook(() => useChatStream(persona, persistence));

      await waitFor(() =>
        expect(result.current.messages).toEqual([
          greeting,
          { role: 'user', content: '이전 질문' },
          { role: 'model', content: '이전 답변' },
        ]),
      );
      expect(persistence.restore).toHaveBeenCalledTimes(1);
    });

    it('restore가 빈 배열이면 greeting만 유지한다', async () => {
      const persistence = makePersistence([]);
      const { result } = renderHook(() => useChatStream(persona, persistence));
      await waitFor(() => expect(persistence.restore).toHaveBeenCalled());
      expect(result.current.messages).toEqual([greeting]);
    });

    it('user 전송 시 onUserMessage, 성공 done 시 onModelMessage를 호출한다', async () => {
      const persistence = makePersistence([]);
      const sse = sseResponse();
      fetchMock.mockResolvedValueOnce(sse.response);
      const { result } = renderHook(() => useChatStream(persona, persistence));
      await waitFor(() => expect(persistence.restore).toHaveBeenCalled());

      act(() => result.current.send('안녕'));
      await waitFor(() => expect(result.current.status).toBe('streaming'));
      expect(persistence.onUserMessage).toHaveBeenCalledWith('안녕');

      act(() => {
        sse.push({ type: 'done', message: { role: 'model', content: '반가워요' } });
        sse.close();
      });
      await waitFor(() => expect(result.current.status).toBe('idle'));
      expect(persistence.onModelMessage).toHaveBeenCalledWith('반가워요');
    });

    it('에러로 끝나면 onModelMessage를 호출하지 않는다 (성공 turn만 저장)', async () => {
      const persistence = makePersistence([]);
      const sse = sseResponse();
      fetchMock.mockResolvedValueOnce(sse.response);
      const { result } = renderHook(() => useChatStream(persona, persistence));
      await waitFor(() => expect(persistence.restore).toHaveBeenCalled());

      act(() => result.current.send('안녕'));
      await waitFor(() => expect(result.current.status).toBe('streaming'));
      act(() => {
        sse.push({ type: 'delta', text: '부분' });
        sse.push({ type: 'error', code: 'timeout', message: '시간초과' });
        sse.close();
      });
      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(persistence.onModelMessage).not.toHaveBeenCalled();
    });

    it('persistence가 실패해도(restore reject, onUserMessage throw) 스트리밍은 정상 진행한다', async () => {
      const persistence = {
        restore: vi.fn().mockRejectedValue(new Error('api down')),
        onUserMessage: vi.fn(() => {
          throw new Error('append failed');
        }),
        onModelMessage: vi.fn(),
      };
      const sse = sseResponse();
      fetchMock.mockResolvedValueOnce(sse.response);
      const { result } = renderHook(() => useChatStream(persona, persistence));

      act(() => result.current.send('안녕'));
      await waitFor(() => expect(result.current.status).toBe('streaming'));
      act(() => {
        sse.push({ type: 'done', message: { role: 'model', content: '괜찮아요' } });
        sse.close();
      });
      await waitFor(() => expect(result.current.status).toBe('idle'));
      expect(result.current.messages).toEqual([
        greeting,
        { role: 'user', content: '안녕' },
        { role: 'model', content: '괜찮아요' },
      ]);
    });
  });

  // ── #18 재생성 + 사용자 메시지 편집 ──────────────────────────
  describe('재생성/편집 (#18)', () => {
    const makePersistence = () => ({
      restore: vi.fn().mockResolvedValue([]),
      onUserMessage: vi.fn(),
      onModelMessage: vi.fn(),
      replace: vi.fn().mockResolvedValue(undefined),
    });

    /** send '안녕' → done '답변1' 까지 진행해 [greeting, user, model] 상태를 만든다 */
    async function primeOneTurn(
      result: { current: ReturnType<typeof useChatStream> },
      sse: ReturnType<typeof sseResponse>,
    ) {
      act(() => result.current.send('안녕'));
      await waitFor(() => expect(result.current.status).toBe('streaming'));
      act(() => {
        sse.push({ type: 'done', message: { role: 'model', content: '답변1' } });
        sse.close();
      });
      await waitFor(() => expect(result.current.status).toBe('idle'));
    }

    it('regenerate()는 마지막 user turn 기준으로 재실행하고 직전 답변을 대체한다', async () => {
      const persistence = makePersistence();
      const first = sseResponse();
      const second = sseResponse();
      fetchMock.mockResolvedValueOnce(first.response).mockResolvedValueOnce(second.response);
      const { result } = renderHook(() => useChatStream(persona, persistence));
      await waitFor(() => expect(persistence.restore).toHaveBeenCalled());

      await primeOneTurn(result, first);

      act(() => result.current.regenerate());
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

      // 영속: greeting 제외, 직전 user turn까지로 전체 교체(옛 답변 truncate)
      expect(persistence.replace).toHaveBeenCalledWith([{ role: 'user', content: '안녕' }]);
      // 재요청 히스토리는 마지막 user까지 (fewShot은 서버가 prepend)
      const body = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
      expect(body.personaId).toBe(persona.id);
      expect(body.messages).toEqual([greeting, { role: 'user', content: '안녕' }]);

      act(() => {
        second.push({ type: 'done', message: { role: 'model', content: '답변2' } });
        second.close();
      });
      await waitFor(() => expect(result.current.status).toBe('idle'));
      expect(result.current.messages).toEqual([
        greeting,
        { role: 'user', content: '안녕' },
        { role: 'model', content: '답변2' },
      ]);
    });

    it('user turn이 없으면 regenerate()는 no-op (greeting만 있을 때)', () => {
      const { result } = renderHook(() => useChatStream(persona));
      act(() => result.current.regenerate());
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('editUser()는 편집 index 이후를 truncate하고 편집된 메시지로 재실행한다', async () => {
      const persistence = makePersistence();
      const first = sseResponse();
      const second = sseResponse();
      fetchMock.mockResolvedValueOnce(first.response).mockResolvedValueOnce(second.response);
      const { result } = renderHook(() => useChatStream(persona, persistence));
      await waitFor(() => expect(persistence.restore).toHaveBeenCalled());

      await primeOneTurn(result, first); // [greeting, user '안녕'(1), model '답변1'(2)]

      act(() => result.current.editUser(1, '안녕 고침'));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

      // 영속: 편집된 user까지로 전체 교체(후속 model turn truncate)
      expect(persistence.replace).toHaveBeenCalledWith([{ role: 'user', content: '안녕 고침' }]);
      const body = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
      expect(body.messages).toEqual([greeting, { role: 'user', content: '안녕 고침' }]);

      act(() => {
        second.push({ type: 'done', message: { role: 'model', content: '고친 답변' } });
        second.close();
      });
      await waitFor(() => expect(result.current.status).toBe('idle'));
      expect(result.current.messages).toEqual([
        greeting,
        { role: 'user', content: '안녕 고침' },
        { role: 'model', content: '고친 답변' },
      ]);
    });

    it('빈 내용으로 editUser()는 no-op, 모델 메시지 index 편집도 무시', async () => {
      const persistence = makePersistence();
      const first = sseResponse();
      fetchMock.mockResolvedValueOnce(first.response);
      const { result } = renderHook(() => useChatStream(persona, persistence));
      await waitFor(() => expect(persistence.restore).toHaveBeenCalled());
      await primeOneTurn(result, first);

      act(() => result.current.editUser(1, '   ')); // 공백
      act(() => result.current.editUser(2, '모델 자리')); // model index
      act(() => result.current.editUser(0, 'greeting 편집')); // greeting(model)

      expect(fetchMock).toHaveBeenCalledTimes(1); // primeOneTurn의 1회 외 추가 없음
      expect(persistence.replace).not.toHaveBeenCalled();
    });
  });

  // ── #15 대화 요약 조립/트리거 ──────────────────────────────
  describe('요약 조립/트리거 (#15)', () => {
    const persona2 = PERSONA_TEMPLATES[0];
    const makePersistence = (
      turns: { role: 'user' | 'model'; content: string }[],
      summary: string | null,
    ) => ({
      restore: vi.fn().mockResolvedValue(turns),
      onUserMessage: vi.fn(),
      onModelMessage: vi.fn(),
      loadSummary: vi.fn().mockResolvedValue(summary),
      summarize: vi.fn().mockResolvedValue('갱신된 요약'),
    });

    it('summary가 있으면 요청을 최근 N turn + conversationSummary로 조립한다', async () => {
      // 충분히 많은 과거 turn + 요약 적재
      const past = Array.from({ length: 8 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'model') as 'user' | 'model',
        content: `과거${i}`,
      }));
      const persistence = makePersistence(past, '이전 요약본');
      const sse = sseResponse();
      fetchMock.mockResolvedValueOnce(sse.response);
      const { result } = renderHook(() => useChatStream(persona2, persistence));
      await waitFor(() => expect(persistence.loadSummary).toHaveBeenCalled());
      await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(1));

      act(() => result.current.send('새 질문'));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      // conversationSummary 전송 + 최근 N turn만 (full-history 아님, fewShot 미포함)
      expect(body.conversationSummary).toBe('이전 요약본');
      expect(body.messages.length).toBe(SUMMARY_RECENT_TURNS);
      expect(body.messages.slice(-1)[0]).toEqual({ role: 'user', content: '새 질문' });
    });

    it('summary가 없으면 기존 full-history로 전송한다 (conversationSummary 미포함)', async () => {
      const persistence = makePersistence([], null);
      const sse = sseResponse();
      fetchMock.mockResolvedValueOnce(sse.response);
      const { result } = renderHook(() => useChatStream(persona2, persistence));
      await waitFor(() => expect(persistence.loadSummary).toHaveBeenCalled());

      act(() => result.current.send('안녕'));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(body.conversationSummary).toBeUndefined();
      expect(body.messages).toEqual([greeting, { role: 'user', content: '안녕' }]);
    });

    it('turn 성공 후 저장 turn이 임계를 넘으면 persistence.summarize를 호출한다', async () => {
      // greeting 제외 turn 수가 임계 초과가 되도록 과거 turn 적재
      const past = Array.from({ length: SUMMARY_TURN_THRESHOLD }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'model') as 'user' | 'model',
        content: `과거${i}`,
      }));
      const persistence = makePersistence(past, null);
      const sse = sseResponse();
      fetchMock.mockResolvedValueOnce(sse.response);
      const { result } = renderHook(() => useChatStream(persona2, persistence));
      await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(1));

      act(() => result.current.send('새 질문'));
      await waitFor(() => expect(result.current.status).toBe('streaming'));
      act(() => {
        sse.push({ type: 'done', message: { role: 'model', content: '답변' } });
        sse.close();
      });
      await waitFor(() => expect(result.current.status).toBe('idle'));

      await waitFor(() => expect(persistence.summarize).toHaveBeenCalled());
    });

    it('임계 이하면 summarize를 호출하지 않는다', async () => {
      const persistence = makePersistence([], null);
      const sse = sseResponse();
      fetchMock.mockResolvedValueOnce(sse.response);
      const { result } = renderHook(() => useChatStream(persona2, persistence));
      await waitFor(() => expect(persistence.loadSummary).toHaveBeenCalled());

      act(() => result.current.send('안녕'));
      await waitFor(() => expect(result.current.status).toBe('streaming'));
      act(() => {
        sse.push({ type: 'done', message: { role: 'model', content: '반가워요' } });
        sse.close();
      });
      await waitFor(() => expect(result.current.status).toBe('idle'));

      expect(persistence.summarize).not.toHaveBeenCalled();
    });
  });

  it('retry()는 실패 턴(partial)을 정리하고 마지막 user 메시지를 재전송한다', async () => {
    const first = sseResponse();
    const second = sseResponse();
    fetchMock.mockResolvedValueOnce(first.response).mockResolvedValueOnce(second.response);
    const { result } = renderHook(() => useChatStream(persona));

    act(() => result.current.send('안녕'));
    await waitFor(() => expect(result.current.status).toBe('streaming'));
    act(() => {
      first.push({ type: 'delta', text: '옷손' });
      first.push({ type: 'error', code: 'upstream_error', message: '호출에 실패했습니다.' });
      first.close();
    });
    await waitFor(() => expect(result.current.status).toBe('error'));

    act(() => result.current.retry());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // 재요청 히스토리에 실패 partial은 빠지고 마지막 user 메시지가 끝에 온다
    const body = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(body.messages).toEqual([greeting, { role: 'user', content: '안녕' }]);

    act(() => {
      second.push({ type: 'done', message: { role: 'model', content: '다시 반가워요' } });
      second.close();
    });
    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.error).toBeNull();
    expect(result.current.messages).toEqual([
      greeting,
      { role: 'user', content: '안녕' },
      { role: 'model', content: '다시 반가워요' },
    ]);
  });
});
