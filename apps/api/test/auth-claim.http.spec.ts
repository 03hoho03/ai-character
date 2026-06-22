import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * #33 익명 데이터 클레임 HTTP 계약 테스트 (CLAUDE.md 규약: 신규 엔드포인트 라우트+status+DTO/인증 거부).
 * 신원(userId)은 쿠키 JWT에서만 — body의 userId는 신뢰하지 않는다(#23 신뢰경계).
 * 클레임은 updateMany(where {browserId, userId:null})로 멱등·충돌skip을 구조로 보장 → where/data 내용을 단언.
 */
const COOKIE = 'access_token';

describe('Auth claim HTTP contract (#33)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const charUpdateMany = jest.fn();
  const convUpdateMany = jest.fn();

  const prismaStub = {
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
    $connect: async () => {},
    $disconnect: async () => {},
    character: { updateMany: charUpdateMany },
    conversation: { updateMany: convUpdateMany },
    user: { findUnique: jest.fn(), create: jest.fn() },
  } as unknown as PrismaService & { $transaction: unknown };
  (prismaStub as unknown as { $transaction: (cb: (tx: unknown) => unknown) => unknown }).$transaction =
    (cb) => cb(prismaStub);

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-#33';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    jwtService = app.get(JwtService, { strict: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    charUpdateMany.mockReset();
    convUpdateMany.mockReset();
  });

  function authCookie(userId = 'u1') {
    const token = jwtService.sign({ sub: userId, email: 'a@b.com' });
    return [`${COOKIE}=${token}`];
  }

  it('POST /auth/claim 쿠키 없음 → 401 (로그인 필수)', async () => {
    const res = await request(app.getHttpServer()).post('/auth/claim').send({ browserId: 'b1' });
    expect(res.status).toBe(401);
    expect(charUpdateMany).not.toHaveBeenCalled();
  });

  it('POST /auth/claim 유효 쿠키 + browserId → 200 + 건수, userId null인 row만 userId set(browserId 유지)', async () => {
    charUpdateMany.mockResolvedValue({ count: 2 });
    convUpdateMany.mockResolvedValue({ count: 1 });

    const res = await request(app.getHttpServer())
      .post('/auth/claim')
      .set('Cookie', authCookie('u1'))
      .send({ browserId: 'b1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ characters: 2, conversations: 1 });
    // where에 userId:null → 멱등(이미 소유 row skip) + 충돌(타 userId) skip. data는 userId만 → browserId 병행 보관.
    expect(charUpdateMany).toHaveBeenCalledWith({
      where: { browserId: 'b1', userId: null },
      data: { userId: 'u1' },
    });
    expect(convUpdateMany).toHaveBeenCalledWith({
      where: { browserId: 'b1', userId: null },
      data: { userId: 'u1' },
    });
  });

  it('POST /auth/claim browserId 누락 → 400 (DTO 거부)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/claim')
      .set('Cookie', authCookie('u1'))
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /auth/claim body의 userId는 무시 — 소유는 쿠키 userId(신뢰경계)', async () => {
    charUpdateMany.mockResolvedValue({ count: 0 });
    convUpdateMany.mockResolvedValue({ count: 0 });

    await request(app.getHttpServer())
      .post('/auth/claim')
      .set('Cookie', authCookie('u1'))
      .send({ browserId: 'b1', userId: 'evil' });

    expect(charUpdateMany).toHaveBeenCalledWith({
      where: { browserId: 'b1', userId: null },
      data: { userId: 'u1' }, // 'evil' 아님 — whitelist strip + 쿠키 신원
    });
  });
});
