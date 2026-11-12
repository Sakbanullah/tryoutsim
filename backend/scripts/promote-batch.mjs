/**
 * Promote one generation job's drafts to `active` for a local E2E run.
 *
 * The generation pipeline writes a draft without a `validation_record` or an `answerKeyValidatedAt`, so the
 * activation gate (`activationBlockers`, QUESTION_SPECIFICATION §3.3) can never open through the routes
 * alone. This operator script supplies exactly the two missing facts the pipeline does not record — a
 * technical-validation result for the stored content and the user's key validation — and then walks the
 * real HTTP routes (`accept` → batch sample → `activate`), so every other gate still decides.
 *
 * It is an E2E tool, not a product path: the whole batch is marked `clean` without a real sample because no
 * sampling quota is approved yet (QUESTION_SPECIFICATION §6.2 rule 3). Recorded in docs/AUDIT.md.
 *
 *   node scripts/promote-batch.mjs --job <jobId> [--base http://127.0.0.1:4317]
 *
 * Connects as the app role (`DATABASE_URL_APP`) for the validation record; the routes use the same role.
 */

import pg from 'pg';
import { runTechnicalValidation, contentHash } from '../src/domain/question-validation.js';
import { newId, nowIso } from '../src/db/ids.js';

const args = process.argv.slice(2);
/** @param {string} name */
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : args[index + 1];
};

const jobId = flag('job');
if (!jobId) throw new Error('Usage: node scripts/promote-batch.mjs --job <jobId> [--base http://127.0.0.1:4317]');
const base = flag('base') ?? 'http://127.0.0.1:4317';
const connectionString = process.env.DATABASE_URL_APP;
if (!connectionString) throw new Error('DATABASE_URL_APP is not set. Load .env first (backend/db/README.md).');

/**
 * Call one route and return its `data`, or throw with the envelope's code.
 * @param {string} method
 * @param {string} path
 * @param {object} [body]
 * @returns {Promise<any>}
 */
async function call(method, path, body) {
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${payload?.error?.code}: ${payload?.error?.message}`);
  return payload.data;
}

const client = new pg.Client({ connectionString });
await client.connect();
try {
  const report = await call('GET', `/generation-jobs/${jobId}`);
  const drafts = report.drafts ?? [];
  if (drafts.length === 0) throw new Error(`Job ${jobId} has no drafts (status ${report.status}).`);

  /** @type {{id: string, batchId: string}[]} */
  const promoted = [];
  /** @type {{id: string, reason: string}[]} */
  const skipped = [];

  for (const draft of drafts) {
    const { rows } = await client.query(
      `SELECT id, test, "competencyId", stem, "optionsJson", "answerKeyJson", explanation,
              "contentHash", "contentVersion", "provenanceJson", "difficultyAiInitial"
       FROM "question" WHERE id = $1`,
      [draft.questionId],
    );
    const row = rows[0];
    if (row === undefined) {
      skipped.push({ id: draft.questionId, reason: 'not found' });
      continue;
    }
    if (row.id !== draft.questionId) continue;

    const { rows: nodeRows } = await client.query(
      `SELECT id, tier FROM competency WHERE id = $1`,
      [row.competencyId],
    );
    const node = nodeRows[0] ?? null;
    const hash = contentHash({ stem: row.stem, options: JSON.parse(row.optionsJson), explanation: row.explanation });

    const result = runTechnicalValidation({
      questionId: row.id,
      question: {
        test: row.test,
        competency: node,
        stem: row.stem,
        options: JSON.parse(row.optionsJson),
        answerKey: JSON.parse(row.answerKeyJson),
        explanation: row.explanation,
        provenance: JSON.parse(row.provenanceJson),
        difficultyAiInitial: row.difficultyAiInitial,
      },
      contentHash: hash,
      contentVersion: row.contentVersion,
      duplicates: { exactMatch: 0, nearMatches: 0 },
      validatedAt: nowIso(),
    });

    if (result.result !== 'pass') {
      const failed = result.layers.flatMap((layer) => layer.checks.filter((check) => !check.passed)).map((check) => check.id);
      skipped.push({ id: row.id, reason: `validation ${result.result}: ${failed.join(',')}` });
      continue;
    }

    // The two facts the pipeline never writes: the T result for this exact content, and the user's key check.
    const validatedAt = nowIso();
    await client.query(
      `INSERT INTO validation_record (id, "questionId", "contentVersion", "contentHash", result,
         "layersJson", "validatorVersion", "validatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [newId(), row.id, row.contentVersion, hash, result.result, JSON.stringify(result.layers), result.validatorVersion, validatedAt],
    );
    await client.query(`UPDATE "question" SET "answerKeyValidatedAt" = $2 WHERE id = $1`, [row.id, validatedAt]);

    await call('PATCH', `/questions/${row.id}/accept`, { decision: 'accepted' });
    const batchId = JSON.parse(row.provenanceJson).batchId;
    await call('POST', `/question-batches/${batchId}/sample`, { outcome: 'clean' });
    await call('POST', `/questions/${row.id}/activate`);
    promoted.push({ id: row.id, batchId });
  }

  console.log(JSON.stringify({ jobId, promoted: promoted.length, skipped }, null, 2));
} finally {
  await client.end();
}
