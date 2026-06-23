import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { PERSONA_TEMPLATES } from '@ai-character/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * #41 대화 목록/삭제 HTTP 계약 테스트. GET /conversations/list(소유 목록, 캐릭터명 해석),
 * DELETE /conversations/:id(소유자만 204, 비소유 404). 라우트 매칭: /list가 단건 GET·:id 계열과 공존.
 * PrismaService.user·conversation·character stub override, signup으로 실 쿠키 발급.
 */
describe('conversations 목록/삭제 (#41 HTTP)', () => {
  let app: INestApplication;
  const userFindUnique = jest.fn();
  const userCreate = jest.fn();
  const convFindUnique = jest.fn();
  const convFindMany = jest.fn();
  const convDelete = jest.fn();
  const charFindMany = jest.fn();

  const prismaStub = {
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
    $connect: async () => {},
    $disconnect: async () => {},
    user: { findUnique: userFindUnique, create: userCreate },
    conversation: { findUnique: convFindUnique, findMany: convFindMany, delete: convDelete },
    character: { findMany: charFindMany },
  } as unknown as PrismaService;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-#41';
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
    [userFindUnique, userCreate, convFindUnique, convFindMany, convDelete, charFindMany].forEach((m) =>
      m.mockReset(),
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

  // --- 목록 ---
  it('GET /conversations/list 비로그인 → browserId 소유 목록(캐릭터명 해석)', async () => {
    const tpl = PERSONA_TEMPLATES[0];
    const now = new Date().toISOString();
    convFindMany.mockResolvedValueOnce([
      { id: 'c1', personaId: tpl.id, updatedAt: now, messages: [{ role: 'user', content: 'hi', createdAt: now }] },
      { id: 'c2', personaId: 'usr-a', updatedAt: now, messages: [] },
    ]);
    charFindMany.mockResolvedValueOnce([{ id: 'usr-a', name: '내캐릭' }]);

    const res = await request(app.getHttpServer()).get('/conversations/list').query({ browserId: 'b1' });

    expect(res.status).toBe(200);
    expect(convFindMany.mock.calls[0][0].where).toEqual({ browserId: 'b1' });
    expect(res.body).toEqual([
      { id: 'c1', personaId: tpl.id, characterName: tpl.name, lastMessage: { role: 'user', content: 'hi', createdAt: now }, updatedAt: now },
      { id: 'c2', personaId: 'usr-a', characterName: '내캐릭', lastMessage: null, updatedAt: now },
    ]);
  });

  it('GET /conversations/list 로그인 → userId 소유 목록', async () => {
    const cookie = await loginCookie();
    convFindMany.mockResolvedValueOnce([]);
    charFindMany.mockResolvedValueOnce([]);

    const res = await request(app.getHttpServer()).get('/conversations/list').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(convFindMany.mock.calls[0][0].where).toEqual({ userId: 'user-1' });
  });

  it('라우트 매칭: /list는 목록 핸들러(단건 GET /conversations?personaId= 와 분리)', async () => {
    // 단건 복원은 여전히 findUnique 경로 — /list가 이를 가로채지 않음
    convFindUnique.mockResolvedValueOnce({ id: 'c9', browserId: 'b1', messages: [] });
    const single = await request(app.getHttpServer())
      .get('/conversations')
      .query({ browserId: 'b1', personaId: 'tpl-x' });
    expect(single.status).toBe(200);
    expect(convFindUnique).toHaveBeenCalled();
    expect(convFindMany).not.toHaveBeenCalled();
  });

  // --- 삭제 ---
  it('DELETE /conversations/:id 소유자 → 204 + delete 호출', async () => {
    convFindUnique.mockResolvedValueOnce({ id: 'c1', browserId: 'b1', userId: null });
    convDelete.mockResolvedValueOnce({ id: 'c1' });

    const res = await request(app.getHttpServer()).delete('/conversations/c1').query({ browserId: 'b1' });

    expect(res.status).toBe(204);
    expect(convDelete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('DELETE /conversations/:id 비소유 → 404 (delete 미호출)', async () => {
    convFindUnique.mockResolvedValueOnce({ id: 'c1', browserId: 'owner', userId: null });

    const res = await request(app.getHttpServer()).delete('/conversations/c1').query({ browserId: 'attacker' });

    expect(res.status).toBe(404);
    expect(convDelete).not.toHaveBeenCalled();
  });

  it('DELETE /conversations/:id 로그인 사용자가 자기 userId 대화 삭제 → 204', async () => {
    const cookie = await loginCookie();
    convFindUnique.mockResolvedValueOnce({ id: 'c1', userId: 'user-1', browserId: null });
    convDelete.mockResolvedValueOnce({ id: 'c1' });

    const res = await request(app.getHttpServer()).delete('/conversations/c1').set('Cookie', cookie);

    expect(res.status).toBe(204);
  });
});
