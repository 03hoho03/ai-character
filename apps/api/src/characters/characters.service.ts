import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreateCharacterRequest } from '@ai-character/shared';
import { PrismaService } from '../prisma/prisma.service';
import { type OwnerContext, ownerMatches, ownerWhere } from '../auth/owner';

/**
 * #16 캐릭터 영속화 서비스. #32 소유자 = OwnerContext(로그인 userId ?? 비로그인 browserId).
 * 소유권 모델: 불일치/부재는 존재를 노출하지 않고 404.
 * 읽기만 예외 — isPublic 캐릭터는 비소유자도 조회 가능(#16 목록+상세).
 */
@Injectable()
export class CharactersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 생성. 같은 id가 이미 있으면 소유자면 갱신(upsert), 타인이 점유 중이면 404로 거부.
   * id는 클라이언트 제공(usr-<uuid>)이라 충돌 가능 — 덮어쓰기 권한을 소유자로 제한한다.
   * 신규 생성 시 소유는 owner(로그인=userId / 비로그인=browserId)로 부여한다.
   */
  async create(dto: CreateCharacterRequest, owner: OwnerContext) {
    const existing = await this.prisma.character.findUnique({ where: { id: dto.id } });
    if (existing && !ownerMatches(existing, owner)) {
      throw new NotFoundException('캐릭터를 찾을 수 없습니다.');
    }
    const columns = this.toColumns(dto);
    if (existing) {
      return this.prisma.character.update({ where: { id: dto.id }, data: columns });
    }
    return this.prisma.character.create({
      data: { id: dto.id, ...ownerWhere(owner), ...columns } as Prisma.CharacterUncheckedCreateInput,
    });
  }

  /** 내 캐릭터 목록(최신순) — 로그인이면 userId, 비로그인이면 browserId 소유분 */
  async getOwned(owner: OwnerContext) {
    return this.prisma.character.findMany({
      where: ownerWhere(owner),
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * 공개 캐릭터 목록(최신순). #24 q=이름/한줄소개 검색, #25 category/tag, #26 등급. 모두 AND 결합.
   * isPublic:true 고정. #26 안전 기본값: includeAdult!=='true'면 contentRating='all'.
   */
  async listPublic(params: {
    q?: string;
    category?: string;
    tag?: string;
    includeAdult?: string;
  } = {}) {
    const keyword = params.q?.trim();
    const category = params.category?.trim();
    const tag = params.tag?.trim();
    const where: Prisma.CharacterWhereInput = { isPublic: true };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { tagline: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = category;
    if (tag) where.tags = { has: tag };
    if (params.includeAdult !== 'true') where.contentRating = 'all';
    return this.prisma.character.findMany({ where, orderBy: { updatedAt: 'desc' } });
  }

  /** 단건. 소유자거나 공개면 반환, 아니면 404(비공개 타인 것은 존재 비노출) */
  async getOne(id: string, owner: OwnerContext) {
    const character = await this.prisma.character.findUnique({ where: { id } });
    if (!character || (!ownerMatches(character, owner) && !character.isPublic)) {
      throw new NotFoundException('캐릭터를 찾을 수 없습니다.');
    }
    return character;
  }

  /** 부분 갱신(소유자만). 불일치/부재 → 404 */
  async update(id: string, owner: OwnerContext, patch: Prisma.CharacterUpdateInput) {
    await this.assertOwner(id, owner);
    return this.prisma.character.update({ where: { id }, data: patch });
  }

  /** 삭제(소유자만). 불일치/부재 → 404 */
  async remove(id: string, owner: OwnerContext) {
    await this.assertOwner(id, owner);
    await this.prisma.character.delete({ where: { id } });
  }

  /** 소유 일치 확인 — 부재/불일치면 존재를 노출하지 않고 404 */
  private async assertOwner(id: string, owner: OwnerContext) {
    const character = await this.prisma.character.findUnique({ where: { id } });
    if (!character || !ownerMatches(character, owner)) {
      throw new NotFoundException('캐릭터를 찾을 수 없습니다.');
    }
    return character;
  }

  /** 생성/갱신 공통 컬럼 매핑 — id/소유자는 제외. Json 필드는 그대로 운반 */
  private toColumns(dto: CreateCharacterRequest) {
    return {
      name: dto.name,
      tagline: dto.tagline,
      personality: dto.personality,
      speechStyle: dto.speechStyle,
      worldview: dto.worldview,
      greeting: dto.greeting,
      exampleDialogue: dto.exampleDialogue as unknown as Prisma.InputJsonValue,
      prohibitions: (dto.prohibitions ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      category: dto.category ?? null,
      tags: dto.tags ?? [],
      contentRating: dto.contentRating ?? 'all',
      isPublic: dto.isPublic ?? false,
    };
  }
}
