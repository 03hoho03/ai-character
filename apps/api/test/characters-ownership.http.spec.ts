import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * #32 characters 소유검증 OwnerContext 전환 HTTP 계약 테스트.
 * 로그인(쿠키 JWT) → userId 소유 / 비로그인 → browserId 폴백(기존 보존) / userId 위조 차단 / 비소유 404.
 * PrismaService.user·character를 stub override. signup으로 실제 쿠키를 발급받아 쿠키 경로를 검증한다.
 */
describe('characters 소유 OwnerContext (#32 HTTP)', () => {
  let app: INestApplication;
  const userFindUnique = jest.fn();
  const userCreate = jest.fn();
  const charFindUnique = jest.fn();
  const charFindMany = jest.fn();
  const charCreate = jest.fn();
  const charUpdate = jest.fn();
  const charDelete = jest.fn();

  const prismaStub = {
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
    $connect: async () => {},
    $disconnect: async () => {},
    user: { findUnique: userFindUnique, create: userCreate },
    character: {
      findUnique: charFindUnique,
      findMany: charFindMany,
      create: charCreate,
      update: charUpdate,
      delete: charDelete,
    },
  } as unknown as PrismaService;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-#32';
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
    [userFindUnique, userCreate, charFindUnique, charFindMany, charCreate, charUpdate, charDelete].forEach(
      (m) => m.mockReset(),
    );
  });

  /** signup으로 로그인 쿠키 발급 → 이후 요청에 Cookie 헤더로 재사용 */
  async function loginCookie(userId = 'user-1', email = 'u@b.com'): Promise<string[]> {
    userFindUnique.mockResolvedValueOnce(null);
    userCreate.mockResolvedValueOnce({ id: userId, email, passwordHash: 'x', createdAt: new Date() });
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password: 'password123' });
    return res.headers['set-cookie'] as unknown as string[];
  }

  const charBody = (id = 'usr-1') => ({
    id,
    name: 'n',
    tagline: 't',
    personality: 'p',
    speechStyle: 's',
    worldview: 'w',
    greeting: 'g',
    exampleDialogue: [{ user: 'u', model: 'm' }],
  });

  it('로그인 후 생성한 캐릭터는 userId 소유(browserId 없이)', async () => {
    const cookie = await loginCookie();
    charFindUnique.mockResolvedValueOnce(null);
    charCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      ...charBody(),
      ...data,
    }));

    const res = await request(app.getHttpServer())
      .post('/characters')
      .set('Cookie', cookie)
      .send(charBody());

    expect(res.status).toBe(201);
    const data = charCreate.mock.calls[0][0].data;
    expect(data.userId).toBe('user-1');
    expect(data.browserId).toBeUndefined();
  });

  it('로그인 getOwned는 userId where로 조회', async () => {
    const cookie = await loginCookie();
    charFindMany.mockResolvedValueOnce([]);

    const res = await request(app.getHttpServer()).get('/characters').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(charFindMany.mock.calls[0][0].where).toEqual({ userId: 'user-1' });
  });

  it('비로그인 생성은 browserId 소유(기존 계약 보존)', async () => {
    charFindUnique.mockResolvedValueOnce(null);
    charCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      ...charBody(),
      ...data,
    }));

    const res = await request(app.getHttpServer())
      .post('/characters')
      .send({ ...charBody(), browserId: 'b1' });

    expect(res.status).toBe(201);
    const data = charCreate.mock.calls[0][0].data;
    expect(data.browserId).toBe('b1');
    expect(data.userId).toBeUndefined();
  });

  it('userId를 body로 위조해도 무시 — 쿠키 없으면 browserId 소유', async () => {
    charFindUnique.mockResolvedValueOnce(null);
    charCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      ...charBody(),
      ...data,
    }));

    await request(app.getHttpServer())
      .post('/characters')
      .send({ ...charBody(), browserId: 'b1', userId: 'attacker' });

    const data = charCreate.mock.calls[0][0].data;
    expect(data.browserId).toBe('b1');
    expect(data.userId).toBeUndefined(); // 위조 userId 무시(쿠키만 신뢰)
  });

  it('로그인 getOwned는 비로그인 browserId 소유물을 노출하지 않는다(where에 browserId 없음)', async () => {
    const cookie = await loginCookie();
    charFindMany.mockResolvedValueOnce([]);

    await request(app.getHttpServer()).get('/characters').set('Cookie', cookie);

    const where = charFindMany.mock.calls[0][0].where;
    expect(where.browserId).toBeUndefined();
    expect(where).toEqual({ userId: 'user-1' });
  });

  it('로그인 사용자가 browserId 소유(userId null) 비공개 캐릭터 접근 → 404', async () => {
    const cookie = await loginCookie();
    charFindUnique.mockResolvedValueOnce({
      id: 'usr-x',
      browserId: 'someone',
      userId: null,
      isPublic: false,
    });

    const res = await request(app.getHttpServer()).get('/characters/usr-x').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('로그인 사용자도 isPublic 캐릭터는 조회 가능', async () => {
    const cookie = await loginCookie();
    charFindUnique.mockResolvedValueOnce({
      id: 'usr-pub',
      browserId: 'someone',
      userId: null,
      isPublic: true,
    });

    const res = await request(app.getHttpServer()).get('/characters/usr-pub').set('Cookie', cookie);
    expect(res.status).toBe(200);
  });
});
