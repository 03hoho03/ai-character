import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import type {
  ContentRating,
  CreateCharacterRequest,
  ExampleDialogueTurn,
  UpdateCharacterRequest,
} from '@ai-character/shared';

/** #26 콘텐츠 등급 허용값 — DTO @IsIn 단일 출처 */
const CONTENT_RATINGS: ContentRating[] = ['all', 'adult'];

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
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(CONTENT_RATINGS)
  contentRating?: ContentRating;

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
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(CONTENT_RATINGS)
  contentRating?: ContentRating;

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

/**
 * #24/#25 GET /characters/public 검색·필터 쿼리. 모두 선택, 단일 문자열.
 * q=이름/한줄소개 검색, category=등호, tag=단일 태그(tags has). 배열 등 비문자열은 거부(400).
 */
export class PublicSearchQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  /**
   * #26 성인 등급 포함 여부 — 기본(미지정/false)은 일반(all)만 노출, 'true'면 성인 포함.
   * 쿼리는 문자열이라 'true'/'false'로 받고 서비스에서 판정. 그 외 값은 거부(400).
   */
  @IsOptional()
  @IsIn(['true', 'false'])
  includeAdult?: string;
}
