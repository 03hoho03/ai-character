import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * #34 유니크키 전환 — 스키마 토대 단언(DB 비의존).
 * 존재가 아니라 *내용*을 단언(lesson l_2026_06_18_x): browserId nullable + 두 unique 튜플 공존.
 * userId nullable + unique([userId,personaId])는 Postgres NULL-distinct로 자연 partial(비로그인 미집행),
 * browserId unique 유지가 비로그인 get-or-create 정합을 지킨다.
 */
describe('Conversation schema — 유니크키 토대 (#34)', () => {
  const schema = readFileSync(
    join(__dirname, '..', 'prisma', 'schema.prisma'),
    'utf8',
  );
  // model Conversation { ... } 블록만 추출해 다른 모델 오염 방지
  const block = schema.match(/model Conversation \{[\s\S]*?\n\}/)?.[0] ?? '';

  it('Conversation 블록이 추출된다', () => {
    expect(block).toContain('model Conversation');
  });

  it('browserId가 nullable(String?)이다 — #40 로그인 전용 생성 토대', () => {
    expect(block).toMatch(/\bbrowserId\s+String\?/);
    // NOT NULL(String, ? 없음)이 남아있지 않은지 — 약화 회귀 차단
    expect(block).not.toMatch(/\bbrowserId\s+String(?!\?)/);
  });

  it('@@unique([browserId, personaId]) 유지(비로그인 축)', () => {
    expect(block).toMatch(/@@unique\(\[browserId,\s*personaId\]\)/);
  });

  it('@@unique([userId, personaId]) 추가(로그인 축)', () => {
    expect(block).toMatch(/@@unique\(\[userId,\s*personaId\]\)/);
  });
});
