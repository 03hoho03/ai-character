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
import type { Request } from 'express';
import { StoriesService } from './stories.service';
import { CreateStoryDto, StoryOwnerQueryDto, UpdateStoryDto } from './dto/story.dto';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { resolveOwner } from '../auth/owner';

/** 쿠키 JWT가 OptionalJwtGuard로 주입하는 요청 신원 */
type OwnedRequest = Request & { user?: { userId: string } };

/**
 * #44 스토리 제작 CRUD API. 소유자 = OwnerContext(로그인 userId(쿠키) ?? 비로그인 browserId, #23).
 * 신원은 쿠키 JWT(OptionalJwtGuard)에서만 — body/query의 userId는 신뢰하지 않고 browserId만 폴백.
 * 쓰기는 소유자만, 단건 읽기는 소유자 + 공개(public/link). 소유 불일치는 404로 존재 비노출.
 */
@Controller('stories')
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  /** 중첩 생성. 로그인이면 userId 소유, 비로그인이면 browserId 소유 */
  @Post()
  @UseGuards(OptionalJwtGuard)
  create(@Body() body: CreateStoryDto, @Req() req: OwnedRequest) {
    return this.stories.create(body, resolveOwner(req, body.browserId));
  }

  /** 내 스토리 목록(최신순) */
  @Get()
  @UseGuards(OptionalJwtGuard)
  getOwned(@Query() query: StoryOwnerQueryDto, @Req() req: OwnedRequest) {
    return this.stories.getOwned(resolveOwner(req, query.browserId));
  }

  /** 단건. 소유자거나 공개(public/link)면 200, 아니면 404 */
  @Get(':id')
  @UseGuards(OptionalJwtGuard)
  getOne(@Param('id') id: string, @Query() query: StoryOwnerQueryDto, @Req() req: OwnedRequest) {
    return this.stories.getOne(id, resolveOwner(req, query.browserId));
  }

  /** 부분 갱신(소유자만). browserId는 폴백 소유 식별자라 갱신 데이터에서 제외. contentRating은 DTO에서 strip(불변) */
  @Patch(':id')
  @UseGuards(OptionalJwtGuard)
  update(@Param('id') id: string, @Body() body: UpdateStoryDto, @Req() req: OwnedRequest) {
    return this.stories.update(id, resolveOwner(req, body.browserId), body);
  }

  /** 삭제(소유자만, cascade로 자식 동반 삭제) */
  @Delete(':id')
  @UseGuards(OptionalJwtGuard)
  @HttpCode(204)
  remove(@Param('id') id: string, @Query() query: StoryOwnerQueryDto, @Req() req: OwnedRequest) {
    return this.stories.remove(id, resolveOwner(req, query.browserId));
  }
}
