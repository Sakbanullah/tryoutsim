/**
 * Generation-job persistence and the batch runner (GENERATION_JOBS §1, §4, §5;
 * QUESTION_GENERATION §5–§7).
 *
 * Execution is server-owned: the job runs in this process after the `202` reply,
 * and the user may close the browser. The batch is the atomic unit — its drafts
 * and its row commit in one transaction, or neither does.
 *
 * Where a canonical doc names data the schema does not carry (`question` rows,
 * `competency` rows, a batch "sent" marker), this module calls an injected seam
 * or the database, and the gap is reported as an open question — it is not
 * papered over with invented columns.
 *
 * The provider response is stored only through the SEC-2 scrubber.
 */

import { conflict, notFound } from '../errors.js';
import { newId } from '../db/ids.js';
import {
  aggregateJob,
  extractQuestions,
  isRetryable,
  parseJsonOutput,
  planBatches,
  restartDecision,
  toJobReport,
} from '../domain/generation.js';
import { failureCategoryForError } from '../domain/provider-errors.js';
import { isPairTested, resolveRoute } from '../domain/routing.js';
import { scrub } from '../domain/scrub.js';
import { QUESTION_PROMPT, buildQuestionMessages } from '../prompts/question.v1.js';
import { raise } from './notification.js';

/** How much of a provider body is kept (scrubbed) for inspection. */
const RAW_RESPONSE_LIMIT = 20000;

/**
 * Seams this domain does not own. Each is one call into another domain's
 * documented contract; the runner never reads another domain's tables.
 *
 * @typedef {object} GenerationSeams
 * @property {(providerId: string) => Promise<string | null>} readKey key for the transport, at send time
 * @property {(row: object) => Promise<{chat: (req: object) => Promise<{content: string}>}>} transportFor
 * @property {(competencyId: string) => Promise<{competencyId: string, test: string, label: string, goal: string}>} loadCompetency taxonomy row for the prompt's `{{goal}}` slot
 * @property {(tx: unknown, input: {jobId: string, batchId: string, question: Record<string, unknown>, competencyId: string, index: number}) => Promise<string | null>} insertDraft writes one `draft` question in the caller's transaction (D3)
 * @property {(questionId: string) => Promise<{questionId: string, stem: string, lifecycle: string} | null>} findQuestionBrief for the job report's drafts
 */

/**
 * Build the generation service used by the routes and `main.js`.
 *
 * @param {object} deps
 * @param {any} deps.prisma
 * @param {GenerationSeams} deps.seams
 * @param {() => Promise<import('../domain/routing.js').Routing>} deps.loadRouting
 * @param {{info: Function, error: Function}} [deps.logger]
 */
export function createGenerationService({ prisma, seams, loadRouting, logger = console }) {
  /** Jobs this process runs now, so a retry or a second start cannot double-run one. */
  const active = new Set();

  /**
   * The `question` task route, with the tested-pair rule applied
   * (AI_PROVIDER_ARCHITECTURE §4–§5; PROVIDER_INTEGRATION §2.1).
   * @returns {Promise<{provider: object, modelId: string}>}
   */
  async function resolveQuestionRoute() {
    const resolved = resolveRoute(await loadRouting(), 'question');
    if (resolved.status === 'unmapped') {
      throw conflict('generation_job', 'task_unmapped', 'No provider is routed for question generation.');
    }
    const provider = await prisma.provider.findUnique({ where: { id: resolved.route.providerId } });
    if (provider === null) {
      throw conflict('generation_job', 'task_unmapped', 'The routed provider no longer exists.');
    }
    if (!isPairTested(provider, resolved.route.modelId)) {
      throw conflict('generation_job', 'provider_untested', 'Test this provider and model before generating.');
    }
    return { provider, modelId: resolved.route.modelId };
  }

  /**
   * Start `jobId` after the current turn of the event loop; failures are logged,
   * never thrown into the request that already got its `202`.
   * @param {string} jobId
   */
  function schedule(jobId) {
    setImmediate(() => {
      void runJob(jobId).catch((error) =>
        logger.error(JSON.stringify({
          level: 'error', event: 'generation_crashed', jobId,
          message: error instanceof Error ? error.message : String(error),
        })),
      );
    });
  }

  /**
   * Create a job and its batch rows, then run it (API_ENDPOINTS §8, 202).
   * Batch size follows the model's detected `maxContextTokens` (GENERATION_JOBS
   * §3): a small context yields more, smaller batches.
   *
   * @param {{competencyIds: string[], count: number}} input
   * @returns {Promise<{jobId: string}>}
   */
  async function createJob({ competencyIds, count }) {
    const { provider, modelId } = await resolveQuestionRoute();
    const maxContext = readCapability(provider, 'maxContext');
    const sizes = planBatches({ count, maxContext: typeof maxContext === 'number' ? maxContext : null });
    const jobId = newId();

    await prisma.$transaction(async (tx) => {
      await tx.generationJob.create({
        data: {
          id: jobId,
          competencyIdsJson: JSON.stringify(competencyIds),
          count,
          status: 'queued',
          providerId: provider.id,
          taskModel: modelId,
          promptVersion: `${QUESTION_PROMPT.id}@${QUESTION_PROMPT.version}`,
          producedCount: 0,
          quarantinedCount: 0,
          partial: 0,
        },
      });
      for (const [index, size] of sizes.entries()) {
        await tx.generationBatch.create({
          data: {
            id: `${jobId}-b${index + 1}`,
            jobId,
            status: 'queued',
            failureCategory: null,
            rawResponseRef: null,
            draftQuestionIds: '[]',
          },
        });
      }
    });

    schedule(jobId);
    return { jobId };
  }

  /**
   * Run a job's undecided batches in order, then write its terminal state.
   * @param {string} jobId
   */
  async function runJob(jobId) {
    if (active.has(jobId)) return;
    active.add(jobId);
    try {
      const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
      if (job === null) return;
      const batches = await prisma.generationBatch.findMany({ where: { jobId }, orderBy: { id: 'asc' } });
      // Only `queued` batches run. `failed` waits for an explicit retry, and
      // `interrupted` is never resumed automatically (§5).
      const toRun = batches.filter((batch) => batch.status === 'queued');
      if (toRun.length === 0) return;

      const provider = await prisma.provider.findUnique({ where: { id: job.providerId } });
      if (provider === null) return;
      const transport = await seams.transportFor(provider);
      await prisma.generationJob.update({ where: { id: jobId }, data: { status: 'running' } });

      const competencyIds = JSON.parse(job.competencyIdsJson);
      const sizes = planBatches({ count: job.count, maxContext: readCapability(provider, 'maxContext') ?? null });
      const competency = await seams.loadCompetency(competencyIds[0]);

      for (const batch of toRun) {
        const index = Number(batch.id.slice(batch.id.lastIndexOf('b') + 1)) - 1;
        await runBatch({ job, batch, transport, size: sizes[index] ?? 1, competency, competencyId: competency.id });
      }
      await finalise(jobId);
    } finally {
      active.delete(jobId);
    }
  }

  /**
   * Run one batch: mark it `running` (GENERATION_JOBS §5 "sent"), call, then
   * commit its outcome in one transaction.
   *
   * @param {{job: object, batch: object, transport: {chat: Function}, size: number, competency: object, competencyId: string}} options
   */
  async function runBatch({ job, batch, transport, size, competency, competencyId }) {
    // NOTE: the "sent" marker is not written before the call — the schema's
    // `generation_batch` has no such state (open question), so a crash between
    // send and commit can re-send one batch on restart. Never re-send is a
    // property of the schema, not of this runner.
    let raw;
    let batchDone;
    try {
      const messages = buildQuestionMessages({
        count: size,
        test: competency.test,
        label: competency.label,
        goal: competency.goal,
        difficulty: 'medium', // fixed: `generation_job` has no difficulty column (open question)
      });
      const answer = await transport.chat({ modelId: job.taskModel, messages, maxTokens: size * 700 });
      raw = scrub(answer.content).slice(0, RAW_RESPONSE_LIMIT);
      const parsed = parseJsonOutput(answer.content);
      const questions = parsed === null ? null : extractQuestions(parsed);
      if (questions === null) {
        await prisma.generationBatch.update({
          where: { id: batch.id },
          data: { status: 'failed', failureCategory: parsed === null ? 'malformed_json' : 'schema_violation', rawResponseRef: raw },
        });
        return;
      }
      batchDone = { questions };
    } catch (error) {
      raw = raw ?? scrub(error instanceof Error ? error.message : String(error)).slice(0, RAW_RESPONSE_LIMIT);
      await prisma.generationBatch.update({
        where: { id: batch.id },
        data: { status: 'failed', failureCategory: failureCategoryForError(error), rawResponseRef: raw },
      });
      return;
    }

    // All of the batch's drafts and its row, or none (GENERATION_JOBS §4).
    await prisma.$transaction(async (tx) => {
      /** @type {string[]} */
      const draftIds = [];
      for (const { index, question } of batchDone.questions) {
        const questionId = await seams.insertDraft(tx, { jobId: job.id, batchId: batch.id, question, competencyId, index });
        if (questionId !== null) draftIds.push(questionId);
      }
      await tx.generationBatch.update({
        where: { id: batch.id },
        data: { status: 'completed', failureCategory: null, rawResponseRef: raw, draftQuestionIds: JSON.stringify(draftIds) },
      });
    });
  }

  /**
   * Write the terminal job state and its notification in one transaction
   * (NOTIFICATION_SPECIFICATION §5). Returns without writing if a batch is still
   * undecided.
   * @param {string} jobId
   */
  async function finalise(jobId) {
    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    const batches = await prisma.generationBatch.findMany({ where: { jobId } });
    if (job === null) return;
    const decided = batches.filter((batch) => batch.status === 'completed' || batch.status === 'failed' || batch.status === 'interrupted');
    if (decided.length !== batches.length) return;

    const aggregate = aggregateJob(
      decided.map((batch) => ({
        status: batch.status,
        produced: JSON.parse(batch.draftQuestionIds).length,
        quarantined: 0,
      })),
    );
    await prisma.$transaction(async (tx) => {
      await tx.generationJob.update({
        where: { id: jobId },
        data: {
          status: aggregate.status,
          producedCount: aggregate.produced,
          quarantinedCount: aggregate.quarantined,
          partial: aggregate.partial ? 1 : 0,
        },
      });
      await raise({
        database: tx,
        type: aggregate.status === 'completed' ? 'generation_completed' : 'generation_failed',
        entityId: jobId,
        params: { jobId, produced: aggregate.produced, batches: batches.length },
      });
    });
  }

  /**
   * `POST /generation-jobs/:id/retry` (API_ENDPOINTS §8; FR-G8). A retry is a new
   * provider request on the same pair; the pair must still be tested.
   * @param {string} jobId
   * @returns {Promise<{jobId: string, status: string}>}
   */
  async function retryJob(jobId) {
    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (job === null) throw notFound('generation_job', jobId);
    if (!isRetryable(job.status)) {
      throw conflict('generation_job', 'not_retryable', 'Only a failed or interrupted job can be retried.');
    }
    const provider = await prisma.provider.findUnique({ where: { id: job.providerId } });
    if (provider === null || !isPairTested(provider, job.taskModel)) {
      throw conflict('generation_job', 'provider_untested', 'Test this provider and model before retrying.');
    }
    await prisma.$transaction(async (tx) => {
      // The failed attempts' rows go; the questions they produced (none on
      // failure) stay, and completed batches are kept as they are (§3).
      await tx.generationBatch.deleteMany({ where: { jobId, status: { in: ['failed', 'interrupted'] } } });
      await tx.generationJob.update({ where: { id: jobId }, data: { status: 'queued', partial: 0 } });
    });
    schedule(jobId);
    return { jobId, status: 'queued' };
  }

  /**
   * The restart inspection of GENERATION_JOBS §5, run before the server reports
   * ready. Only safe work is resumed; partial output is never deleted.
   * @returns {Promise<{resumed: string[], interrupted: string[]}>}
   */
  async function inspectOnStart() {
    const leftovers = await prisma.generationJob.findMany({ where: { status: { in: ['queued', 'running'] } } });
    /** @type {string[]} */
    const resumed = [];
    /** @type {string[]} */
    const interrupted = [];
    for (const job of leftovers) {
      const batches = await prisma.generationBatch.findMany({ where: { jobId: job.id } });
      const decision = restartDecision(
        job,
        // No batch can be `running` (no sent marker is written), so a crash
        // always resumes the queued batches — see the open question.
        batches.map((batch) => ({ id: batch.id, status: /** @type {'queued' | 'committed'} */ (batch.status) })),
      );
      if (decision.action === 'resume') {
        resumed.push(job.id);
        schedule(job.id);
      } else if (decision.action === 'interrupt') {
        await prisma.$transaction(async (tx) => {
          if (decision.markBatches.length > 0) {
            await tx.generationBatch.updateMany({ where: { id: { in: decision.markBatches } }, data: { status: 'interrupted' } });
          }
          await tx.generationJob.update({ where: { id: job.id }, data: { status: 'interrupted' } });
          await raise({
            database: tx,
            type: 'generation_interrupted',
            entityId: job.id,
            params: { jobId: job.id, batches: batches.length },
          });
        });
        interrupted.push(job.id);
      }
    }
    return { resumed, interrupted };
  }

  /**
   * The `JobReport` of GENERATION_JOBS §3 for one job.
   * @param {string} jobId
   * @returns {Promise<object>}
   */
  async function getReport(jobId) {
    const job = await prisma.generationJob.findUnique({ where: { id: jobId }, include: { batches: { orderBy: { id: 'asc' } } } });
    if (job === null) throw notFound('generation_job', jobId);
    const draftIds = /** @type {string[]} */ (job.batches.flatMap((batch) => JSON.parse(batch.draftQuestionIds)));
    // Counts come from the stored ids alone, so the report never depends on
    // another domain's read.
    return toJobReport(job, job.batches, draftIds.map((questionId) => ({ questionId, stem: '', lifecycle: 'draft' })));
  }

  /**
   * `GET /generation-jobs`, newest first. `generation_job` has no timestamp
   * column, so the order is by opaque id — see the report's open question.
   * @param {{limit?: string | null}} query
   * @returns {Promise<object[]>}
   */
  async function listJobs({ limit }) {
    const take = Math.min(Math.max(Number.parseInt(limit ?? '', 10) || 50, 1), 200);
    const rows = await prisma.generationJob.findMany({ orderBy: { id: 'desc' }, take });
    return Promise.all(rows.map((row) => getReport(row.id)));
  }

  return { createJob, retryJob, runJob, inspectOnStart, getReport, listJobs };
}

/**
 * The `value` of one stored capability flag, or `null`.
 * @param {{capabilityFlagsJson: string}} provider
 * @param {'jsonMode'|'streaming'|'maxContext'} field
 * @returns {unknown}
 */
function readCapability(provider, field) {
  try {
    return JSON.parse(provider.capabilityFlagsJson)?.[field]?.value ?? null;
  } catch {
    return null;
  }
}
