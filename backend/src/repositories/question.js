/**
 * Question repository: every SQL statement about `question`, its version history and its
 * review/validation/report rows. No rule lives here — callers pass already-validated values
 * and own the transaction; this file only names the columns and the order of rows.
 *
 * Raw SQL is used where Prisma hides the needed semantics: the report queue's conditional
 * resolution (allowed only while open, DATABASE_SCHEMA T-3) and the newest-record subqueries.
 */

import { AppError, notFound } from '../errors.js';
import { translateDbError } from '../db/errors.js';

/** Columns the detail and list views read; `answerKeyJson` is the owner-only field. */
const QUESTION_COLUMNS = `
  id, test, "competencyId", stimulus, stem, "optionsJson", "answerKeyJson", explanation,
  "difficultyAiInitial", "empiricalDifficultyJson", lifecycle, "dynamicEligible",
  "answerKeyValidatedAt", "quarantinedReason", "provenanceJson", "contentHash",
  "taxonomyVersion", "contentVersion"`;

/**
 * Map a `question` row to the contract's field names, parsing the JSON text columns.
 * @param {Record<string, any>} row
 * @returns {object}
 */
export function toQuestion(row) {
  return {
    id: row.id,
    test: row.test,
    competencyId: row.competencyId,
    stimulus: row.stimulus,
    stem: row.stem,
    options: JSON.parse(row.optionsJson),
    answerKey: JSON.parse(row.answerKeyJson),
    explanation: row.explanation,
    difficulty: {
      aiInitial: row.difficultyAiInitial,
      empirical: row.empiricalDifficultyJson === null ? null : JSON.parse(row.empiricalDifficultyJson),
    },
    lifecycle: row.lifecycle,
    dynamicEligible: row.dynamicEligible === 1,
    answerKeyValidatedAt: row.answerKeyValidatedAt,
    quarantinedReason: row.quarantinedReason,
    provenance: JSON.parse(row.provenanceJson),
    contentHash: row.contentHash,
    taxonomyVersion: row.taxonomyVersion,
    contentVersion: row.contentVersion,
  };
}

/**
 * Read one question, or `null`.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} id
 * @returns {Promise<Record<string, any> | null>}
 */
export async function findQuestion(db, id) {
  const { rows } = await db.query(`SELECT ${QUESTION_COLUMNS} FROM "question" WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/**
 * Read one question or throw `404 NOT_FOUND`.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @returns {Promise<Record<string, any>>}
 */
export async function requireQuestion(pool, id) {
  const row = await findQuestion(pool, id);
  if (row === null) throw notFound('question', id);
  return row;
}

/**
 * Insert the `question` row and its first `question_version` row. Must run inside a
 * transaction the caller opens (one question, one transaction, DB-6 style).
 *
 * @param {import('pg').PoolClient} tx
 * @param {object} q
 * @param {string} q.id
 * @param {string} q.test
 * @param {string} q.competencyId
 * @param {string} q.stimulus
 * @param {string} q.stem
 * @param {unknown} q.optionsJson serialised below
 * @param {object} q.answerKey
 * @param {string} q.explanation
 * @param {string} q.difficultyAiInitial
 * @param {string} q.lifecycle
 * @param {string} q.provenanceJson
 * @param {string} q.contentHash
 * @param {string} q.taxonomyVersion
 * @param {string} q.createdAt
 * @returns {Promise<void>}
 */
export async function insertQuestion(tx, q) {
  const optionsJson = JSON.stringify(q.optionsJson);
  const answerKeyJson = JSON.stringify(q.answerKey);
  try {
    await tx.query(
      `INSERT INTO "question" (id, test, "competencyId", stimulus, stem, "optionsJson", "answerKeyJson",
         explanation, "difficultyAiInitial", lifecycle, "dynamicEligible", "provenanceJson",
         "contentHash", "taxonomyVersion", "contentVersion")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,$12,$13,1)`,
      [q.id, q.test, q.competencyId, q.stimulus, q.stem, optionsJson, answerKeyJson, q.explanation,
        q.difficultyAiInitial, q.lifecycle, q.provenanceJson, q.contentHash, q.taxonomyVersion],
    );
    await tx.query(
      `INSERT INTO "question_version" ("questionId", "contentVersion", "contentHash", stem,
         "optionsJson", "answerKeyJson", explanation, "createdAt")
       VALUES ($1,1,$2,$3,$4,$5,$6,$7)`,
      [q.id, q.contentHash, q.stem, optionsJson, answerKeyJson, q.explanation, q.createdAt],
    );
  } catch (error) {
    translateDbError(error, { resource: 'question', id: q.id });
  }
}

/**
 * Append the next content version: a new `question_version` row plus the updated cache on
 * `question`. The old version/sample stays untouched (append-only, T-2).
 *
 * @param {import('pg').PoolClient} tx
 * @param {string} id
 * @param {object} content `{contentHash, stem, optionsJson, answerKeyJson, explanation, lifecycle, provenanceJson, createdAt}`
 *   `optionsJson`/`answerKeyJson` are already serialised
 * @param {number} nextVersion
 * @returns {Promise<void>}
 */
export async function appendContentVersion(tx, id, content, nextVersion) {
  try {
    await tx.query(
      `INSERT INTO "question_version" ("questionId", "contentVersion", "contentHash", stem,
         "optionsJson", "answerKeyJson", explanation, "createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, nextVersion, content.contentHash, content.stem, content.optionsJson, content.answerKeyJson,
        content.explanation, content.createdAt],
    );
    // A new hash invalidates the key validation: it was an act on the previous content.
    await tx.query(
      `UPDATE "question" SET stem=$2, "optionsJson"=$3, "answerKeyJson"=$4, explanation=$5,
         "contentHash"=$6, "contentVersion"=$7, lifecycle=$8, "provenanceJson"=$9,
         "answerKeyValidatedAt"=NULL, "quarantinedReason"=CASE WHEN $8 = 'quarantined' THEN "quarantinedReason" ELSE NULL END
       WHERE id=$1`,
      [id, content.stem, content.optionsJson, content.answerKeyJson, content.explanation, content.contentHash,
        nextVersion, content.lifecycle, content.provenanceJson],
    );
  } catch (error) {
    translateDbError(error, { resource: 'question', id });
  }
}

/**
 * Update only the cache/state columns of a question (lifecycle, eligibility, key validation,
 * quarantine reason, provenance). Content never moves through here.
 *
 * @param {import('pg').PoolClient | import('pg').Pool} db
 * @param {string} id
 * @param {{lifecycle?: string, dynamicEligible?: 0 | 1, answerKeyValidatedAt?: string | null,
 *   quarantinedReason?: string | null, provenanceJson?: string}} patch
 * @returns {Promise<number>} rows affected
 */
export async function updateState(db, id, patch) {
  const columns = Object.keys(patch);
  if (columns.length === 0) return 0;
  const sets = columns.map((column, index) => `"${column}" = $${index + 2}`);
  try {
    const { rowCount } = await db.query(
      `UPDATE "question" SET ${sets.join(', ')} WHERE id = $1`,
      [id, ...columns.map((column) => patch[/** @type {keyof typeof patch} */ (column)])],
    );
    return rowCount ?? 0;
  } catch (error) {
    translateDbError(error, { resource: 'question', id });
  }
}

/**
 * Append one `question_review` entry (append-only, T-5).
 * @param {import('pg').PoolClient} tx
 * @param {{id: string, questionId: string, reviewer: string, reviewedAt: string, decision: string,
 *   activity: string, editsJson?: string | null, answerKeyValidatedBy?: string | null,
 *   answerKeyValidatedAt?: string | null, notes?: string | null}} entry
 * @returns {Promise<void>}
 */
export async function insertReview(tx, entry) {
  try {
    await tx.query(
      `INSERT INTO "question_review" (id, "questionId", reviewer, "reviewedAt", decision, activity,
         "editsJson", "answerKeyValidatedBy", "answerKeyValidatedAt", notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [entry.id, entry.questionId, entry.reviewer, entry.reviewedAt, entry.decision, entry.activity,
        entry.editsJson ?? null, entry.answerKeyValidatedBy ?? null, entry.answerKeyValidatedAt ?? null,
        entry.notes ?? null],
    );
  } catch (error) {
    translateDbError(error, { resource: 'question', id: entry.questionId });
  }
}

/**
 * Append one `validation_record` (append-only, T-4).
 * @param {import('pg').PoolClient} tx
 * @param {{id: string, questionId: string, contentVersion: number, contentHash: string, result: string,
 *   layersJson: string, validatorVersion: string, validatedAt: string}} record
 * @returns {Promise<void>}
 */
export async function insertValidation(tx, record) {
  try {
    await tx.query(
      `INSERT INTO "validation_record" (id, "questionId", "contentVersion", "contentHash", result,
         "layersJson", "validatorVersion", "validatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [record.id, record.questionId, record.contentVersion, record.contentHash, record.result,
        record.layersJson, record.validatorVersion, record.validatedAt],
    );
  } catch (error) {
    translateDbError(error, { resource: 'question', id: record.questionId });
  }
}

/**
 * The newest `validation_record` for a question, or `null`.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} questionId
 * @returns {Promise<{result: string, contentHash: string, contentVersion: number} | null>}
 */
export async function latestValidation(db, questionId) {
  const { rows } = await db.query(
    `SELECT "contentVersion", "contentHash", result FROM "validation_record"
     WHERE "questionId" = $1 ORDER BY "validatedAt" DESC, id DESC LIMIT 1`,
    [questionId],
  );
  return rows[0] ?? null;
}

/**
 * Whether a `question_review` entry with this decision exists (the activation gate's
 * `acceptedBy = 'user'` evidence, QUESTION_SPECIFICATION §3.3).
 * @param {import('pg').Pool} pool
 * @param {string} questionId
 * @param {string} decision
 * @returns {Promise<boolean>}
 */
export async function hasReviewDecision(pool, questionId, decision) {
  const { rows } = await pool.query(
    `SELECT 1 FROM "question_review" WHERE "questionId" = $1 AND decision = $2 LIMIT 1`,
    [questionId, decision],
  );
  return rows.length > 0;
}

/**
 * The review history, oldest first.
 * @param {import('pg').Pool} pool
 * @param {string} questionId
 * @returns {Promise<Record<string, any>[]>}
 */
export async function reviewHistory(pool, questionId) {
  const { rows } = await pool.query(
    `SELECT id, reviewer, "reviewedAt", decision, activity, "editsJson", "answerKeyValidatedBy",
            "answerKeyValidatedAt", notes
     FROM "question_review" WHERE "questionId" = $1 ORDER BY "reviewedAt", id`,
    [questionId],
  );
  return rows.map(toReview);
}

/**
 * The latest review entry, or `null`.
 * @param {import('pg').Pool} pool
 * @param {string} questionId
 * @returns {Promise<Record<string, any> | null>}
 */
export async function latestReview(pool, questionId) {
  const history = await reviewHistory(pool, questionId);
  return history.at(-1) ?? null;
}

/**
 * Map a `question_review` row to its contract shape.
 * @param {Record<string, any>} row
 * @returns {object}
 */
export function toReview(row) {
  return {
    id: row.id,
    reviewer: row.reviewer,
    reviewedAt: row.reviewedAt,
    decision: row.decision,
    activity: row.activity,
    ...(row.editsJson === null ? {} : { edits: JSON.parse(row.editsJson) }),
    ...(row.answerKeyValidatedBy === null ? {} : {
      answerKeyValidatedBy: row.answerKeyValidatedBy,
      answerKeyValidatedAt: row.answerKeyValidatedAt,
    }),
    ...(row.notes === null ? {} : { notes: row.notes }),
  };
}

/**
 * The full version history, oldest first (QUESTION_SPECIFICATION §7.2).
 * @param {import('pg').Pool} pool
 * @param {string} questionId
 * @returns {Promise<{contentVersion: number, contentHash: string, createdAt: string}[]>}
 */
export async function versionHistory(pool, questionId) {
  const { rows } = await pool.query(
    `SELECT "contentVersion", "contentHash", "createdAt" FROM "question_version"
     WHERE "questionId" = $1 ORDER BY "contentVersion"`,
    [questionId],
  );
  return rows;
}

/**
 * Sessions whose frozen roster names this question (§7.2 "dipakai di sesi"). Read from the
 * snapshot's stored roster JSON, never recomputed.
 * @param {import('pg').Pool} pool
 * @param {string} questionId
 * @returns {Promise<{sessionId: string, status: string, startedAt: string}[]>}
 */
export async function sessionsUsing(pool, questionId) {
  const { rows } = await pool.query(
    `SELECT s.id AS "sessionId", s.status, s."startedAt" FROM "session" s
     JOIN "session_snapshot" snap ON snap."sessionId" = s.id
     WHERE snap."rosterJson"::jsonb @> $1::jsonb
     ORDER BY s."startedAt" DESC`,
    [JSON.stringify([questionId])],
  );
  return rows;
}

/**
 * Whether an `open` session froze this question's answer key. The key edit path refuses
 * while true (V-06 protection, API_ENDPOINTS §6).
 * @param {import('pg').Pool} pool
 * @param {string} questionId
 * @returns {Promise<boolean>}
 */
export async function openSessionHoldsKey(pool, questionId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM "session" s
     JOIN "session_snapshot" snap ON snap."sessionId" = s.id
     WHERE s.status = 'open' AND snap."answerKeysJson"::jsonb ? $1::text
     LIMIT 1`,
    [questionId],
  );
  return rows.length > 0;
}

/**
 * Insert a report (append-only; T-3 permits INSERT and an update while open).
 * @param {import('pg').PoolClient | import('pg').Pool} db
 * @param {{id: string, questionId: string, contentVersion: number, reportedAt: string,
 *   severity: string, category: string, note: string | null}} report
 * @returns {Promise<void>}
 */
export async function insertReport(db, report) {
  try {
    await db.query(
      `INSERT INTO "question_report" (id, "questionId", "contentVersion", "reportedAt", severity,
         category, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [report.id, report.questionId, report.contentVersion, report.reportedAt, report.severity,
        report.category, report.note],
    );
  } catch (error) {
    translateDbError(error, { resource: 'question_report', id: report.id });
  }
}

/**
 * Reports not yet resolved, oldest first (queue P-4, Kelola → Review Soal).
 * @param {import('pg').Pool} pool
 * @returns {Promise<Record<string, any>[]>}
 */
export async function openReports(pool) {
  const { rows } = await pool.query(
    `SELECT id, "questionId", "contentVersion", "reportedAt", severity, category, note, resolution, "resolvedAt"
     FROM "question_report" WHERE resolution IS NULL ORDER BY reportedAt`,
  );
  return rows.map(toReport);
}

/**
 * One report, or `null`.
 * @param {import('pg').Pool} pool
 * @param {string} id
 * @returns {Promise<Record<string, any> | null>}
 */
export async function findReport(pool, id) {
  const { rows } = await pool.query(
    `SELECT id, "questionId", "contentVersion", "reportedAt", severity, category, note, resolution, "resolvedAt"
     FROM "question_report" WHERE id = $1`,
    [id],
  );
  return rows[0] ? toReport(rows[0]) : null;
}

/**
 * Resolve an open report. `WHERE resolution IS NULL` is the guard: a resolved row is not
 * matched, and the DB trigger would refuse the update anyway (T-3).
 * @param {import('pg').PoolClient} tx
 * @param {string} id
 * @param {{resolution: string, resolvedAt: string}} decision
 * @returns {Promise<boolean>} false when the report was already resolved or absent
 */
export async function resolveReport(tx, id, decision) {
  try {
    const { rowCount } = await tx.query(
      `UPDATE "question_report" SET resolution = $2, "resolvedAt" = $3
       WHERE id = $1 AND resolution IS NULL`,
      [id, decision.resolution, decision.resolvedAt],
    );
    return (rowCount ?? 0) === 1;
  } catch (error) {
    translateDbError(error, { resource: 'question_report', id });
  }
}

/**
 * Map a `question_report` row to its contract shape (DATABASE_SCHEMA §2).
 * @param {Record<string, any>} row
 * @returns {object}
 */
export function toReport(row) {
  return {
    id: row.id,
    questionId: row.questionId,
    contentVersion: row.contentVersion,
    reportedAt: row.reportedAt,
    severity: row.severity,
    category: row.category,
    note: row.note,
    resolution: row.resolution,
    resolvedAt: row.resolvedAt,
  };
}

/**
 * Refuse an empty id at the boundary (VALIDATION.md §1 `id_format`).
 * @param {string} id
 * @returns {string}
 */
export function assertId(id) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'Invalid id.', {
      fields: [{ path: 'id', message: 'id is required.', rule: 'id_format' }],
    });
  }
  return id;
}
