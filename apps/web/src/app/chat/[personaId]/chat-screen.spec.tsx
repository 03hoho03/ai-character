/**
 * #18 ChatScreen 상호작용 테스트 — 재생성 버튼 + user 메시지 편집 UI.
 * fetch를 url/method로 라우팅(영속 + /chat/stream SSE)해 한 turn을 끝까지 진행한 뒤 어포던스를 검증.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PERSONA_TEMPLATES,
  serializeChatStreamEvent,
  type ChatStreamEvent,
} from '@ai-character/shared';
import { ChatScreen } from './chat-screen';

const persona = PERSONA_TEMPLATES[0];

function sseResponse() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start: (c) => (controller = c) });
  const encoder = new TextEncoder();
  return {
    response: new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }),
    push: (e: ChatStreamEvent) => controller.enqueue(encoder.encode(serializeChatStreamEvent(e))),
    close: () => controller.close(),
  };
}

describe('ChatScreen (#18)', () => {
  const fetchMock = vi.fn();
  let streams: ReturnType<typeof sseResponse>[];
  const calls: { url: string; method: string }[] = [];

  beforeEach(() => {
    // jsdom 미구현 — 자동 스크롤 effect가 throw하지 않도록 스텁
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.clear();
    localStorage.setItem('ai-character:browser-id', 'b1');
    streams = [];
    calls.length = 0;
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      calls.push({ url, method });
      if (url.includes('/chat/stream')) return streams.shift()!.response;
      if (url.includes('/conversations') && method === 'GET') {
        return new Response(JSON.stringify({ message: 'nf' }), { status: 404 });
      }
      if (url.endsWith('/conversations') && method === 'POST') {
        return new Response(JSON.stringify({ id: 'c1', browserId: 'b1', personaId: persona.id }));
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  /** 입력창에 보내고 done까지 진행해 [greeting, user, model] 상태로 만든다 */
  async function sendOneTurn(text: string, answer: string) {
    const sse = sseResponse();
    streams.push(sse);
    fireEvent.change(screen.getByLabelText('메시지 입력'), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: '전송' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/chat/stream'))).toBe(true));
    act(() => {
      sse.push({ type: 'done', message: { role: 'model', content: answer } });
      sse.close();
    });
    await waitFor(() => expect(screen.getByText(answer)).toBeTruthy());
  }

  it('한 turn 후 user 버블에 편집, 마지막 model 버블에 재생성 버튼을 노출한다', async () => {
    render(<ChatScreen persona={persona} />);
    await sendOneTurn('안녕', '답변1');

    expect(screen.getByRole('button', { name: '편집' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '재생성' })).toBeTruthy();
  });

  it('편집 클릭 시 현재 내용이 담긴 textarea를 열고, 저장하면 편집 내용으로 재실행한다', async () => {
    render(<ChatScreen persona={persona} />);
    await sendOneTurn('안녕', '답변1');

    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    const editor = screen.getByLabelText('메시지 편집') as HTMLTextAreaElement;
    expect(editor.value).toBe('안녕');

    // 다음 재실행용 스트림 예약 후 저장
    streams.push(sseResponse());
    fireEvent.change(editor, { target: { value: '안녕 고침' } });
    fireEvent.click(screen.getByRole('button', { name: '저장 후 재전송' }));

    // 편집 후속 truncate(PUT) + 새 /chat/stream 호출
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    await waitFor(() =>
      expect(calls.filter((c) => c.url.includes('/chat/stream'))).toHaveLength(2),
    );
    expect(screen.getByText('안녕 고침')).toBeTruthy();
  });

  it('재생성 클릭 시 후속 truncate(PUT) 후 새 답변을 스트리밍한다', async () => {
    render(<ChatScreen persona={persona} />);
    await sendOneTurn('안녕', '답변1');

    const regen = sseResponse();
    streams.push(regen);
    fireEvent.click(screen.getByRole('button', { name: '재생성' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    await waitFor(() =>
      expect(calls.filter((c) => c.url.includes('/chat/stream'))).toHaveLength(2),
    );
    act(() => {
      regen.push({ type: 'done', message: { role: 'model', content: '답변2' } });
      regen.close();
    });
    await waitFor(() => expect(screen.getByText('답변2')).toBeTruthy());
  });
});
