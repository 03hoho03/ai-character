import { ClaimService } from '../src/auth/claim.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * #33 클레임 서비스 단위 테스트 — 멱등·충돌skip·browserId보존을 트랜잭션 내 updateMany where/data로 박제.
 * 멱등/충돌은 where {userId:null} 필터로 구조 보장(이미 소유 row는 매칭 안 됨), browserId는 data에서 건드리지 않는다.
 */
describe('ClaimService (#33)', () => {
  const charUpdateMany = jest.fn();
  const convUpdateMany = jest.fn();
  const transaction = jest.fn();

  const prisma = {
    character: { updateMany: charUpdateMany },
    conversation: { updateMany: convUpdateMany },
    $transaction: transaction,
  } as unknown as PrismaService;

  let service: ClaimService;

  beforeEach(() => {
    charUpdateMany.mockReset();
    convUpdateMany.mockReset();
    transaction.mockReset();
    // $transaction(cb)는 콜백에 tx 클라이언트를 넘겨 실행한다 — 동일 stub을 tx로 전달.
    transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma));
    service = new ClaimService(prisma);
  });

  it('browserId 일치 & userId null인 Character/Conversation에 userId 주입, 건수 반환', async () => {
    charUpdateMany.mockResolvedValue({ count: 3 });
    convUpdateMany.mockResolvedValue({ count: 2 });

    const result = await service.claimAnonymousData('u1', 'b1');

    expect(result).toEqual({ characters: 3, conversations: 2 });
    expect(transaction).toHaveBeenCalledTimes(1); // 원자성 — 한 트랜잭션 내에서
    expect(charUpdateMany).toHaveBeenCalledWith({
      where: { browserId: 'b1', userId: null },
      data: { userId: 'u1' },
    });
    expect(convUpdateMany).toHaveBeenCalledWith({
      where: { browserId: 'b1', userId: null },
      data: { userId: 'u1' },
    });
  });

  it('멱등: 이미 클레임돼 userId null row가 없으면 0건(where 필터가 재실행을 무해화)', async () => {
    charUpdateMany.mockResolvedValue({ count: 0 });
    convUpdateMany.mockResolvedValue({ count: 0 });

    const result = await service.claimAnonymousData('u1', 'b1');

    expect(result).toEqual({ characters: 0, conversations: 0 });
  });

  it('browserId를 null로 만들지 않는다(병행 보관) — data는 userId만', async () => {
    charUpdateMany.mockResolvedValue({ count: 1 });
    convUpdateMany.mockResolvedValue({ count: 1 });

    await service.claimAnonymousData('u1', 'b1');

    const charData = charUpdateMany.mock.calls[0][0].data;
    const convData = convUpdateMany.mock.calls[0][0].data;
    expect(charData).toEqual({ userId: 'u1' });
    expect(convData).toEqual({ userId: 'u1' });
    expect('browserId' in charData).toBe(false);
    expect('browserId' in convData).toBe(false);
  });
});
