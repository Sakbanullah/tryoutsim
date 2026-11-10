/**
 * Process entry point.
 *
 * Order follows DEPLOYMENT_AND_BACKUP §1.2: read configuration (a missing value
 * is a start failure with a stated remedy), take the single-instance lock, prove
 * the database answers, then serve on loopback and report ready. The start path
 * runs `prisma migrate status` — never a migration: migrations are an operator
 * step under the migration role (MIGRATION_STRATEGY §7).
 */

import { mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from './config.js';
import { createPool, ping } from './db/pool.js';
import { createHttpServer } from './http/server.js';
import { buildRouter, createAiServices } from './routes/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';
import { STORE_KINDS, createMemorySecretStore, createWindowsCredentialStore, defaultInstallId, platformStoreKind } from './secrets/secret-store.js';

const LOCK_NAME = 'tryoutsim-backend.lock';

/** @returns {string} the single-instance lock path */
function lockPath() {
  return join(process.env.LOCALAPPDATA ?? tmpdir(), LOCK_NAME);
}

/**
 * Acquire the single-instance lock. A second instance refuses to start rather
 * than sharing one database and one credential with the first.
 * @returns {Promise<() => Promise<void>>} release function
 */
async function acquireLock() {
  const path = lockPath();
  await mkdir(join(path, '..'), { recursive: true });

  try {
    const handle = await open(path, 'wx');
    await handle.writeFile(String(process.pid));
    await handle.close();
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'EEXIST') throw error;

    const owner = Number((await readFile(path, 'utf8').catch(() => '')).trim());
    if (Number.isInteger(owner) && owner > 0) {
      try {
        process.kill(owner, 0);
        throw new Error(
          `TryoutSim is already running (process ${owner}). Close it before starting another instance.`,
        );
      } catch (probe) {
        if (/** @type {NodeJS.ErrnoException} */ (probe).code === 'EPERM') {
          throw new Error(
            `TryoutSim is already running (process ${owner}). Close it before starting another instance.`,
          );
        }
        // ESRCH: the owner is gone, so the lock is stale and can be replaced.
      }
    }
    await writeFile(path, String(process.pid));
  }

  return () => rm(path, { force: true });
}

/** Entry point. */
async function main() {
  const config = loadConfig();
  const releaseLock = await acquireLock();
  const pool = createPool({ ...config.pool, databaseUrl: config.databaseUrl });

  try {
    await ping(pool);
  } catch (error) {
    await releaseLock();
    await pool.end();
    throw new Error(
      `Cannot reach the database as the application role. Is PostgreSQL 18 running and ` +
        `tryoutsim provisioned (DEPLOYMENT_AND_BACKUP §1.5)? Cause: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // The AI domains need a Prisma client and the OS secret store; a machine whose store cannot be
  // opened still gets every other route, with `/providers` reporting `UNSUPPORTED`.
  // One Prisma client over the same pool `connect` builds, so every query stays under the app
  // role's grants. A machine whose OS secret store cannot be opened still gets every other route.
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  let secretStore;
  try {
    const kind = platformStoreKind();
    if (!STORE_KINDS.includes(kind)) throw new Error(`This platform's secret store (${kind}) is not one of the schema's store kinds.`);
    secretStore = kind === 'windows_credential_manager' ? createWindowsCredentialStore() : createMemorySecretStore();
  } catch (error) {
    console.error(JSON.stringify({
      level: 'warn', event: 'secret_store_unavailable',
      message: error instanceof Error ? error.message : String(error),
    }));
    secretStore = createMemorySecretStore();
  }
  const ai = createAiServices({ prisma, secretStore, installId: defaultInstallId() });

  const router = buildRouter({ pool, prisma, providerStore: ai.providerStore, generation: ai.generation });
  const server = createHttpServer({ router });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => resolve(undefined));
  });

  console.log(JSON.stringify({
    level: 'info', event: 'ready', host: config.host, port: config.port,
  }));

  /** Stop accepting work, drain connections, release the lock. */
  const shutdown = async (signal) => {
    console.log(JSON.stringify({ level: 'info', event: 'shutdown', signal }));
    server.close();
    await prisma.$disconnect();
    await pool.end();
    await releaseLock();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error(JSON.stringify({
    level: 'fatal', event: 'start_failed', message: error instanceof Error ? error.message : String(error),
  }));
  process.exit(1);
});
