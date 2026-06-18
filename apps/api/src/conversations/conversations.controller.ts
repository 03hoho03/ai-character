import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import {
  AppendMessageDto,
  CreateConversationDto,
  GetConversationQueryDto,
  ReplaceMessagesDto,
  SummarizeDto,
} from './dto/conversation.dto';

/**
 * #14 대화 영속화 API. 소유자 = 익명 browserId(요청 동반).
 * /chat/stream 은 stateless 유지 — 프론트가 이 API로 저장/복원을 오케스트레이션한다.
 */
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  /** (browserId, personaId) 대화 get-or-create */
  @Post()
  create(@Body() body: CreateConversationDto) {
    return this.conversations.getOrCreate(body.browserId, body.personaId);
  }

  /** 소유자 대화 + 메시지(시간순) 복원. 없으면 404 → 프론트는 새 대화로 시작 */
  @Get()
  async get(@Query() query: GetConversationQueryDto) {
    const conversation = await this.conversations.getByOwner(query.browserId, query.personaId);
    if (!conversation) throw new NotFoundException('대화를 찾을 수 없습니다.');
    return conversation;
  }

  /** 메시지 append (소유권 불일치 시 404) */
  @Post(':id/messages')
  append(@Param('id') id: string, @Body() body: AppendMessageDto) {
    return this.conversations.appendMessage(id, body.browserId, body.role, body.content);
  }

  /** #18 메시지 열 전체 교체 — 편집/재생성 후속 turn truncate (소유권 불일치 시 404) */
  @Put(':id/messages')
  replace(@Param('id') id: string, @Body() body: ReplaceMessagesDto) {
    return this.conversations.replaceMessages(id, body.browserId, body.messages);
  }

  /** #15 임계 초과 시 과거 turn 자동 요약 (소유권 불일치 시 404) */
  @Post(':id/summarize')
  summarize(@Param('id') id: string, @Body() body: SummarizeDto) {
    return this.conversations.summarizeIfNeeded(id, body.browserId);
  }
}
