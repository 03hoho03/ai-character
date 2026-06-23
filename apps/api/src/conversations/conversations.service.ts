import { Injectable, NotFoundException } from '@nestjs/common';
import {
  SUMMARY_RECENT_TURNS,
  SUMMARY_TURN_THRESHOLD,
  type ChatMessage,
  type SummaryResult,
} from '@ai-character/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { type OwnerContext, ownerMatches, ownerWhere } from '../auth/owner';

/**
 * #14 대화/메시지 영속화 서비스.
 * #40 소유자 = OwnerContext(로그인 userId(쿠키) ?? 비로그인 browserId). 캐릭터당 대화 1개는
 * 로그인=(userId,personaId)/비로그인=(browserId,personaId) 유니크(#34 토대). 소유검증은 ownerMatches.
 */
@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
  ) {}

  /** owner별 (소유키, personaId) 복합 unique where — 로그인=userId_personaId / 비로그인=browserId_personaId */
  private ownerPersonaWhere(owner: OwnerContext, personaId: string) {
    return 'userId' in owner
      ? { userId_personaId: { userId: owner.userId, personaId } }
      : { browserId_personaId: { browserId: owner.browserId, personaId } };
  }

  /** (owner, personaId) 대화를 get-or-create. 생성 시 소유는 ownerWhere만 set(로그인=userId/비로그인=browserId) */
  async getOrCreate(owner: OwnerContext, personaId: string) {
    const existing = await this.prisma.conversation.findUnique({
      where: this.ownerPersonaWhere(owner, personaId),
    });
    if (existing) return existing;
    return this.prisma.conversation.create({ data: { ...ownerWhere(owner), personaId } });
  }

  /** 소유자 대화 + 메시지(시간순). 없으면 null */
  async getByOwner(owner: OwnerContext, personaId: string) {
    return this.prisma.conversation.findUnique({
      where: this.ownerPersonaWhere(owner, personaId),
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /**
   * 메시지 append. 소유 불일치/부재면 존재를 노출하지 않고 404(ownerMatches: 로그인=userId/비로그인=browserId).
   * nested create로 메시지 생성과 updatedAt 갱신을 한 번에 처리한다.
   */
  async appendMessage(
    conversationId: string,
    owner: OwnerContext,
    role: ChatMessage['role'],
    content: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation || !ownerMatches(conversation, owner)) {
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

  /**
   * #18 메시지 열 전체 교체 — 편집/재생성의 후속 turn truncate를 한 번에 달성.
   * 트랜잭션으로 기존 메시지를 비우고 주어진 배열을 순서대로 재삽입한다.
   * createdAt을 i만큼 증가시켜 restore(createdAt asc)가 입력 순서를 그대로 보존하게 한다.
   */
  async replaceMessages(
    conversationId: string,
    owner: OwnerContext,
    messages: ChatMessage[],
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation || !ownerMatches(conversation, owner)) {
      throw new NotFoundException('대화를 찾을 수 없습니다.');
    }

    const base = Date.now();
    return this.prisma.$transaction(async (tx) => {
      await tx.message.deleteMany({ where: { conversationId } });
      return tx.conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
          messages: {
            create: messages.map((m, i) => ({
              role: m.role,
              content: m.content,
              createdAt: new Date(base + i),
            })),
          },
        },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    });
  }

  /**
   * #15 임계 초과 시 과거 turn 자동 요약(장기기억). 소유자 가드(불일치 404).
   * 최근 N turn은 원문 유지, 그 앞 turn을 직전 요약과 함께 Gemini로 압축해 영속한다.
   * 임계 이하면 no-op으로 현재 요약 상태를 그대로 반환한다.
   */
  async summarizeIfNeeded(conversationId: string, owner: OwnerContext): Promise<SummaryResult> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation || !ownerMatches(conversation, owner)) {
      throw new NotFoundException('대화를 찾을 수 없습니다.');
    }

    const messages = conversation.messages;
    if (messages.length <= SUMMARY_TURN_THRESHOLD) {
      return {
        summary: conversation.summary ?? null,
        summarizedCount: conversation.summarizedCount ?? 0,
      };
    }

    const older = messages.slice(0, messages.length - SUMMARY_RECENT_TURNS);
    const summary = await this.chat.summarize(
      conversation.summary ?? null,
      older.map((m) => ({ role: m.role as ChatMessage['role'], content: m.content })),
    );
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { summary, summarizedCount: older.length },
    });
    return { summary, summarizedCount: older.length };
  }
}
