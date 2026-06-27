import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * #49 플레이 세션 영속(StorySession 생성/이어하기) HTTP 계약 테스트.
 * 핵심 단언: POST 시 statValues가 StartSetting.stats의 initialValue로 정확히 초기화되는지(정규화 Stat → Json 변환).
 * OwnerContext: 로그인(쿠키 JWT)→userId 소유 / 비로그인→browserId 폴백 / body userId 위조 무시 / 소유 불일치 404 / 라우트 매칭.
 * PrismaService.user·startSetting·storySession을 stub override(실 DB·실키 없이).
 */
describe('story-sessions 영속 (#49 HTTP)', () => {
  let app: INestApplication;
  const userFindUnique = jest.fn();
  const userCreate = jest.fn();
  const startSettingFindUnique = jest.fn();
  const sessionCreate = jest.fn();
  const sessionFindUnique = jest.fn();

  const prismaStub = {
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
    $connect: async () => {},
    $disconnect: async () => {},
    user: { findUnique: userFindUnique, create: userCreate },
    startSetting: { findUnique: startSettingFindUnique },
    storySession: { create: sessionCreate, findUnique: sessionFindUnique },
  } as unknown as PrismaService;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-#49';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    [userFindUnique, userCreate, startSettingFindUnique, sessionCreate, sessionFindUnique].forEach(
      (m) => m.mockReset(),
    );
  });

  async function loginCookie(userId = 'user-1', email = 'u@b.com'): Promise<string[]> {
    userFindUnique.mockResolvedValueOnce(null);
    userCreate.mockResolvedValueOnce({ id: userId, email, passwordHash: 'x', createdAt: new Date() });
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password: 'password123' });
    return res.headers['set-cookie'] as unknown as string[];
  }

  // --- 생성 + statValues 초기화 (핵심) ---
  it('POST /story-sessions → 201, statValues가 StartSetting.stats의 initialValue로 초기화', async () => {
    startSettingFindUnique.mockResolvedValueOnce({
      id: 'ss1',
      storyId: 'story1',
      stats: [
        { name: '호감도', initialValue: 0, minValue: 0, maxValue: 100 },
        { name: '신뢰', initialValue: 10, minValue: 0, maxValue: 100 },
      ],
    });
    sessionCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'sess1',
      endedWith: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));

    const res = await request(app.getHttpServer())
      .post('/story-sessions')
      .send({ browserId: 'b1', storyId: 'story1', startSettingId: 'ss1' });

    expect(res.status).toBe(201);
    // 핵심: 정규화 Stat[] → Json statValues 변환 정확성
    expect(res.body.statValues).toEqual({ 호감도: 0, 신뢰: 10 });
    expect(res.body.endedWith).toBeNull();
    // create data에도 동일 초기화 + browserId 소유
    const data = sessionCreate.mock.calls[0][0].data;
    expect(data.statValues).toEqual({ 호감도: 0, 신뢰: 10 });
    expect(data.browserId).toBe('b1');
    expect(data.userId).toBeUndefined();
  });

  it('로그인 POST /story-sessions → userId 소유(browserId 없이)', async () => {
    const cookie = await loginCookie();
    startSettingFindUnique.mockResolvedValueOnce({
      id: 'ss1',
      storyId: 'story1',
      stats: [{ name: '호감도', initialValue: 5, minValue: 0, maxValue: 100 }],
    });
    sessionCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'sess1',
      endedWith: null,
      ...data,
    }));

    const res = await request(app.getHttpServer())
      .post('/story-sessions')
      .set('Cookie', cookie)
      .send({ browserId: 'b1', storyId: 'story1', startSettingId: 'ss1' });

    expect(res.status).toBe(201);
    const data = sessionCreate.mock.calls[0][0].data;
    expect(data.userId).toBe('user-1');
    expect(data.browserId).toBeUndefined();
  });

  it('body userId 위조해도 무시 — 쿠키 없으면 browserId 소유', async () => {
    startSettingFindUnique.mockResolvedValueOnce({ id: 'ss1', storyId: 'story1', stats: [] });
    sessionCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'sess1',
      ...data,
    }));

    await request(app.getHttpServer())
      .post('/story-sessions')
      .send({ browserId: 'b1', storyId: 'story1', startSettingId: 'ss1', userId: 'attacker' });

    const data = sessionCreate.mock.calls[0][0].data;
    expect(data.browserId).toBe('b1');
    expect(data.userId).toBeUndefined();
  });

  it('POST /story-sessions 존재하지 않는 startSettingId → 404', async () => {
    startSettingFindUnique.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer())
      .post('/story-sessions')
      .send({ browserId: 'b1', storyId: 'story1', startSettingId: 'none' });
    expect(res.status).toBe(404);
    expect(sessionCreate).not.toHaveBeenCalled();
  });

  // --- DTO 거부 ---
  it('POST /story-sessions storyId 누락 → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/story-sessions')
      .send({ browserId: 'b1', startSettingId: 'ss1' });
    expect(res.status).toBe(400);
  });

  it('POST /story-sessions startSettingId 누락 → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/story-sessions')
      .send({ browserId: 'b1', storyId: 'story1' });
    expect(res.status).toBe(400);
  });

  // --- 이어하기 GET /:id ---
  it('GET /story-sessions/:id 소유자 → 200, statValues/endedWith 반환', async () => {
    sessionFindUnique.mockResolvedValueOnce({
      id: 'sess1',
      storyId: 'story1',
      startSettingId: 'ss1',
      statValues: { 호감도: 35, 신뢰: 12 },
      endedWith: null,
      browserId: 'b1',
      userId: null,
    });

    const res = await request(app.getHttpServer())
      .get('/story-sessions/sess1')
      .query({ browserId: 'b1' });

    expect(res.status).toBe(200);
    expect(res.body.statValues).toEqual({ 호감도: 35, 신뢰: 12 });
    expect(res.body.endedWith).toBeNull();
  });

  it('GET /story-sessions/:id 타 소유 → 404 (존재 비노출)', async () => {
    sessionFindUnique.mockResolvedValueOnce({
      id: 'sess1',
      browserId: 'owner',
      userId: null,
      statValues: {},
    });

    const res = await request(app.getHttpServer())
      .get('/story-sessions/sess1')
      .query({ browserId: 'attacker' });

    expect(res.status).toBe(404);
  });

  it('GET /story-sessions/:id 부재 → 404', async () => {
    sessionFindUnique.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer())
      .get('/story-sessions/none')
      .query({ browserId: 'b1' });
    expect(res.status).toBe(404);
  });

  it('GET /story-sessions/:id 위조 browserId 무시 — 로그인 소유 검증', async () => {
    const cookie = await loginCookie();
    sessionFindUnique.mockResolvedValueOnce({
      id: 'sess1',
      browserId: null,
      userId: 'user-1',
      statValues: { 호감도: 1 },
      endedWith: null,
    });

    const res = await request(app.getHttpServer())
      .get('/story-sessions/sess1')
      .set('Cookie', cookie)
      .query({ browserId: 'attacker' });

    expect(res.status).toBe(200);
  });
});
