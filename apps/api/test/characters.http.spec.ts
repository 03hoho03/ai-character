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
    expect(findMany.mock.calls[0][0].where).toEqual({ isPublic: true });
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
});
