import { NotFoundException } from '@nestjs/common';
import { SUMMARY_RECENT_TURNS, SUMMARY_TURN_THRESHOLD } from '@ai-character/shared';
import { ConversationsService } from '../src/conversations/conversations.service';

/**
 * #14 ConversationsService 단위 테스트 — Prisma를 모킹해 로직만 검증.
 * #40 OwnerContext 전환: 메서드는 browserId 직접 수신 → owner({userId}|{browserId}).
 * get-or-create는 owner별 복합 unique 키(로그인=userId_personaId / 비로그인=browserId_personaId)로 분기,
 * 소유검증은 ownerMatches(로그인=userId, 비로그인=browserId). 식별자 변경의 테스트 2차 상태 갱신(l_2026_06_20).
 */
describe('ConversationsService (#40 OwnerContext)', () => {
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

  const anon = { browserId: 'b1' } as const;
  const user = { userId: 'u1' } as const;

  beforeEach(() => {
    jest.clearAllMocks();
    $transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma));
    service = new ConversationsService(prisma, chatService);
  });

  describe('getOrCreate', () => {
    it('비로그인: 기존 (browserId, personaId) 대화가 있으면 재사용 (생성 안 함)', async () => {
      const existing = { id: 'c1', browserId: 'b1', personaId: 'tpl-x' };
      conversation.findUnique.mockResolvedValue(existing);

      const result = await service.getOrCreate(anon, 'tpl-x');

      expect(result).toBe(existing);
      expect(conversation.findUnique).toHaveBeenCalledWith({
        where: { browserId_personaId: { browserId: 'b1', personaId: 'tpl-x' } },
      });
      expect(conversation.create).not.toHaveBeenCalled();
    });

    it('비로그인: 없으면 browserId 소유로 생성(userId 없이)', async () => {
      conversation.findUnique.mockResolvedValue(null);
      const created = { id: 'c2', browserId: 'b1', personaId: 'usr-y' };
      conversation.create.mockResolvedValue(created);

      const result = await service.getOrCreate(anon, 'usr-y');

      expect(result).toBe(created);
      expect(conversation.create).toHaveBeenCalledWith({
        data: { browserId: 'b1', personaId: 'usr-y' },
      });
    });

    it('로그인: userId_personaId 키로 조회한다(#34 토대)', async () => {
      const existing = { id: 'c1', userId: 'u1', personaId: 'tpl-x' };
      conversation.findUnique.mockResolvedValue(existing);

      const result = await service.getOrCreate(user, 'tpl-x');

      expect(result).toBe(existing);
      expect(conversation.findUnique).toHaveBeenCalledWith({
        where: { userId_personaId: { userId: 'u1', personaId: 'tpl-x' } },
      });
    });

    it('로그인: 없으면 userId 소유로 생성(browserId 없이 — characters #32 일관)', async () => {
      conversation.findUnique.mockResolvedValue(null);
      const created = { id: 'c3', userId: 'u1', personaId: 'tpl-x' };
      conversation.create.mockResolvedValue(created);

      await service.getOrCreate(user, 'tpl-x');

      expect(conversation.create).toHaveBeenCalledWith({
        data: { userId: 'u1', personaId: 'tpl-x' },
      });
      const data = conversation.create.mock.calls[0][0].data;
      expect(data.browserId).toBeUndefined();
    });
  });

  describe('getByOwner', () => {
    it('비로그인: browserId_personaId 키 + 메시지 시간순(asc)', async () => {
      const conv = { id: 'c1', messages: [] };
      conversation.findUnique.mockResolvedValue(conv);

      const result = await service.getByOwner(anon, 'tpl-x');

      expect(result).toBe(conv);
      expect(conversation.findUnique).toHaveBeenCalledWith({
        where: { browserId_personaId: { browserId: 'b1', personaId: 'tpl-x' } },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    });

    it('로그인: userId_personaId 키로 조회', async () => {
      conversation.findUnique.mockResolvedValue({ id: 'c1', messages: [] });

      await service.getByOwner(user, 'tpl-x');

      expect(conversation.findUnique).toHaveBeenCalledWith({
        where: { userId_personaId: { userId: 'u1', personaId: 'tpl-x' } },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    });

    it('없으면 null', async () => {
      conversation.findUnique.mockResolvedValue(null);
      expect(await service.getByOwner(anon, 'none')).toBeNull();
    });
  });

  describe('appendMessage', () => {
    it('비로그인 소유 일치(browserId)면 저장 + updatedAt 갱신', async () => {
      conversation.findUnique.mockResolvedValue({ id: 'c1', browserId: 'b1', userId: null });
      const saved = { id: 'm1', role: 'user', content: '안녕', createdAt: new Date() };
      conversation.update.mockResolvedValue({ messages: [saved] });

      const result = await service.appendMessage('c1', anon, 'user', '안녕');

      expect(result).toBe(saved);
      expect(conversation.update).toHaveBeenCalledTimes(1);
      const arg = conversation.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'c1' });
      expect(arg.data.messages.create).toEqual({ role: 'user', content: '안녕' });
    });

    it('로그인 소유 일치(userId)면 저장', async () => {
      conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1', browserId: null });
      conversation.update.mockResolvedValue({ messages: [{ id: 'm1' }] });

      await service.appendMessage('c1', user, 'user', 'x');

      expect(conversation.update).toHaveBeenCalledTimes(1);
    });

    it('대화가 없으면 NotFound', async () => {
      conversation.findUnique.mockResolvedValue(null);
      await expect(service.appendMessage('nope', anon, 'user', 'x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(conversation.update).not.toHaveBeenCalled();
    });

    it('비로그인 owner의 browserId가 다르면 NotFound (존재 노출 안 함)', async () => {
      conversation.findUnique.mockResolvedValue({ id: 'c1', browserId: 'owner', userId: null });
      await expect(service.appendMessage('c1', { browserId: 'attacker' }, 'user', 'x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(conversation.update).not.toHaveBeenCalled();
    });

    it('로그인 owner의 userId가 다르면 NotFound', async () => {
      conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'other', browserId: null });
      await expect(service.appendMessage('c1', user, 'user', 'x')).rejects.toBeInstanceOf(
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

    it('소유자면 트랜잭션으로 기존 메시지를 비우고 배열을 순서대로 재삽입', async () => {
      conversation.findUnique.mockResolvedValue({ id: 'c1', browserId: 'b1', userId: null });
      const result = { id: 'c1', messages: turns };
      conversation.update.mockResolvedValue(result);

      const out = await service.replaceMessages('c1', anon, turns);

      expect(out).toBe(result);
      expect($transaction).toHaveBeenCalledTimes(1);
      expect(message.deleteMany).toHaveBeenCalledWith({ where: { conversationId: 'c1' } });
      const arg = conversation.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'c1' });
      const created = arg.data.messages.create as { role: string; content: string }[];
      expect(created.map((m) => ({ role: m.role, content: m.content }))).toEqual(turns);
      expect(message.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
        conversation.update.mock.invocationCallOrder[0],
      );
    });

    it('빈 배열이면 모든 메시지를 비운다', async () => {
      conversation.findUnique.mockResolvedValue({ id: 'c1', browserId: 'b1', userId: null });
      conversation.update.mockResolvedValue({ id: 'c1', messages: [] });

      await service.replaceMessages('c1', anon, []);

      expect(message.deleteMany).toHaveBeenCalledWith({ where: { conversationId: 'c1' } });
      expect(conversation.update.mock.calls[0][0].data.messages.create).toEqual([]);
    });

    it('소유자가 아니면 NotFound (트랜잭션 미실행)', async () => {
      conversation.findUnique.mockResolvedValue({ id: 'c1', browserId: 'owner', userId: null });
      await expect(service.replaceMessages('c1', { browserId: 'attacker' }, turns)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect($transaction).not.toHaveBeenCalled();
    });

    it('대화가 없으면 NotFound', async () => {
      conversation.findUnique.mockResolvedValue(null);
      await expect(service.replaceMessages('nope', anon, turns)).rejects.toBeInstanceOf(
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

    it('임계 이하면 no-op (요약·갱신 없음, 현 summary 반환)', async () => {
      conversation.findUnique.mockResolvedValue({
        id: 'c1',
        browserId: 'b1',
        userId: null,
        summary: null,
        summarizedCount: 0,
        messages: makeMessages(SUMMARY_TURN_THRESHOLD),
      });

      const result = await service.summarizeIfNeeded('c1', anon);

      expect(summarize).not.toHaveBeenCalled();
      expect(conversation.update).not.toHaveBeenCalled();
      expect(result).toEqual({ summary: null, summarizedCount: 0 });
    });

    it('임계 초과면 최근 N 제외 turn을 요약해 영속', async () => {
      const total = SUMMARY_TURN_THRESHOLD + 4;
      conversation.findUnique.mockResolvedValue({
        id: 'c1',
        browserId: 'b1',
        userId: null,
        summary: '기존 요약',
        summarizedCount: 2,
        messages: makeMessages(total),
      });
      summarize.mockResolvedValue('새 요약');
      conversation.update.mockResolvedValue({ id: 'c1' });

      const result = await service.summarizeIfNeeded('c1', anon);

      const expectedOlder = total - SUMMARY_RECENT_TURNS;
      expect(summarize).toHaveBeenCalledTimes(1);
      expect(summarize.mock.calls[0][0]).toBe('기존 요약');
      expect((summarize.mock.calls[0][1] as unknown[]).length).toBe(expectedOlder);
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
        userId: null,
        messages: makeMessages(20),
      });
      await expect(service.summarizeIfNeeded('c1', { browserId: 'attacker' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(summarize).not.toHaveBeenCalled();
    });

    it('대화가 없으면 NotFound', async () => {
      conversation.findUnique.mockResolvedValue(null);
      await expect(service.summarizeIfNeeded('nope', anon)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
