import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConversationsService } from './conversations.service';
import {
  AppendMessageDto,
  CreateConversationDto,
  GetConversationQueryDto,
  ReplaceMessagesDto,
  SummarizeDto,
} from './dto/conversation.dto';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { resolveOwner } from '../auth/owner';

/** 쿠키 JWT가 OptionalJwtGuard로 주입하는 요청 신원 */
type OwnedRequest = Request & { user?: { userId: string } };

/**
 * #14 대화 영속화 API. #40 소유자 = OwnerContext(로그인 userId(쿠키) ?? 비로그인 browserId).
 * 신원은 쿠키 JWT(OptionalJwtGuard)에서만 — body/query의 userId는 신뢰하지 않고 browserId만 폴백(#23).
 * /chat/stream 은 stateless 유지 — 프론트가 이 API로 저장/복원을 오케스트레이션한다.
 */
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  /** (owner, personaId) 대화 get-or-create. 로그인이면 userId 소유, 비로그인이면 browserId 소유 */
  @Post()
  @UseGuards(OptionalJwtGuard)
  create(@Body() body: CreateConversationDto, @Req() req: OwnedRequest) {
    return this.conversations.getOrCreate(resolveOwner(req, body.browserId), body.personaId);
  }

  /** 소유자 대화 + 메시지(시간순) 복원. 없으면 404 → 프론트는 새 대화로 시작 */
  @Get()
  @UseGuards(OptionalJwtGuard)
  async get(@Query() query: GetConversationQueryDto, @Req() req: OwnedRequest) {
    const owner = resolveOwner(req, query.browserId);
    const conversation = await this.conversations.getByOwner(owner, query.personaId);
    if (!conversation) throw new NotFoundException('대화를 찾을 수 없습니다.');
    return conversation;
  }

  /** 메시지 append (소유권 불일치 시 404) */
  @Post(':id/messages')
  @UseGuards(OptionalJwtGuard)
  append(@Param('id') id: string, @Body() body: AppendMessageDto, @Req() req: OwnedRequest) {
    return this.conversations.appendMessage(id, resolveOwner(req, body.browserId), body.role, body.content);
  }

  /** #18 메시지 열 전체 교체 — 편집/재생성 후속 turn truncate (소유권 불일치 시 404) */
  @Put(':id/messages')
  @UseGuards(OptionalJwtGuard)
  replace(@Param('id') id: string, @Body() body: ReplaceMessagesDto, @Req() req: OwnedRequest) {
    return this.conversations.replaceMessages(id, resolveOwner(req, body.browserId), body.messages);
  }

  /** #15 임계 초과 시 과거 turn 자동 요약 (소유권 불일치 시 404) */
  @Post(':id/summarize')
  @UseGuards(OptionalJwtGuard)
  summarize(@Param('id') id: string, @Body() body: SummarizeDto, @Req() req: OwnedRequest) {
    return this.conversations.summarizeIfNeeded(id, resolveOwner(req, body.browserId));
  }
}
