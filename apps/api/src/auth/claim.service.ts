import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 클레임 결과 — 재소유된 Character/Conversation 건수 */
export type ClaimResult = { characters: number; conversations: number };

/** $transaction이 콜백에 넘기는 tx 클라이언트(필요한 모델 접근만 추림) */
type ClaimTx = {
  character: { updateMany(args: unknown): Promise<{ count: number }> };
  conversation: { updateMany(args: unknown): Promise<{ count: number }> };
};

/**
 * #33 익명 데이터 클레임 — 로그인 시 browserId 소유물(Character/Conversation)을 userId로 재소유.
 * 정책(#27 결정3): userId 주입만(id 재발급 없음), browserId는 병행 보관(제거 안 함).
 * 멱등·충돌 안전은 where {userId: null} 필터로 구조 보장 — 이미 소유(자신이든 타 계정이든)된 row는
 * 매칭되지 않아 재실행/충돌 시 자동 skip(기존 계정 소유 우선). 단일 트랜잭션으로 원자 처리.
 */
@Injectable()
export class ClaimService {
  constructor(private readonly prisma: PrismaService) {}

  async claimAnonymousData(userId: string, browserId: string): Promise<ClaimResult> {
    return this.prisma.$transaction(async (tx: ClaimTx) => {
      const characters = await tx.character.updateMany({
        where: { browserId, userId: null },
        data: { userId },
      });
      const conversations = await tx.conversation.updateMany({
        where: { browserId, userId: null },
        data: { userId },
      });
      return { characters: characters.count, conversations: conversations.count };
    });
  }
}
