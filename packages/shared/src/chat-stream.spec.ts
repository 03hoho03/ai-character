/**
 * #12 SSE 이벤트 규약 테스트 — prd.md 성공 기준에 매핑.
 * 파서는 fetch response.body를 그대로 받는 프레임워크 무관 유틸 (#3이 import).
 */
import { describe, expect, it } from 'vitest';
import {
  parseChatStream,
  serializeChatStreamEvent,
  type ChatStreamEvent,
} from './chat-stream';

const EVENTS: ChatStreamEvent[] = [
  { type: 'delta', text: '안녕' },
  { type: 'delta', text: '하세요' },
  { type: 'done', message: { role: 'model', content: '안녕하세요' } },
];

/** 문자열 조각들을 fetch response.body 형태의 ReadableStream으로 변환 */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

/** 바이트 단위 조각 스트림 (멀티바이트 경계 분할 테스트용) */
function byteStreamOf(text: string, size: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) {
        controller.enqueue(bytes.slice(i, i + size));
      }
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<ChatStreamEvent[]> {
  const out: ChatStreamEvent[] = [];
  for await (const event of parseChatStream(stream)) out.push(event);
  return out;
}

describe('serializeChatStreamEvent (#12)', () => {
  it('delta를 SSE wire format으로 직렬화한다', () => {
    expect(serializeChatStreamEvent({ type: 'delta', text: '안녕' })).toBe(
      'event: delta\ndata: {"text":"안녕"}\n\n',
    );
  });

  it('done을 SSE wire format으로 직렬화한다', () => {
    expect(
      serializeChatStreamEvent({
        type: 'done',
        message: { role: 'model', content: '안녕하세요' },
      }),
    ).toBe('event: done\ndata: {"message":{"role":"model","content":"안녕하세요"}}\n\n');
  });
});

describe('parseChatStream (#12)', () => {
  const wire = EVENTS.map(serializeChatStreamEvent).join('');

  it('이벤트 단위로 도착한 스트림을 복원한다', async () => {
    expect(await collect(streamOf(EVENTS.map(serializeChatStreamEvent)))).toEqual(EVENTS);
  });

  it('이벤트 중간에서 잘린 chunk 시퀀스도 복원한다', async () => {
    // 'event: '/'data: ' 라인과 JSON 한가운데를 가로지르는 분할
    const cuts = [wire.slice(0, 5), wire.slice(5, 30), wire.slice(30, 31), wire.slice(31)];
    expect(await collect(streamOf(cuts))).toEqual(EVENTS);
  });

  it('멀티바이트(한글) 문자 한가운데서 바이트가 잘려도 복원한다', async () => {
    expect(await collect(byteStreamOf(wire, 3))).toEqual(EVENTS);
  });

  it('한 chunk에 여러 이벤트가 합쳐 도착해도 복원한다', async () => {
    expect(await collect(streamOf([wire]))).toEqual(EVENTS);
  });

  it('알 수 없는 event 타입 블록은 무시한다 (#13 forward-compat)', async () => {
    const withUnknown =
      serializeChatStreamEvent(EVENTS[0]) +
      'event: future\ndata: {"x":1}\n\n' +
      serializeChatStreamEvent(EVENTS[2]);
    expect(await collect(streamOf([withUnknown]))).toEqual([EVENTS[0], EVENTS[2]]);
  });
});
