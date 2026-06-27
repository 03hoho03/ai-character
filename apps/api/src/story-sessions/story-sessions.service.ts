import { Injectable, NotFoundException } from '@nestjs/common';
import type { StatValues } from '@ai-character/shared';
import { PrismaService } from '../prisma/prisma.service';
import { type OwnerContext, ownerMatches, ownerWhere } from '../auth/owner';

/**
 * #49 플레이 세션 영속 서비스(StorySession = Conversation의 스토리판).
 * 이번 범위는 **세션 영속만** — 생성(statValues 초기화) + 이어하기(소유검증) CRUD.
 * delta 적용(#50)·엔딩 평가(#51)·모델 호출·메시지 런타임은 범위 밖(미구현).
 * 소유자 = OwnerContext(로그인 userId(쿠키) ?? 비로그인 browserId). 불일치/부재는 존재 비노출 404.
 */
@Injectable()
export class StorySessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 세션 생성. 해당 StartSetting의 정규화 Stat[]을 읽어 statValues를 Stat.initialValue로 초기화한다
   * (예 {호감도:0, 신뢰:10}). endedWith는 스키마 기본 null(진행중). 소유는 ownerWhere만 set.
   * startSetting 부재면 404.
   */
  async create(owner: OwnerContext, storyId: string, startSettingId: string) {
    const startSetting = await this.prisma.startSetting.findUnique({
      where: { id: startSettingId },
      include: { stats: true },
    });
    if (!startSetting || startSetting.storyId !== storyId) {
      throw new NotFoundException('시작 설정을 찾을 수 없습니다.');
    }

    // 정규화 Stat[] → Json statValues 초기화(스탯명 → 초기값). #50 delta 전까지 불변.
    const statValues: StatValues = {};
    for (const stat of startSetting.stats) statValues[stat.name] = stat.initialValue;

    return this.prisma.storySession.create({
      data: { ...ownerWhere(owner), storyId, startSettingId, statValues },
    });
  }

  /**
   * 이어하기 — 소유자 세션(현재 statValues/endedWith) 반환. 소유 불일치/부재는 존재 비노출 404.
   * (로그인=userId / 비로그인=browserId 비교, ownerMatches)
   */
  async getByOwner(sessionId: string, owner: OwnerContext) {
    const session = await this.prisma.storySession.findUnique({ where: { id: sessionId } });
    if (!session || !ownerMatches(session, owner)) {
      throw new NotFoundException('세션을 찾을 수 없습니다.');
    }
    return session;
  }
}
