import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { CreateStorySessionRequest } from '@ai-character/shared';

/** POST /story-sessions 본문 — 세션 생성. browserId는 비로그인 폴백(로그인이면 쿠키 userId 우선, #23). */
export class CreateStorySessionDto implements CreateStorySessionRequest {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  browserId?: string;

  @IsString()
  @IsNotEmpty()
  storyId!: string;

  @IsString()
  @IsNotEmpty()
  startSettingId!: string;
}

/** GET /story-sessions/:id 쿼리 — 소유 식별자만(비로그인 폴백 browserId, 로그인이면 쿠키 userId 우선). */
export class GetStorySessionQueryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  browserId?: string;
}
