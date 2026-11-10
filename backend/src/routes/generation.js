/**
 * `/generation-jobs` (API_ENDPOINTS §8; GENERATION_JOBS; QUESTION_GENERATION §5).
 *
 * Create and retry answer `202` and run the job in the background; there is no
 * cancel, pause or resume route (Product Owner decision, 2026-11-08). Reports
 * carry status, counts and batches only — no token, cost or rate field exists
 * (AI_PROVIDER_ARCHITECTURE §9).
 */

import { AppError, validationError } from '../errors.js';
import { asObject } from '../http/validation.js';
import { parseGenerationRequest } from '../domain/generation-input.js';

/**
 * Register the generation-job routes.
 *
 * @param {ReturnType<import('../http/router.js').createRouter>} router
 * @param {{prisma: any, generation: any, materialGeneration?: any}} deps
 */
export function registerGenerationRoutes(router, { prisma, generation, materialGeneration = null }) {
  /** Enqueue N questions for a competency set (202, 400, 409, 429, 502, 504). */
  router.add('POST', '/generation-jobs', async ({ body }) => {
    const input = parseGenerationRequest(asObject(body));
    const competencyIds = await checkLeaves(prisma, input.competencyIds);
    if (competencyIds.length > 0) throw validationError(competencyIds);
    return { status: 202, data: await generation.createJob(input) };
  });

  /** List jobs, newest first (200). */
  router.add('GET', '/generation-jobs', async ({ query }) => ({ data: await generation.listJobs({ limit: query.get('limit') }) }));

  /** One job's report (200, 404). */
  router.add('GET', '/generation-jobs/:id', async ({ params }) => ({ data: await generation.getReport(params.id) }));

  /** Retry a failed or interrupted job on the same pair (202, 400, 404, 409). */
  router.add('POST', '/generation-jobs/:id/retry', async ({ params }) => ({ status: 202, data: await generation.retryJob(params.id) }));

  /**
   * Draft one material with the AI provider (API_ENDPOINTS §7 `POST /materials/:id/draft`).
   * 202 with a job id; the same provider/timeout error codes apply as for question jobs.
   */
  router.add('POST', '/materials/:id/draft', async ({ params }) => {
    if (materialGeneration === null) {
      throw new AppError('UNSUPPORTED', 'Material drafting is not configured.', { feature: 'material_draft' });
    }
    return { status: 202, data: await materialGeneration.draftMaterial(params.id) };
  });
}

/**
 * Every named competency must exist and be a leaf with a stated goal (VALIDATION
 * §2 "generation": "each a valid leaf" — QUESTION_GENERATION §1 step 1).
 *
 * @param {any} prisma
 * @param {string[]} ids
 * @returns {Promise<{path: string, message: string, rule: string}[]>}
 */
async function checkLeaves(prisma, ids) {
  const rows = await prisma.competency.findMany({ where: { id: { in: ids } }, include: { _count: { select: { children: true } } } });
  /** @type {Map<string, {id: string, goal: string, _count: {children: number}}>} */
  const byId = new Map(rows.map((row) => [row.id, row]));
  /** @type {{path: string, message: string, rule: string}[]} */
  const fields = [];
  for (const [index, id] of ids.entries()) {
    const row = byId.get(id);
    if (row === undefined) fields.push({ path: `competencyIds[${index}]`, message: 'Competency does not exist.', rule: 'exists' });
    else if (row._count.children > 0) fields.push({ path: `competencyIds[${index}]`, message: 'Competency is not a leaf.', rule: 'leaf' });
    else if (typeof row.goal !== 'string' || row.goal.trim().length === 0) {
      fields.push({ path: `competencyIds[${index}]`, message: 'Competency has no goal to ground the prompt.', rule: 'goal' });
    }
  }
  return fields;
}
