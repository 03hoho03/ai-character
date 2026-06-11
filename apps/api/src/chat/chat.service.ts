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
import type { GenerateContentResponse, GoogleGenAI } from '@google/genai';
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
   * 중간 에러/타임아웃 이벤트 규약은 #13.
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

  private async *toStreamEvents(
    upstream: AsyncGenerator<GenerateContentResponse>,
  ): AsyncGenerator<ChatStreamEvent> {
    let full = '';
    for await (const chunk of upstream) {
      const text = chunk.text;
      if (!text) continue; // 빈 chunk는 delta 없이 통과 — safety 세분화는 #13
      full += text;
      yield { type: 'delta', text };
    }
    yield { type: 'done', message: { role: 'model', content: full } };
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
