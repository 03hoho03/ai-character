import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * #44 스토리 제작 API HTTP 계약 테스트 (CLAUDE.md 규약: 신규 엔드포인트는 supertest로
 * 라우트 매칭 + 성공 status + DTO 거부(400)를 검증). PrismaService를 stub override해 실 DB 미의존.
 * - POST /stories 중첩 생성 위임 인자 검증(+ OwnerContext 기록)
 * - DTO 거부(필수 누락/잘못된 op/visibility → 400, 신뢰경계 strip)
 * - 소유 불일치 404, 위조 browserId/userId 무시(쿠키 우선)
 * - PATCH contentRating 불변(strip돼 갱신 데이터에 안 들어감)
 * - GET /stories(목록) vs GET /stories/:id 라우트 분리(리터럴 vs :param 회귀)
 */
describe('stories 제작 API (#44 HTTP 계약)', () => {
  let app: INestApplication;
  const userFindUnique = jest.fn();
  const userCreate = jest.fn();
  const storyFindUnique = jest.fn();
  const storyFindMany = jest.fn();
  const storyCreate = jest.fn();
  const storyUpdate = jest.fn();
  const storyDelete = jest.fn();
  const txFn = jest.fn();

  const prismaStub = {
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
    $connect: async () => {},
    $disconnect: async () => {},
    $transaction: (arg: unknown) => txFn(arg),
    user: { findUnique: userFindUnique, create: userCreate },
    story: {
      findUnique: storyFindUnique,
      findMany: storyFindMany,
      create: storyCreate,
      update: storyUpdate,
      delete: storyDelete,
    },
  } as unknown as PrismaService;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-#44';
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
    [
      userFindUnique,
      userCreate,
      storyFindUnique,
      storyFindMany,
      storyCreate,
      storyUpdate,
      storyDelete,
      txFn,
    ].forEach((m) => m.mockReset());
    // 기본: $transaction(fn) 형태면 콜백 실행, story.create 위임
    txFn.mockImplementation((arg: unknown) =>
      typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prismaStub) : arg,
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

  const storyBody = (over: Record<string, unknown> = {}) => ({
    name: '운명의 학원',
    tagline: '선택이 운명을 바꾼다',
    storyInfo: '마법 학원 배경의 인터랙티브 픽션',
    developmentExamples: [{ input: '문을 연다', output: '복도가 펼쳐진다' }],
    shortcuts: [{ label: '상태', command: '/status' }],
    startSettings: [
      {
        name: '입학 첫날',
        prologue: '프롤로그',
        startSituation: '교문 앞',
        suggestedReplies: ['안녕'],
        stats: [{ name: '호감도', initialValue: 10, minValue: 0, maxValue: 100 }],
        endings: [
          {
            name: '해피엔딩',
            condition: [{ stat: '호감도', op: '>=', value: 80 }],
            resultText: '둘은 행복했다',
          },
        ],
      },
    ],
    ...over,
  });

  it('POST /stories 비로그인 → 201 + 중첩 생성 위임 + browserId 소유 기록', async () => {
    storyCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'story-1',
      ...data,
    }));

    const res = await request(app.getHttpServer())
      .post('/stories')
      .send(storyBody({ browserId: 'b1' }));

    expect(res.status).toBe(201);
    const data = storyCreate.mock.calls[0][0].data;
    expect(data.browserId).toBe('b1');
    expect(data.userId).toBeUndefined();
    // 중첩 생성: startSettings nested write 위임
    expect(data.startSettings.create).toBeDefined();
    const ss = data.startSettings.create[0];
    expect(ss.name).toBe('입학 첫날');
    expect(ss.stats.create[0].name).toBe('호감도');
    expect(ss.endings.create[0].name).toBe('해피엔딩');
  });

  it('POST /stories 로그인 → userId 소유(browserId 없이), 위조 browserId 무시', async () => {
    const cookie = await loginCookie();
    storyCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'story-2',
      ...data,
    }));

    const res = await request(app.getHttpServer())
      .post('/stories')
      .set('Cookie', cookie)
      .send(storyBody({ browserId: 'forged' }));

    expect(res.status).toBe(201);
    const data = storyCreate.mock.calls[0][0].data;
    expect(data.userId).toBe('user-1');
    expect(data.browserId).toBeUndefined();
  });

  it('POST /stories userId를 body로 위조해도 무시(쿠키만 신뢰)', async () => {
    storyCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'story-3',
      ...data,
    }));

    await request(app.getHttpServer())
      .post('/stories')
      .send({ ...storyBody({ browserId: 'b1' }), userId: 'attacker' });

    const data = storyCreate.mock.calls[0][0].data;
    expect(data.browserId).toBe('b1');
    expect(data.userId).toBeUndefined();
  });

  it('POST /stories 필수 누락(name 없음) → 400', async () => {
    const body = storyBody({ browserId: 'b1' }) as Record<string, unknown>;
    delete body.name;
    const res = await request(app.getHttpServer()).post('/stories').send(body);
    expect(res.status).toBe(400);
  });

  it('POST /stories 잘못된 엔딩 op → 400 (@IsIn 거부)', async () => {
    const bad = storyBody({ browserId: 'b1' });
    bad.startSettings[0].endings[0].condition[0].op = '!=' as never;
    const res = await request(app.getHttpServer()).post('/stories').send(bad);
    expect(res.status).toBe(400);
  });

  it('POST /stories 잘못된 visibility → 400 (@IsIn 거부)', async () => {
    const res = await request(app.getHttpServer())
      .post('/stories')
      .send(storyBody({ browserId: 'b1', visibility: 'everyone' }));
    expect(res.status).toBe(400);
  });

  it('POST /stories 비로그인 + browserId 없음 → 400 (소유 식별자 필요)', async () => {
    const res = await request(app.getHttpServer()).post('/stories').send(storyBody());
    expect(res.status).toBe(400);
  });

  it('GET /stories → 200 + 내 목록(ownerWhere)', async () => {
    storyFindMany.mockResolvedValueOnce([]);
    const res = await request(app.getHttpServer()).get('/stories').query({ browserId: 'b1' });
    expect(res.status).toBe(200);
    expect(storyFindMany.mock.calls[0][0].where).toEqual({ browserId: 'b1' });
  });

  it('GET /stories/:id 소유자 비공개 → 200', async () => {
    storyFindUnique.mockResolvedValueOnce({
      id: 'story-x',
      browserId: 'b1',
      userId: null,
      visibility: 'private',
    });
    const res = await request(app.getHttpServer())
      .get('/stories/story-x')
      .query({ browserId: 'b1' });
    expect(res.status).toBe(200);
  });

  it('GET /stories/:id 비소유 비공개 → 404 (존재 비노출)', async () => {
    storyFindUnique.mockResolvedValueOnce({
      id: 'story-x',
      browserId: 'someone',
      userId: null,
      visibility: 'private',
    });
    const res = await request(app.getHttpServer())
      .get('/stories/story-x')
      .query({ browserId: 'b1' });
    expect(res.status).toBe(404);
  });

  it('GET /stories/:id 공개 스토리는 비소유도 → 200', async () => {
    storyFindUnique.mockResolvedValueOnce({
      id: 'story-pub',
      browserId: 'someone',
      userId: null,
      visibility: 'public',
    });
    const res = await request(app.getHttpServer())
      .get('/stories/story-pub')
      .query({ browserId: 'b1' });
    expect(res.status).toBe(200);
  });

  // 라우트 순서 회귀: GET /stories(목록) vs GET /stories/:id(단건) 분리.
  it('라우트 분리: GET /stories는 목록(findMany), GET /stories/:id는 단건(findUnique)', async () => {
    storyFindMany.mockResolvedValueOnce([]);
    await request(app.getHttpServer()).get('/stories').query({ browserId: 'b1' });
    expect(storyFindMany).toHaveBeenCalledTimes(1);
    expect(storyFindUnique).not.toHaveBeenCalled();

    storyFindUnique.mockResolvedValueOnce({
      id: 'abc',
      browserId: 'b1',
      userId: null,
      visibility: 'public',
    });
    await request(app.getHttpServer()).get('/stories/abc').query({ browserId: 'b1' });
    expect(storyFindUnique).toHaveBeenCalledTimes(1);
    // 목록이 :id로 가로채이지 않았음(findMany 추가 호출 없음)
    expect(storyFindMany).toHaveBeenCalledTimes(1);
  });

  it('PATCH /stories/:id 소유자 → 200 + 부분 갱신, contentRating 변경 시도 strip(불변)', async () => {
    storyFindUnique.mockResolvedValueOnce({
      id: 'story-x',
      browserId: 'b1',
      userId: null,
      visibility: 'private',
      contentRating: 'all',
    });
    storyUpdate.mockResolvedValueOnce({ id: 'story-x' });

    const res = await request(app.getHttpServer())
      .patch('/stories/story-x')
      .send({ browserId: 'b1', name: '새 이름', contentRating: 'adult' });

    expect(res.status).toBe(200);
    const data = storyUpdate.mock.calls[0][0].data;
    expect(data.name).toBe('새 이름');
    // contentRating은 DTO whitelist로 strip → 갱신 데이터에 절대 없음(불변 집행)
    expect('contentRating' in data).toBe(false);
  });

  it('PATCH /stories/:id 비소유 → 404', async () => {
    storyFindUnique.mockResolvedValueOnce({
      id: 'story-x',
      browserId: 'someone',
      userId: null,
      visibility: 'private',
      contentRating: 'all',
    });
    const res = await request(app.getHttpServer())
      .patch('/stories/story-x')
      .send({ browserId: 'b1', name: 'x' });
    expect(res.status).toBe(404);
  });

  it('DELETE /stories/:id 소유자 → 204', async () => {
    storyFindUnique.mockResolvedValueOnce({
      id: 'story-x',
      browserId: 'b1',
      userId: null,
      visibility: 'private',
    });
    storyDelete.mockResolvedValueOnce({ id: 'story-x' });
    const res = await request(app.getHttpServer())
      .delete('/stories/story-x')
      .query({ browserId: 'b1' });
    expect(res.status).toBe(204);
  });

  it('DELETE /stories/:id 비소유 → 404 (삭제 미위임)', async () => {
    storyFindUnique.mockResolvedValueOnce({
      id: 'story-x',
      browserId: 'someone',
      userId: null,
      visibility: 'private',
    });
    const res = await request(app.getHttpServer())
      .delete('/stories/story-x')
      .query({ browserId: 'b1' });
    expect(res.status).toBe(404);
    expect(storyDelete).not.toHaveBeenCalled();
  });
});
