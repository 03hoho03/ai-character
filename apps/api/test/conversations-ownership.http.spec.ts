import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * #40 conversations 소유검증 OwnerContext 전환 HTTP 계약 테스트(현재 conversations HTTP 0개 — 신설).
 * 로그인(쿠키 JWT)→userId 소유(userId 키 get-or-create) / 비로그인→browserId 폴백(기존 보존) /
 * userId 위조 차단 / 소유 불일치 404 / 라우트 매칭. PrismaService.user·conversation을 stub override.
 */
const COOKIE = 'access_token';

describe('conversations 소유 OwnerContext (#40 HTTP)', () => {
  let app: INestApplication;
  const userFindUnique = jest.fn();
  const userCreate = jest.fn();
  const convFindUnique = jest.fn();
  const convCreate = jest.fn();
  const convUpdate = jest.fn();

  const prismaStub = {
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
    $connect: async () => {},
    $disconnect: async () => {},
    user: { findUnique: userFindUnique, create: userCreate },
    conversation: { findUnique: convFindUnique, create: convCreate, update: convUpdate },
  } as unknown as PrismaService;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-#40';
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
    [userFindUnique, userCreate, convFindUnique, convCreate, convUpdate].forEach((m) => m.mockReset());
  });

  async function loginCookie(userId = 'user-1', email = 'u@b.com'): Promise<string[]> {
    userFindUnique.mockResolvedValueOnce(null);
    userCreate.mockResolvedValueOnce({ id: userId, email, passwordHash: 'x', createdAt: new Date() });
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password: 'password123' });
    return res.headers['set-cookie'] as unknown as string[];
  }

  // --- get-or-create 소유 ---
  it('비로그인 POST /conversations → browserId 키 get-or-create, browserId 소유(userId 없이)', async () => {
    convFindUnique.mockResolvedValueOnce(null);
    convCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: 'c1', ...data }));

    const res = await request(app.getHttpServer())
      .post('/conversations')
      .send({ browserId: 'b1', personaId: 'tpl-x' });

    expect(res.status).toBe(201);
    expect(convFindUnique.mock.calls[0][0].where).toEqual({
      browserId_personaId: { browserId: 'b1', personaId: 'tpl-x' },
    });
    const data = convCreate.mock.calls[0][0].data;
    expect(data.browserId).toBe('b1');
    expect(data.userId).toBeUndefined();
  });

  it('로그인 POST /conversations → userId 키 get-or-create, userId 소유(browserId 없이)', async () => {
    const cookie = await loginCookie();
    convFindUnique.mockResolvedValueOnce(null);
    convCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: 'c1', ...data }));

    const res = await request(app.getHttpServer())
      .post('/conversations')
      .set('Cookie', cookie)
      .send({ browserId: 'b1', personaId: 'tpl-x' });

    expect(res.status).toBe(201);
    expect(convFindUnique.mock.calls[0][0].where).toEqual({
      userId_personaId: { userId: 'user-1', personaId: 'tpl-x' },
    });
    const data = convCreate.mock.calls[0][0].data;
    expect(data.userId).toBe('user-1');
    expect(data.browserId).toBeUndefined();
  });

  it('body userId 위조해도 무시 — 쿠키 없으면 browserId 소유', async () => {
    convFindUnique.mockResolvedValueOnce(null);
    convCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: 'c1', ...data }));

    await request(app.getHttpServer())
      .post('/conversations')
      .send({ browserId: 'b1', personaId: 'tpl-x', userId: 'attacker' });

    const data = convCreate.mock.calls[0][0].data;
    expect(data.browserId).toBe('b1');
    expect(data.userId).toBeUndefined(); // 위조 userId 무시(쿠키만 신뢰)
  });

  // --- GET 복원 ---
  it('GET /conversations 비로그인 → browserId 키 조회', async () => {
    convFindUnique.mockResolvedValueOnce({ id: 'c1', browserId: 'b1', messages: [] });

    const res = await request(app.getHttpServer())
      .get('/conversations')
      .query({ browserId: 'b1', personaId: 'tpl-x' });

    expect(res.status).toBe(200);
    expect(convFindUnique.mock.calls[0][0].where).toEqual({
      browserId_personaId: { browserId: 'b1', personaId: 'tpl-x' },
    });
  });

  it('GET /conversations 없으면 404', async () => {
    convFindUnique.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer())
      .get('/conversations')
      .query({ browserId: 'b1', personaId: 'none' });
    expect(res.status).toBe(404);
  });

  // --- 소유검증 404 (라우트 매칭 포함) ---
  it('POST /conversations/:id/messages 비소유 → 404 (존재 비노출)', async () => {
    convFindUnique.mockResolvedValueOnce({ id: 'c1', browserId: 'owner', userId: null });

    const res = await request(app.getHttpServer())
      .post('/conversations/c1/messages')
      .send({ browserId: 'attacker', role: 'user', content: 'x' });

    expect(res.status).toBe(404);
    expect(convUpdate).not.toHaveBeenCalled();
  });

  it('로그인 사용자가 자기(userId) 대화에 메시지 append → 200', async () => {
    const cookie = await loginCookie();
    convFindUnique.mockResolvedValueOnce({ id: 'c1', userId: 'user-1', browserId: null });
    convUpdate.mockResolvedValueOnce({ messages: [{ id: 'm1', role: 'user', content: 'hi', createdAt: new Date() }] });

    const res = await request(app.getHttpServer())
      .post('/conversations/c1/messages')
      .set('Cookie', cookie)
      .send({ role: 'user', content: 'hi' });

    expect(res.status).toBe(201);
    expect(convUpdate).toHaveBeenCalledTimes(1);
  });

  it('로그인 사용자가 타 userId 대화에 append → 404', async () => {
    const cookie = await loginCookie();
    convFindUnique.mockResolvedValueOnce({ id: 'c1', userId: 'other', browserId: null });

    const res = await request(app.getHttpServer())
      .post('/conversations/c1/messages')
      .set('Cookie', cookie)
      .send({ role: 'user', content: 'hi' });

    expect(res.status).toBe(404);
  });

  // --- DTO 거부 ---
  it('POST /conversations personaId 누락 → 400 (DTO 거부)', async () => {
    const res = await request(app.getHttpServer()).post('/conversations').send({ browserId: 'b1' });
    expect(res.status).toBe(400);
  });
});
