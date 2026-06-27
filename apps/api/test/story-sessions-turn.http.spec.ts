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

  // ---- #51 엔딩 결정론 평가 ----
  function startSettingWithEnding() {
    return {
      ...startSetting(),
      endings: [
        {
          id: 'happy',
          name: '해피엔딩',
          resultText: '둘은 행복하게 살았다.',
          priority: 0,
          condition: [{ stat: '호감도', op: '>=', value: 100 }],
        },
      ],
    };
  }

  it('#51 스탯이 엔딩 조건 충족 → ended=true, ending 반환, endedWith 영속', async () => {
    sessionFindUnique.mockResolvedValueOnce(ownedSession());
    startSettingFindUnique.mockResolvedValueOnce(startSettingWithEnding());
    storyFindUnique.mockResolvedValueOnce(story());
    // 호감도 35+80=115 → clamp 100 → 조건 >=100 충족
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ reply: '마지막 장면.', statDeltas: { 호감도: 80 } }),
    });
    sessionUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ ...data }));

    const res = await request(app.getHttpServer())
      .post('/story-sessions/sess1/turn')
      .send({ browserId: 'b1', message: '고백한다.' });

    expect(res.status).toBe(201);
    expect(res.body.ended).toBe(true);
    expect(res.body.ending).toEqual({
      id: 'happy',
      name: '해피엔딩',
      resultText: '둘은 행복하게 살았다.',
    });
    // endedWith 영속
    expect(sessionUpdate.mock.calls[0][0].data.endedWith).toBe('happy');
  });

  it('#51 조건 미충족 → ended=false, ending=null, endedWith 미영속', async () => {
    sessionFindUnique.mockResolvedValueOnce(ownedSession());
    startSettingFindUnique.mockResolvedValueOnce(startSettingWithEnding());
    storyFindUnique.mockResolvedValueOnce(story());
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ reply: '아직 이야기 중.', statDeltas: { 호감도: 5 } }),
    });
    sessionUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ ...data }));

    const res = await request(app.getHttpServer())
      .post('/story-sessions/sess1/turn')
      .send({ browserId: 'b1', message: '대화한다.' });

    expect(res.body.ended).toBe(false);
    expect(res.body.ending).toBeNull();
    expect('endedWith' in sessionUpdate.mock.calls[0][0].data).toBe(false);
  });

  it('#51 엔딩은 clamp된 값으로 평가(raw는 조건 충족이나 clamp 후 미충족 → 트리거 안 함)', async () => {
    // 호감도 max를 50으로 낮춘 시작설정 + 조건 >=80. raw 35+100=135는 80 넘지만 clamp 50 → 미충족.
    const ss = {
      ...startSetting(),
      stats: [{ name: '호감도', initialValue: 35, minValue: 0, maxValue: 50 }],
      endings: [
        {
          id: 'cap',
          name: '한계돌파',
          resultText: '...',
          priority: 0,
          condition: [{ stat: '호감도', op: '>=', value: 80 }],
        },
      ],
    };
    sessionFindUnique.mockResolvedValueOnce(ownedSession({ statValues: { 호감도: 35 } }));
    startSettingFindUnique.mockResolvedValueOnce(ss);
    storyFindUnique.mockResolvedValueOnce(story());
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ reply: 'x', statDeltas: { 호감도: 100 } }),
    });
    sessionUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ ...data }));

    const res = await request(app.getHttpServer())
      .post('/story-sessions/sess1/turn')
      .send({ browserId: 'b1', message: 'go' });

    expect(res.body.statValues.호감도).toBe(50); // clamp
    expect(res.body.ended).toBe(false); // clamp 50 < 80 → 미충족(raw 135였다면 트리거됐을 것)
    expect('endedWith' in sessionUpdate.mock.calls[0][0].data).toBe(false);
  });

  it('#51 이미 종료된 세션 → 모델 호출 없이 엔딩 반환', async () => {
    sessionFindUnique.mockResolvedValueOnce(ownedSession({ endedWith: 'happy' }));
    startSettingFindUnique.mockResolvedValueOnce(startSettingWithEnding());
    storyFindUnique.mockResolvedValueOnce(story());

    const res = await request(app.getHttpServer())
      .post('/story-sessions/sess1/turn')
      .send({ browserId: 'b1', message: '계속한다.' });

    expect(res.status).toBe(201);
    expect(res.body.ended).toBe(true);
    expect(res.body.ending.id).toBe('happy');
    expect(generateContent).not.toHaveBeenCalled();
    expect(sessionUpdate).not.toHaveBeenCalled();
  });
});
