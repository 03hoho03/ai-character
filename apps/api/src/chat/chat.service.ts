import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FinishReason, type GenerateContentResponse, type GoogleGenAI } from '@google/genai';
import type { ChatRequest, ChatResponse, ChatStreamEvent } from '@ai-character/shared';
import { GENAI_CLIENT } from './chat.constants';

const GEMINI_TIMEOUT_MS = 30_000;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(GENAI_CLIENT) private readonly client: GoogleGenAI | null,
    private readonly config: ConfigService,
  ) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const client = this.requireClient();
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
    const contents = this.toContents(request);

    try {
      const result = await this.withTimeout(
        client.models.generateContent({
          model,
          contents,
          ...(request.systemInstruction !== undefined
            ? { config: { systemInstruction: request.systemInstruction } }
            : {}),
        }),
      );

      const text = result.text;
      if (!text) {
        // safety-block 등 빈 응답의 세분화는 #13 — 여기서는 502로 일괄 처리
        throw new BadGatewayException('Gemini가 빈 응답을 반환했습니다.');
      }
      return { message: { role: 'model', content: text } };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      // 업스트림 에러 원문은 로그로만 — 응답에는 안전한 메시지
      this.logger.error('Gemini 호출 실패', err instanceof Error ? err.stack : String(err));
      throw new BadGatewayException('Gemini 호출에 실패했습니다.');
    }
  }

  /**
   * #12 스트리밍 경로. Gemini chunk → delta 이벤트, 종료 시 합산 done 이벤트.
   * 503(키 미설정)은 generator 생성 전에 던져 일반 HTTP 에러로 응답된다.
   * 중간 에러/타임아웃/safety-block은 종결 error 이벤트로 송출된다 (#13).
   */
  async chatStream(
    request: ChatRequest,
    signal?: AbortSignal,
  ): Promise<AsyncGenerator<ChatStreamEvent>> {
    const client = this.requireClient();
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');

    const upstream = await client.models.generateContentStream({
      model,
      contents: this.toContents(request),
      config: {
        ...(request.systemInstruction !== undefined
          ? { systemInstruction: request.systemInstruction }
          : {}),
        ...(signal ? { abortSignal: signal } : {}),
      },
    });
    return this.toStreamEvents(upstream);
  }

  /**
   * #13 에러 이벤트 규약: error는 종결 이벤트 — 송출 후 done 없이 스트림을 닫는다.
   * 타임아웃은 chunk 간 무응답(idle) 30초 기준 (GEMINI_TIMEOUT_MS 재사용).
   */
  private async *toStreamEvents(
    upstream: AsyncGenerator<GenerateContentResponse>,
  ): AsyncGenerator<ChatStreamEvent> {
    let full = '';
    try {
      while (true) {
        const next = await this.withTimeout(upstream.next());
        if (next.done) break;
        const chunk = next.value;

        if (this.isSafetyBlocked(chunk)) {
          yield {
            type: 'error',
            code: 'safety_block',
            message: '안전 정책에 의해 응답이 차단되었습니다.',
          };
          return;
        }

        const text = chunk.text;
        if (!text) continue; // 빈 chunk는 delta 없이 통과
        full += text;
        yield { type: 'delta', text };
      }
    } catch (err) {
      const isTimeout = err instanceof GatewayTimeoutException;
      // 업스트림 에러 원문은 로그로만 — 이벤트에는 안전한 메시지
      this.logger.error('Gemini 스트림 중단', err instanceof Error ? err.stack : String(err));
      void upstream.return(undefined).catch(() => undefined); // 타임아웃 시 업스트림 중단 (fire-and-forget)
      yield isTimeout
        ? { type: 'error', code: 'timeout', message: 'Gemini 응답이 30초를 초과했습니다.' }
        : { type: 'error', code: 'upstream_error', message: 'Gemini 호출에 실패했습니다.' };
      return;
    }

    if (!full) {
      // safety 미검출 빈 응답 — 빈 done 대신 에러로 종결
      yield {
        type: 'error',
        code: 'upstream_error',
        message: 'Gemini가 빈 응답을 반환했습니다.',
      };
      return;
    }
    yield { type: 'done', message: { role: 'model', content: full } };
  }

  private isSafetyBlocked(chunk: GenerateContentResponse): boolean {
    return (
      chunk.promptFeedback?.blockReason !== undefined ||
      chunk.candidates?.[0]?.finishReason === FinishReason.SAFETY
    );
  }

  private requireClient(): GoogleGenAI {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY가 설정되지 않았습니다. apps/api/.env를 확인하세요 (.env.example 참조).',
      );
    }
    return this.client;
  }

  private toContents(request: ChatRequest) {
    return request.messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new GatewayTimeoutException('Gemini 응답이 30초를 초과했습니다.')),
        GEMINI_TIMEOUT_MS,
      );
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }
}
