import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import type {
  AppendMessageRequest,
  ChatMessage,
  CreateConversationRequest,
  ReplaceMessagesRequest,
  SummarizeRequest,
} from '@ai-character/shared';

/** POST /conversations 본문 */
export class CreateConversationDto implements CreateConversationRequest {
  @IsString()
  @IsNotEmpty()
  browserId!: string;

  @IsString()
  @IsNotEmpty()
  personaId!: string;
}

/** GET /conversations 쿼리 */
export class GetConversationQueryDto {
  @IsString()
  @IsNotEmpty()
  browserId!: string;

  @IsString()
  @IsNotEmpty()
  personaId!: string;
}

/** POST /conversations/:id/messages 본문 */
export class AppendMessageDto implements AppendMessageRequest {
  @IsString()
  @IsNotEmpty()
  browserId!: string;

  @IsIn(['user', 'model'])
  role!: ChatMessage['role'];

  @IsString()
  @IsNotEmpty()
  content!: string;
}

/** 교체용 메시지 1건 — 중첩 검증 */
class ChatMessageDto implements ChatMessage {
  @IsIn(['user', 'model'])
  role!: ChatMessage['role'];

  @IsString()
  @IsNotEmpty()
  content!: string;
}

/** PUT /conversations/:id/messages 본문 (#18) — 메시지 열 전체 교체 */
export class ReplaceMessagesDto implements ReplaceMessagesRequest {
  @IsString()
  @IsNotEmpty()
  browserId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];
}

/** POST /conversations/:id/summarize 본문 (#15) */
export class SummarizeDto implements SummarizeRequest {
  @IsString()
  @IsNotEmpty()
  browserId!: string;
}
