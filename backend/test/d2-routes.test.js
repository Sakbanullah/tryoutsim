/**
 * D2 route self-check over a real `node:http` round-trip with a fake Prisma: the wire shapes of the exam-config,
 * package, history and deletion routes (API_ENDPOINTS §2, §4–§5; API_SPECIFICATION §7.2, §7.4), the body decoding
 * for autosave, and the approval rules that need no database. Nothing here touches PostgreSQL.
 *
 * Mounted directly (not through `routes/index.js`) so this file asserts only the modules D2 owns.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRouter } from '../src/http/router.js';
import { createHttpServer } from '../src/http/server.js';
import { registerExamConfigRoutes } from '../src/routes/exam-configs.js';
import { registerPackageRoutes } from '../src/routes/packages.js';
import { decodeAnswerBody, registerSessionRoutes } from '../src/routes/sessions.js';
import { outstandingWarnings } from '../src/repositories/exam-config.js';

const NOW = '2026-11-10T08:00:00.000Z';
const silent = { info: () => {}, error: () => {} };

/** Start a router on an ephemeral port. */
async function serve(router) {
  const server = createHttpServer({ router, logger: silent });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  return { base: `http://127.0.0.1:${port}/api/v1`, close: () => new Promise((resolve) => server.close(resolve)) };
}

/** The `exam_config` row every fixture shares. */
function configRow(overrides = {}) {
  return {
    id: 'cpns-2026', pathway: 'CPNS', examYear: 2026, state: 'provisional', dataProvenance: 'seed', durationMinutes: 100,
    itemCount: 110, twkCount: 30, tiuCount: 35, tkpCount: 45, twkWeight: 5, tiuWeight: 5, tkpWeightMin: 1, tkpWeightMax: 5,
    maxScore: 550, notice: 'Ambang belum terverifikasi. UNV-01 UNV-02', scoringVersion: 1, configVersion: 3,
    regulatoryBasisHash: 'hash-3', ...overrides,
  };
}

/**
 * The few Prisma calls the D2 routes make.
 * @param {{config?: object, approvals?: object[], legacy?: object[], pins?: string[]}} [input]
 *   `pins`: `exam_config` ids that exist as CPNS seed rows, so a package pin can resolve.
 */
function fakePrisma({ config = configRow(), approvals = [], legacy = [], pins = [], pinId = null } = {}) {
  const state = { approvals: [...approvals], created: [], deleted: [], sessions: [] };
  // The package version a session starts on; a pin names `pinId` at `config.configVersion`.
  const pkgVersion = {
    packageId: 'pkg', version: 1, titleId: 'paket', createdAt: NOW, examConfigId: pinId, examConfigVersion: pinId === null ? null : config.configVersion,
    definitionJson: JSON.stringify({ kind: 'subtest', test: 'TWK', itemCount: 0, repeatPolicy: 'allow_repeat' }),
  };
  // The transaction sees the same rows as the client; `state` collects what it writes.
  const client = {
    state,
    examConfig: {
      // Honours the `where` the repository passes: the route's CPNS/seed filter is what keeps a legacy row out.
      findMany: async ({ where = {} } = {}) => [config, ...legacy].filter((row) => (where.pathway === undefined || row.pathway === where.pathway)
        && (where.dataProvenance === undefined || row.dataProvenance === where.dataProvenance)),
      findUnique: async ({ where }) => (where.id === config.id ? config : legacy.find((row) => row.id === where.id) ?? null),
      // AUD-87 order 1: only a CPNS seed row whose `configVersion` equals the pin is usable.
      findFirst: async ({ where }) => (pins.includes(where.id) && where.configVersion === config.configVersion
        ? { ...config, id: where.id, examConfigId: undefined } : null),
    },
    basisRef: { findMany: async () => [{ id: 'b1', examConfigId: config.id, tier: 'HISTORICAL', pathway: 'CPNS', title: 'UNV-02 ambang', source: 's', url: 'u', accessedAt: 'a' }] },
    thresholds: { findMany: async () => [], findUnique: async () => null },
    provisionalApproval: {
      findMany: async ({ where = {} } = {}) => state.approvals.filter((row) => where.configId === undefined || row.configId === where.configId),
      create: async ({ data }) => {
        state.created.push(data);
        state.approvals.unshift(data);
        return data;
      },
    },
    package: {
      findUnique: async ({ where }) => (where.id === 'pkg' ? { id: 'pkg', mode: 'tryout', source: 'builtin', retiredAt: null } : null),
      // GET /packages: the list view reads the pin of each current version.
      findMany: async () => (state.listRows ?? []),
    },
    packageVersion: {
      findMany: async () => [],
      findUnique: async ({ where }) => (where.packageId_version.packageId === 'pkg' ? pkgVersion : null),
      findFirst: async () => pkgVersion,
    },
    competency: { findMany: async () => [] },
    scoreResult: { findUnique: async () => null, createMany: async () => ({ count: 1 }) },
    sessionSnapshot: { create: async ({ data }) => { state.snapshot = data; return data; } },
    answerSheet: { findMany: async () => [], findUnique: async () => null },
    session: {
      findUnique: async ({ where }) => state.sessions.find((row) => row.id === where.id) ?? null,
      updateMany: async () => ({ count: 1 }),
      create: async ({ data }) => {
        state.sessions.push(data);
        return { ...data, activeMs: 0, runningSince: data.runningSince };
      },
    },
    $transaction: async (work) => work(client),
    $queryRaw: async (strings, ...values) => {
      const sql = strings.join('?');
      if (sql.includes('delete_session')) {
        state.deleted.push(values[0]);
        return [{ deleted: values[0] !== 'missing' }];
      }
      return [];
    },
  };
  return client;
}

/** Mount D2's modules with a pinned clock. */
function routerWith(prisma) {
  const router = createRouter();
  const deps = { prisma, now: () => Date.parse(NOW), nowIso: () => NOW };
  registerExamConfigRoutes(router, deps);
  registerPackageRoutes(router, deps);
  registerSessionRoutes(router, deps);
  return router;
}

/** Send JSON and decode the envelope. */
async function call(base, method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  return { status: response.status, envelope: response.status === 204 ? null : await response.json() };
}

test('GET /exam-configs: CPNS seed rows only, with approval status', async () => {
  const prisma = fakePrisma({ legacy: [configRow({ id: 'old-2019', dataProvenance: 'legacy', state: 'historical' })] });
  const { base, close } = await serve(routerWith(prisma));
  try {
    const { status, envelope } = await call(base, 'GET', '/exam-configs');
    assert.equal(status, 200);
    assert.deepEqual(envelope.data.map((row) => row.configId), ['cpns-2026'], 'a legacy row is never listed');
    assert.equal(envelope.data[0].approvedAt, null);
    assert.deepEqual(envelope.data[0].thresholds, { mode: 'none' });
  } finally {
    await close();
  }
});

test('GET /exam-configs/:id: 404 for a legacy row, the full config otherwise', async () => {
  const prisma = fakePrisma({ legacy: [configRow({ id: 'old-2019', dataProvenance: 'legacy' })] });
  const { base, close } = await serve(routerWith(prisma));
  try {
    assert.equal((await call(base, 'GET', '/exam-configs/old-2019')).status, 404);
    const { status, envelope } = await call(base, 'GET', '/exam-configs/cpns-2026');
    assert.equal(status, 200);
    assert.equal(envelope.data.thresholdVerdictPossible, false, 'no thresholds means no verdict');
    assert.equal(envelope.data.regulatoryBasis[0].number, 'b1');
    assert.equal(envelope.data.configVersion, 3);
  } finally {
    await close();
  }
});

test('POST /exam-configs/:id/approval: 400 on ack/path mismatch, 409 on non-provisional, 200 appends once', async () => {
  const prisma = fakePrisma();
  const { base, close } = await serve(routerWith(prisma));
  try {
    const wrongId = await call(base, 'POST', '/exam-configs/cpns-2026/approval', { configId: 'other', acknowledgedWarnings: ['UNV-01', 'UNV-02'] });
    assert.equal(wrongId.status, 400);
    const missingAck = await call(base, 'POST', '/exam-configs/cpns-2026/approval', { configId: 'cpns-2026', acknowledgedWarnings: ['UNV-01'] });
    assert.equal(missingAck.status, 400);
    assert.equal(missingAck.envelope.error.details.fields[0].rule, 'acknowledge_all');

    const first = await call(base, 'POST', '/exam-configs/cpns-2026/approval', { configId: 'cpns-2026', acknowledgedWarnings: ['UNV-02', 'UNV-01'] });
    assert.equal(first.status, 200);
    // The wire `ProvisionalApproval` (CPNS_2026_REGULATIONS §4.3) carries no storage id.
    const { id: _approvalId, ...approvalWire } = first.envelope.data.approval;
    assert.deepEqual(approvalWire, {
      configId: 'cpns-2026', configVersion: 3, scoringVersion: 1, regulatoryBasisHash: 'hash-3',
      approvedByUserAt: NOW, approvedBy: 'local-user', acknowledgedWarnings: ['UNV-02', 'UNV-01'],
    });
    assert.equal(prisma.state.created.length, 1);

    const again = await call(base, 'POST', '/exam-configs/cpns-2026/approval', { configId: 'cpns-2026', acknowledgedWarnings: ['UNV-02', 'UNV-01'] });
    assert.equal(again.status, 200);
    assert.equal(prisma.state.created.length, 1, 'same four values: no second row');
    assert.deepEqual(again.envelope.data.approval.approvedByUserAt, NOW);
  } finally {
    await close();
  }
});

test('approval of an official_verified config is 409 state_not_provisional', async () => {
  const { base, close } = await serve(routerWith(fakePrisma({ config: configRow({ state: 'official_verified' }) })));
  try {
    const { status, envelope } = await call(base, 'POST', '/exam-configs/cpns-2026/approval', { configId: 'cpns-2026', acknowledgedWarnings: ['UNV-01', 'UNV-02'] });
    assert.equal(status, 409);
    assert.equal(envelope.error.details.reason, 'state_not_provisional');
  } finally {
    await close();
  }
});

test('outstandingWarnings: only UNV- ids the config itself carries', () => {
  assert.deepEqual(outstandingWarnings(configRow({ notice: 'UNV-01 and UNV-05; nothing else' }), []), ['UNV-01', 'UNV-05']);
  assert.deepEqual(outstandingWarnings(configRow({ notice: 'no warnings' }), []), []);
  assert.deepEqual(outstandingWarnings(configRow({ notice: 'no warnings' }), [{ title: 'UNV-02 x' }]), ['UNV-02']);
});

test('GET /sessions: filters, derived status and the summary shape', async () => {
  const rows = [
    { id: 's1', mode: 'tryout', status: 'submitted', packageId: 'p', packageVersion: 1, examConfigId: 'cpns-2026', startedAt: NOW, submittedAt: NOW, totalJson: JSON.stringify({ earned: 293, possible: 435 }) },
    { id: 's2', mode: 'latihan', status: 'open', packageId: 'q', packageVersion: 2, examConfigId: 'cpns-2026', startedAt: NOW, submittedAt: null, totalJson: null },
  ];
  const prisma = fakePrisma();
  prisma.$queryRaw = async () => rows;
  const { base, close } = await serve(routerWith(prisma));
  try {
    const { status, envelope } = await call(base, 'GET', '/sessions?mode=tryout&from=2026-11-01');
    assert.equal(status, 200);
    assert.deepEqual(envelope.data.map((row) => [row.id, row.status, row.totalEarned]), [['s1', 'scored', 293], ['s2', 'open', null]]);
    assert.equal((await call(base, 'GET', '/sessions?mode=practice')).status, 400);
    assert.equal((await call(base, 'GET', '/sessions?from=nope')).status, 400);
  } finally {
    await close();
  }
});

test('DELETE /sessions/:id: 204 through the delete function, 404 when it reports nothing', async () => {
  const prisma = fakePrisma();
  const { base, close } = await serve(routerWith(prisma));
  try {
    assert.equal((await call(base, 'DELETE', '/sessions/s1')).status, 204);
    assert.deepEqual(prisma.state.deleted, ['s1']);
    assert.equal((await call(base, 'DELETE', '/sessions/missing')).status, 404);
  } finally {
    await close();
  }
});

test('POST /sessions/bulk-delete: per-session outcomes', async () => {
  const prisma = fakePrisma();
  const { base, close } = await serve(routerWith(prisma));
  try {
    const { status, envelope } = await call(base, 'POST', '/sessions/bulk-delete', { sessionIds: ['s1', 'missing', 's3'] });
    assert.equal(status, 200);
    assert.equal(envelope.data.deletedCount, 2);
    assert.deepEqual(envelope.data.outcomes, [
      { sessionId: 's1', deleted: true }, { sessionId: 'missing', deleted: false }, { sessionId: 's3', deleted: true },
    ]);
    assert.equal((await call(base, 'POST', '/sessions/bulk-delete', { sessionIds: ['s1', 'missing', 's3'] })).status, 200);
    for (const body of [{ sessionIds: [] }, {}, { sessionIds: 's1' }, { sessionIds: ['a', 'a'] }]) {
      assert.equal((await call(base, 'POST', '/sessions/bulk-delete', body)).status, 400, JSON.stringify(body));
    }
  } finally {
    await close();
  }
});

test('decodeAnswerBody: both wire forms, exactly one answer, A–E or null, explicit elapsed time', () => {
  assert.deepEqual(decodeAnswerBody({ answers: [{ questionId: 'q1', selectedOption: 'B' }], elapsedActiveMs: 1000 }, { allowElapsed: true }), {
    answers: [{ questionId: 'q1', selected: 'B', flagged: false }], elapsedActiveMs: 1000,
  });
  assert.deepEqual(decodeAnswerBody({ questionId: 'q1', selected: null, flagged: true, elapsedActiveMs: 0 }, { allowElapsed: true }).answers, [
    { questionId: 'q1', selected: null, flagged: true },
  ]);
  const fails = (body, opts = { allowElapsed: true }) => {
    try { decodeAnswerBody(body, opts); } catch (error) { return error.details.fields.map((f) => f.rule); }
    return [];
  };
  assert.deepEqual(fails({ answers: [{ questionId: 'q1', selectedOption: 'Z' }], elapsedActiveMs: 0 }), ['enum']);
  assert.deepEqual(fails({ answers: [{ questionId: 'q1', selectedOption: null }], elapsedActiveMs: -1 }), ['finite_integer']);
  assert.deepEqual(fails({ questionId: 'q1', selected: 'A', selectedOption: 'A', elapsedActiveMs: 0 }), ['conflict']);
  assert.deepEqual(fails({ answers: [{ questionId: 'q1', selectedOption: null, extra: 1 }], elapsedActiveMs: 0 }), ['unknown_field']);
  assert.deepEqual(fails({ answers: [{ questionId: 'q1', selectedOption: null }], elapsedActiveMs: 0 }, { allowElapsed: false }), ['unknown_field']);
  assert.deepEqual(fails(null), ['type']);
});

test('GET /packages: mode filter; 400 on an unknown mode', async () => {
  const prisma = fakePrisma();
  prisma.$queryRaw = async () => [];
  const { base, close } = await serve(routerWith(prisma));
  try {
    assert.deepEqual((await call(base, 'GET', '/packages?mode=latihan')).envelope.data, []);
    assert.equal((await call(base, 'GET', '/packages?mode=practice')).status, 400);
  } finally {
    await close();
  }
});

test('POST /packages/:id/sessions: 404 unknown package, 400 bad body', async () => {
  const { base, close } = await serve(routerWith(fakePrisma()));
  try {
    assert.equal((await call(base, 'POST', '/packages/none/sessions', { mode: 'tryout' })).status, 404);
    assert.equal((await call(base, 'POST', '/packages/pkg/sessions', { mode: 'practice' })).status, 400);
    assert.equal((await call(base, 'POST', '/packages/pkg/sessions', { mode: 'tryout', configId: 'x' })).status, 400);
  } finally {
    await close();
  }
});

/**
 * A Prisma-shaped client over in-memory tables: `model.findMany/findUnique/findFirst/create/delete/deleteMany/upsert`
 * with a `where` matcher, and `$queryRaw`/`$executeRaw` over a tiny SQL dialect (one table, quoted identifiers,
 * `?`-free JSON literals). Enough to run the real repositories against the baseline schema in memory, including a
 * T-7 UPDATE guard and `tryoutsim.add_session_verdict`.
 * @param {Record<string, object[]>} tables table name → rows (mutated)
 * @param {(table: string, row: object | null, status: string | undefined, changes: Record<string, unknown>) => void}
 *   [onUpdate] called before every row update (the trigger hooks live here)
 */
function memoryPrisma(tables, onUpdate = () => {}) {
  const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return /** @type {object[]} */ (value).some((part) => matches(row, part));
    if (key === 'AND') return /** @type {object[]} */ (value).every((part) => matches(row, part));
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      if ('in' in value) return value.in.includes(row[key]);
      if ('startsWith' in value) return String(row[key]).startsWith(value.startsWith);
      throw new Error(`memoryPrisma: unsupported filter ${key}`);
    }
    return row[key] === value;
  });
  const table = (name) => (tables[name] ??= []);
  const apply = (row, select) => {
    if (!select) return { ...row };
    const picked = {};
    for (const key of Object.keys(select).filter((k) => select[k])) picked[key] = row[key];
    return picked;
  };
  /** The primary key a `skipDuplicates` createMany dedupes on. */
  const primaryOf = (row) => ({ examConfigId: row.examConfigId, sessionId: row.sessionId, id: row.id, questionId: row.questionId });
  const model = (name) => ({
    findMany: async ({ where } = {}) => table(name).filter((row) => matches(row, where)).map((row) => ({ ...row })),
    findUnique: async ({ where }) => {
      const row = table(name).find((r) => matches(r, where));
      if (!row) return null;
      // `loadScoreResult` reads the frozen `packageBinding` through `include: { session: { snapshot } }`.
      const snapshot = name === 'score_result' ? table('session_snapshot').find((s) => s.sessionId === row.sessionId) : undefined;
      return { ...row, ...(snapshot ? { session: { snapshot: { packageBindingJson: snapshot.packageBindingJson } } } : {}) };
    },
    findFirst: async ({ where } = {}) => table(name).find((row) => matches(row, where)) ?? null,
    create: async ({ data, select }) => {
      table(name).push({ ...data });
      return apply(data, select);
    },
    createMany: async ({ data, skipDuplicates = false }) => {
      const rows = table(name);
      const fresh = data.filter((row) => !skipDuplicates || !rows.some((existing) => matches(existing, primaryOf(row))));
      rows.push(...fresh.map((row) => ({ ...row })));
      return { count: fresh.length };
    },
    upsert: async ({ where, create, update }) => {
      const row = table(name).find((r) => matches(r, where));
      if (!row) { table(name).push({ ...create }); return { ...create }; }
      Object.assign(row, update);
      return { ...row };
    },
    updateMany: async ({ where, data }) => {
      const rows = table(name).filter((row) => matches(row, where));
      for (const row of rows) { onUpdate(name, row, row.status, data); Object.assign(row, data); }
      return { count: rows.length };
    },
    delete: async ({ where }) => {
      const rows = table(name);
      const index = rows.findIndex((row) => matches(row, where));
      if (index === -1) return null;
      return rows.splice(index, 1)[0];
    },
    deleteMany: async ({ where } = {}) => {
      const rows = table(name);
      const keep = rows.filter((row) => !matches(row, where));
      rows.splice(0, rows.length, ...keep);
      return { count: tables[name].length };
    },
  });
  const client = {
    tables,
    $transaction: async (work) => work(client),
    $queryRawUnsafe: async (sql, ...values) => {
      const set = sql.match(/SELECT ([\w", ]+) FROM "(\w+)"/);
      const remove = sql.match(/^DELETE FROM "(\w+)"/);
      if (remove) client.tables[remove[1]] = [];
      if (sql.includes('count(*)')) return [{ n: values[0] ? table(values[0]).length : 0 }];
      if (set) return table(set[2]).filter((row) => !values[0] || matches(row, values[0])).map((row) => ({ ...row }));
      return [];
    },
    $executeRawUnsafe: async (sql, ...values) => {
      const update = sql.match(/UPDATE "(\w+)" SET "(\w+)" = \?/);
      if (!update) throw new Error(`memoryPrisma: unsupported SQL ${sql}`);
      const [, name] = update;
      const columns = [...sql.matchAll(/"\w+" = \?/g)].map((match) => match[0].split('"')[1]);
      const row = table(name)[0];
      onUpdate(name, row, row.status, Object.fromEntries(columns.map((column, index) => [column, values[index]])));
      for (const [index, column] of columns.entries()) row[column] = values[index];
      return 1;
    },
    $executeRaw: async (strings, ...values) => {
      onUpdate('score_result', table('score_result')[0] ?? null, undefined, { sql: strings.join('?') });
      return 1;
    },
    $queryRaw: async (strings, ...values) => {
      const sql = strings.join('?');
      if (sql.includes('exists')) return [{ exists: true }].filter(() => values[0]);
      // `createSession`'s package guard (BUG-002): one row of the package named by the id parameter.
      if (sql.includes('FROM "package"')) return table('package').filter((row) => row.id === values[0]).map((row) => ({ retiredAt: row.retiredAt }));
      return [{ n: 0 }];
    },
  };
  for (const name of ['examConfig', 'basisRef', 'thresholds', 'provisionalApproval', 'question', 'competency', 'package',
    'packageVersion', 'session', 'sessionSnapshot', 'scoreResult', 'answerSheet']) {
    client[name] = model({ examConfig: 'exam_config', basisRef: 'basis_ref', provisionalApproval: 'provisional_approval',
      packageVersion: 'package_version', sessionSnapshot: 'session_snapshot', scoreResult: 'score_result', answerSheet: 'answer_sheet' }[name] ?? name);
  }
  // Raw SQL reaches the same tables under their schema names.
  Object.defineProperty(client, 'table', { value: table });
  return client;
}

test('memoryPrisma: where matching, createMany skipDuplicates and the T-7 guard (sanity of the fake itself)', async () => {
  let guard = false;
  let writes = 0;
  const prisma = memoryPrisma({ score_result: [{ sessionId: 's', verdictJson: null, totalJson: 'a' }] }, () => {
    writes += 1;
    if (guard) throw Object.assign(new Error('immutable'), { code: '23001' });
  });
  await prisma.scoreResult.createMany({ data: [{ sessionId: 's', totalJson: 'b' }], skipDuplicates: true });
  assert.equal(prisma.tables.score_result.length, 1, 'skipDuplicates keeps the first row');
  const before = writes;
  guard = true;
  await assert.rejects(prisma.$executeRaw`UPDATE "score_result" SET "totalJson" = ${'x'}`, (error) => error.code === '23001');
  assert.equal(writes, before + 1, 'the guard was reached');
});
/**
 * The baseline `session_snapshot` row for a session, shaped like `buildSnapshot` in the session repository.
 * @param {string} sessionId
 * @param {string} basisHash the `regulatoryBasisHash` the snapshot froze
 */
function snapshotRow(sessionId, basisHash) {
  const questions = ['q1', 'q2', 'q3'].map((questionId) => ({
    questionId, questionVersion: 1, contentHash: `h-${questionId}`, test: 'TWK', competencyId: 'TWK.1',
    optionKeys: ['A', 'B', 'C', 'D', 'E'], options: [], maxScore: 5,
  }));
  return {
    sessionId,
    snapshotVersion: `s1-${sessionId}`,
    questionsJson: JSON.stringify(questions),
    answerKeysJson: JSON.stringify(questions.map(({ questionId }) => ({
      questionId, scoringVersion: 1, optionScores: { A: 0, B: 5, C: 0, D: 0, E: 0 }, unansweredScore: 0, maxScore: 5,
    }))),
    configJson: JSON.stringify({
      configId: 'cpns-2026', configVersion: 3, scoringVersion: 1, examYear: 2026, pathway: 'CPNS', state: 'provisional',
      regulatoryBasisHash: basisHash, regulatoryBasis: [], scoringRules: { scoringVersion: 1, tkpWeightRange: [1, 5],
        perQuestionMax: { TWK: 5, TIU: 5, TKP: 5 }, unansweredScoreBounds: { min: 0, max: 0 }, unansweredRule: 'zero' },
      notice: 'UNV-01',
    }),
    thresholdsJson: JSON.stringify({ mode: 'total_only', total: 10, source: { tier: 'HISTORICAL', pathway: 'CPNS' } }),
    approvalJson: JSON.stringify({ approval: null, source: { rowId: null } }),
    packageBindingJson: JSON.stringify({ packageId: 'pkg', packageVersion: 1, mode: 'tryout', kind: 'subtest', rosterHash: 'r' }),
    timingJson: JSON.stringify({ mode: 'accumulated_active', durationMs: 60000, activeMsAtStart: 0, autoSubmitOnExpiry: true }),
    rosterJson: JSON.stringify({ repeatCount: 0, attemptedBefore: 0 }),
    taxonomyVersion: '2026',
  };
}

/**
 * The in-memory baseline for the verdict-only route tests: one submitted session whose result was stored with a
 * withheld verdict (no approval), one config row, three answered-or-not sheets. `configRow` comes from the D2 fixture.
 * @param {{storedTotalJson?: string, approvals?: object[]}} [input]
 */
function verdictOnlyTables({ storedTotalJson, approvals = [] } = {}) {
  const sheets = ['q1', 'q2', 'q3'].map((questionId, index) => ({
    sessionId: 's1', questionId, selectedOption: index === 0 ? 'B' : null, answerTimestampMs: 0, elapsedActiveMs: 0, flagged: 0,
  }));
  const total = { earned: 5, possible: 15, answeredCount: 1, correctCount: 1 };
  const byTest = { TWK: total, TIU: { ...total, earned: 0, possible: 0, answeredCount: 0, correctCount: 0 },
    TKP: { ...total, earned: 0, possible: 0, answeredCount: 0, correctCount: 0 } };
  const byQuestion = [
    { questionId: 'q1', test: 'TWK', competencyId: 'TWK.1', earned: 5, maxScore: 5, selected: 'B', correct: true },
    { questionId: 'q2', test: 'TWK', competencyId: 'TWK.1', earned: 0, maxScore: 5, selected: null, correct: null },
    { questionId: 'q3', test: 'TWK', competencyId: 'TWK.1', earned: 0, maxScore: 5, selected: null, correct: null },
  ];
  return {
    exam_config: [configRow()],
    thresholds: [{ examConfigId: 'cpns-2026', mode: 'total_only', twk: null, tiu: null, tkp: null, total: 10, sourceJson: JSON.stringify({ tier: 'HISTORICAL', pathway: 'CPNS' }) }],
    provisional_approval: approvals,
    competency: [{ id: 'TWK.1', parentId: null, test: 'TWK', label: 'x', goal: 'x', tier: 'EVIDENCE-BACKED-NOT-CPNS-2026' }],
    session: [{ id: 's1', examConfigId: 'cpns-2026', configVersion: 3, scoringVersion: 1, mode: 'tryout', packageId: 'pkg', packageVersion: 1,
      rosterJson: JSON.stringify(['q1', 'q2', 'q3']), status: 'submitted', activeMs: 1000, runningSince: null, durationMs: 60000,
      startedAt: NOW, submittedAt: NOW }],
    session_snapshot: [snapshotRow('s1', 'hash-3')],
    answer_sheet: sheets,
    score_result: [{
      sessionId: 's1', snapshotVersion: 's1-s1', totalJson: storedTotalJson ?? JSON.stringify(total), byTestJson: JSON.stringify(byTest),
      byCompetencyJson: JSON.stringify({ 'TWK.1': total }), byQuestionJson: JSON.stringify(byQuestion),
      thresholdsJson: JSON.stringify({ mode: 'total_only', passed: false, basisTier: 'HISTORICAL', basisPathway: 'CPNS', noticeRequired: true }),
      verdictJson: null, approvalJson: null, verdictWithheldJson: JSON.stringify({ code: 'APPROVAL_MISSING', changed: [] }),
      timingJson: JSON.stringify({ activeMs: 1000, durationMs: 60000 }), scoredAt: NOW, blockedErrorCode: null,
    }],
  };
}

/** A `provisional_approval` row bound to the fixture's four values. */
const approvalRow = {
  id: 'ap1', configId: 'cpns-2026', configVersion: 3, scoringVersion: 1, regulatoryBasisHash: 'hash-3',
  approvedByUserAt: NOW, approvedBy: 'local-user', acknowledgedWarningsJson: '["UNV-01"]',
};

/**
 * The DB-side pieces of the verdict-only tests: `tryoutsim.add_session_verdict` over the in-memory table and the
 * T-7 row guard from migration `20261110000002` (verdict columns may move; only onto a verdict-null row).
 * @param {ReturnType<typeof memoryPrisma>} prisma
 */
function withVerdictFunction(prisma) {
  const row = prisma.tables.score_result[0];
  prisma.$queryRaw = async (strings, ...values) => {
    const [sessionId, verdict, approval, withheld] = values;
    if (sessionId !== row.sessionId || row.verdictJson !== null) return [{ added: false }];
    prisma.$executeRawUnsafe(`UPDATE "score_result" SET "verdictJson" = ?, "approvalJson" = ?, "verdictWithheldJson" = ?`, verdict, approval, withheld);
    return [{ added: true }];
  };
  return prisma;
}

test('POST /sessions/:id/score: a verdict-null result gains its verdict once, through the function (AUD-85)', async () => {
  const tables = verdictOnlyTables({ approvals: [approvalRow] });
  const written = [];
  const prisma = withVerdictFunction(memoryPrisma(tables, (name, row, status, changes) => {
    if (name !== 'score_result') return;
    const verdictColumns = ['verdictJson', 'approvalJson', 'verdictWithheldJson'];
    const allowed = Object.keys(changes).every((key) => verdictColumns.includes(key));
    if (!(row.verdictJson === null && allowed)) throw Object.assign(new Error('score_result rows are immutable'), { code: '23001' });
    written.push(Object.keys(changes).filter((key) => verdictColumns.includes(key)).sort());
  }));

  const { base, close } = await serve(routerWith(prisma));
  try {
    const { status, envelope } = await call(base, 'POST', '/sessions/s1/score');
    assert.equal(status, 200);
    const result = envelope.data;
    assert.equal(result.total.earned, 5, 'the stored score is returned');
    assert.equal(result.verdict.mode, 'total_only', 'the verdict is now present');
    assert.equal(result.verdict.passed, false);
    assert.equal(result.withheld, null, 'the stored withheld payload was replaced with null');
    assert.equal(result.approval.approvedByUserAt, NOW);
    assert.deepEqual(result.timing, { activeMs: 1000, durationMs: 60000 }, 'timing is the stored one');
    assert.equal(result.scoredAt, NOW);
    assert.equal(result.packageBinding.packageId, 'pkg', 'packageBinding is read from the stored payload');
    assert.deepEqual(written, [['approvalJson', 'verdictJson', 'verdictWithheldJson']], 'one verdict-only write');

    const again = await call(base, 'POST', '/sessions/s1/score');
    assert.equal(again.status, 200);
    assert.deepEqual(again.envelope.data, result, 'a result with a verdict is returned unchanged');
    assert.equal(written.length, 1, 'no second write');
  } finally {
    await close();
  }
});

test('POST /sessions/:id/score: 409 verdict_only_change_forbidden when the re-score would differ (AUD-85)', async () => {
  const tables = verdictOnlyTables({ approvals: [approvalRow], storedTotalJson: JSON.stringify({ earned: 6, possible: 15, answeredCount: 1, correctCount: 1 }) });
  let mutated = false;
  const prisma = withVerdictFunction(memoryPrisma(tables, () => { mutated = true; }));

  const { base, close } = await serve(routerWith(prisma));
  try {
    const { status, envelope } = await call(base, 'POST', '/sessions/s1/score');
    assert.equal(status, 409);
    assert.equal(envelope.error.code, 'CONFLICT');
    assert.equal(envelope.error.details.reason, 'verdict_only_change_forbidden');
    assert.equal(mutated, false, 'nothing is written');
    assert.equal(tables.score_result[0].verdictJson, null);
  } finally {
    await close();
  }
});

test('POST /sessions/:id/submit: a plain pre-flight failure is 422 PREFLIGHT_FAILED (AUD-90)', async () => {
  const tables = verdictOnlyTables();
  const prisma = memoryPrisma({
    ...tables,
    session: [{ ...tables.session[0], status: 'open', submittedAt: null }],
    score_result: [],
    // Two sheets on one question: PF-02 (duplicate), no regulatory or threshold code.
    answer_sheet: [...tables.answer_sheet, { ...tables.answer_sheet[1], selectedOption: 'C' }],
  });
  const { base, close } = await serve(routerWith(prisma));
  try {
    const { status, envelope } = await call(base, 'POST', '/sessions/s1/submit');
    assert.equal(status, 422);
    assert.equal(envelope.error.code, 'PREFLIGHT_FAILED');
    assert.ok(Array.isArray(envelope.error.details.errors) && envelope.error.details.errors.some((e) => e.code === 'DUPLICATE_QUESTION_ID'));
    assert.equal(prisma.tables.score_result.length, 0, 'nothing was stored');
  } finally {
    await close();
  }
});

test('GET /packages: the view carries the version pin, null when absent (AUD-87)', async () => {
  const rows = [
    { id: 'pkg', mode: 'tryout', source: 'custom', retiredAt: null, currentVersion: 2, titleId: 'a', definitionJson: JSON.stringify({ kind: 'subtest', test: 'TWK', itemCount: 0 }), examConfigId: 'cpns-2026', examConfigVersion: 3 },
    { id: 'pkg2', mode: 'tryout', source: 'custom', retiredAt: null, currentVersion: 1, titleId: 'b', definitionJson: JSON.stringify({ kind: 'subtest', test: 'TWK', itemCount: 0 }), examConfigId: null, examConfigVersion: null },
  ];
  const prisma = fakePrisma();
  prisma.state.listRows = rows;
  prisma.$queryRaw = async () => rows;
  const { base, close } = await serve(routerWith(prisma));
  try {
    const { status, envelope } = await call(base, 'GET', '/packages');
    assert.equal(status, 200);
    assert.deepEqual(envelope.data.map((row) => [row.id, row.examConfigId, row.examConfigVersion]), [['pkg', 'cpns-2026', 3], ['pkg2', null, null]]);
  } finally {
    await close();
  }
});

test('POST /packages/:id/sessions: configResolution pinned / fallback / resolved (AUD-87)', async () => {
  /** In-memory rows for one package with an optional pin; `pinnedConfig` is the row the pin names. */
  const offered = ({ pin = null, pinnedConfig = null } = {}) => memoryPrisma({
    exam_config: [configRow(), ...(pinnedConfig ? [pinnedConfig] : [])],
    basis_ref: [{ id: 'b1', examConfigId: 'cpns-2026', tier: 'HISTORICAL', pathway: 'CPNS', title: 'UNV-02', source: 's', url: 'u', accessedAt: 'a' }],
    thresholds: [], provisional_approval: [], competency: [],
    question: [{ id: 'q1', test: 'TWK', competencyId: 'TWK.1', optionsJson: '[]', answerKeyJson: '{}', contentVersion: 1, contentHash: 'h',
      lifecycle: 'active', dynamicEligible: 1 }],
    package: [{ id: 'pkg', mode: 'tryout', source: 'custom', retiredAt: null }],
    package_version: [{ packageId: 'pkg', version: 1, titleId: 'paket', createdAt: NOW, definitionJson: JSON.stringify({ kind: 'subtest', test: 'TWK', itemCount: 1 }),
      examConfigId: pin?.id ?? null, examConfigVersion: pin?.version ?? null }],
    session: [], session_snapshot: [], answer_sheet: [], score_result: [],
  });

  const cases = [
    [{ pin: { id: 'pinned-2', version: 2 }, pinnedConfig: configRow({ id: 'pinned-2', configVersion: 2, regulatoryBasisHash: 'hash-2' }) }, 'pinned', 'pinned-2'],
    // A pin to a row that is not a usable CPNS seed config (here: none row at all) falls through to order 2.
    [{ pin: { id: 'gone', version: 9 } }, 'fallback', 'cpns-2026'],
    [{}, 'resolved', 'cpns-2026'],
  ];
  for (const [input, expected, configId] of cases) {
    const prisma = offered(input);
    const { base, close } = await serve(routerWith(prisma));
    try {
      const { status, envelope } = await call(base, 'POST', '/packages/pkg/sessions', { mode: 'tryout' });
      assert.equal(status, 201, JSON.stringify(input));
      assert.equal(envelope.data.configResolution, expected);
      assert.equal(envelope.data.session.configId, configId);
    } finally {
      await close();
    }
  }
});
