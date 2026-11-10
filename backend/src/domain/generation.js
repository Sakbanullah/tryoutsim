/**
 * Generation-jobs domain (GENERATION_JOBS §2–§5, QUESTION_GENERATION §5–§7).
 *
 * Pure decisions live here — batch sizing, status aggregation, the report shape
 * and the restart inspection — so they are testable without a database. The
 * runner in `repositories/generation-job.js` performs the writes they describe.
 *
 * The batch is the atomic unit (§4): one row, all of its drafts or none.
 */

/** The closed job status set (GENERATION_JOBS §2; DATABASE_SCHEMA C-18). */
export const JOB_STATUSES = Object.freeze(['queued', 'running', 'completed', 'failed', 'interrupted']);

/** The closed batch status set (DATABASE_SCHEMA C-19). */
export const BATCH_STATUSES = Object.freeze(['completed', 'failed', 'interrupted']);

/**
 * Questions per provider call. PRD §12 fixes only the review budget
 * ("≤ 60 s median per AI question"); it does not state a number of calls per
 * review unit. A batch of 5 bounds one review sitting to about five minutes and
 * keeps a failed call from costing a long generation. NOT a canonical value —
 * see the open question in the D4 report.
 */
export const QUESTIONS_PER_BATCH = 5;

/**
 * Smallest context window that can hold one question plus the template. A model
 * whose `maxContext` is detected but below this cannot be used for `question`.
 */
export const MIN_CONTEXT_FOR_ONE_QUESTION = 2000;

/**
 * Split a requested count into batch sizes. A detected `maxContextTokens` below
 * what the full batch needs halves the batch; it never truncates a prompt (§3).
 *
 * @param {{count: number, maxContext: number | null}} options
 * @returns {number[]} sizes, summing to `count`
 */
export function planBatches({ count, maxContext }) {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('count must be a positive integer.');
  let perBatch = QUESTIONS_PER_BATCH;
  // `null` = no probed context size: plan at the default batch size. Whether an
  // unprobed model may be used at all is an open question, not decided here.
  while (maxContext !== null && maxContext < perBatch * MIN_CONTEXT_FOR_ONE_QUESTION && perBatch > 1) {
    perBatch = Math.max(1, Math.floor(perBatch / 2));
  }
  /** @type {number[]} */
  const sizes = [];
  for (let left = count; left > 0; left -= perBatch) sizes.push(Math.min(perBatch, left));
  return sizes;
}

/**
 * A job's status once no caller is working on it, and its counters, from its
 * batches. `partial` is true iff some batch failed or was interrupted and the
 * job still produced questions (§3).
 *
 * @param {{status: string, produced: number, quarantined: number}[]} batches
 * @returns {{status: 'completed'|'failed', produced: number, quarantined: number, partial: boolean, awaitingSampling: boolean}}
 */
export function aggregateJob(batches) {
  const produced = batches.reduce((sum, batch) => sum + batch.produced, 0);
  const quarantined = batches.reduce((sum, batch) => sum + batch.quarantined, 0);
  const succeeded = batches.filter((batch) => batch.status === 'completed').length;
  const unresolved = batches.length - succeeded;
  return {
    status: succeeded === 0 ? 'failed' : 'completed',
    produced,
    quarantined,
    partial: unresolved > 0 && produced > 0,
    // §3: the batch gate is unsatisfied while any batch delivered questions that
    // have not been sampled. Batches this runner just wrote are never sampled.
    awaitingSampling: produced - quarantined > 0,
  };
}

/**
 * The `JobReport` of §3 — the only job shape the API returns. No token, cost or
 * rate field exists (AI_PROVIDER_ARCHITECTURE §9).
 *
 * @param {object} job a `generation_job` row
 * @param {(object | null)[]} batches its `generation_batch` rows
 * @param {{questionId: string, stem: string, lifecycle: string}[]} drafts
 * @returns {object}
 */
export function toJobReport(job, batches, drafts) {
  /** @type {Record<string, number>} */
  const failedByCategory = {};
  for (const batch of batches) {
    if (batch && batch.failureCategory) {
      failedByCategory[batch.failureCategory] = (failedByCategory[batch.failureCategory] ?? 0) + 1;
    }
  }
  return {
    jobId: job.id,
    status: job.status,
    requested: job.count,
    produced: job.producedCount,
    quarantined: job.quarantinedCount,
    partial: job.partial === 1,
    awaitingSampling: (job.producedCount - job.quarantinedCount > 0) && job.status === 'completed',
    failureCategories: failedByCategory,
    batches: batches.filter((batch) => batch !== null).map((batch) => ({
      batchId: /** @type {{id: string}} */ (batch).id,
      status: /** @type {{status: string}} */ (batch).status,
      produced: JSON.parse(/** @type {{draftQuestionIds: string}} */ (batch).draftQuestionIds).length,
      failureCategory: /** @type {{failureCategory: string | null}} */ (batch).failureCategory ?? undefined,
    })),
    drafts,
  };
}

/**
 * The restart decision of §5 for one leftover job.
 *
 * - `queued` — nothing was sent: resume normally.
 * - `running` — drop the unsent batches (`drop`), mark the sent-but-unanswered
 *   one `interrupted`. A running job always has at most one batch in flight, so
 *   the job becomes `interrupted`; batches already resolved keep their rows and
 *   their drafts (`keep`).
 * - `completed` / `failed` / `interrupted` — untouched.
 *
 * Never resumes a sent request: a provider request is not resumable mid-flight.
 *
 * @param {{id: string, status: string}} job
 * @param {{id: string, status: 'queued'|'sent'|'committed', failureCategory?: string | null}[]} batches
 * @returns {{action: 'none'} | {action: 'resume'} | {action: 'interrupt', markBatches: string[], dropBatches: string[]}}
 */
export function restartDecision(job, batches) {
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'interrupted') return { action: 'none' };
  if (job.status === 'queued') return { action: 'resume' };
  return {
    action: 'interrupt',
    markBatches: batches.filter((batch) => batch.status === 'sent').map((batch) => batch.id),
    dropBatches: batches.filter((batch) => batch.status === 'queued').map((batch) => batch.id),
  };
}

/**
 * Whether a job may be retried: `interrupted` or `failed` only (§2: no terminal
 * failure without a retry action; no retry of a finished or running job).
 * @param {string} status
 * @returns {boolean}
 */
export function isRetryable(status) {
  return status === 'interrupted' || status === 'failed';
}

/**
 * Parse the JSON array bodies the generators produce (AI_VALIDATION T layer, the
 * minimal part). Accepts a bare JSON value or one fenced code block (§4 of the
 * prompt spec). Returns `null` when it is not JSON at all — the caller records
 * `malformed_json`; a parsed wrong shape is `schema_violation`.
 *
 * @param {string} content
 * @returns {unknown}
 */
export function parseJsonOutput(content) {
  const text = content.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/**
 * Extract the `questions[]` array from a parsed output. Each entry keeps its
 * index so a per-question failure can be reported.
 *
 * @param {unknown} parsed
 * @returns {{index: number, question: Record<string, unknown>}[] | null} `null` when the shape is wrong
 */
export function extractQuestions(parsed) {
  const questions = /** @type {{questions?: unknown}} */ (parsed)?.questions;
  if (!Array.isArray(questions)) return null;
  return questions
    .map((question, index) => ({ index, question: /** @type {Record<string, unknown>} */ (question) }))
    .filter(({ question }) => question !== null && typeof question === 'object' && !Array.isArray(question));
}
