/**
 * The Prisma Client bound to the app-role pool.
 *
 * One pool, one client, one driver (`pg` through `@prisma/adapter-pg`; ADR-008,
 * ADR-011). Every query made through this client is subject to the app role's
 * grants: it cannot write an append-only table and cannot delete a session — that
 * is `tryoutsim.delete_session`'s job (D-1).
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';
import { createPool } from './pool.js';

/**
 * Build the client and the pool it borrows connections from.
 *
 * @param {ReturnType<import('../config.js').loadConfig>} config
 * @returns {{prisma: PrismaClient, pool: import('pg').Pool, close: () => Promise<void>}}
 */
export function connect(config) {
  const pool = createPool({ ...config.pool, databaseUrl: config.databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  return {
    prisma,
    pool,
    /** Close the client then the pool; safe to call twice. */
    async close() {
      await prisma.$disconnect();
      await pool.end();
    },
  };
}
