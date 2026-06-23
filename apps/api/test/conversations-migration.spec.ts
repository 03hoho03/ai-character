import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * #34 유니크키 마이그레이션 SQL 내용·순서 단언(DB 비의존).
 * 커스텀 마이그레이션이 (1) dedupe DELETE(최신 유지) → (2) browserId DROP NOT NULL →
 * (3) CREATE UNIQUE INDEX(userId,personaId)를 *이 순서로* 담아야 unique violation 없이 적용된다.
 * 단순 존재가 아니라 dedupe가 index 생성보다 앞서는지(순서)를 단언 — '토대가 후속 제약을 깬다'(l_2026_06_19) 차단.
 */
describe('Conversation 유니크키 마이그레이션 SQL (#34)', () => {
  const migrationsDir = join(__dirname, '..', 'prisma', 'migrations');

  // (userId,personaId) unique index를 만드는 마이그레이션을 찾는다
  function findMigrationSql(): { name: string; sql: string } {
    const dirs = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    for (const name of dirs) {
      let sql = '';
      try {
        sql = readFileSync(join(migrationsDir, name, 'migration.sql'), 'utf8');
      } catch {
        continue;
      }
      if (/CREATE UNIQUE INDEX[\s\S]*"Conversation"[\s\S]*"userId"[\s\S]*"personaId"/i.test(sql)) {
        return { name, sql };
      }
    }
    throw new Error('userId,personaId unique를 만드는 마이그레이션을 찾지 못함');
  }

  it('userId,personaId unique index 마이그레이션이 존재한다', () => {
    const { sql } = findMigrationSql();
    expect(sql).toMatch(/CREATE UNIQUE INDEX/i);
  });

  it('browserId를 DROP NOT NULL(nullable화)한다', () => {
    const { sql } = findMigrationSql();
    expect(sql).toMatch(/ALTER COLUMN "browserId" DROP NOT NULL/i);
  });

  it('dedupe DELETE(중복 제거)를 포함한다', () => {
    const { sql } = findMigrationSql();
    expect(sql).toMatch(/DELETE FROM "Conversation"/i);
    // 최신 유지 semantics 근거 — updatedAt 기준 정렬/비교가 들어있는지
    expect(sql).toMatch(/updatedAt/i);
  });

  it('dedupe가 unique index 생성보다 *먼저* 온다(순서 — violation 방지)', () => {
    const { sql } = findMigrationSql();
    const deleteIdx = sql.search(/DELETE FROM "Conversation"/i);
    const createIdx = sql.search(/CREATE UNIQUE INDEX/i);
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(createIdx).toBeGreaterThan(deleteIdx);
  });
});
