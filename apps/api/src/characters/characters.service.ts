import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreateCharacterRequest } from '@ai-character/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * #16 캐릭터 영속화 서비스. 소유자 = 익명 browserId.
 * 소유권 모델은 conversations(#14)와 동일: 불일치/부재는 존재를 노출하지 않고 404.
 * 읽기만 예외 — isPublic 캐릭터는 비소유자도 조회 가능(#16 목록+상세).
 */
@Injectable()
export class CharactersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 생성. 같은 id가 이미 있으면 소유자면 갱신(upsert), 타인이 점유 중이면 404로 거부.
   * id는 클라이언트 제공(usr-<uuid>)이라 충돌 가능 — 덮어쓰기 권한을 소유자로 제한한다.
   */
  async create(dto: CreateCharacterRequest) {
    const existing = await this.prisma.character.findUnique({ where: { id: dto.id } });
    if (existing && existing.browserId !== dto.browserId) {
      throw new NotFoundException('캐릭터를 찾을 수 없습니다.');
    }
    const columns = this.toColumns(dto);
    if (existing) {
      return this.prisma.character.update({ where: { id: dto.id }, data: columns });
    }
    return this.prisma.character.create({
      data: { id: dto.id, browserId: dto.browserId, ...columns },
    });
  }

  /** 내 캐릭터 목록(최신순) */
  async getOwned(browserId: string) {
    return this.prisma.character.findMany({
      where: { browserId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** 공개 캐릭터 목록(최신순) */
  async listPublic() {
    return this.prisma.character.findMany({
      where: { isPublic: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** 단건. 소유자거나 공개면 반환, 아니면 404(비공개 타인 것은 존재 비노출) */
  async getOne(id: string, browserId: string) {
    const character = await this.prisma.character.findUnique({ where: { id } });
    if (!character || (character.browserId !== browserId && !character.isPublic)) {
      throw new NotFoundException('캐릭터를 찾을 수 없습니다.');
    }
    return character;
  }

  /** 부분 갱신(소유자만). 불일치/부재 → 404 */
  async update(id: string, browserId: string, patch: Prisma.CharacterUpdateInput) {
    await this.assertOwner(id, browserId);
    return this.prisma.character.update({ where: { id }, data: patch });
  }

  /** 삭제(소유자만). 불일치/부재 → 404 */
  async remove(id: string, browserId: string) {
    await this.assertOwner(id, browserId);
    await this.prisma.character.delete({ where: { id } });
  }

  /** 소유 browserId 일치 확인 — 부재/불일치면 존재를 노출하지 않고 404 */
  private async assertOwner(id: string, browserId: string) {
    const character = await this.prisma.character.findUnique({ where: { id } });
    if (!character || character.browserId !== browserId) {
      throw new NotFoundException('캐릭터를 찾을 수 없습니다.');
    }
    return character;
  }

  /** 생성/갱신 공통 컬럼 매핑 — id/browserId(소유권)는 제외. Json 필드는 그대로 운반 */
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
      isPublic: dto.isPublic ?? false,
    };
  }
}
