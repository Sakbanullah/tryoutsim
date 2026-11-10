/**
 * D2 self-check against the real PostgreSQL 18 schema: session creation freezes a snapshot and a tryout duration,
 * autosave moves the clock, submit stores exactly one result whose verdict follows the approval, `score_result`
 * cannot be rewritten (T-7), and the delete function is the only removal path.
 *
 * AUD-85 (verdict-only re-score through the function) and AUD-87 (config resolution pinned / fallback / resolved).
 *
 * Skipped when `DATABASE_URL_APP` is absent or unreachable; the skip is reported, never a silent pass. Every fixture
 * is created by this test and removed through `tryoutsim.delete_session` (plus its own config/package rows).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connect } from '../src/db/client.js';
import { loadConfig } from '../src/config.js';
import { approveConfig } from '../src/repositories/exam-config.js';
import { AppError } from '../src/errors.js';
import { loadScoreResult } from '../src/repositories/score-result.js';
import { createSession, deleteSession, loadResult, rescoreSession, saveAnswer, submitSession } from '../src/repositories/session.js';

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
 * Insert a self-contained fixture: one competency, N TWK questions, one provisional config with a threshold, one
 * package. Ids carry `tag` so parallel runs never collide.
 * @param {any} prisma
 * @param {{tag: string, state?: string}} input
 */
async function fixture(prisma, { tag, state = 'provisional' }) {
  const configId = `cfg-${tag}`;
  await prisma.competency.create({
    data: { id: `TWK.${tag}`, test: 'TWK', label: 'uji', goal: 'uji', tier: 'EVIDENCE-BACKED-NOT-CPNS-2026', parentId: null },
  });
  for (let i = 0; i < 3; i += 1) {
    await prisma.question.create({
      data: {
        id: `q-${tag}-${i}`, test: 'TWK', competencyId: `TWK.${tag}`, stimulus: '', stem: `s${i}`,
        optionsJson: JSON.stringify({ options: ['A', 'B', 'C', 'D', 'E'].map((key) => ({ key, text: key })) }),
        answerKeyJson: JSON.stringify({ optionScores: { A: 0, B: 5, C: 0, D: 0, E: 0 }, unansweredScore: 0, maxScore: 5 }),
        explanation: 'e', difficultyAiInitial: 'easy', lifecycle: 'active', dynamicEligible: 1,
        provenanceJson: JSON.stringify({ kind: 'human' }), contentHash: `h-${tag}-${i}`, taxonomyVersion: '2026', contentVersion: 1,
      },
    });
  }
  await prisma.examConfig.create({
    data: {
      id: configId, pathway: 'CPNS', examYear: 2026, state, dataProvenance: 'seed', durationMinutes: 1,
      itemCount: 3, twkCount: 3, tiuCount: 0, tkpCount: 0, twkWeight: 5, tiuWeight: 5, tkpWeightMin: 1, tkpWeightMax: 5,
      maxScore: 15, notice: 'UNV-01 uji', scoringVersion: 1, configVersion: 1, regulatoryBasisHash: `rh-${tag}`,
    },
  });
  await prisma.thresholds.create({
    data: { examConfigId: configId, mode: 'total_only', total: 10, sourceJson: JSON.stringify({ tier: 'HISTORICAL', pathway: 'CPNS' }) },
  });
  await prisma.package.create({ data: { id: `pkg-${tag}`, mode: 'tryout', source: 'custom', retiredAt: null } });
  const version = await prisma.packageVersion.create({
    data: {
      packageId: `pkg-${tag}`, version: 1, titleId: `paket ${tag}`, createdAt: new Date().toISOString(),
      definitionJson: JSON.stringify({ kind: 'subtest', test: 'TWK', itemCount: 3 }),
    },
  });
  return {
    configId,
    pkg: { id: `pkg-${tag}`, mode: 'tryout', retiredAt: null },
    version,
  };
}

test('session: snapshot, tryout duration, autosave clock, submit verdict follows the approval', { skip: SKIP }, async (t) => {
  const { db, reason } = await database();
  if (db === null) return t.skip(reason);
  const prisma = /** @type {any} */ (db.prisma);
  const tag = `d2s${Date.now()}`;
  const created = await fixture(prisma, { tag });
  /** @type {string} */
  let sessionId = '';
  t.after(async () => {
    await prisma.$queryRaw`SELECT tryoutsim.delete_session(${sessionId})`.catch(() => undefined);
    await prisma.examConfig.delete({ where: { id: created.configId } }).catch(() => undefined);
    await prisma.package.delete({ where: { id: `pkg-${tag}` } }).catch(() => undefined);
    await prisma.question.deleteMany({ where: { id: { startsWith: `q-${tag}-` } } }).catch(() => undefined);
    await prisma.competency.delete({ where: { id: `TWK.${tag}` } }).catch(() => undefined);
    await db.close();
  });

  const now = Date.parse('2026-11-10T08:00:00.000Z');
  const { session, snapshotVersion, configResolution } = await createSession(prisma, created, 'tryout', new Date(now).toISOString());
  assert.match(snapshotVersion, /^s1-/);
  assert.equal(configResolution, 'resolved', 'no pin: order 2');
  sessionId = session.id;
  assert.equal(session.durationMs, 60_000, 'tryout duration is the config duration');

  const saved = await saveAnswer(prisma, session.id, { questionId: `q-${tag}-0`, selected: 'B', flagged: false, elapsedActiveMs: 1000 }, now + 1000, new Date(now + 1000).toISOString());
  assert.equal(saved.activeMs, 1000);

  await approveConfig(prisma, created.configId, { configId: created.configId, acknowledgedWarnings: ['UNV-01'] }, new Date(now + 2000).toISOString());
  const scoredAt = new Date(now + 3000).toISOString();
  const result = await submitSession(prisma, session.id, null, now + 3000, scoredAt);
  assert.equal(result.total.earned, 5);
  assert.deepEqual(result.timing, { activeMs: 3000, durationMs: 60_000 }, 'timing is computed once, at scoring');
  assert.equal(result.scoredAt, scoredAt);
  assert.equal(result.withheld, null, 'a verdict was authorized');
  assert.deepEqual(result.packageBinding.packageId, `pkg-${tag}`);
  assert.equal(result.verdict.mode, 'total_only');
  assert.equal(result.verdict.passed, false);
  assert.equal(result.approval.approvedBy, 'local-user');

  const stored = await loadResult(prisma, session.id);
  assert.deepEqual(stored, result, 'the stored result is returned verbatim, never recomputed');
  assert.deepEqual(await rescoreSession(prisma, session.id, now + 4000, new Date(now + 4000).toISOString()), result, 'idempotent');

  const [row] = await prisma.$queryRaw`SELECT count(*)::int AS n FROM "score_result" WHERE "sessionId" = ${session.id}`;
  assert.equal(row.n, 1);
  // AUD-88: `timing`, `withheld` and `scoredAt` are read back from the row, not recomputed.
  const storedRow = await loadScoreResult(prisma, session.id);
  assert.deepEqual(storedRow.result.timing, result.timing);
  assert.equal(storedRow.result.withheld, null);
  assert.equal(storedRow.result.scoredAt, scoredAt);
  await assert.rejects(
    prisma.$executeRaw`UPDATE "score_result" SET "totalJson" = '{}' WHERE "sessionId" = ${session.id}`,
    (error) => error.code === '23001' || error.code === '42501',
    'T-7 (or the missing grant) refuses a score-column rewrite',
  );

  assert.equal(await deleteSession(prisma, session.id), true, 'deletion goes through the function');
  assert.equal(await deleteSession(prisma, session.id), false, 'a second call reports nothing');
});

test('AUD-85: verdict-only re-score adds a withheld verdict through the function, never by UPDATE', { skip: SKIP }, async (t) => {
  const { db, reason } = await database();
  if (db === null) return t.skip(reason);
  const prisma = /** @type {any} */ (db.prisma);
  const tag = `d2v${Date.now()}`;
  const created = await fixture(prisma, { tag });
  /** @type {string} */
  let sessionId = '';
  t.after(async () => {
    await prisma.$queryRaw`SELECT tryoutsim.delete_session(${sessionId})`.catch(() => undefined);
    await prisma.provisionalApproval.deleteMany({ where: { configId: created.configId } }).catch(() => undefined);
    await prisma.examConfig.delete({ where: { id: created.configId } }).catch(() => undefined);
    await prisma.package.delete({ where: { id: `pkg-${tag}` } }).catch(() => undefined);
    await prisma.question.deleteMany({ where: { id: { startsWith: `q-${tag}-` } } }).catch(() => undefined);
    await prisma.competency.delete({ where: { id: `TWK.${tag}` } }).catch(() => undefined);
    await db.close();
  });

  const now = Date.parse('2026-11-10T09:00:00.000Z');
  const at = (offset) => new Date(now + offset).toISOString();
  const { session } = await createSession(prisma, created, 'tryout', at(0));
  sessionId = session.id;
  await saveAnswer(prisma, session.id, { questionId: `q-${tag}-0`, selected: 'B', flagged: false, elapsedActiveMs: 500 }, now + 500, at(500));

  const withheld = await submitSession(prisma, session.id, null, now + 1000, at(1000));
  assert.equal(withheld.verdict, null, 'no approval: the verdict is withheld');
  assert.equal(withheld.withheld.code, 'APPROVAL_MISSING');

  const scored = await rescoreSession(prisma, session.id, now + 2000, at(2000));
  assert.deepEqual(scored, withheld, 'still withheld: the score stands, nothing rewritten');

  await approveConfig(prisma, created.configId, { configId: created.configId, acknowledgedWarnings: ['UNV-01'] }, at(3000));
  const withVerdict = await rescoreSession(prisma, session.id, now + 4000, at(4000));
  assert.equal(withVerdict.total.earned, 5);
  assert.equal(withVerdict.verdict.mode, 'total_only');
  assert.equal(withVerdict.withheld, null);
  assert.equal(withVerdict.approval.approvedByUserAt, at(3000));
  assert.deepEqual(withVerdict.timing, withheld.timing, 'evidence untouched');
  assert.equal(withVerdict.scoredAt, withheld.scoredAt, 'scoredAt untouched');
  assert.equal(withVerdict.snapshotVersion, withheld.snapshotVersion);

  const [again] = await prisma.$queryRaw`SELECT tryoutsim.add_session_verdict(${session.id}, '{"mode":"none"}'::jsonb, NULL, NULL) AS "added"`;
  assert.equal(again.added, false, 'a row that already carries a verdict refuses a second one');
  assert.deepEqual(await rescoreSession(prisma, session.id, now + 5000, at(5000)), withVerdict, 'idempotent once a verdict exists');
});

test('AUD-87: createSession resolves the version pin first, else the latest usable CPNS config', { skip: SKIP }, async (t) => {
  const { db, reason } = await database();
  if (db === null) return t.skip(reason);
  const prisma = /** @type {any} */ (db.prisma);
  const tag = `d2p${Date.now()}`;
  const created = await fixture(prisma, { tag });
  const pinnedId = `${created.configId}-pin`;
  const pinned = await prisma.examConfig.findUnique({ where: { id: created.configId } });
  await prisma.examConfig.create({ data: { ...pinned, id: pinnedId, configVersion: 2, regulatoryBasisHash: `rh-${tag}-pin` } });
  const sessions = [];
  t.after(async () => {
    for (const id of sessions) await prisma.$queryRaw`SELECT tryoutsim.delete_session(${id})`.catch(() => undefined);
    await prisma.$executeRawUnsafe('UPDATE "package_version" SET "examConfigId" = NULL, "examConfigVersion" = NULL WHERE "packageId" = ?', `pkg-${tag}`).catch(() => undefined);
    await prisma.examConfig.deleteMany({ where: { id: { in: [pinnedId, created.configId] } } }).catch(() => undefined);
    await prisma.package.delete({ where: { id: `pkg-${tag}` } }).catch(() => undefined);
    await prisma.question.deleteMany({ where: { id: { startsWith: `q-${tag}-` } } }).catch(() => undefined);
    await prisma.competency.delete({ where: { id: `TWK.${tag}` } }).catch(() => undefined);
    await db.close();
  });

  const pin = async (examConfigId, examConfigVersion) => {
    await prisma.$executeRawUnsafe('UPDATE "package_version" SET "examConfigId" = ?, "examConfigVersion" = ? WHERE "packageId" = ?', examConfigId, examConfigVersion, `pkg-${tag}`);
    const version = await prisma.packageVersion.findUnique({ where: { packageId_version: { packageId: `pkg-${tag}`, version: 1 } } });
    return { pkg: created.pkg, version };
  };

  const at = new Date().toISOString();
  const pinnedRun = await createSession(prisma, await pin(pinnedId, 2), 'tryout', at);
  sessions.push(pinnedRun.session.id);
  assert.equal(pinnedRun.configResolution, 'pinned');
  assert.equal(pinnedRun.session.examConfigId, pinnedId);

  const stale = await pin(pinnedId, 99);
  const fallbackRun = await createSession(prisma, stale, 'tryout', at);
  sessions.push(fallbackRun.session.id);
  assert.equal(fallbackRun.configResolution, 'fallback', 'the pin no longer matches a usable config');
  assert.equal(fallbackRun.session.examConfigId, created.configId);

  const unpinned = await createSession(prisma, await pin(null, null), 'tryout', at);
  sessions.push(unpinned.session.id);
  assert.equal(unpinned.configResolution, 'resolved');
});
