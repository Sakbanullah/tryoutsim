/**
 * `/exam-configs` (API_ENDPOINTS §2; API_SPECIFICATION §7.2 for approval).
 *
 * Management only: the learner never selects a config (PACKAGE_SPECIFICATION §3), so no route here feeds a session.
 * The approval body carries only `configId` and the acknowledgements; the four bound values are computed server-side
 * (VALIDATION §2).
 */

import { parseBody } from '../domain/validate.js';
import { approveConfig, getExamConfig, listExamConfigs } from '../repositories/exam-config.js';

/**
 * Register the exam-config routes.
 * @param {ReturnType<import('../http/router.js').createRouter>} router
 * @param {{prisma: object, nowIso: () => string}} deps
 */
export function registerExamConfigRoutes(router, { prisma, nowIso }) {
  /** List CPNS configs with state and approval status (200). */
  router.add('GET', '/exam-configs', async () => ({ data: await listExamConfigs(prisma) }));

  /** One config with basis, thresholds and verdict possibility (200, 404). */
  router.add('GET', '/exam-configs/:id', async ({ params }) => ({ data: await getExamConfig(prisma, params.id) }));

  /** Record a provisional approval for the current four values (200, 400, 404, 409). */
  router.add('POST', '/exam-configs/:id/approval', async ({ params, body }) => {
    const input = parseBody(body, [
      { name: 'configId', required: true, kind: 'string' },
      { name: 'acknowledgedWarnings', required: true, kind: 'stringArray', itemMax: 100 },
    ]);
    return { data: await approveConfig(prisma, params.id, input, nowIso()) };
  });
}
