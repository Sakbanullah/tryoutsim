/**
 * BUG-011 regression against the real PostgreSQL schema: the §7.7 review block reports the content version the
 * session froze by reading the same `session_snapshot.questionsJson` shape `createSession` writes
 * (`questionVersion`), and the live version from `question.contentVersion`.
 *
 * Skipped when `DATABASE_URL_APP` is absent or unreachable. The fixture is created here and removed here.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connect } from '../src/db/client.js';
import { loadConfig } from '../src/config.js';
import { approveConfig } from '../src/repositories/exam-config.js';
import { createSession, loadReview, submitSession } from '../src/repositories/session.js';

const SKIP = !process.env.DATABASE_URL_APP && 'DATABASE_URL_APP is not set';

/** Connect as the app role, or `null` with the reason. */
async function database() {
  if (!process.env.DATABASE_URL_APP) return { db: null, reason: 'DATABASE_URL_APP is not set' };
  try {
    const db = connect(loadConfig());
    await db.prisma.$queryRaw`SELECT 1`;
    return { db, reason: '' };
  } catch (error) {
    return { db: null, reason: `database unreachable: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Run one statement as the migration role (the app role is forbidden to change append-only rows). Tests only.
 * @param {string} sql
 * @param {unknown[]} params
 */
async function withMigrator(sql, params) {
  if (!process.env.DATABASE_URL) return;
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql, params);
  } finally {
    await client.end();
  }
}

/**
 * Remove a fixture's approval, config, package (with its append-only version), questions and competency. A session
 * is removed through `delete_session` as the app role.
 * @param {any} prisma
 * @param {string} tag
 * @param {string[]} sessionIds
 */
async function cleanup(prisma, tag, sessionIds) {
  for (const id of sessionIds) await prisma.$queryRaw`SELECT tryoutsim.delete_session(${id})`.catch(() => undefined);
  await prisma.provisionalApproval.deleteMany({ where: { configId: `cfg-${tag}` } }).catch(() => undefined);
  await prisma.examConfig.deleteMany({ where: { id: `cfg-${tag}` } }).catch(() => undefined);
  // `package_version` is append-only for the app role: the version goes through the migrator connection.
  await withMigrator('DELETE FROM "package_version" WHERE "packageId" = $1', [`pkg-${tag}`]).catch(() => undefined);
  await prisma.package.deleteMany({ where: { id: `pkg-${tag}` } }).catch(() => undefined);
  await prisma.question.deleteMany({ where: { id: { startsWith: `q-${tag}-` } } }).catch(() => undefined);
  await prisma.competency.deleteMany({ where: { id: `TWK.${tag}` } }).catch(() => undefined);
}

/**
 * One competency, two TWK questions (contentVersion 2), one provisional config pinned by the package, one package.
 * @param {any} prisma
 * @param {string} tag
 */
async function fixture(prisma, tag) {
  await prisma.competency.create({
    data: { id: `TWK.${tag}`, test: 'TWK', label: 'uji', goal: 'uji', tier: 'EVIDENCE-BACKED-NOT-CPNS-2026', parentId: null },
  });
  for (let i = 0; i < 2; i += 1) {
    await prisma.question.create({
      data: {
        id: `q-${tag}-${i}`, test: 'TWK', competencyId: `TWK.${tag}`, stimulus: '', stem: `s${i}`,
        optionsJson: JSON.stringify({ options: ['A', 'B', 'C', 'D', 'E'].map((key) => ({ key, text: key })) }),
        answerKeyJson: JSON.stringify({ optionScores: { A: 0, B: 5, C: 0, D: 0, E: 0 }, unansweredScore: 0, maxScore: 5, scoringVersion: 1 }),
        explanation: 'e', difficultyAiInitial: 'easy', lifecycle: 'active', dynamicEligible: 1,
        provenanceJson: JSON.stringify({ kind: 'human' }), contentHash: `h-${tag}-${i}`, taxonomyVersion: '2026', contentVersion: 2,
      },
    });
  }
  const configVersion = 1_000_000_000 + Number(String(tag).replace(/\D/g, '').slice(-6));
  await prisma.examConfig.create({
    data: {
      id: `cfg-${tag}`, pathway: 'CPNS', examYear: 2026, state: 'provisional', dataProvenance: 'seed', durationMinutes: 1,
      itemCount: 2, twkCount: 2, tiuCount: 0, tkpCount: 0, twkWeight: 5, tiuWeight: 5, tkpWeightMin: 1, tkpWeightMax: 5,
      maxScore: 10, notice: `UNV-01 ${tag}`, scoringVersion: 1, configVersion, regulatoryBasisHash: `rh-${tag}`,
    },
  });
  await prisma.thresholds.create({
    data: { examConfigId: `cfg-${tag}`, mode: 'total_only', total: 5, sourceJson: JSON.stringify({ tier: 'HISTORICAL', pathway: 'CPNS' }) },
  });
  await prisma.package.create({ data: { id: `pkg-${tag}`, mode: 'tryout', source: 'custom', retiredAt: null } });
  const version = await prisma.packageVersion.create({
    data: {
      packageId: `pkg-${tag}`, version: 1, titleId: `paket ${tag}`, createdAt: new Date().toISOString(),
      definitionJson: JSON.stringify({ kind: 'subtest', test: 'TWK', itemCount: 2 }),
      examConfigId: `cfg-${tag}`, examConfigVersion: configVersion,
    },
  });
  return { pkg: { id: `pkg-${tag}`, mode: 'tryout', retiredAt: null }, version };
}

test('BUG-011: loadReview reports the frozen content version from the real snapshot', { skip: SKIP }, async (t) => {
  const { db, reason } = await database();
  if (db === null) return t.skip(reason);
  const prisma = /** @type {any} */ (db.prisma);
  const tag = `b11${Date.now()}`;
  /** @type {string[]} */
  const sessionIds = [];
  t.after(async () => {
    await cleanup(prisma, tag, sessionIds);
    await db.close();
  });

  const created = await fixture(prisma, tag);
  const now = Date.parse('2026-11-12T08:00:00.000Z');
  const { session } = await createSession(prisma, created, 'tryout', new Date(now).toISOString());
  sessionIds.push(session.id);

  // The snapshot stores the version under `questionVersion` — the shape the buggy read missed.
  const snapshot = await prisma.sessionSnapshot.findUnique({ where: { sessionId: session.id } });
  assert.equal(JSON.parse(snapshot.questionsJson)[0].questionVersion, 2);

  await approveConfig(prisma, `cfg-${tag}`, { configId: `cfg-${tag}`, acknowledgedWarnings: ['UNV-01'] }, new Date(now + 2000).toISOString());
  await submitSession(prisma, session.id, null, now + 3000, new Date(now + 3000).toISOString());

  const ids = [`q-${tag}-0`, `q-${tag}-1`];
  const same = await loadReview(prisma, session.id, ids.join(','));
  for (const block of same.questions) {
    assert.equal(block.frozenContentVersion, 2, 'BUG-011: an integer, not undefined');
    assert.equal(block.latestContentVersion, 2);
    assert.equal(block.frozenContentVersion, block.latestContentVersion);
  }

  // One question edited after the session: its two versions must differ; the untouched one still matches.
  await prisma.question.update({ where: { id: ids[0] }, data: { contentVersion: 3, explanation: 'e2' } });
  const mixed = await loadReview(prisma, session.id, ids.join(','));
  const [edited, untouched] = mixed.questions;
  assert.equal(edited.frozenContentVersion, 2);
  assert.equal(edited.latestContentVersion, 3);
  assert.notEqual(edited.frozenContentVersion, edited.latestContentVersion);
  assert.equal(untouched.frozenContentVersion, untouched.latestContentVersion);
});
