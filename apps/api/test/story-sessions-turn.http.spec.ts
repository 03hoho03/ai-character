import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GENAI_CLIENT } from '../src/chat/chat.constants';

/**
 * #50 [46b] play turn HTTP 계약 — 모델 structured 출력을 서버가 검증·clamp.
 * 핵심: GENAI_CLIENT를 canned structured 응답으로 override(실키 없이).
 * 신뢰경계 단언: 모델이 미정의 스탯 delta를 줘도 무시(rejectedKeys), clamp가 영속 인자에 반영.
 * 라우트 회귀: GET /:id(이어하기) 와 POST /:id/turn(플레이) 공존 매칭.
 */
describe('story-sessions play turn (#50 HTTP)', () => {
  let app: INestApplication;
  const sessionFindUnique = jest.fn();
  const sessionUpdate = jest.fn();
  const startSettingFindUnique = jest.fn();
  const storyFindUnique = jest.fn();
  const generateContent = jest.fn();

  const prismaStub = {
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
    $connect: async () => {},
    $disconnect: async () => {},
    user: { findUnique: jest.fn(), create: jest.fn() },
    startSetting: { findUnique: startSettingFindUnique },
    story: { findUnique: storyFindUnique },
    storySession: { findUnique: sessionFindUnique, update: sessionUpdate },
  } as unknown as PrismaService;

  const genaiStub = { models: { generateContent } };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-#50';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .overrideProvider(GENAI_CLIENT)
      .useValue(genaiStub)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    [sessionFindUnique, sessionUpdate, startSettingFindUnique, storyFindUnique, generateContent].forEach(
      (m) => m.mockReset(),
    );
  });

  function ownedSession(over: Record<string, unknown> = {}) {
    return {
      id: 'sess1',
      storyId: 'story1',
      startSettingId: 'ss1',
      statValues: { 호감도: 35, 신뢰: 12 },
      endedWith: null,
      browserId: 'b1',
      userId: null,
      ...over,
    };
  }

  function startSetting() {
    return {
      id: 'ss1',
      storyId: 'story1',
      name: '첫 만남',
      prologue: 'p',
      startSituation: 's',
      suggestedReplies: [],
      stats: [
        { name: '호감도', initialValue: 35, minValue: 0, maxValue: 100 },
        { name: '신뢰', initialValue: 12, minValue: 0, maxValue: 100 },
      ],
    };
  }

  function story() {
    return {
      id: 'story1',
      name: '도서관의 비밀',
      tagline: 't',
      promptTemplateId: null,
      storyInfo: 'info',
      developmentExamples: [],
      shortcuts: [],
      contentRating: 'all',
      visibility: 'private',
      commentsClosed: false,
    };
  }

  it('POST /:id/turn 성공 → statValues가 clamp되어 갱신, reply 반환', async () => {
    sessionFindUnique.mockResolvedValueOnce(ownedSession());
    startSettingFindUnique.mockResolvedValueOnce(startSetting());
    storyFindUnique.mockResolvedValueOnce(story());
    // 모델: 호감도 +80(98 cap 넘게) → max 100 clamp 기대
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ reply: '그녀가 미소짓는다.', statDeltas: { 호감도: 80, 신뢰: -5 } }),
    });
    sessionUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      ...ownedSession(),
      ...data,
    }));

    const res = await request(app.getHttpServer())
      .post('/story-sessions/sess1/turn')
      .send({ browserId: 'b1', message: '그녀에게 다가간다.' });

    expect(res.status).toBe(201);
    expect(res.body.reply).toBe('그녀가 미소짓는다.');
    // 35+80=115 → clamp 100 / 12-5=7
    expect(res.body.statValues).toEqual({ 호감도: 100, 신뢰: 7 });
    // 영속 인자에도 clamp 반영
    const data = sessionUpdate.mock.calls[0][0].data;
    expect(data.statValues).toEqual({ 호감도: 100, 신뢰: 7 });
  });

  it('모델이 미정의 스탯 delta 줘도 무시 + rejectedKeys 반환(신뢰경계)', async () => {
    sessionFindUnique.mockResolvedValueOnce(ownedSession());
    startSettingFindUnique.mockResolvedValueOnce(startSetting());
    storyFindUnique.mockResolvedValueOnce(story());
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ reply: 'ok', statDeltas: { 호감도: 1, 해킹: 999 } }),
    });
    sessionUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ ...data }));

    const res = await request(app.getHttpServer())
      .post('/story-sessions/sess1/turn')
      .send({ browserId: 'b1', message: 'hi' });

    expect(res.status).toBe(201);
    expect('해킹' in res.body.statValues).toBe(false);
    expect(res.body.rejectedKeys).toContain('해킹');
    expect(sessionUpdate.mock.calls[0][0].data.statValues.해킹).toBeUndefined();
  });

  it('모델 JSON 파싱 실패 → 방어(빈 reply, 스탯 변화 없음, 500 아님)', async () => {
    sessionFindUnique.mockResolvedValueOnce(ownedSession());
    startSettingFindUnique.mockResolvedValueOnce(startSetting());
    storyFindUnique.mockResolvedValueOnce(story());
    generateContent.mockResolvedValueOnce({ text: '이건 JSON이 아니다 {broken' });
    sessionUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ ...data }));

    const res = await request(app.getHttpServer())
      .post('/story-sessions/sess1/turn')
      .send({ browserId: 'b1', message: 'hi' });

    expect(res.status).toBe(201);
    expect(res.body.statValues).toEqual({ 호감도: 35, 신뢰: 12 });
  });

  it('소유 불일치 → 404 (모델 호출 안 함)', async () => {
    sessionFindUnique.mockResolvedValueOnce(ownedSession({ browserId: 'owner' }));

    const res = await request(app.getHttpServer())
      .post('/story-sessions/sess1/turn')
      .send({ browserId: 'attacker', message: 'hi' });

    expect(res.status).toBe(404);
    expect(generateContent).not.toHaveBeenCalled();
    expect(sessionUpdate).not.toHaveBeenCalled();
  });

  it('세션 부재 → 404', async () => {
    sessionFindUnique.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer())
      .post('/story-sessions/none/turn')
      .send({ browserId: 'b1', message: 'hi' });
    expect(res.status).toBe(404);
  });

  it('message 누락 → 400 (DTO 거부)', async () => {
    const res = await request(app.getHttpServer())
      .post('/story-sessions/sess1/turn')
      .send({ browserId: 'b1' });
    expect(res.status).toBe(400);
  });

  it('라우트 회귀: GET /:id(이어하기)는 turn과 별개로 매칭된다', async () => {
    sessionFindUnique.mockResolvedValueOnce(ownedSession());
    const res = await request(app.getHttpServer())
      .get('/story-sessions/sess1')
      .query({ browserId: 'b1' });
    expect(res.status).toBe(200);
    expect(generateContent).not.toHaveBeenCalled();
  });
});
