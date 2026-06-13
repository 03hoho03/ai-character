import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import type {
  AppendMessageRequest,
  ChatMessage,
  CreateConversationRequest,
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
