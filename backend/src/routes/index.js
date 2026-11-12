/**
 * The full route table.
 *
 * Domain modules register their own routes here, so this file lists modules and
 * nothing else — it is the one place to see which domains are wired.
 */

import { randomUUID } from 'node:crypto';
import { createRouter } from '../http/router.js';
import { conflict } from '../errors.js';
import { nowIso } from '../db/ids.js';
import { loadConfig } from '../config.js';
import { connect } from '../db/client.js';
import { contentHash } from '../domain/question-validation.js';
import { insertQuestion, findQuestion } from '../repositories/question.js';
import { createProviderStore, transportFor } from '../repositories/provider.js';
import { loadRouting } from '../repositories/routing.js';
import { createGenerationService } from '../repositories/generation-job.js';
import { registerHealthRoutes } from './health.js';
import { registerExamConfigRoutes } from './exam-configs.js';
import { registerPackageRoutes } from './packages.js';
import { registerSessionRoutes } from './sessions.js';
import { registerQuestionRoutes } from './questions.js';
import { registerMaterialRoutes } from './materials.js';
import { registerTaxonomyRoutes } from './taxonomy.js';
import { registerGenerationRoutes } from './generation.js';
import { registerProviderRoutes } from './providers.js';
import { registerNotificationRoutes } from './notifications.js';
import { registerBootstrapRoutes } from './bootstrap.js';

/**
 * Build the router with every domain mounted.
 * @param {{pool: import('pg').Pool, prisma?: any, now?: () => number, nowIso?: () => string,
 *   providerStore?: any, fetchImpl?: typeof fetch, generation?: any,
 *   materialGeneration?: any}} deps
 * @returns {ReturnType<typeof createRouter>}
 */
export function buildRouter(deps) {
  const router = createRouter();
  const { pool } = deps;
  // D2's seams: defaults when the caller passes none; `prisma` opens the process client on first use when absent.
  const prisma = deps.prisma ?? lazyPrisma();
  const now = deps.now ?? Date.now;
  const clock = deps.nowIso ?? (() => new Date().toISOString());

  registerHealthRoutes(router, pool);
  registerBootstrapRoutes(router, { pool, prisma, providerStore: deps.providerStore });
  registerTaxonomyRoutes(router, { pool });
  registerExamConfigRoutes(router, { prisma, nowIso: clock });
  registerPackageRoutes(router, { prisma, now, nowIso: clock });
  registerSessionRoutes(router, { prisma, now, nowIso: clock });
  registerQuestionRoutes(router, { pool });
  registerMaterialRoutes(router, { pool });
  registerNotificationRoutes(router, { prisma });

  // Optional seams: a module is wired only when its collaborator exists, so a missing provider
  // configuration cannot render the rest of the app unreachable.
  if (deps.providerStore !== undefined) {
    registerProviderRoutes(router, { prisma, providerStore: deps.providerStore, fetchImpl: deps.fetchImpl });
  }
  if (deps.generation !== undefined) {
    registerGenerationRoutes(router, {
      prisma, generation: deps.generation, materialGeneration: deps.materialGeneration ?? null,
    });
  }
  return router;
}

/**
 * Adapt a Prisma transaction client to the one method `insertQuestion` (a `pg`-client function) uses.
 *
 * The D3 question writer was written against `pg`; the generation runner holds a Prisma transaction client. Passing
 * the Prisma client itself failed at runtime (`tx.query is not a function`) and crashed every generation job.
 * Parameters stay bound by PostgreSQL (`$1…`), never interpolated into the statement.
 *
 * @param {{$queryRawUnsafe: (sql: string, ...params: unknown[]) => Promise<unknown>}} tx
 * @returns {{query: (sql: string, params?: unknown[]) => Promise<unknown>}} the `pg`-shaped client
 */
/**
 * The scoring version a new draft's key is authored against — the same rule as `currentScoringVersion` in
 * `routes/questions.js` (the live usable CPNS config). Read through the transaction client so the draft and the batch
 * row still commit together.
 * @param {any} tx
 * @returns {Promise<number>}
 */
async function scoringVersionFor(tx) {
  const rows = await tx.$queryRawUnsafe(
    `SELECT "scoringVersion" FROM "exam_config"
      WHERE "pathway" = 'CPNS' AND "dataProvenance" = 'seed' AND "state" IN ('official_verified', 'provisional')
      ORDER BY ("state" = 'official_verified') DESC, "configVersion" DESC, "id" ASC
      LIMIT 1`,
  );
  const version = rows[0]?.scoringVersion;
  if (typeof version !== 'number') {
    throw conflict('exam_config', 'no_usable_config', 'No CPNS examination configuration can back a question.');
  }
  return version;
}

function pgClientOver(tx) {
  return {
    query: (sql, params = []) => tx.$queryRawUnsafe(sql, ...params),
  };
}

/**
 * Build the collaborator `buildRouter` needs for the AI domains: the provider store over the
 * process secret store, the generation service over the seams that touch D3's question storage,
 * and the prompt template.
 *
 * It lives here so `main.js` wires the same objects the tests do, and so the seams are stated
 * once: `insertDraft` maps a generated question onto D3's `insertQuestion` inside the caller's
 * Prisma transaction (`tx` is a Prisma client; the SQL goes through the same pool).
 *
 * @param {{prisma: any, pool: import('pg').Pool, secretStore: any, installId: string,
 *   logger?: {info: Function, error: Function}, fetchImpl?: typeof fetch}} deps
 * @returns {{providerStore: any, generation: any}}
 */
export function createAiServices({ prisma, pool, secretStore, installId, logger = console, fetchImpl }) {
  const providerStore = createProviderStore({ prisma, secretStore, installId, logger });
  const generation = createGenerationService({
    prisma,
    logger,
    loadRouting: () => loadRouting(prisma),
    seams: {
      readKey: (providerId) => providerStore.readKey(providerId),
      transportFor: (row) => transportFor({ row, readKey: providerStore.readKey, fetchImpl }),
      loadCompetency: async (competencyId) => {
        const row = await prisma.competency.findUnique({ where: { id: competencyId } });
        if (row === null) throw conflict('competency', 'not_found', 'The competency no longer exists.');
        return { competencyId: row.id, test: row.test, label: row.label, goal: row.goal };
      },
      insertDraft: async (prismaTx, { jobId, batchId, question, competencyId, index }) => {
        if (typeof competencyId !== 'string' || competencyId === '') {
          throw new TypeError(`insertDraft received no competencyId (got ${typeof competencyId}).`);
        }
        const id = `q-${randomUUID()}`;
        const hash = contentHash({
          stem: question.stem, options: question.options, explanation: question.explanation,
        });
        // The model returns the question content only: `test` is the competency's (the prompt's `test` slot) and the
        // key carries the scoring version its weights were authored against (SCORING_METHODOLOGY §2.2), which the
        // client never supplies. Reading them here keeps the draft insertable and scorable.
        const competency = await prismaTx.competency.findUnique({ where: { id: competencyId }, select: { test: true } });
        if (competency === null) throw conflict('competency', 'not_found', 'The competency no longer exists.');
        const scoringVersion = await scoringVersionFor(prismaTx);
        // `insertQuestion` speaks the `pg` client's `query(sql, params)`; a Prisma transaction client does not, so the
        // two calls go through `$queryRawUnsafe` inside that same transaction (one batch, one atomic unit).
        await insertQuestion(pgClientOver(prismaTx), {
          id,
          test: competency.test,
          competencyId,
          stimulus: question.stimulus ?? '',
          stem: question.stem,
          optionsJson: question.options,
          answerKey: { .../** @type {object} */ (question.answerKey), scoringVersion },
          explanation: question.explanation,
          difficultyAiInitial: question.difficultyAiInitial ?? 'medium',
          lifecycle: 'draft',
          provenanceJson: JSON.stringify({
            kind: 'ai_generated',
            providerId: question.providerId ?? null,
            modelId: question.modelId ?? null,
            batchId,
            generationId: jobId,
            generatedAt: nowIso(),
            sampling: { status: 'pending' },
          }),
          contentHash: hash,
          taxonomyVersion: '',
          createdAt: nowIso(),
        });
        return id;
      },
      findQuestionBrief: async (questionId) => {
        const row = await findQuestion(pool, questionId);
        return row === null ? null : { questionId: row.id, stem: row.stem, lifecycle: row.lifecycle };
      },
    },
  });
  return { providerStore, generation };
}

/**
 * A Prisma client opened on first use, for `main.js`, which passes only the pool. The pool is created by `connect`,
 * so the start path's own probe still means what it says.
 * @returns {object} a proxy that forwards every property to the client once
 */
function lazyPrisma() {
  /** @type {object | null} */
  let client = null;
  const open = () => (client ??= connect(loadConfig()).prisma);
  return new Proxy({}, { get: (_target, key) => Reflect.get(open(), key) });
}
