import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FinishReason, type GenerateContentResponse, type GoogleGenAI } from '@google/genai';
import {
  PERSONA_TEMPLATES,
  buildPersonaPrompt,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type ChatStreamEvent,
  type ExampleDialogueTurn,
  type Persona,
} from '@ai-character/shared';
import { CharactersService } from '../characters/characters.service';
import type { OwnerContext } from '../auth/owner';
import { GENAI_CLIENT, SAFETY_SETTINGS } from './chat.constants';

const GEMINI_TIMEOUT_MS = 30_000;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(GENAI_CLIENT) private readonly client: GoogleGenAI | null,
    private readonly config: ConfigService,
    private readonly characters: CharactersService,
  ) {}

  async chat(request: ChatRequest, owner: OwnerContext): Promise<ChatResponse> {
    // #23 신뢰 소스에서 persona 재조립 — requireClient보다 먼저 해결해 미존재는 404가 503보다 앞선다
    const persona = await this.resolvePersona(request.personaId, owner);
    const prompt = buildPersonaPrompt(persona);
    const client = this.requireClient();
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
    const contents = this.toContents([...prompt.fewShotMessages, ...request.messages]);
    const systemInstruction = this.buildSystemInstruction(
      prompt.systemInstruction,
      request.conversationSummary,
    );

    try {
      const result = await this.withTimeout(
        client.models.generateContent({
          model,
          contents,
          config: { systemInstruction, safetySettings: SAFETY_SETTINGS },
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
    owner: OwnerContext,
    signal?: AbortSignal,
  ): Promise<AsyncGenerator<ChatStreamEvent>> {
    // #23 신뢰 소스에서 persona 재조립 (404가 503보다 앞서도록 requireClient 이전 해결)
    const persona = await this.resolvePersona(request.personaId, owner);
    const prompt = buildPersonaPrompt(persona);
    const client = this.requireClient();
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');

    const systemInstruction = this.buildSystemInstruction(
      prompt.systemInstruction,
      request.conversationSummary,
    );
    const upstream = await client.models.generateContentStream({
      model,
      contents: this.toContents([...prompt.fewShotMessages, ...request.messages]),
      config: {
        systemInstruction,
        safetySettings: SAFETY_SETTINGS,
        ...(signal ? { abortSignal: signal } : {}),
      },
    });
    return this.toStreamEvents(upstream);
  }

  /**
   * #15 과거 대화 요약(장기기억) 생성. 직전 요약을 누적 반영해 보존적으로 압축한다.
   * 캐릭터 연기와 분리된 별도 system instruction으로 호출한다.
   */
  async summarize(priorSummary: string | null, turns: ChatMessage[]): Promise<string> {
    const client = this.requireClient();
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
    const serialized = turns
      .map((t) => `${t.role === 'user' ? '사용자' : '캐릭터'}: ${t.content}`)
      .join('\n');
    const prompt = [
      priorSummary ? `기존 요약:\n${priorSummary}\n` : '',
      '아래 대화를 한국어로 간결히 요약하라. 인물·사건·약속·감정 변화 등 이후 대화에 필요한 맥락을 보존하라.',
      '',
      '대화:',
      serialized,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const result = await this.withTimeout(
        client.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            systemInstruction:
              '너는 대화 내용을 보존적으로 요약하는 도우미다. 캐릭터 연기는 하지 않는다.',
          },
        }),
      );
      const text = result.text;
      if (!text) throw new BadGatewayException('Gemini가 빈 요약을 반환했습니다.');
      return text;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('요약 생성 실패', err instanceof Error ? err.stack : String(err));
      throw new BadGatewayException('요약 생성에 실패했습니다.');
    }
  }

  /**
   * #23 personaId를 신뢰 소스에서 해결한다 — 클라가 보낸 어떤 instruction도 신뢰하지 않는다.
   * `tpl-*`는 shared 템플릿, 그 외(`usr-*`)는 Character DB(소유자거나 공개면 반환, 아니면 404).
   */
  private async resolvePersona(personaId: string, owner: OwnerContext): Promise<Persona> {
    if (personaId.startsWith('tpl-')) {
      const template = PERSONA_TEMPLATES.find((p) => p.id === personaId);
      if (!template) throw new NotFoundException('캐릭터를 찾을 수 없습니다.');
      return template;
    }
    const character = await this.characters.getOne(personaId, owner);
    return this.toPersona(character);
  }

  /** Character row(Json 필드 포함) → Persona. prohibitions null → undefined */
  private toPersona(c: Awaited<ReturnType<CharactersService['getOne']>>): Persona {
    return {
      id: c.id,
      name: c.name,
      tagline: c.tagline,
      personality: c.personality,
      speechStyle: c.speechStyle,
      worldview: c.worldview,
      greeting: c.greeting,
      exampleDialogue: (c.exampleDialogue ?? []) as unknown as ExampleDialogueTurn[],
      prohibitions: (c.prohibitions ?? undefined) as string[] | undefined,
    };
  }

  /** #15 conversationSummary가 있으면 systemInstruction(서버 빌드 base)에 '이전 대화 요약' 블록을 접합 */
  private buildSystemInstruction(base: string, summary?: string): string {
    if (!summary) return base;
    const block = [
      '## 이전 대화 요약',
      summary,
      '위 요약은 과거 대화의 압축이다. 일관성을 위해 참고하되 그대로 반복하지 마라.',
    ].join('\n');
    return `${base}\n\n${block}`;
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

  private toContents(messages: ChatMessage[]) {
    return messages.map((m) => ({
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
