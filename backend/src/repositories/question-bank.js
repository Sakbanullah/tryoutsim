/**
 * Question-bank stock queries: which questions a dynamic package may deal, the duplicate
 * clusters, and the batch sampling outcome. Selection itself is PACKAGE_SPECIFICATION §4;
 * this file only answers "how many exist" for the questions D3 owns.
 *
 * Nothing here reads a live question inside a session — sessions read their frozen snapshot
 * (DATABASE_SCHEMA §1). The authoring helpers (`LOCAL_USER`, `WRITABLE_CONTENT_FIELDS`,
 * `parseEdits`) live here because they are boundary rules shared by the question routes.
 */

import { createHash } from 'node:crypto';

/** §8.2: a dynamic package selects `active` **and** `dynamicEligible`. */
const SELECTABLE = `lifecycle = 'active' AND "dynamicEligible" = 1`;

/** Kept in step with the columns the filters read. Weakness ranking is RECOMMENDATION_ENGINE §4. */
const FILTER_SQL = Object.freeze({
  text: {
    column: `stem ILIKE '%' || $::text || '%'`,
    validate: (value) => (typeof value === 'string' && value.length > 0 ? null : 'text must be non-empty.'),
  },
  test: { column: `test = $::text`, enum: ['TWK', 'TIU', 'TKP'] },
  competencyId: {
    // A leaf matches itself; a domain id matches every node under it (COMPETENCY_TAXONOMY §7.2).
    column: `("competencyId" = $::text OR "competencyId" LIKE $::text || '.%')`,
    validate: (value) => (typeof value === 'string' && value.length > 0 ? null : 'competencyId must be non-empty.'),
  },
  difficultyAiInitial: { column: `"difficultyAiInitial" = $::text`, enum: ['easy', 'medium', 'hard'] },
  lifecycle: {
    column: `lifecycle = $::text`,
    enum: ['draft', 'ai_validated', 'human_reviewed', 'active', 'quarantined', 'rejected', 'archived'],
  },
  provenance: {
    // `provenance` is stored as JSON text and never queried by containment (DATABASE_SCHEMA §3.5);
    // this is a whole-string match on the parsed field via the JSON accessor.
    column: `("provenanceJson"::jsonb ->> 'kind') = $::text`,
    enum: ['ai_generated', 'ai_generated_human_reviewed', 'human_authored', 'official_historical'],
  },
});

/** Query keys this route understands; everything else is `unknown_query`. */
export const LIST_FILTERS = Object.freeze(Object.keys(FILTER_SQL));

/**
 * Build the WHERE clause from validated filters.
 * @param {Record<string, string>} filters already validated
 * @returns {{sql: string, params: string[]}}
 */
function whereClause(filters) {
  const clauses = [];
  const params = [];
  for (const [name, value] of Object.entries(filters)) {
    params.push(value);
    clauses.push(FILTER_SQL[/** @type {keyof typeof FILTER_SQL} */ (name)].column.replaceAll('$::text', `$${params.length}`));
  }
  return { sql: clauses.length === 0 ? '' : `WHERE ${clauses.join(' AND ')}`, params };
}

/**
 * Validate list filters at the boundary (VALIDATION.md §1). Unknown keys are rejected, never
 * ignored, so a filter the server does not implement cannot look applied.
 *
 * @param {URLSearchParams} query
 * @param {(fields: {path: string, message: string, rule: string}[]) => never} fail
 * @returns {Record<string, string>}
 */
export function parseListFilters(query, fail) {
  /** @type {{path: string, message: string, rule: string}[]} */
  const fields = [];
  /** @type {Record<string, string>} */
  const filters = {};
  for (const [name, value] of query) {
    const spec = FILTER_SQL[/** @type {keyof typeof FILTER_SQL} */ (name)];
    if (spec === undefined) {
      fields.push({ path: name, message: `${name} is not a filter.`, rule: 'unknown_field' });
      continue;
    }
    if (`enum` in spec && !spec.enum.includes(value)) {
      fields.push({ path: name, message: `${name} is not an accepted value.`, rule: 'enum' });
      continue;
    }
    const problem = 'validate' in spec ? spec.validate(value) : null;
    if (problem !== null) {
      fields.push({ path: name, message: problem, rule: 'format' });
      continue;
    }
    filters[name] = value;
  }
  if (fields.length > 0) fail(fields);
  return filters;
}

/**
 * List questions with their per-lifecycle facet counts (§8.1 "counts per facet").
 *
 * Lazy on purpose: no pagination until a documented page size exists, and the facet counts are
 * the full filtered set so the UI can explain an empty list. `ponytail:` the ceiling is a full
 * scan of a local single-user bank; add a page limit when one has an approved value.
 *
 * @param {import('pg').Pool} pool
 * @param {Record<string, string>} filters
 * @returns {Promise<{items: object[], facets: {lifecycle: Record<string, number>}}>}
 */
export async function listQuestions(pool, filters) {
  const { sql, params } = whereClause(filters);
  const { rows } = await pool.query(`SELECT * FROM "question" ${sql} ORDER BY id`, params);
  const facetRows = await pool.query(
    `SELECT lifecycle, count(*)::int AS count FROM "question" ${sql} GROUP BY lifecycle`,
    params,
  );
  const facets = Object.fromEntries(facetRows.rows.map((row) => [row.lifecycle, row.count]));
  return { items: rows, facets: { lifecycle: facets } };
}

/**
 * Duplicate candidate clusters by `contentHash` (V-08/V-09, FR-Q5), non-archived only.
 * @param {import('pg').Pool} pool
 * @returns {Promise<{contentHash: string, count: number}[]>}
 */
export async function duplicateClusters(pool) {
  const { rows } = await pool.query(
    `SELECT "contentHash", count(*)::int AS count FROM "question"
     WHERE lifecycle <> 'archived' GROUP BY "contentHash" HAVING count(*) > 1
     ORDER BY count(*) DESC, "contentHash"`,
  );
  return rows;
}

/**
 * Bank facts the V-08/V-09 check needs: how many non-archived questions share this hash
 * (V-08, excluding the question itself), and how many share the normalised stem.
 * Near-duplicate tokenisation is undefined (V-09), so `nearMatches` counts exact hash matches
 * on normalised, number-stripped stems — a lower bound, never an approximation claim.
 *
 * @param {import('pg').Pool} pool
 * @param {{questionId: string, contentHash: string, stem: string}} input
 * @returns {Promise<{exactMatch: number, nearMatches: number}>}
 */
export async function duplicateFacts(pool, { questionId, contentHash, stem }) {
  const normalised = stem.toLowerCase().replace(/[0-9]+/g, '#').replace(/\s+/g, ' ').trim();
  const { rows } = await pool.query(
    `SELECT
       count(*) FILTER (WHERE "contentHash" = $2 AND id <> $1)::int AS exact,
       count(*) FILTER (WHERE regexp_replace(lower(stem), '[0-9]+', '#', 'g') = $3 AND id <> $1)::int AS near
     FROM "question" WHERE lifecycle <> 'archived'`,
    [questionId, contentHash, normalised],
  );
  return { exactMatch: rows[0].exact, nearMatches: rows[0].near };
}

/**
 * Eligible stock for a competency filter: `active` and `dynamicEligible`, optionally narrowed
 * to one leaf (PACKAGE_SPECIFICATION §4.1). Used by submateri pickers and package assembly.
 * @param {import('pg').Pool} pool
 * @param {string | null} competencyId a leaf id, or null for the whole bank
 * @returns {Promise<number>}
 */
export async function eligibleStock(pool, competencyId) {
  const { rows } = competencyId === null
    ? await pool.query(`SELECT count(*)::int AS count FROM "question" WHERE ${SELECTABLE}`)
    : await pool.query(
      `SELECT count(*)::int AS count FROM "question" WHERE ${SELECTABLE} AND "competencyId" = $1`,
      [competencyId],
    );
  return rows[0].count;
}

/**
 * The stored columns the activation gate reads (QUESTION_SPECIFICATION §3.3).
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @returns {Promise<{lifecycle: string, contentHash: string, answerKeyValidatedAt: string | null, provenanceJson: string} | null>}
 */
export async function gateRow(pool, id) {
  const { rows } = await pool.query(
    `SELECT lifecycle, "contentHash", "answerKeyValidatedAt", "provenanceJson" FROM "question" WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * The `active` questions of one AI batch, for the sampling outcome (§6.4).
 * @param {import('pg').Pool} pool
 * @param {string} batchId
 * @returns {Promise<string[]>}
 */
export async function batchActiveIds(pool, batchId) {
  const { rows } = await pool.query(
    `SELECT id FROM "question" WHERE lifecycle = 'active' AND "provenanceJson"::jsonb ->> 'batchId' = $1 ORDER BY id`,
    [batchId],
  );
  return rows.map((row) => row.id);
}

/**
 * Store the sampling outcome on each question's provenance (§6.1, FR-G7).
 * @param {import('pg').PoolClient} tx
 * @param {string[]} questionIds
 * @param {{status: string, sampledAt: string, findings?: object, systemic?: boolean}} sampling
 * @returns {Promise<number>} rows changed
 */
export async function recordSampling(tx, questionIds, sampling) {
  if (questionIds.length === 0) return 0;
  const { rowCount } = await tx.query(
    `UPDATE "question" SET "provenanceJson" = jsonb_set("provenanceJson"::jsonb, '{sampling}', $2::jsonb)::text
     WHERE id = ANY($1::text[])`,
    [questionIds, JSON.stringify(sampling)],
  );
  return rowCount ?? 0;
}

/**
 * Change eligibility of every `active` question of one AI batch that passed its sampling.
 * Only the call of `POST /question-batches/:id/sample` with `clean` reaches this.
 * @param {import('pg').PoolClient} tx
 * @param {string[]} questionIds

 * @returns {Promise<number>} rows changed
 */
export async function markEligible(tx, questionIds) {
  if (questionIds.length === 0) return 0;
  const { rowCount } = await tx.query(
    `UPDATE "question" SET "dynamicEligible" = 1
     WHERE id = ANY($1::text[]) AND lifecycle = 'active' AND "dynamicEligible" = 0`,
    [questionIds],
  );
  return rowCount ?? 0;
}

/**
 * The person present at this local, single-user machine (ADR-001/ADR-009: no accounts). It is
 * the recorded actor for review, report and approval acts, never a client-supplied value.
 * `ponytail:` a fixed label; replace only if a user-editable display name is decided.
 */
export const LOCAL_USER = 'local-user';

/**
 * The field names an edit may change: content only. State, provenance and validation are
 * moved by their own routes, so an edit can never silently flip them (V-06 protection).
 */
export const WRITABLE_CONTENT_FIELDS = Object.freeze(['stem', 'options', 'explanation', 'answerKey']);

/**
 * Validate an `edits[]` list against the writable fields (API_SPECIFICATION §7.1).
 * @param {unknown} edits
 * @param {FieldErrors} errors
 * @returns {{field: string, value: unknown}[] | null}
 */
export function parseEdits(edits, errors) {
  if (!Array.isArray(edits) || edits.length === 0) {
    errors.add('edits', 'edits is required when the decision is edited.', 'required');
    return null;
  }
  /** @type {{field: string, value: unknown}[]} */
  const parsed = [];
  const seen = new Set();
  for (const [index, edit] of edits.entries()) {
    const path = `edits[${index}].field`;
    const field = edit !== null && typeof edit === 'object' ? /** @type {Record<string, unknown>} */ (edit).field : undefined;
    if (typeof field !== 'string' || !WRITABLE_CONTENT_FIELDS.includes(field)) {
      errors.add(path, 'edits[].field must be a writable content field.', 'enum');
      continue;
    }
    if (seen.has(field)) {
      errors.add(path, 'edits[] must not repeat a field.', 'unique_items');
      continue;
    }
    seen.add(field);
    parsed.push({ field, value: /** @type {Record<string, unknown>} */ (edit).value });
  }
  return parsed;
}

/**
 * The hash of one content field, for the `{field, beforeHash, afterHash}` review entry (§4).
 * @param {unknown} value
 * @returns {string}
 */
export function fieldHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
