/**
 * #34 dedupe 동작 검증 (실 Postgres, BEGIN/ROLLBACK).
 * jest 스위트는 DB 비의존을 유지하므로(기존 계약), dedupe의 *행동* 정확성은 이 스크립트로 검증한다.
 * 마이그레이션 파일의 실제 dedupe DELETE(마커 사이)를 추출해 실행 → 테스트가 진짜 SQL에 묶인다.
 * 모든 변경은 $transaction 내에서 일어나고 마지막에 ROLLBACK 센티넬로 되돌려 dev DB를 오염시키지 않는다.
 *
 * 실행: node scripts/verify-dedupe.mjs  (DATABASE_URL 필요, 마이그레이션 적용 후)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'prisma', 'migrations');

const DEDUPE_START = '-- #34-dedupe-start';
const DEDUPE_END = '-- #34-dedupe-end';

/** 마이그레이션에서 dedupe DELETE 문(마커 사이)을 추출 */
function extractDedupeSql() {
  for (const d of readdirSync(migrationsDir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    let sql = '';
    try {
      sql = readFileSync(join(migrationsDir, d.name, 'migration.sql'), 'utf8');
    } catch {
      continue;
    }
    const s = sql.indexOf(DEDUPE_START);
    const e = sql.indexOf(DEDUPE_END);
    if (s >= 0 && e > s) {
      return sql.slice(s + DEDUPE_START.length, e).trim();
    }
  }
  throw new Error(`dedupe 마커(${DEDUPE_START}..${DEDUPE_END})를 가진 마이그레이션을 찾지 못함`);
}

const P = 'p_dedupe_test_persona';
const U = 'u_dedupe_test_user';

class Rollback extends Error {}

async function main() {
  const dedupeSql = extractDedupeSql();
  const prisma = new PrismaClient();
  const checks = [];

  try {
    await prisma.$transaction(async (tx) => {
      // dedupe는 unique index *생성 전* 마이그레이션 시점에 도는 정리다. 적용 후엔 index가 중복 seed를
      // 막으므로, 마이그레이션 시점 조건을 재현하려 트랜잭션 안에서 index를 잠시 제거(ROLLBACK으로 복원).
      await tx.$executeRawUnsafe(`DROP INDEX IF EXISTS "Conversation_userId_personaId_key"`);
      // 테스트 사용자(FK 충족)
      await tx.$executeRawUnsafe(
        `INSERT INTO "User"(id,email,"passwordHash","createdAt") VALUES ($1,$2,'x',now())`,
        U,
        `${U}@test.local`,
      );
      // A: userId=U, browserId=b1, 오래됨, 메시지 1
      // B: userId=U, browserId=b2, 최신, 메시지 2  (같은 userId+personaId → 중복)
      // C: userId=NULL, browserId=b3, 비로그인, 메시지 1 (같은 personaId지만 무변경 대상)
      const mk = async (id, userId, browserId, updatedAt) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "Conversation"(id,"browserId","personaId","userId","createdAt","updatedAt","summarizedCount")
           VALUES ($1,$2,$3,$4,now(),$5,0)`,
          id,
          browserId,
          P,
          userId,
          updatedAt,
        );
      await mk('conv_A', U, 'b_dd_1', new Date('2026-06-01T00:00:00Z'));
      await mk('conv_B', U, 'b_dd_2', new Date('2026-06-20T00:00:00Z'));
      await mk('conv_C', null, 'b_dd_3', new Date('2026-06-10T00:00:00Z'));
      const msg = async (cid, n) => {
        for (let i = 0; i < n; i++) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "Message"(id,"conversationId",role,content,"createdAt") VALUES ($1,$2,'user','x',now())`,
            `m_${cid}_${i}`,
            cid,
          );
        }
      };
      await msg('conv_A', 1);
      await msg('conv_B', 2);
      await msg('conv_C', 1);

      // 실제 마이그레이션 dedupe 실행
      await tx.$executeRawUnsafe(dedupeSql);

      // 검증
      const survivors = await tx.$queryRawUnsafe(
        `SELECT id FROM "Conversation" WHERE "personaId" = $1 ORDER BY id`,
        P,
      );
      const ids = survivors.map((r) => r.id).sort();
      checks.push(['최신(B) 생존', ids.includes('conv_B')]);
      checks.push(['older(A) 삭제', !ids.includes('conv_A')]);
      checks.push(['비로그인(C, userId null) 무변경', ids.includes('conv_C')]);
      checks.push([
        '생존은 정확히 {B,C} 2건',
        JSON.stringify(ids) === JSON.stringify(['conv_B', 'conv_C']),
      ]);

      const aMsgs = await tx.$queryRawUnsafe(
        `SELECT count(*)::int AS n FROM "Message" WHERE "conversationId" = 'conv_A'`,
      );
      checks.push(['삭제된 A의 메시지 cascade 삭제', aMsgs[0].n === 0]);

      throw new Rollback(); // 모든 변경 되돌림 — dev DB 오염 금지
    });
  } catch (e) {
    if (!(e instanceof Rollback)) {
      console.error('스크립트 오류:', e.message);
      await prisma.$disconnect();
      process.exit(2);
    }
  }
  await prisma.$disconnect();

  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? '\n[dedupe-verify] ALL PASS (ROLLBACK 완료, dev DB 무변경)' : '\n[dedupe-verify] FAIL');
  process.exit(allPass ? 0 : 1);
}

main();
