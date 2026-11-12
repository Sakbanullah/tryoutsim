/**
 * Provider deletion (DB-4, ADR-011 P-6; API_ENDPOINTS §8 `DELETE /providers/:id`): the FK cascades a provider's jobs
 * and their batches, and the delete guard refuses while a job is queued or running (23503 → 409 CONFLICT).
 * Skipped when `DATABASE_URL_APP` is absent or unreachable. Every row here is created by this test and removed by it.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connect } from '../src/db/client.js';
import { createProviderStore } from '../src/repositories/provider.js';
import { createMemorySecretStore } from '../src/secrets/secret-store.js';
import { AppError } from '../src/errors.js';
import { loadConfig } from '../src/config.js';

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

/**
 * A provider (keyless, so no credential is written) and a generation job on it, in the given status.
 * @param {any} prisma
 * @param {any} store
 * @param {string} tag
 * @param {string} status
 */
async function providerWithJob(prisma, store, tag, status) {
  const provider = await store.create({
    preset: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1', defaultModel: 'm',
    timeoutMs: 1000, headers: {}, extraParams: {}, key: null,
  });
  const jobId = `cascade-${tag}`;
  await prisma.generationJob.create({
    data: {
      id: jobId, competencyIdsJson: '[]', count: 1, status, providerId: provider.id,
      taskModel: 'm', promptVersion: 'test', producedCount: 0, quarantinedCount: 0, partial: 0,
    },
  });
  await prisma.generationBatch.create({
    data: { id: `${jobId}-b1`, jobId, status: 'completed', failureCategory: null, rawResponseRef: '', draftQuestionIds: '[]' },
  });
  return { provider, jobId };
}

test('provider delete refuses while a job is queued, then cascades a finished job', { skip: !process.env.DATABASE_URL_APP && 'DATABASE_URL_APP is not set' }, async (t) => {
  const { db, reason } = await database();
  if (db === null) return t.skip(reason);
  const prisma = /** @type {any} */ (db.prisma);
  const store = createProviderStore({ prisma, secretStore: createMemorySecretStore(), installId: `cascade-${Date.now()}`, logger: silent });
  const tag = `${Date.now()}`;
  let providerId = null;
  t.after(async () => {
    // Safety net only: the test's own delete is the assertion. Nothing here touches another test's rows.
    if (providerId !== null) {
      await prisma.generationJob.deleteMany({ where: { providerId } }).catch(() => undefined);
      await prisma.provider.deleteMany({ where: { id: providerId } }).catch(() => undefined);
    }
    await db.close();
  });

  const { provider, jobId } = await providerWithJob(prisma, store, tag, 'queued');
  providerId = provider.id;

  // Queued: refused with a CONFLICT, and nothing is removed.
  await assert.rejects(store.remove(provider.id), (error) => error instanceof AppError && error.code === 'CONFLICT');
  assert.notEqual(await store.get(provider.id), null, 'the provider survives the refused delete');
  assert.notEqual(await prisma.generationJob.findUnique({ where: { id: jobId } }), null, 'its job survives too');

  // Finished: the FK cascades the job (and its batch), then the provider goes; the credential purge follows.
  await prisma.generationJob.update({ where: { id: jobId }, data: { status: 'completed' } });
  await store.remove(provider.id);
  providerId = null;
  assert.equal(await store.get(provider.id), null, 'the provider row is gone');
  assert.equal(await prisma.generationJob.findUnique({ where: { id: jobId } }), null, 'its finished job went with it');
  assert.equal(await prisma.generationBatch.findUnique({ where: { id: `${jobId}-b1` } }), null, 'and so did its batch');
});
