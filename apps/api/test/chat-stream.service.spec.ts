/**
 * #12 ChatService.chatStream 단위 테스트 — mock Gemini 스트림 기반.
 */
import { ServiceUnavailableException } from '@nestjs/common';
import type { ChatRequest, ChatStreamEvent } from '@ai-character/shared';
import { ChatService } from '../src/chat/chat.service';

const cfg = () => ({ get: (_key: string, def?: string) => def }) as never;

const baseRequest: ChatRequest = {
  systemInstruction: '너는 친절한 마법사다.',
  messages: [{ role: 'user', content: '안녕' }],
};

async function* mockChunks(texts: (string | undefined)[]) {
  for (const text of texts) yield { text };
}

async function collect(gen: AsyncGenerator<ChatStreamEvent>): Promise<ChatStreamEvent[]> {
  const out: ChatStreamEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe('ChatService.chatStream (#12)', () => {
  const generateContentStream = jest.fn();
  const client = { models: { generateContentStream } } as never;
  let service: ChatService;

  beforeEach(() => {
    generateContentStream.mockReset();
    service = new ChatService(client, cfg());
  });

  it('chunk마다 delta를, 종료 시 합산 done을 발행한다', async () => {
    generateContentStream.mockResolvedValue(mockChunks(['안녕', '하세요']));

    const events = await collect(await service.chatStream(baseRequest));

    expect(events).toEqual([
      { type: 'delta', text: '안녕' },
      { type: 'delta', text: '하세요' },
      { type: 'done', message: { role: 'model', content: '안녕하세요' } },
    ]);
  });

  it('빈/undefined chunk 텍스트는 delta 없이 건너뛴다', async () => {
    generateContentStream.mockResolvedValue(mockChunks(['안녕', undefined, '', '!']));

    const events = await collect(await service.chatStream(baseRequest));

    expect(events).toEqual([
      { type: 'delta', text: '안녕' },
      { type: 'delta', text: '!' },
      { type: 'done', message: { role: 'model', content: '안녕!' } },
    ]);
  });

  it('contents 매핑/systemInstruction/abortSignal을 Gemini 호출에 전달한다', async () => {
    generateContentStream.mockResolvedValue(mockChunks(['ok']));
    const controller = new AbortController();

    await collect(await service.chatStream(baseRequest, controller.signal));

    expect(generateContentStream).toHaveBeenCalledTimes(1);
    const callArg = generateContentStream.mock.calls[0][0];
    expect(callArg.model).toBe('gemini-2.5-flash');
    expect(callArg.contents).toEqual([{ role: 'user', parts: [{ text: '안녕' }] }]);
    expect(callArg.config?.systemInstruction).toBe('너는 친절한 마법사다.');
    expect(callArg.config?.abortSignal).toBe(controller.signal);
  });

  it('클라이언트(GEMINI_API_KEY) 미설정 시 generator 생성 전에 503을 던진다', async () => {
    const noKey = new ChatService(null, cfg());

    await expect(noKey.chatStream(baseRequest)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe('ChatService.chatStream 에러 이벤트 규약 (#13)', () => {
  const generateContentStream = jest.fn();
  const client = { models: { generateContentStream } } as never;
  let service: ChatService;

  beforeEach(() => {
    generateContentStream.mockReset();
    service = new ChatService(client, cfg());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('finishReason SAFETY chunk를 만나면 safety_block error를 송출하고 종료한다 (done 없음)', async () => {
    async function* chunks() {
      yield { text: '안녕' };
      yield { candidates: [{ finishReason: 'SAFETY' }] };
    }
    generateContentStream.mockResolvedValue(chunks());

    const events = await collect(await service.chatStream(baseRequest));

    expect(events).toEqual([
      { type: 'delta', text: '안녕' },
      { type: 'error', code: 'safety_block', message: expect.any(String) },
    ]);
  });

  it('promptFeedback.blockReason이 있으면 safety_block error를 송출한다', async () => {
    async function* chunks() {
      yield { promptFeedback: { blockReason: 'SAFETY' } };
    }
    generateContentStream.mockResolvedValue(chunks());

    const events = await collect(await service.chatStream(baseRequest));

    expect(events).toEqual([
      { type: 'error', code: 'safety_block', message: expect.any(String) },
    ]);
  });

  it('chunk 간 무응답 30초 초과 시 timeout error를 송출한다', async () => {
    jest.useFakeTimers();
    async function* hang() {
      yield { text: '안녕' };
      await new Promise(() => {}); // 다음 chunk가 영원히 오지 않음
    }
    generateContentStream.mockResolvedValue(hang());

    const eventsPromise = collect(await service.chatStream(baseRequest));
    await jest.advanceTimersByTimeAsync(30_000);

    expect(await eventsPromise).toEqual([
      { type: 'delta', text: '안녕' },
      { type: 'error', code: 'timeout', message: expect.any(String) },
    ]);
  });

  it('업스트림 iteration이 throw하면 upstream_error를 송출한다 (done 없음)', async () => {
    async function* failing() {
      yield { text: '안' };
      throw new Error('gemini boom');
    }
    generateContentStream.mockResolvedValue(failing());

    const events = await collect(await service.chatStream(baseRequest));

    expect(events).toEqual([
      { type: 'delta', text: '안' },
      { type: 'error', code: 'upstream_error', message: expect.any(String) },
    ]);
  });

  it('텍스트 0자로 정상 종료되면 빈 done 대신 upstream_error를 송출한다', async () => {
    generateContentStream.mockResolvedValue(mockChunks([undefined, '']));

    const events = await collect(await service.chatStream(baseRequest));

    expect(events).toEqual([
      { type: 'error', code: 'upstream_error', message: expect.any(String) },
    ]);
  });
});
