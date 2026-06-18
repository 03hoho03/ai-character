import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * #24 GET /characters/public?q= HTTP 계약 테스트 (CLAUDE.md 규약: 신규/변경 엔드포인트는
 * supertest로 라우트 매칭 + status + DTO 거부를 검증). prisma.character.findMany를 stub해
 * 컨트롤러→서비스 배선과 q 쿼리 전달을 확인한다. 라우트 순서('public'이 ':id'보다 먼저)도 함께 검증.
 */
const publicChar = { id: 'usr-pub', name: '엘베리아', tagline: '엘프 마법사', isPublic: true };

describe('GET /characters/public (HTTP contract)', () => {
  let app: INestApplication;
  const findMany = jest.fn();

  const prismaStub = {
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
    $connect: async () => {},
    $disconnect: async () => {},
    character: { findMany },
  } as unknown as PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([publicChar]);
  });

  it('q 없으면 200 + 공개 목록(라우트 public이 :id보다 먼저 매칭)', async () => {
    const res = await request(app.getHttpServer()).get('/characters/public');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([publicChar]);
    // :id로 가로채였다면 findUnique 경로 → 목록이 아님. findMany 호출이 라우트 순서 정합을 증명
    expect(findMany).toHaveBeenCalledTimes(1);
    // #26 기본 공개목록은 일반(all)만 — 성인은 opt-in 없이는 노출되지 않는다
    expect(findMany.mock.calls[0][0].where).toEqual({ isPublic: true, contentRating: 'all' });
  });

  it('q=마법 → 200 + q를 name/tagline 필터로 서비스에 전달', async () => {
    const res = await request(app.getHttpServer()).get('/characters/public').query({ q: '마법' });

    expect(res.status).toBe(200);
    const where = findMany.mock.calls[0][0].where;
    expect(where.isPublic).toBe(true);
    expect(where.OR).toEqual([
      { name: { contains: '마법', mode: 'insensitive' } },
      { tagline: { contains: '마법', mode: 'insensitive' } },
    ]);
  });

  it('q가 배열(다중 전달)이면 400 (Query DTO @IsString 거부)', async () => {
    const res = await request(app.getHttpServer())
      .get('/characters/public')
      .query('q=a&q=b');

    expect(res.status).toBe(400);
  });

  // #25 태그/카테고리 필터
  it('category=판타지 → 200 + isPublic 고정 + category 등호 필터', async () => {
    const res = await request(app.getHttpServer())
      .get('/characters/public')
      .query({ category: '판타지' });

    expect(res.status).toBe(200);
    const where = findMany.mock.calls[0][0].where;
    expect(where.isPublic).toBe(true);
    expect(where.category).toBe('판타지');
  });

  it('tag=마법 → 200 + tags has 필터(공개 목록만 대상)', async () => {
    const res = await request(app.getHttpServer())
      .get('/characters/public')
      .query({ tag: '마법' });

    expect(res.status).toBe(200);
    const where = findMany.mock.calls[0][0].where;
    expect(where.isPublic).toBe(true);
    expect(where.tags).toEqual({ has: '마법' });
  });

  it('q+category+tag 동시 → 검색 OR와 등호/has 필터를 함께 AND한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/characters/public')
      .query({ q: '엘프', category: '판타지', tag: '마법' });

    expect(res.status).toBe(200);
    const where = findMany.mock.calls[0][0].where;
    expect(where.isPublic).toBe(true);
    expect(where.category).toBe('판타지');
    expect(where.tags).toEqual({ has: '마법' });
    expect(where.OR).toEqual([
      { name: { contains: '엘프', mode: 'insensitive' } },
      { tagline: { contains: '엘프', mode: 'insensitive' } },
    ]);
  });

  it('tag가 배열(다중 전달)이면 400 (Query DTO @IsString 거부)', async () => {
    const res = await request(app.getHttpServer())
      .get('/characters/public')
      .query('tag=a&tag=b');

    expect(res.status).toBe(400);
  });

  // #26 콘텐츠 등급 필터 — 기본 일반만, 성인은 opt-in
  it('기본(includeAdult 없음) → contentRating=all로 성인 제외(내용 단언)', async () => {
    const res = await request(app.getHttpServer())
      .get('/characters/public')
      .query({ category: '판타지' });

    expect(res.status).toBe(200);
    const where = findMany.mock.calls[0][0].where;
    expect(where.isPublic).toBe(true);
    // baseline이 약화돼(성인 노출) GREEN이면 안 됨 — 등급 값 자체를 단언
    expect(where.contentRating).toBe('all');
  });

  it('includeAdult=true → contentRating 제약을 풀어 성인 포함(등급 키 부재)', async () => {
    const res = await request(app.getHttpServer())
      .get('/characters/public')
      .query({ includeAdult: 'true' });

    expect(res.status).toBe(200);
    const where = findMany.mock.calls[0][0].where;
    expect(where.isPublic).toBe(true);
    expect(where.contentRating).toBeUndefined();
  });

  it('includeAdult=false → 명시적으로도 일반만(contentRating=all)', async () => {
    const res = await request(app.getHttpServer())
      .get('/characters/public')
      .query({ includeAdult: 'false' });

    expect(res.status).toBe(200);
    expect(findMany.mock.calls[0][0].where.contentRating).toBe('all');
  });

  it('includeAdult가 true/false 외 값이면 400 (Query DTO @IsIn 거부)', async () => {
    const res = await request(app.getHttpServer())
      .get('/characters/public')
      .query({ includeAdult: 'yes' });

    expect(res.status).toBe(400);
  });

  it('POST /characters: contentRating이 all/adult 외면 400 (@IsIn 거부 — 신뢰경계)', async () => {
    const res = await request(app.getHttpServer())
      .post('/characters')
      .send({
        id: 'usr-x',
        browserId: 'b1',
        name: '이름',
        tagline: '한줄',
        personality: '성격',
        speechStyle: '말투',
        worldview: '세계관',
        greeting: '인사',
        exampleDialogue: [{ user: 'u', model: 'm' }],
        contentRating: 'teen', // 허용 enum 밖
      });

    expect(res.status).toBe(400);
  });
});
