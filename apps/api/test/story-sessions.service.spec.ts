import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { GoogleGenAI } from '@google/genai';
import { StorySessionsService } from '../src/story-sessions/story-sessions.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * #49 StorySessionsService 단위 — statValues 초기화(Stat.initialValue 매핑)와 소유검증 가드.
 * HTTP 계약은 story-sessions.http.spec.ts(+ #50 turn은 story-sessions-turn.http.spec.ts).
 * 여기서는 create/getByOwner 변환·가드 로직만 분리 검증(turn은 GENAI 의존이라 HTTP 계약으로).
 */
describe('StorySessionsService (#49)', () => {
  const startSettingFindUnique = jest.fn();
  const sessionCreate = jest.fn();
  const sessionFindUnique = jest.fn();

  const prisma = {
    startSetting: { findUnique: startSettingFindUnique },
    storySession: { create: sessionCreate, findUnique: sessionFindUnique },
  } as unknown as PrismaService;

  // #50 turn 추가로 생성자에 config/GENAI_CLIENT 의존 추가 — 이 단위 스코프(create/getByOwner)는 미사용이라 stub/null.
  const config = { get: (_k: string, d?: unknown) => d } as unknown as ConfigService;
  const service = new StorySessionsService(prisma, config, null as unknown as GoogleGenAI | null);

  beforeEach(() => {
    [startSettingFindUnique, sessionCreate, sessionFindUnique].forEach((m) => m.mockReset());
  });

  it('create: statValues를 Stat.initialValue로 정확히 초기화하고 owner를 기록한다', async () => {
    startSettingFindUnique.mockResolvedValueOnce({
      id: 'ss1',
      storyId: 'story1',
      stats: [
        { name: '호감도', initialValue: 0 },
        { name: '신뢰', initialValue: 10 },
      ],
    });
    sessionCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: 's', ...data }));

    await service.create({ browserId: 'b1' }, 'story1', 'ss1');

    const data = sessionCreate.mock.calls[0][0].data;
    expect(data.statValues).toEqual({ 호감도: 0, 신뢰: 10 });
    expect(data.endedWith).toBeUndefined();
    expect(data.browserId).toBe('b1');
    expect(data.storyId).toBe('story1');
    expect(data.startSettingId).toBe('ss1');
  });

  it('create: 스탯 없는 시작설정은 빈 statValues', async () => {
    startSettingFindUnique.mockResolvedValueOnce({ id: 'ss1', storyId: 'story1', stats: [] });
    sessionCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: 's', ...data }));
    await service.create({ browserId: 'b1' }, 'story1', 'ss1');
    expect(sessionCreate.mock.calls[0][0].data.statValues).toEqual({});
  });

  it('create: 없는 startSettingId면 404', async () => {
    startSettingFindUnique.mockResolvedValueOnce(null);
    await expect(service.create({ browserId: 'b1' }, 'story1', 'none')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getByOwner: 소유 불일치면 404', async () => {
    sessionFindUnique.mockResolvedValueOnce({ id: 's', browserId: 'owner', userId: null });
    await expect(service.getByOwner('s', { browserId: 'attacker' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getByOwner: 소유자면 세션 반환', async () => {
    const row = { id: 's', browserId: 'b1', userId: null, statValues: { 호감도: 1 }, endedWith: null };
    sessionFindUnique.mockResolvedValueOnce(row);
    await expect(service.getByOwner('s', { browserId: 'b1' })).resolves.toEqual(row);
  });
});
