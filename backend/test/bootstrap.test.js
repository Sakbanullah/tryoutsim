/**
 * `GET /bootstrap` (API_ENDPOINTS §1) over a real `node:http` round-trip.
 *
 * The contract under test: the snapshot the first paint reads, and the two rules it must never break —
 * no exam-config list (decision B3) and an unread count that comes from the notification store.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRouter } from '../src/http/router.js';
import { createHttpServer } from '../src/http/server.js';
import { registerBootstrapRoutes } from '../src/routes/bootstrap.js';

const silent = { info: () => {}, error: () => {} };

/** Start a router on an ephemeral port. */
async function serve(router) {
  const server = createHttpServer({ router, logger: silent });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  return { base: `http://127.0.0.1:${port}/api/v1`, close: () => new Promise((resolve) => server.close(resolve)) };
}

/**
 * A pool and a Prisma double covering exactly the reads `bootstrap.js` makes.
 * @param {{scoreResults?: number}} [input]
 */
function collaborators({ scoreResults = 0 } = {}) {
  const pool = {
    query: async (sql) => {
      if (sql.includes('FROM "competency"')) {
        return { rows: [{ id: 'TWK.1', test: 'TWK', parentId: null, label: 'Pilar', goal: 'g', tier: 'EVIDENCE-BACKED-NOT-CPNS-2026' }] };
      }
      return { rows: [{ lifecycle: 'active', count: 7 }, { lifecycle: 'draft', count: 2 }] };
    },
  };
  const prisma = {
    $queryRaw: async () => [],
    scoreResult: { count: async () => scoreResults },
    package: { findMany: async () => [] },
    notification: { findMany: async () => [], count: async () => 0 },
  };
  // `listPackages` issues raw SQL through `$queryRaw`; the bootstrap must survive an empty bank.
  return { pool, prisma };
}

test('GET /bootstrap: the first-paint snapshot, with no exam-config list (B3)', async () => {
  const { pool, prisma } = collaborators({ scoreResults: 1 });
  const router = createRouter();
  registerBootstrapRoutes(router, {
    pool,
    prisma,
    providerStore: { list: async () => [] },
  });
  const { base, close } = await serve(router);
  try {
    const response = await fetch(`${base}/bootstrap`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.meta.version, '1.0.0');

    const data = body.data;
    assert.equal(data.examConfigs, undefined, 'the learner never selects a config (PACKAGE_SPECIFICATION §3)');
    assert.equal(data.taxonomy.length, 1);
    assert.deepEqual(data.packages, []);
    assert.deepEqual(data.providers, [], 'no provider key or row shape leaks into the snapshot');
    assert.deepEqual(data.questionBankSummary, {
      total: 9,
      active: 7,
      byLifecycle: { draft: 2, ai_validated: 0, human_reviewed: 0, active: 7, quarantined: 0, archived: 0, withdrawn: 0 },
    });
    assert.equal(data.analyticsReady, true, 'a stored result makes analytics available');
    assert.ok(Number.isInteger(data.notifications.unreadCount), 'the unread count is read, never computed here');
    assert.equal(typeof data.defaults, 'object');
  } finally {
    await close();
  }
});
