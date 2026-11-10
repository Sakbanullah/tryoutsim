/**
 * `/competencies` and `/latihan/submateri` (API_ENDPOINTS §1, §3).
 *
 * The taxonomy's content is canonical in COMPETENCY_TAXONOMY.md; both routes read the seeded
 * table and nothing else. `availableQuestions` is the stored eligibility count, never a
 * client-side derivation (§8.2: `active` **and** `dynamicEligible`).
 */

import { validationError } from '../errors.js';
import { leavesWithStock, listNodes } from '../repositories/competency.js';

/**
 * Register the taxonomy routes.
 * @param {ReturnType<import('../http/router.js').createRouter>} router
 * @param {{pool: import('pg').Pool}} deps
 */
export function registerTaxonomyRoutes(router, { pool }) {
  router.add('GET', '/competencies', async ({ query }) => {
    const test = query.get('test');
    if (test !== null && !['TWK', 'TIU', 'TKP'].includes(test)) {
      throw validationError([{ path: 'test', message: 'test must be TWK, TIU or TKP.', rule: 'enum' }]);
    }
    return { data: await listNodes(pool, test) };
  });

  router.add('GET', '/latihan/submateri', async () => ({ data: await leavesWithStock(pool) }));
}
