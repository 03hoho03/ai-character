import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import type {
  ContentRating,
  CreateStoryRequest,
  DevelopmentExample,
  EndingDef,
  EndingOp,
  EndingRule,
  Shortcut,
  StartSettingDef,
  StatDef,
  StoryVisibility,
  UpdateStoryRequest,
} from '@ai-character/shared';

/** #44 허용값 단일 출처 — DTO @IsIn */
const CONTENT_RATINGS: ContentRating[] = ['all', 'adult'];
const VISIBILITIES: StoryVisibility[] = ['public', 'private', 'link'];
const ENDING_OPS: EndingOp[] = ['>=', '<=', '==', '>', '<'];

/** 전개 예시 1쌍 — 중첩 검증 */
class DevelopmentExampleDto implements DevelopmentExample {
  @IsString()
  @IsNotEmpty()
  input!: string;

  @IsString()
  @IsNotEmpty()
  output!: string;
}

/** 단축어 1개 — 중첩 검증 */
class ShortcutDto implements Shortcut {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  command!: string;
}

/** 스탯 정의 1개 — 중첩 검증 */
class StatDefDto implements StatDef {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  initialValue!: number;

  @IsInt()
  minValue!: number;

  @IsInt()
  maxValue!: number;
}

/** 엔딩 조건 1절 `스탯 op 값` — 중첩 검증. op는 허용 enum만(신뢰경계) */
class EndingRuleDto implements EndingRule {
  @IsString()
  @IsNotEmpty()
  stat!: string;

  @IsIn(ENDING_OPS)
  op!: EndingOp;

  @IsNumber()
  value!: number;
}

/** 엔딩 정의 1개 — condition은 [{stat,op,value}] AND 규칙 */
class EndingDefDto implements EndingDef {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EndingRuleDto)
  condition!: EndingRuleDto[];

  @IsString()
  @IsNotEmpty()
  resultText!: string;

  @IsOptional()
  @IsInt()
  priority?: number;
}

/** 시작 설정 1개(분기 시나리오 단위) — 스탯/엔딩 중첩 */
class StartSettingDefDto implements StartSettingDef {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  prologue!: string;

  @IsString()
  @IsNotEmpty()
  startSituation!: string;

  @IsOptional()
  @IsString()
  playGuide?: string;

  @IsArray()
  @IsString({ each: true })
  suggestedReplies!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatDefDto)
  stats!: StatDefDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EndingDefDto)
  endings!: EndingDefDto[];
}

/**
 * POST /stories 본문(#44) — Story 본체 + 중첩 StartSetting/Stat/Ending.
 * id는 서버가 cuid로 부여(클라 미제공). userId는 받지 않는다(쿠키만 신뢰, #23).
 */
export class CreateStoryDto implements CreateStoryRequest {
  // #44 비로그인 폴백 소유 식별자(로그인이면 쿠키 userId 우선, #23).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  browserId?: string;

  @IsOptional()
  @IsString()
  profileImage?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  tagline!: string;

  @IsOptional()
  @IsString()
  promptTemplateId?: string;

  @IsString()
  storyInfo!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DevelopmentExampleDto)
  developmentExamples!: DevelopmentExampleDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShortcutDto)
  shortcuts!: ShortcutDto[];

  @IsOptional()
  @IsIn(CONTENT_RATINGS)
  contentRating?: ContentRating;

  @IsOptional()
  @IsIn(VISIBILITIES)
  visibility?: StoryVisibility;

  @IsOptional()
  @IsBoolean()
  commentsClosed?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StartSettingDefDto)
  startSettings!: StartSettingDefDto[];
}

/**
 * PATCH /stories/:id 본문(#44) — 부분 갱신(소유자만). id는 경로에서 받는다.
 * contentRating은 의도적으로 필드 부재 → ValidationPipe(whitelist)가 strip → 불변 집행(#44 등록 탭).
 * startSettings를 보내면 자식 전체 교체 갱신(서비스가 deleteMany+create).
 */
export class UpdateStoryDto implements UpdateStoryRequest {
  // #44 비로그인 폴백 소유 식별자(로그인이면 쿠키 userId 우선, #23).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  browserId?: string;

  @IsOptional()
  @IsString()
  profileImage?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  promptTemplateId?: string;

  @IsOptional()
  @IsString()
  storyInfo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DevelopmentExampleDto)
  developmentExamples?: DevelopmentExampleDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShortcutDto)
  shortcuts?: ShortcutDto[];

  @IsOptional()
  @IsIn(VISIBILITIES)
  visibility?: StoryVisibility;

  @IsOptional()
  @IsBoolean()
  commentsClosed?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StartSettingDefDto)
  startSettings?: StartSettingDefDto[];
}

/** GET /stories · GET/DELETE /stories/:id 쿼리 — 소유 식별자만(로그인이면 쿠키 userId 우선, optional). */
export class StoryOwnerQueryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  browserId?: string;
}
