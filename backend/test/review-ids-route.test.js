/**
 * `GET /sessions/:id/questions?ids=` (API_SPECIFICATION §7.7) at the routing edge.
 *
 * Regression: the route passed `query.getAll('ids')` (an array) to `parseReviewIds`, which reads a string — so every
 * review request from the result screen answered 500. The route must join the list into the comma-separated form.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRouter } from '../src/http/router.js';
import { createHttpServer } from '../src/http/server.js';
import { registerSessionRoutes } from '../src/routes/sessions.js';
import { parseReviewIds } from '../src/repositories/session-questions.js';

const silent = { info: () => {}, error: () => {} };

test('review ids: the query list reaches the parser as one comma-separated string', async () => {
  // The parser's own contract, which the route must satisfy.
  assert.deepEqual(parseReviewIds('q-a,q-b', ['q-a', 'q-b']), ['q-a', 'q-b']);

  const router = createRouter();
  // An unknown session stops `loadReview` after parsing; the status tells parser (400) from repository (404) failures.
  const prisma = { session: { findUnique: async () => null } };
  registerSessionRoutes(router, { prisma, now: () => Date.now(), nowIso: () => new Date().toISOString() });
  const server = createHttpServer({ router, logger: silent });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  const base = `http://127.0.0.1:${port}/api/v1`;
  try {
    for (const query of ['ids=q-a,q-b', 'ids=q-a&ids=q-b']) {
      const response = await fetch(`${base}/sessions/ses_missing/questions?${query}`);
      assert.notEqual(response.status, 500, `${query}: the array/string mismatch must not come back as a 500`);
      assert.equal(response.status, 404, `${query}: parsing succeeded and the repository reported no session`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
