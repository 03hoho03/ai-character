import { Body, Controller, Post } from '@nestjs/common';
import type { ChatResponse } from '@ai-character/shared';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';

/**
 * 비스트리밍 chat 엔드포인트 (#2a). 스트리밍 전환은 #12.
 * curl 예시:
 *   curl -X POST localhost:4000/chat -H 'Content-Type: application/json' \
 *     -d '{"systemInstruction":"너는 마법사다.","messages":[{"role":"user","content":"안녕"}]}'
 */
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  chat(@Body() body: ChatRequestDto): Promise<ChatResponse> {
    return this.chatService.chat(body);
  }
}
