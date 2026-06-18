import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import type {
  CreateCharacterRequest,
  ExampleDialogueTurn,
  UpdateCharacterRequest,
} from '@ai-character/shared';

/** few-shot 예시 대화 1턴 — 중첩 검증용 */
class ExampleDialogueTurnDto implements ExampleDialogueTurn {
  @IsString()
  @IsNotEmpty()
  user!: string;

  @IsString()
  @IsNotEmpty()
  model!: string;
}

/** POST /characters 본문 — Persona(id 포함) + 소유자 + 공개 여부 */
export class CreateCharacterDto implements CreateCharacterRequest {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  browserId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  tagline!: string;

  @IsString()
  personality!: string;

  @IsString()
  speechStyle!: string;

  @IsString()
  worldview!: string;

  @IsString()
  greeting!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExampleDialogueTurnDto)
  exampleDialogue!: ExampleDialogueTurnDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prohibitions?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

/** PATCH /characters/:id 본문 — 소유자 인증 + 부분 갱신. id는 경로에서 받는다 */
export class UpdateCharacterDto implements UpdateCharacterRequest {
  @IsString()
  @IsNotEmpty()
  browserId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  personality?: string;

  @IsOptional()
  @IsString()
  speechStyle?: string;

  @IsOptional()
  @IsString()
  worldview?: string;

  @IsOptional()
  @IsString()
  greeting?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExampleDialogueTurnDto)
  exampleDialogue?: ExampleDialogueTurnDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prohibitions?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

/** browserId를 쿼리로 받는 읽기/삭제용 — GET /characters, GET/DELETE /characters/:id */
export class BrowserIdQueryDto {
  @IsString()
  @IsNotEmpty()
  browserId!: string;
}

/** #24 GET /characters/public 검색 쿼리 — q는 선택. 배열 등 비문자열은 거부(400) */
export class PublicSearchQueryDto {
  @IsOptional()
  @IsString()
  q?: string;
}
