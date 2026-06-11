import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * HTTP 계약 테스트 — 실키 없이 검증 가능한 런타임 동작.
 * TestingModule + supertest는 포트를 점유하지 않음
 * (lesson x_dev_server_check_side_effects 적용: 포트/pkill 회피).
 */
describe('POST /chat (HTTP contract, GEMINI_API_KEY 미설정)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    delete process.env.GEMINI_API_KEY; // 키 미설정 상태 강제
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('유효한 body + 키 미설정 → 503 + GEMINI_API_KEY 안내', async () => {
    const res = await request(app.getHttpServer())
      .post('/chat')
      .send({ messages: [{ role: 'user', content: '안녕' }] });

    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).toContain('GEMINI_API_KEY');
  });

  it('빈 messages → 400', async () => {
    const res = await request(app.getHttpServer()).post('/chat').send({ messages: [] });

    expect(res.status).toBe(400);
  });

  it('잘못된 role → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/chat')
      .send({ messages: [{ role: 'assistant', content: 'hi' }] });

    expect(res.status).toBe(400);
  });

  it('content 누락 → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/chat')
      .send({ messages: [{ role: 'user' }] });

    expect(res.status).toBe(400);
  });

  it('/health 회귀 없음 → 200', async () => {
    const res = await request(app.getHttpServer()).get('/health');

    expect(res.status).toBe(200);
  });
});
