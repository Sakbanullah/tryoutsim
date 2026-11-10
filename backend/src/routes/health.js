/**
 * `GET /health` — readiness, not liveness.
 *
 * It answers 200 only once the database answers, so the launcher can use it as
 * the gate before opening the browser (DEPLOYMENT_AND_BACKUP §1.2 step 5–6).
 * Reaching this route at all means the process started; a failing database is
 * reported as an error envelope, which the launcher shows instead of a blank page.
 */

import { ping } from '../db/pool.js';
import { CONTRACT_VERSION } from '../http/envelope.js';

/**
 * Register the health route.
 * @param {ReturnType<import('../http/router.js').createRouter>} router
 * @param {import('pg').Pool} pool
 */
export function registerHealthRoutes(router, pool) {
  /**
   * Report readiness.
   * @returns {Promise<{data: {status: string, contractVersion: string, database: string}}>}
   */
  router.add('GET', '/health', async () => {
    await ping(pool);
    return { data: { status: 'ready', contractVersion: CONTRACT_VERSION, database: 'up' } };
  });
}
