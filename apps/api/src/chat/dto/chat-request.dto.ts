import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import type { ChatMessage, ChatRequest } from '@ai-character/shared';

export class ChatMessageDto implements ChatMessage {
  @IsIn(['user', 'model'])
  role!: 'user' | 'model';

  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class ChatRequestDto implements ChatRequest {
  /** #23 신뢰 소스 조회 키. 클라가 systemInstruction을 보내도 whitelist가 strip → 서버 재조립 */
  @IsString()
  @IsNotEmpty()
  personaId!: string;

  /** #23 usr-* 소유 확인용 익명 browserId */
  @IsString()
  @IsNotEmpty()
  browserId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  /** #15 과거 대화 요약 — 서버가 systemInstruction에 접합 */
  @IsOptional()
  @IsString()
  conversationSummary?: string;
}
