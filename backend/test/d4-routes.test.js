/**
 * D4 self-check: the provider and generation routes over a real `node:http`
 * round-trip, with a fake Prisma and the in-memory secret store. Nothing here
 * touches PostgreSQL or a provider.
 *
 * The point is the wire: no response, in any status, carries the key.
 *
 * Mounted directly (not through `routes/index.js`) because that file is shared
 * with the other builders'; `d4-routes` asserts only the modules this domain owns.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRouter } from '../src/http/router.js';
import { createHttpServer } from '../src/http/server.js';
import { registerProviderRoutes } from '../src/routes/providers.js';
import { registerGenerationRoutes } from '../src/routes/generation.js';
import { createProviderStore } from '../src/repositories/provider.js';
import { createMemorySecretStore } from '../src/secrets/secret-store.js';
import { CONTRACT_VERSION } from '../src/http/envelope.js';

const KEY = 'sk-test-0123456789abcdefWXYZ';

/**
 * The few Prisma calls the provider store makes.
 * @param {Record<string, Map<string, any>>} tables rows keyed by id, mutated in place
 */
function fakePrisma(tables = { provider: new Map(), secretRef: new Map() }) {
  return {
    tables,
    $transaction: async (work) => work(fakePrisma(tables)),
    provider: {
      create: async ({ data }) => { tables.provider.set(data.id, data); return data; },
      update: async ({ where, data }) => {
        const row = { ...tables.provider.get(where.id), ...data };
        tables.provider.set(where.id, row);
        return row;
      },
      findUnique: async ({ where }) => {
        const row = tables.provider.get(where.id);
        return row ? { ...row, secretRef: tables.secretRef.get(where.id) ?? null } : null;
      },
      findMany: async () => [...tables.provider.values()].map((row) => ({ ...row, secretRef: tables.secretRef.get(row.id) ?? null })),
    },
    secretRef: {
      create: async ({ data }) => { tables.secretRef.set(data.providerId, data); return data; },
      upsert: async ({ where, create, update }) => {
        const row = tables.secretRef.has(where.providerId) ? { ...tables.secretRef.get(where.providerId), ...update } : create;
        tables.secretRef.set(where.providerId, row);
        return row;
      },
    },
  };
}

/**
 * Serve one router on a loopback port.
 * @param {ReturnType<typeof createRouter>} router
 * @returns {Promise<{base: string, close: () => Promise<void>}>}
 */
async function serve(router) {
  const server = createHttpServer({ router, logger: { info: () => {}, error: () => {} } });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  return { base: `http://127.0.0.1:${port}/api/v1`, close: () => new Promise((resolve) => server.close(() => resolve(undefined))) };
}

test('POST /providers stores the key in the OS store, returns only keyLast4', async () => {
  const prisma = fakePrisma();
  const secretStore = createMemorySecretStore();
  const providerStore = createProviderStore({ prisma: /** @type {any} */ (prisma), secretStore, installId: 'test' });
  const router = createRouter();
  registerProviderRoutes(router, { prisma: /** @type {any} */ (prisma), providerStore });
  const { base, close } = await serve(router);
  try {
    const created = await fetch(`${base}/providers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ preset: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'm', key: KEY }),
    });
    assert.equal(created.status, 201);
    const text = await created.text();
    assert.equal(text.includes(KEY), false, 'the key is in the response');
    const body = JSON.parse(text);
    assert.equal(body.meta.version, CONTRACT_VERSION);
    assert.equal(body.data.keyLast4, 'WXYZ');
    assert.equal(body.data.hasKey, true);
    assert.deepEqual([...secretStore._entries.values()], [KEY], 'the key went to the store');

    const listed = await fetch(`${base}/providers`);
    assert.equal((await listed.text()).includes(KEY), false);

    const invalid = await fetch(`${base}/providers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ preset: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', key: `${KEY} ${KEY}` }),
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.text()).includes(KEY), false, 'a field error echoes the key');
  } finally {
    await close();
  }
});

test('POST /generation-jobs passes the parsed request through and answers 202', async () => {
  /** @type {any} */
  let seen = null;
  const prisma = /** @type {any} */ ({ competency: { findMany: async () => [{ id: 'c1', goal: 'g', _count: { children: 0 } }] } });
  const router = createRouter();
  registerGenerationRoutes(router, { prisma, generation: { createJob: async (input) => { seen = input; return { jobId: 'j1' }; } } });
  const { base, close } = await serve(router);
  try {
    const response = await fetch(`${base}/generation-jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ competencyIds: ['c1'], count: 2, difficulty: 'hard' }),
    });
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { data: { jobId: 'j1' }, meta: { version: CONTRACT_VERSION } });
    assert.deepEqual(seen, { competencyIds: ['c1'], count: 2, difficulty: 'hard' });

    const unknown = await fetch(`${base}/generation-jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ competencyIds: ['c1'], count: 2, difficulty: 'hard', providerId: 'p' }),
    });
    assert.equal(unknown.status, 400);
  } finally {
    await close();
  }
});
