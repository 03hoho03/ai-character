import { NotFoundException } from '@nestjs/common';
import { SUMMARY_RECENT_TURNS, SUMMARY_TURN_THRESHOLD } from '@ai-character/shared';
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
  const message = { create: jest.fn(), deleteMany: jest.fn() };
  const $transaction = jest.fn();
  const prisma = { conversation, message, $transaction } as never;
  const summarize = jest.fn();
  const chatService = { summarize } as never;
  let service: ConversationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    // 트랜잭션 콜백은 같은 prisma 모킹을 tx로 받아 실행한다
    $transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma));
    service = new ConversationsService(prisma, chatService);
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

  describe('replaceMessages (#18 truncate-after)', () => {
    const turns = [
      { role: 'user' as const, content: '편집된 질문' },
      { role: 'model' as const, content: '새 답변' },
    ];

    it('소유자면 트랜잭션으로 기존 메시지를 비우고 주어진 배열을 순서대로 재삽입한다', async () => {
      conversation.findUnique.mockResolvedValue({ id: 'c1', browserId: 'b1' });
      const result = { id: 'c1', messages: turns };
      conversation.update.mockResolvedValue(result);

      const out = await service.replaceMessages('c1', 'b1', turns);

      expect(out).toBe(result);
      expect($transaction).toHaveBeenCalledTimes(1);
      // (a) 기존 메시지 전체 삭제
      expect(message.deleteMany).toHaveBeenCalledWith({ where: { conversationId: 'c1' } });
      // (b) 주어진 배열을 순서대로 nested create
      const arg = conversation.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'c1' });
      const created = arg.data.messages.create as { role: string; content: string }[];
      expect(created.map((m) => ({ role: m.role, content: m.content }))).toEqual(turns);
      // 삭제가 재삽입보다 먼저 호출됨
      expect(message.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
        conversation.update.mock.invocationCallOrder[0],
      );
    });

    it('빈 배열이면 모든 메시지를 비운다', async () => {
      conversation.findUnique.mockResolvedValue({ id: 'c1', browserId: 'b1' });
      conversation.update.mockResolvedValue({ id: 'c1', messages: [] });

      await service.replaceMessages('c1', 'b1', []);

      expect(message.deleteMany).toHaveBeenCalledWith({ where: { conversationId: 'c1' } });
      expect(conversation.update.mock.calls[0][0].data.messages.create).toEqual([]);
    });

    it('소유자가 아니면 NotFound (트랜잭션 미실행)', async () => {
      conversation.findUnique.mockResolvedValue({ id: 'c1', browserId: 'owner' });
      await expect(service.replaceMessages('c1', 'attacker', turns)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect($transaction).not.toHaveBeenCalled();
    });

    it('대화가 없으면 NotFound', async () => {
      conversation.findUnique.mockResolvedValue(null);
      await expect(service.replaceMessages('nope', 'b1', turns)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect($transaction).not.toHaveBeenCalled();
    });
  });

  describe('summarizeIfNeeded (#15)', () => {
    const makeMessages = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'model',
        content: `메시지 ${i}`,
      }));

    it('저장 turn이 임계 이하면 no-op (요약 호출·갱신 없음, 현 summary 반환)', async () => {
      conversation.findUnique.mockResolvedValue({
        id: 'c1',
        browserId: 'b1',
        summary: null,
        summarizedCount: 0,
        messages: makeMessages(SUMMARY_TURN_THRESHOLD), // 임계 이하(초과 아님)
      });

      const result = await service.summarizeIfNeeded('c1', 'b1');

      expect(summarize).not.toHaveBeenCalled();
      expect(conversation.update).not.toHaveBeenCalled();
      expect(result).toEqual({ summary: null, summarizedCount: 0 });
    });

    it('임계 초과면 최근 N 제외 turn을 요약해 summary/summarizedCount를 영속한다', async () => {
      const total = SUMMARY_TURN_THRESHOLD + 4;
      const messages = makeMessages(total);
      conversation.findUnique.mockResolvedValue({
        id: 'c1',
        browserId: 'b1',
        summary: '기존 요약',
        summarizedCount: 2,
        messages,
      });
      summarize.mockResolvedValue('새 요약');
      conversation.update.mockResolvedValue({ id: 'c1' });

      const result = await service.summarizeIfNeeded('c1', 'b1');

      const expectedOlder = total - SUMMARY_RECENT_TURNS;
      // 직전 요약 + 오래된 turn(최근 N 제외)으로 요약 호출
      expect(summarize).toHaveBeenCalledTimes(1);
      expect(summarize.mock.calls[0][0]).toBe('기존 요약');
      expect((summarize.mock.calls[0][1] as unknown[]).length).toBe(expectedOlder);
      // 영속
      expect(conversation.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { summary: '새 요약', summarizedCount: expectedOlder },
      });
      expect(result).toEqual({ summary: '새 요약', summarizedCount: expectedOlder });
    });

    it('소유자가 아니면 NotFound (요약 안 함)', async () => {
      conversation.findUnique.mockResolvedValue({
        id: 'c1',
        browserId: 'owner',
        messages: makeMessages(20),
      });
      await expect(service.summarizeIfNeeded('c1', 'attacker')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(summarize).not.toHaveBeenCalled();
    });

    it('대화가 없으면 NotFound', async () => {
      conversation.findUnique.mockResolvedValue(null);
      await expect(service.summarizeIfNeeded('nope', 'b1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
