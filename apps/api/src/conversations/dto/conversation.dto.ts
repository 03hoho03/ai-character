import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import type {
  AppendMessageRequest,
  ChatMessage,
  CreateConversationRequest,
  ReplaceMessagesRequest,
  SummarizeRequest,
} from '@ai-character/shared';

/** POST /conversations 본문 */
export class CreateConversationDto implements CreateConversationRequest {
  // #40 로그인이면 쿠키 userId가 우선하므로 optional(비로그인 폴백 식별자, #23).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  browserId?: string;

  @IsString()
  @IsNotEmpty()
  personaId!: string;
}

/** GET /conversations 쿼리 */
export class GetConversationQueryDto {
  // #40 로그인이면 쿠키 userId가 우선하므로 optional(비로그인 폴백 식별자, #23).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  browserId?: string;

  @IsString()
  @IsNotEmpty()
  personaId!: string;
}

/** POST /conversations/:id/messages 본문 */
export class AppendMessageDto implements AppendMessageRequest {
  // #40 로그인이면 쿠키 userId가 우선하므로 optional(비로그인 폴백 식별자, #23).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  browserId?: string;

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
  // #40 로그인이면 쿠키 userId가 우선하므로 optional(비로그인 폴백 식별자, #23).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  browserId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];
}

/** POST /conversations/:id/summarize 본문 (#15) */
export class SummarizeDto implements SummarizeRequest {
  // #40 로그인이면 쿠키 userId가 우선하므로 optional(비로그인 폴백 식별자, #23).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  browserId?: string;
}
