import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { StorySessionsService } from './story-sessions.service';
import { CreateStorySessionDto, GetStorySessionQueryDto } from './dto/story-session.dto';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { resolveOwner } from '../auth/owner';

/** 쿠키 JWT가 OptionalJwtGuard로 주입하는 요청 신원 */
type OwnedRequest = Request & { user?: { userId: string } };

/**
 * #49 플레이 세션 영속 API(StorySession = Conversation의 스토리판).
 * #40 패턴 복제 — 신원은 쿠키 JWT(OptionalJwtGuard)에서만, body/query userId 불신뢰·browserId만 폴백(#23).
 * 이번 범위는 세션 생성/이어하기뿐 — delta(#50)·엔딩(#51)·모델 호출 없음.
 */
@Controller('story-sessions')
export class StorySessionsController {
  constructor(private readonly sessions: StorySessionsService) {}

  /** 세션 생성 — StartSetting.stats의 initialValue로 statValues 초기화. 로그인=userId / 비로그인=browserId 소유 */
  @Post()
  @UseGuards(OptionalJwtGuard)
  create(@Body() body: CreateStorySessionDto, @Req() req: OwnedRequest) {
    return this.sessions.create(
      resolveOwner(req, body.browserId),
      body.storyId,
      body.startSettingId,
    );
  }

  /** 이어하기 — 소유자 세션(현재 statValues/endedWith) 반환. 소유 불일치/부재 404 */
  @Get(':id')
  @UseGuards(OptionalJwtGuard)
  get(@Param('id') id: string, @Query() query: GetStorySessionQueryDto, @Req() req: OwnedRequest) {
    return this.sessions.getByOwner(id, resolveOwner(req, query.browserId));
  }
}
