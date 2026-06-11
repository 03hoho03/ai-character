import type { ChatMessage } from './index';

/** #13 에러 이벤트의 원인 구분. 프론트는 code로 분기, message는 그대로 노출 가능. */
export type ChatStreamErrorCode = 'safety_block' | 'timeout' | 'upstream_error';

const ERROR_CODES: readonly string[] = ['safety_block', 'timeout', 'upstream_error'];

/**
 * #12 SSE 스트리밍 이벤트 규약 + #13 에러 이벤트.
 * error는 종결 이벤트 — 이후 done은 오지 않고 스트림이 닫힌다.
 */
export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; message: ChatMessage }
  | { type: 'error'; code: ChatStreamErrorCode; message: string };

/** ChatStreamEvent → SSE wire format. api 송출과 파서 테스트의 단일 출처. */
export function serializeChatStreamEvent(event: ChatStreamEvent): string {
  const { type, ...payload } = event;
  return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}

/**
 * fetch response.body(SSE)를 ChatStreamEvent로 복원하는 프레임워크 무관 파서.
 * 이벤트가 임의 chunk/바이트 경계에서 잘려 도착해도 안전하다 (#3이 import만 하면 됨).
 * 알 수 없는 event 타입은 무시한다 (#13 forward-compat).
 */
export async function* parseChatStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatStreamEvent> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseEventBlock(block);
        if (event) yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseEventBlock(block: string): ChatStreamEvent | null {
  let eventType = '';
  const dataLines: string[] = [];

  for (const line of block.split('\n')) {
    if (line.startsWith('event: ')) eventType = line.slice('event: '.length);
    else if (line.startsWith('data: ')) dataLines.push(line.slice('data: '.length));
  }
  if (dataLines.length === 0) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(dataLines.join('\n'));
  } catch {
    return null; // 손상 블록은 건너뛴다
  }

  if (eventType === 'delta') {
    const { text } = payload as { text?: unknown };
    if (typeof text === 'string') return { type: 'delta', text };
  } else if (eventType === 'done') {
    const { message } = payload as { message?: ChatMessage };
    if (message && typeof message.content === 'string') return { type: 'done', message };
  } else if (eventType === 'error') {
    const { code, message } = payload as { code?: unknown; message?: unknown };
    if (typeof message === 'string') {
      // 미지의 code는 upstream_error로 강등 — 규약이 늘어나도 구버전 프론트가 깨지지 않는다
      const known = typeof code === 'string' && ERROR_CODES.includes(code);
      return { type: 'error', code: known ? (code as ChatStreamErrorCode) : 'upstream_error', message };
    }
  }
  return null; // 알 수 없는 이벤트 (forward-compat)
}
