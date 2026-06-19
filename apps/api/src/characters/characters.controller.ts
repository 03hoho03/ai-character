import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { CharactersService } from './characters.service';
import {
  BrowserIdQueryDto,
  CreateCharacterDto,
  PublicSearchQueryDto,
  UpdateCharacterDto,
} from './dto/character.dto';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { resolveOwner } from '../auth/owner';

/** 쿠키 JWT가 OptionalJwtGuard로 주입하는 요청 신원 */
type OwnedRequest = Request & { user?: { userId: string } };

/**
 * #16 캐릭터 CRUD API. #32 소유자 = OwnerContext(로그인 userId(쿠키) ?? 비로그인 browserId).
 * 쓰기는 소유자만, 읽기는 소유자 전체 + 비소유자는 isPublic만(목록+상세).
 * 라우트 선언 순서 주의: 리터럴 'public'을 ':id'보다 먼저 둬야 가로채이지 않는다.
 */
@Controller('characters')
export class CharactersController {
  constructor(private readonly characters: CharactersService) {}

  /** 생성. 로그인이면 userId 소유, 비로그인이면 browserId 소유. 같은 id 재요청은 소유자면 upsert */
  @Post()
  @UseGuards(OptionalJwtGuard)
  create(@Body() body: CreateCharacterDto, @Req() req: OwnedRequest) {
    return this.characters.create(body, resolveOwner(req, body.browserId));
  }

  /** 내 캐릭터 목록(최신순) */
  @Get()
  @UseGuards(OptionalJwtGuard)
  getOwned(@Query() query: BrowserIdQueryDto, @Req() req: OwnedRequest) {
    return this.characters.getOwned(resolveOwner(req, query.browserId));
  }

  /** 공개 캐릭터 목록(최신순). #24 q 검색, #25 category/tag, #26 등급 필터. 소유 무관 — 가드 불필요 */
  @Get('public')
  listPublic(@Query() query: PublicSearchQueryDto) {
    return this.characters.listPublic(query);
  }

  /** 단건. 소유자거나 isPublic이면 200, 아니면 404 */
  @Get(':id')
  @UseGuards(OptionalJwtGuard)
  getOne(@Param('id') id: string, @Query() query: BrowserIdQueryDto, @Req() req: OwnedRequest) {
    return this.characters.getOne(id, resolveOwner(req, query.browserId));
  }

  /** 부분 갱신(소유자만). browserId는 폴백 소유 식별자라 갱신 데이터에서 제외 */
  @Patch(':id')
  @UseGuards(OptionalJwtGuard)
  update(@Param('id') id: string, @Body() body: UpdateCharacterDto, @Req() req: OwnedRequest) {
    const { browserId, ...patch } = body;
    return this.characters.update(
      id,
      resolveOwner(req, browserId),
      patch as unknown as Prisma.CharacterUpdateInput,
    );
  }

  /** 삭제(소유자만) */
  @Delete(':id')
  @UseGuards(OptionalJwtGuard)
  @HttpCode(204)
  remove(@Param('id') id: string, @Query() query: BrowserIdQueryDto, @Req() req: OwnedRequest) {
    return this.characters.remove(id, resolveOwner(req, query.browserId));
  }
}
