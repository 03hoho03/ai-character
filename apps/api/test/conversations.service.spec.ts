import { NotFoundException } from '@nestjs/common';
import { ConversationsService } from '../src/conversations/conversations.service';

/**
 * #14 ConversationsService 단위 테스트 — Prisma를 모킹해 로직만 검증.
 * prd.md 성공 기준에 매핑.
 */
describe('ConversationsService', () => {
  const conversation = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const message = { create: jest.fn() };
  const prisma = { conversation, message } as never;
  let service: ConversationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConversationsService(prisma);
  });

  describe('getOrCreate', () => {
    it('기존 (browserId, personaId) 대화가 있으면 재사용한다 (생성 안 함)', async () => {
      const existing = { id: 'c1', browserId: 'b1', personaId: 'tpl-x' };
      conversation.findUnique.mockResolvedValue(existing);

      const result = await service.getOrCreate('b1', 'tpl-x');

      expect(result).toBe(existing);
      expect(conversation.findUnique).toHaveBeenCalledWith({
        where: { browserId_personaId: { browserId: 'b1', personaId: 'tpl-x' } },
      });
      expect(conversation.create).not.toHaveBeenCalled();
    });

    it('없으면 새로 생성한다', async () => {
      conversation.findUnique.mockResolvedValue(null);
      const created = { id: 'c2', browserId: 'b1', personaId: 'usr-y' };
      conversation.create.mockResolvedValue(created);

      const result = await service.getOrCreate('b1', 'usr-y');

      expect(result).toBe(created);
      expect(conversation.create).toHaveBeenCalledWith({
        data: { browserId: 'b1', personaId: 'usr-y' },
      });
    });
  });

  describe('getByOwner', () => {
    it('메시지를 시간순(asc)으로 포함해 조회한다', async () => {
      const conv = { id: 'c1', messages: [] };
      conversation.findUnique.mockResolvedValue(conv);

      const result = await service.getByOwner('b1', 'tpl-x');

      expect(result).toBe(conv);
      expect(conversation.findUnique).toHaveBeenCalledWith({
        where: { browserId_personaId: { browserId: 'b1', personaId: 'tpl-x' } },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    });

    it('없으면 null을 그대로 반환한다', async () => {
      conversation.findUnique.mockResolvedValue(null);
      expect(await service.getByOwner('b1', 'none')).toBeNull();
    });
  });

  describe('appendMessage', () => {
    it('소유 browserId가 일치하면 메시지를 저장하고 updatedAt을 갱신한다', async () => {
      conversation.findUnique.mockResolvedValue({ id: 'c1', browserId: 'b1' });
      const saved = { id: 'm1', role: 'user', content: '안녕', createdAt: new Date() };
      conversation.update.mockResolvedValue({ messages: [saved] });

      const result = await service.appendMessage('c1', 'b1', 'user', '안녕');

      expect(result).toBe(saved);
      // 메시지 생성 + updatedAt 갱신을 한 번의 update(nested create)로 처리
      expect(conversation.update).toHaveBeenCalledTimes(1);
      const arg = conversation.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'c1' });
      expect(arg.data.messages.create).toEqual({ role: 'user', content: '안녕' });
    });

    it('대화가 없으면 NotFound', async () => {
      conversation.findUnique.mockResolvedValue(null);
      await expect(service.appendMessage('nope', 'b1', 'user', 'x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(conversation.update).not.toHaveBeenCalled();
    });

    it('browserId가 소유자와 다르면 NotFound (존재 노출 안 함)', async () => {
      conversation.findUnique.mockResolvedValue({ id: 'c1', browserId: 'owner' });
      await expect(service.appendMessage('c1', 'attacker', 'user', 'x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(conversation.update).not.toHaveBeenCalled();
    });
  });
});
