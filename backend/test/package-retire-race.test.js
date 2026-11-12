/**
 * BUG-002 against the real PostgreSQL 18 schema: retiring a package and creating a session from it are ordered by
 * one row lock, so a session is never created from a package whose retire already committed (PACKAGE_SPECIFICATION
 * §5, API_SPECIFICATION §7.4 "package exists, is not retired").
 *
 * Scenario (deterministic, no sleeping for an unknown interval):
 *   1. A second `pg` client opens its own transaction and takes `FOR UPDATE` on the package row — a retire in flight.
 *   2. `createSession` is started against the snapshot's package and must block at its own `FOR SHARE`.
 *   3. The second client sets `retiredAt` and commits.
 *   4. `createSession` resumes, sees the retired row, and must throw `409 package_retired`; no `session` row exists.
 *   5. The reverse order: the retire waits for an uncommitted session transaction and then succeeds.
 * Skipped when `DATABASE_URL_APP` is absent or unreachable; fixture rows are this test's own and removed at the end.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import pg from 'pg';
import { connect } from '../src/db/client.js';
import { loadConfig } from '../src/config.js';
import { AppError } from '../src/errors.js';
import { findPackage, retirePackage } from '../src/repositories/package.js';
import { createSession } from '../src/repositories/session.js';

const SKIP = !process.env.DATABASE_URL_APP && 'DATABASE_URL_APP is not set';

/** How long a step may take before the test calls it a hang (a lock that never releases, not a slow machine). */
const DEADLINE_MS = 15_000;

/**
 * Connect as the app role, or `null` with the reason.
 * @returns {Promise<{db: ReturnType<typeof connect> | null, reason: string}>}
 */
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
 * Insert a self-contained fixture: one competency, three TWK questions, one pinned config, one package. The package
 * has no session, so `delete_session` is never needed; the app role may delete the rest.
 * @param {any} prisma
 * @param {string} tag
 * @returns {Promise<{pkg: object, version: object}>} what `findPackage` returns
 */
async function fixture(prisma, tag) {
  const configId = `cfg-${tag}`;
  await prisma.competency.create({
    data: { id: `TWK.${tag}`, test: 'TWK', label: 'uji', goal: 'uji', tier: 'EVIDENCE-BACKED-NOT-CPNS-2026', parentId: null },
  });
  for (let i = 0; i < 3; i += 1) {
    await prisma.question.create({
      data: {
        id: `q-${tag}-${i}`, test: 'TWK', competencyId: `TWK.${tag}`, stimulus: '', stem: `s${i}`,
        optionsJson: JSON.stringify({ options: ['A', 'B', 'C', 'D', 'E'].map((key) => ({ key, text: key })) }),
        answerKeyJson: JSON.stringify({ optionScores: { A: 0, B: 5, C: 0, D: 0, E: 0 }, unansweredScore: 0, maxScore: 5, scoringVersion: 1 }),
        explanation: 'e', difficultyAiInitial: 'easy', lifecycle: 'active', dynamicEligible: 1,
        provenanceJson: JSON.stringify({ kind: 'human' }), contentHash: `h-${tag}-${i}`, taxonomyVersion: '2026', contentVersion: 1,
      },
    });
  }
  const configVersion = 1_000_000_000 + Number(String(tag).replace(/\D/g, '').slice(-6));
  await prisma.examConfig.create({
    data: {
      id: configId, pathway: 'CPNS', examYear: 2026, state: 'provisional', dataProvenance: 'seed', durationMinutes: 1,
      itemCount: 3, twkCount: 3, tiuCount: 0, tkpCount: 0, twkWeight: 5, tiuWeight: 5, tkpWeightMin: 1, tkpWeightMax: 5,
      maxScore: 15, notice: 'UNV-01 uji', scoringVersion: 1, configVersion, regulatoryBasisHash: `rh-${tag}`,
    },
  });
  await prisma.thresholds.create({
    data: { examConfigId: configId, mode: 'total_only', total: 10, sourceJson: JSON.stringify({ tier: 'HISTORICAL', pathway: 'CPNS' }) },
  });
  await prisma.package.create({ data: { id: `pkg-${tag}`, mode: 'tryout', source: 'custom', retiredAt: null } });
  await prisma.packageVersion.create({
    data: {
      packageId: `pkg-${tag}`, version: 1, titleId: `paket ${tag}`, createdAt: new Date().toISOString(),
      definitionJson: JSON.stringify({ kind: 'subtest', test: 'TWK', itemCount: 3 }),
      examConfigId: configId, examConfigVersion: configVersion,
    },
  });
  return findPackage(prisma, `pkg-${tag}`);
}

/**
 * Remove a fixture's rows in foreign-key order.
 * @param {any} prisma
 * @param {string} tag
 */
async function cleanup(prisma, tag) {
  await prisma.session.deleteMany({ where: { packageId: `pkg-${tag}` } }).catch(() => undefined);
  await prisma.packageVersion.deleteMany({ where: { packageId: `pkg-${tag}` } }).catch(() => undefined);
  await prisma.package.deleteMany({ where: { id: `pkg-${tag}` } }).catch(() => undefined);
  await prisma.thresholds.deleteMany({ where: { examConfigId: `cfg-${tag}` } }).catch(() => undefined);
  await prisma.examConfig.deleteMany({ where: { id: `cfg-${tag}` } }).catch(() => undefined);
  await prisma.question.deleteMany({ where: { id: { startsWith: `q-${tag}-` } } }).catch(() => undefined);
  await prisma.competency.deleteMany({ where: { id: `TWK.${tag}` } }).catch(() => undefined);
}

/**
 * Resolve with `promise`, or reject once `ms` pass — so a missing lock release fails the test instead of hanging it.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 */
function within(promise, ms) {
  /** @type {NodeJS.Timeout} */
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return /** @type {Promise<T>} */ (Promise.race([promise, deadline])).finally(() => clearTimeout(timer));
}

/** `true` for the `AppError` the contract names, `false` for anything else (a bug, not a lost race). */
function isRetiredConflict(error) {
  return error instanceof AppError && error.status === 409 && error.details?.resource === 'package' && error.details?.reason === 'package_retired';
}

test('BUG-002: a session waits for a retire in flight and is refused once it commits', { skip: SKIP }, async (t) => {
  const { db, reason } = await database();
  if (db === null) return t.skip(reason);
  const prisma = /** @type {any} */ (db.prisma);
  const tag = `rr${Date.now()}`;
  const other = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await other.connect();
  t.after(async () => {
    await cleanup(prisma, tag);
    await other.end();
    await db.close();
  });
  const found = await fixture(prisma, tag);
  const retiredAt = new Date().toISOString();

  // 1. The retiring transaction holds the row.
  await other.query('BEGIN');
  await other.query('SELECT "id" FROM "package" WHERE "id" = $1 FOR UPDATE', [found.pkg.id]);

  // 2. A session starts against the same package; it must block.
  let settled = false;
  const starting = within(createSession(prisma, found, 'tryout', new Date().toISOString()), DEADLINE_MS)
    .finally(() => { settled = true; });
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(settled, false, 'createSession must wait on the package row lock, not read past it');

  // 3. The retire commits its `retiredAt`.
  await other.query('UPDATE "package" SET "retiredAt" = $2 WHERE "id" = $1', [found.pkg.id, retiredAt]);
  await other.query('COMMIT');

  // 4. The session sees the retired row and writes nothing.
  await assert.rejects(starting, isRetiredConflict);
  const [{ n }] = await prisma.$queryRaw`SELECT count(*)::int AS n FROM "session" WHERE "packageId" = ${found.pkg.id}`;
  assert.equal(n, 0, 'no session may be created from a package retired before its creation committed');
});

test('BUG-002: a retire waits for an open session transaction and then succeeds', { skip: SKIP }, async (t) => {
  const { db, reason } = await database();
  if (db === null) return t.skip(reason);
  const prisma = /** @type {any} */ (db.prisma);
  const tag = `rr${Date.now()}b`;
  const other = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await other.connect();
  t.after(async () => {
    await cleanup(prisma, tag);
    await other.end();
    await db.close();
  });
  const found = await fixture(prisma, tag);

  // An open session transaction holds FOR SHARE on the package (what `createSession` takes before its insert).
  await other.query('BEGIN');
  await other.query('SELECT "id" FROM "package" WHERE "id" = $1 FOR SHARE', [found.pkg.id]);
  let settled = false;
  const retiring = within(retirePackage(prisma, found.pkg.id, new Date().toISOString()), DEADLINE_MS)
    .finally(() => { settled = true; });
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(settled, false, 'the retire must wait for the session transaction holding the shared lock');
  await other.query('COMMIT');

  const retired = await retiring;
  assert.notEqual(retired.pkg.retiredAt, null, 'the retire applies once the shared lock is released');
});
