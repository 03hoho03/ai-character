/**
 * #3 useChatStream 훅 테스트 — prd.md 성공 기준에 매핑.
 * mock fetch + 수동 제어 ReadableStream으로 SSE 수신 시나리오를 재현한다.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PERSONA_TEMPLATES,
  buildPersonaPrompt,
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

  it('요청 body에 systemInstruction + fewShot + greeting 포함 히스토리를 담는다', async () => {
    const sse = sseResponse();
    fetchMock.mockResolvedValueOnce(sse.response);
    const { result } = renderHook(() => useChatStream(persona));

    act(() => result.current.send('안녕'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://localhost:4000/chat/stream');
    const body = JSON.parse((init as RequestInit).body as string);
    const prompt = buildPersonaPrompt(persona);
    expect(body.systemInstruction).toBe(prompt.systemInstruction);
    expect(body.messages).toEqual([
      ...prompt.fewShotMessages,
      greeting,
      { role: 'user', content: '안녕' },
    ]);
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
    const prompt = buildPersonaPrompt(persona);
    expect(body.messages).toEqual([
      ...prompt.fewShotMessages,
      greeting,
      { role: 'user', content: '안녕' },
    ]);

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
