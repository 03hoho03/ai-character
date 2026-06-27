import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateStoryRequest,
  StartSettingDef,
  UpdateStoryRequest,
} from '@ai-character/shared';
import { PrismaService } from '../prisma/prisma.service';
import { type OwnerContext, ownerMatches, ownerWhere } from '../auth/owner';

/**
 * #44 스토리 제작 영속화 서비스. 소유자 = OwnerContext(로그인 userId ?? 비로그인 browserId, #23).
 * 소유권 모델(characters 선례): 불일치/부재는 존재를 노출하지 않고 404.
 * 읽기만 예외 — 공개(visibility public/link) 스토리는 비소유자도 단건 조회 가능.
 * contentRating 불변(#44 등록 탭): 생성 시에만 설정, PATCH DTO에 필드 부재 → 갱신 불가.
 */
@Injectable()
export class StoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 중첩 생성(Story + StartSetting[] + 각 Stat[]/Ending[]). Prisma nested write로 단일 트랜잭션.
   * id는 서버가 cuid로 부여. 소유는 owner(로그인=userId / 비로그인=browserId)로 부여한다.
   */
  async create(dto: CreateStoryRequest, owner: OwnerContext) {
    const data = {
      ...ownerWhere(owner),
      profileImage: dto.profileImage ?? null,
      name: dto.name,
      tagline: dto.tagline,
      promptTemplateId: dto.promptTemplateId ?? null,
      storyInfo: dto.storyInfo,
      developmentExamples: dto.developmentExamples as unknown as Prisma.InputJsonValue,
      shortcuts: dto.shortcuts as unknown as Prisma.InputJsonValue,
      contentRating: dto.contentRating ?? 'all',
      visibility: dto.visibility ?? 'private',
      commentsClosed: dto.commentsClosed ?? false,
      startSettings: { create: dto.startSettings.map(toStartSettingCreate) },
    } as unknown as Prisma.StoryUncheckedCreateInput;

    return this.prisma.story.create({
      data,
      include: STORY_INCLUDE,
    });
  }

  /** 내 스토리 목록(최신순) — 로그인이면 userId, 비로그인이면 browserId 소유분 */
  async getOwned(owner: OwnerContext) {
    return this.prisma.story.findMany({
      where: ownerWhere(owner),
      orderBy: { updatedAt: 'desc' },
      include: STORY_INCLUDE,
    });
  }

  /**
   * 단건. 소유자면 항상 반환. 비소유자는 visibility !== 'private'일 때만(즉 public/link).
   * link는 설계상 id가 곧 공유링크 → 별도 토큰 없이 직접 id 조회 허용(public과 동일 취급).
   * private 타인 것은 존재를 노출하지 않고 404.
   */
  async getOne(id: string, owner: OwnerContext) {
    const story = await this.prisma.story.findUnique({ where: { id }, include: STORY_INCLUDE });
    if (!story || (!ownerMatches(story, owner) && story.visibility === 'private')) {
      throw new NotFoundException('스토리를 찾을 수 없습니다.');
    }
    return story;
  }

  /**
   * 부분 갱신(소유자만). contentRating은 DTO에서 strip되어 patch에 없으므로 불변 집행.
   * startSettings가 오면 자식(StartSetting/Stat/Ending) 전체 교체 — deleteMany 후 재생성을
   * 단일 트랜잭션으로 묶어 부분 적용을 막는다.
   */
  async update(id: string, owner: OwnerContext, patch: UpdateStoryRequest) {
    await this.assertOwner(id, owner);
    const { startSettings, browserId: _ignored, ...scalar } = patch;

    const data: Prisma.StoryUpdateInput = {};
    if (scalar.profileImage !== undefined) data.profileImage = scalar.profileImage;
    if (scalar.name !== undefined) data.name = scalar.name;
    if (scalar.tagline !== undefined) data.tagline = scalar.tagline;
    if (scalar.promptTemplateId !== undefined) data.promptTemplateId = scalar.promptTemplateId;
    if (scalar.storyInfo !== undefined) data.storyInfo = scalar.storyInfo;
    if (scalar.developmentExamples !== undefined)
      data.developmentExamples = scalar.developmentExamples as unknown as Prisma.InputJsonValue;
    if (scalar.shortcuts !== undefined)
      data.shortcuts = scalar.shortcuts as unknown as Prisma.InputJsonValue;
    if (scalar.visibility !== undefined) data.visibility = scalar.visibility;
    if (scalar.commentsClosed !== undefined) data.commentsClosed = scalar.commentsClosed;

    if (startSettings === undefined) {
      return this.prisma.story.update({ where: { id }, data, include: STORY_INCLUDE });
    }

    // 자식 교체 갱신: 기존 StartSetting 삭제(cascade로 Stat/Ending 동반) 후 재생성 — 원자적으로.
    return this.prisma.$transaction(async (tx) => {
      await tx.startSetting.deleteMany({ where: { storyId: id } });
      return tx.story.update({
        where: { id },
        data: { ...data, startSettings: { create: startSettings.map(toStartSettingCreate) } },
        include: STORY_INCLUDE,
      });
    });
  }

  /** 삭제(소유자만). 불일치/부재 → 404. 자식은 cascade(onDelete: Cascade) */
  async remove(id: string, owner: OwnerContext) {
    await this.assertOwner(id, owner);
    await this.prisma.story.delete({ where: { id } });
  }

  /** 소유 일치 확인 — 부재/불일치면 존재를 노출하지 않고 404 */
  private async assertOwner(id: string, owner: OwnerContext) {
    const story = await this.prisma.story.findUnique({ where: { id } });
    if (!story || !ownerMatches(story, owner)) {
      throw new NotFoundException('스토리를 찾을 수 없습니다.');
    }
    return story;
  }
}

/** 단건/목록 응답에 중첩 자식을 포함하는 include 트리 */
const STORY_INCLUDE = {
  startSettings: { include: { stats: true, endings: true } },
} as const;

/** StartSettingDef → Prisma nested create 입력(스탯/엔딩 동반 생성) */
function toStartSettingCreate(ss: StartSettingDef) {
  return {
    name: ss.name,
    prologue: ss.prologue,
    startSituation: ss.startSituation,
    playGuide: ss.playGuide ?? null,
    suggestedReplies: ss.suggestedReplies as unknown as Prisma.InputJsonValue,
    stats: {
      create: ss.stats.map((s) => ({
        name: s.name,
        initialValue: s.initialValue,
        minValue: s.minValue,
        maxValue: s.maxValue,
      })),
    },
    endings: {
      create: ss.endings.map((e) => ({
        name: e.name,
        condition: e.condition as unknown as Prisma.InputJsonValue,
        resultText: e.resultText,
        priority: e.priority ?? 0,
      })),
    },
  };
}
