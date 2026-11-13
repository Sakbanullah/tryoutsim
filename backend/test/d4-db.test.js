/**
 * D4 self-check: DB-backed pieces (provider store, generation runner) against the
 * real PostgreSQL 18 schema. Skipped when `DATABASE_URL_APP` is absent or
 * unreachable; the skip is reported, never a silent pass.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connect } from '../src/db/client.js';
import { createProviderStore } from '../src/repositories/provider.js';
import { createGenerationService } from '../src/repositories/generation-job.js';
import { createMemorySecretStore } from '../src/secrets/secret-store.js';
import { loadConfig } from '../src/config.js';
import { loadRouting, saveRouting } from '../src/repositories/routing.js';
import { AppError } from '../src/errors.js';

const KEY = 'sk-db-0123456789abcdefQRST';
const silent = { info: () => {}, error: () => {} };

/** Connect as the app role, or `null` with the reason when not provisioned. */
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

/** A unique install id so runs do not collide. */
const installId = `test-${Date.now()}`;

test('provider store: create / update / delete in DB-4 order', { skip: !process.env.DATABASE_URL_APP && 'DATABASE_URL_APP is not set' }, async (t) => {
  const { db, reason } = await database();
  if (db === null) return t.skip(reason);
  const prisma = /** @type {any} */ (db.prisma);
  const secretStore = createMemorySecretStore();
  const store = createProviderStore({ prisma, secretStore, installId, logger: silent });
  /** @type {string[]} */
  const created = [];
  t.after(async () => {
    for (const id of created) await prisma.provider.delete({ where: { id } }).catch(() => undefined);
    await db.close();
  });

  const row = await store.create({
    preset: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'm',
    timeoutMs: 1000, headers: {}, extraParams: {}, key: KEY,
  });
  created.push(row.id);
  assert.equal(row.secretRef.keyLast4, 'QRST');
  assert.equal([...secretStore._entries.values()][0], KEY, 'the key is in the store, not the row');
  const stored = await prisma.secretRef.findUnique({ where: { providerId: row.id } });
  assert.equal(JSON.stringify(stored).includes(KEY), false, 'the key reached secret_ref');
  assert.equal(await store.readKey(row.id), KEY);

  const updated = await store.update(row.id, { key: `${KEY}2` });
  assert.equal(updated.secretRef.keyLast4, 'RST2');
  assert.equal(updated.testedAt, null);

  await store.remove(row.id);
  created.pop();
  assert.equal(await store.get(row.id), null);
  assert.equal(secretStore._entries.size, 0, 'the credential was purged after the row');
  await assert.rejects(store.remove(row.id), (error) => error instanceof AppError && error.code === 'NOT_FOUND');
});

test('generation: batches, partial output and the report', { skip: !process.env.DATABASE_URL_APP && 'DATABASE_URL_APP is not set' }, async (t) => {
  const { db, reason } = await database();
  if (db === null) return t.skip(reason);
  const prisma = /** @type {any} */ (db.prisma);
  const secretStore = createMemorySecretStore();
  const store = createProviderStore({ prisma, secretStore, installId, logger: silent });
  // The route's leaf check is not exercised here; a leaf created by this test grounds the prompt. There is no seed
  // script, so every fixture supplies its own rows.
  const tag = `d4g${Date.now()}`;
  const leafId = `TWK.${tag}`;
  await prisma.competency.create({ data: { id: leafId, test: 'TWK', label: 'latihan', goal: 'latihan', tier: 'EVIDENCE-BACKED-NOT-CPNS-2026', parentId: null } });
  const leaf = await prisma.competency.findFirst({ where: { id: leafId } });
  t.after(async () => {
    await prisma.competency.deleteMany({ where: { id: leafId } }).catch(() => undefined);
  });

  const provider = await store.create({
    preset: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'm',
    timeoutMs: 1000, headers: {}, extraParams: {}, key: KEY,
  });
  let calls = 0;
  t.after(async () => {
    await prisma.generationJob.deleteMany({ where: { providerId: provider.id } }).catch(() => undefined);
    await store.remove(provider.id).catch(() => undefined);
    await db.close();
  });
  // Mark the pair tested without a network call: the runner only reads `testedAt`. A manual `maxContext` of 2500 is
  // below 5 × 2000, so `planBatches` halves the 5-question batch to 2 — this fixture needs two batches, one that
  // succeeds and one that fails, to exercise partial output (GENERATION_JOBS §3).
  await prisma.provider.update({
    where: { id: provider.id },
    data: {
      testedAt: '2026-11-10T00:00:00.000Z',
      capabilityFlagsJson: JSON.stringify({ maxContext: { value: 2500, source: 'manual' } }),
    },
  });
  await saveRouting(prisma, { default: { providerId: provider.id, modelId: 'm' } });

  /** @type {{tx: any, input: any}[]} */
  let inserted = [];
  const generation = createGenerationService({
    prisma,
    loadRouting: () => loadRouting(prisma),
    logger: silent,
    seams: {
      readKey: store.readKey,
      transportFor: () => ({
        chat: async () => {
          calls += 1;
          if (calls === 1) return { content: JSON.stringify({ questions: [{ stem: 'a' }, { stem: 'b' }] }) };
          return { content: 'not json at all' };
        },
      }),
      loadCompetency: async (id) => ({ id, test: 'TWK', label: 'l', goal: 'g' }),
      insertDraft: async (_tx, input) => {
        inserted.push({ tx: _tx, input });
        return `${input.batchId}-q${input.index}`;
      },
    },
  });

  // A competency leaf must exist for the route's check; pick any leaf.
  const { jobId } = await generation.createJob({ competencyIds: [leaf.id], count: 4 });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const row = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (row.status === 'completed' || row.status === 'failed') break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  const report = await generation.getReport(jobId);
  assert.equal(report.status, 'completed');
  assert.equal(report.partial, true, 'one batch failed, one produced');
  assert.equal(report.produced, 2);
  assert.equal(inserted.length, 2);
});

test('provider delete is refused with 409 while a job is queued', { skip: !process.env.DATABASE_URL_APP && 'DATABASE_URL_APP is not set' }, async (t) => {
  const { db, reason } = await database();
  if (db === null) return t.skip(reason);
  const prisma = /** @type {any} */ (db.prisma);
  const store = createProviderStore({ prisma, secretStore: createMemorySecretStore(), installId, logger: silent });
  const provider = await store.create({
    preset: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1', defaultModel: 'm',
    timeoutMs: 1000, headers: {}, extraParams: {}, key: null,
  });
  t.after(async () => {
    await prisma.generationJob.deleteMany({ where: { providerId: provider.id } }).catch(() => undefined);
    await store.remove(provider.id).catch(() => undefined);
    await db.close();
  });
  const job = await prisma.generationJob.create({
    data: {
      id: `d4-${Date.now()}`, competencyIdsJson: '[]', count: 1, status: 'queued', providerId: provider.id,
      taskModel: 'm', promptVersion: 'test', producedCount: 0, quarantinedCount: 0, partial: 0,
    },
  });
  await assert.rejects(store.remove(provider.id), (error) => error instanceof AppError && error.code === 'CONFLICT');
  assert.notEqual(await store.get(provider.id), null, 'the provider survives the refused delete');
  await prisma.generationJob.delete({ where: { id: job.id } });
});
