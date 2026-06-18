import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * #28 인증 백엔드 HTTP 계약 테스트 (CLAUDE.md 규약: 신규 엔드포인트는 supertest로 라우트+status+DTO거부).
 * PrismaService.user를 stub해 실 DB 없이 검증. 보안/정책 구조화 상수(쿠키 httpOnly/sameSite/maxAge,
 * 409/401 분기)는 존재가 아니라 *내용*을 단언(lesson l_2026_06_18_x — weak_check 금지).
 */
const COOKIE = 'access_token';
const MAX_AGE_7D = 604800; // 7d in seconds

describe('Auth HTTP contract (#28)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const findUnique = jest.fn();
  const create = jest.fn();

  const prismaStub = {
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
    $connect: async () => {},
    $disconnect: async () => {},
    user: { findUnique, create },
  } as unknown as PrismaService;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-#28';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser()); // main.ts와 동일 — guard가 req.cookies를 읽는다
    await app.init();
    jwtService = app.get(JwtService, { strict: false }); // 만료 토큰 발급용(guard와 동일 secret)
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
  });

  // --- signup ---
  it('POST /auth/signup 신규 email → 201 + httpOnly JWT 쿠키, passwordHash 미노출', async () => {
    findUnique.mockResolvedValue(null);
    create.mockImplementation(({ data }: { data: { email: string; passwordHash: string } }) => ({
      id: 'u1',
      email: data.email,
      passwordHash: data.passwordHash,
      createdAt: new Date(),
    }));

    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'a@b.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'u1', email: 'a@b.com' });
    expect(res.body.passwordHash).toBeUndefined();

    const setCookie = res.headers['set-cookie'][0] as string;
    expect(setCookie).toMatch(new RegExp(`${COOKIE}=`));
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(new RegExp(`Max-Age=${MAX_AGE_7D}`));
  });

  it('POST /auth/signup 저장된 해시는 평문이 아니라 argon2 검증을 통과한다(내용 단언)', async () => {
    findUnique.mockResolvedValue(null);
    let stored: { passwordHash: string } | undefined;
    create.mockImplementation(({ data }: { data: { email: string; passwordHash: string } }) => {
      stored = data;
      return { id: 'u1', email: data.email, passwordHash: data.passwordHash, createdAt: new Date() };
    });

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'a@b.com', password: 'password123' });

    expect(stored).toBeDefined();
    expect(stored!.passwordHash).not.toBe('password123'); // 평문 저장 금지
    expect(stored!.passwordHash.startsWith('$argon2')).toBe(true); // argon2 포맷
    expect(await argon2.verify(stored!.passwordHash, 'password123')).toBe(true);
  });

  it('POST /auth/signup 중복 email → 409', async () => {
    findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash: 'x' });

    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'a@b.com', password: 'password123' });

    expect(res.status).toBe(409);
  });

  it('POST /auth/signup email 형식 아님 → 400 (DTO 거부)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('POST /auth/signup 비번 8자 미만 → 400 (DTO 거부)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'a@b.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  // --- login ---
  it('POST /auth/login 올바른 자격 → 200 + httpOnly JWT 쿠키', async () => {
    const hash = await argon2.hash('password123');
    findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash: hash });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@b.com', password: 'password123' });

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'][0] as string;
    expect(setCookie).toMatch(new RegExp(`${COOKIE}=`));
    expect(setCookie).toMatch(/HttpOnly/i);
  });

  it('POST /auth/login 비번 불일치 → 401', async () => {
    const hash = await argon2.hash('other-password');
    findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash: hash });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@b.com', password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('POST /auth/login 미존재 email → 401 (존재 비노출, 비번불일치와 동일)', async () => {
    findUnique.mockResolvedValue(null);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ghost@b.com', password: 'password123' });
    expect(res.status).toBe(401);
  });

  // --- me (guard) ---
  it('GET /auth/me 유효 쿠키 → 200 + {userId,email}', async () => {
    const hash = await argon2.hash('password123');
    findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash: hash });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@b.com', password: 'password123' });
    const cookie = login.headers['set-cookie'];

    const me = await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie);

    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ userId: 'u1', email: 'a@b.com' });
  });

  it('GET /auth/me 쿠키 없음 → 401', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /auth/me 위조 토큰 → 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', [`${COOKIE}=forged.invalid.token`]);
    expect(res.status).toBe(401);
  });

  it('GET /auth/me 만료 토큰 → 401 (올바른 서명이라도 exp 지나면 거부)', async () => {
    // 같은 secret으로 서명하되 이미 만료된 토큰 — guard가 만료를 실제로 거부하는지 박제
    const expired = jwtService.sign({ sub: 'u1', email: 'a@b.com' }, { expiresIn: '-1s' });
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', [`${COOKIE}=${expired}`]);
    expect(res.status).toBe(401);
  });
});
