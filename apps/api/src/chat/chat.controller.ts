import { Body, Controller, HttpCode, HttpStatus, Logger, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { serializeChatStreamEvent, type ChatResponse } from '@ai-character/shared';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';

/**
 * chat 엔드포인트 — 비스트리밍(#2a) + SSE 스트리밍(#12).
 * curl 예시:
 *   curl -X POST localhost:4000/chat -H 'Content-Type: application/json' \
 *     -d '{"systemInstruction":"너는 마법사다.","messages":[{"role":"user","content":"안녕"}]}'
 *   curl -N -X POST localhost:4000/chat/stream -H 'Content-Type: application/json' -d '...'
 */
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Post()
  chat(@Body() body: ChatRequestDto): Promise<ChatResponse> {
    return this.chatService.chat(body);
  }

  /**
   * SSE 스트리밍 (#12). EventSource는 POST 불가 — 프론트는 fetch +
   * shared parseChatStream으로 소비한다. 클라이언트가 연결을 끊으면
   * AbortController로 Gemini 업스트림을 중단한다.
   */
  @Post('stream')
  @HttpCode(HttpStatus.OK)
  async chatStream(@Body() body: ChatRequestDto, @Res() res: Response): Promise<void> {
    const abort = new AbortController();
    res.once('close', () => abort.abort());

    // generator 생성 전 예외(503 등)는 SSE 헤더 송출 전이라 일반 HTTP 에러로 전달된다
    const events = await this.chatService.chatStream(body, abort.signal);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const event of events) {
        if (abort.signal.aborted) break;
        res.write(serializeChatStreamEvent(event));
      }
    } catch (err) {
      // 스트림 중간 에러의 SSE 이벤트 규약은 #13 — 여기서는 로그 후 연결 종료
      this.logger.error('SSE 스트림 중단', err instanceof Error ? err.stack : String(err));
    } finally {
      res.end();
    }
  }
}
