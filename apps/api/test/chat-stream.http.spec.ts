/**
 * #12 POST /chat/stream HTTP 계약 테스트.
 * - SSE 송출/규약: GENAI_CLIENT를 mock으로 override (실키 불필요)
 * - 라운드트립: 실제 응답 본문을 shared parseChatStream으로 복원
 * - abort: ephemeral port + socket destroy (고정 포트/pkill 회피)
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { parseChatStream, type ChatStreamEvent } from '@ai-character/shared';
import { AppModule } from '../src/app.module';
import { GENAI_CLIENT } from '../src/chat/chat.constants';
import { stubPrisma } from './prisma-stub';

const VALID_BODY = { messages: [{ role: 'user', content: '안녕' }] };

function streamOfText(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function parseAll(text: string): Promise<ChatStreamEvent[]> {
  const out: ChatStreamEvent[] = [];
  for await (const e of parseChatStream(streamOfText(text))) out.push(e);
  return out;
}

/** supertest가 text/event-stream 본문을 버퍼링하도록 하는 파서 */
function sseBuffer(res: request.Response, cb: (err: Error | null, body: string) => void) {
  let text = '';
  res.on('data', (chunk: Buffer) => (text += chunk.toString('utf8')));
  res.on('end', () => cb(null, text));
}

describe('POST /chat/stream (mock Gemini)', () => {
  let app: INestApplication;
  let capturedSignal: AbortSignal | undefined;

  const generateContentStream = jest.fn();
  const mockClient = { models: { generateContentStream } };

  beforeAll(async () => {
    const moduleRef = await stubPrisma(Test.createTestingModule({ imports: [AppModule] }))
      .overrideProvider(GENAI_CLIENT)
      .useValue(mockClient)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    capturedSignal = undefined;
    generateContentStream.mockReset();
    generateContentStream.mockImplementation(async (params: { config?: { abortSignal?: AbortSignal } }) => {
      capturedSignal = params.config?.abortSignal;
      return (async function* () {
        yield { text: '안녕' };
        yield { text: '하세요' };
      })();
    });
  });

  it('delta×N → done 순서의 SSE를 text/event-stream으로 송출한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/chat/stream')
      .send(VALID_BODY)
      .buffer(true)
      .parse(sseBuffer);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const events = await parseAll(res.body as unknown as string);
    expect(events).toEqual([
      { type: 'delta', text: '안녕' },
      { type: 'delta', text: '하세요' },
      { type: 'done', message: { role: 'model', content: '안녕하세요' } },
    ]);
  });

  it('빈 messages → 400 (기존 /chat과 동일 규약)', async () => {
    const res = await request(app.getHttpServer()).post('/chat/stream').send({ messages: [] });
    expect(res.status).toBe(400);
  });

  it('클라이언트 연결 중단 시 업스트림 AbortSignal이 aborted가 된다', async () => {
    // 첫 delta 후 abort될 때까지 대기하는 업스트림 — 무한 스트림 시뮬레이션
    generateContentStream.mockImplementation(async (params: { config?: { abortSignal?: AbortSignal } }) => {
      const signal = params.config?.abortSignal;
      capturedSignal = signal;
      return (async function* () {
        yield { text: '안' };
        await new Promise<void>((resolve) => {
          if (signal?.aborted) return resolve();
          signal?.addEventListener('abort', () => resolve(), { once: true });
        });
      })();
    });

    const server = app.getHttpServer() as http.Server;
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port, path: '/chat/stream', method: 'POST', headers: { 'content-type': 'application/json' } },
        (res) => {
          // 첫 chunk 수신 즉시 클라이언트가 연결을 끊는다
          res.once('data', () => {
            req.destroy();
            resolve();
          });
        },
      );
      req.on('error', reject);
      req.end(JSON.stringify(VALID_BODY));
    });

    // res 'close' → controller abort 전파를 polling으로 확인
    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 3000;
      const timer = setInterval(() => {
        if (capturedSignal?.aborted) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() > deadline) {
          clearInterval(timer);
          reject(new Error('AbortSignal이 3초 내에 aborted 되지 않음'));
        }
      }, 20);
    });

    expect(capturedSignal?.aborted).toBe(true);
  });
});

describe('POST /chat/stream (GEMINI_API_KEY 미설정)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    delete process.env.GEMINI_API_KEY;
    const moduleRef = await stubPrisma(Test.createTestingModule({ imports: [AppModule] })).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('유효한 body + 키 미설정 → 503 (SSE 시작 전 일반 HTTP 에러)', async () => {
    const res = await request(app.getHttpServer()).post('/chat/stream').send(VALID_BODY);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).toContain('GEMINI_API_KEY');
  });
});
