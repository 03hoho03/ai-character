import { Injectable, NotFoundException } from '@nestjs/common';
import type { ChatMessage } from '@ai-character/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * #14 대화/메시지 영속화 서비스.
 * 소유자 = 익명 browserId. 캐릭터당 대화 1개 = (browserId, personaId) 유니크.
 */
@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** (browserId, personaId) 대화를 get-or-create */
  async getOrCreate(browserId: string, personaId: string) {
    const where = { browserId_personaId: { browserId, personaId } };
    const existing = await this.prisma.conversation.findUnique({ where });
    if (existing) return existing;
    return this.prisma.conversation.create({ data: { browserId, personaId } });
  }

  /** 소유자 대화 + 메시지(시간순). 없으면 null */
  async getByOwner(browserId: string, personaId: string) {
    return this.prisma.conversation.findUnique({
      where: { browserId_personaId: { browserId, personaId } },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /**
   * 메시지 append. 소유 browserId 불일치/부재면 존재를 노출하지 않고 404.
   * nested create로 메시지 생성과 updatedAt 갱신을 한 번에 처리한다.
   */
  async appendMessage(
    conversationId: string,
    browserId: string,
    role: ChatMessage['role'],
    content: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation || conversation.browserId !== browserId) {
      throw new NotFoundException('대화를 찾을 수 없습니다.');
    }

    // updatedAt를 명시적으로 갱신 — 관계-only nested write만으로는 부모 row가
    // UPDATE되지 않아 @updatedAt이 자동 갱신되지 않는다.
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date(), messages: { create: { role, content } } },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return updated.messages[0];
  }
}
