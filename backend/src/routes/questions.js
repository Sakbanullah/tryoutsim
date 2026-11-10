/**
 * `/questions`, `/question-reports`, `/question-batches` (API_ENDPOINTS §6).
 *
 * The lifecycle edges themselves are QUESTION_SPECIFICATION §3 and are enforced in
 * `domain/question-lifecycle.js`; this file only maps a request onto one documented edge and
 * persists it in one transaction. No route here decides a threshold, a score or a sampling
 * outcome — those arrive from the user or from the validator.
 */

import { randomUUID } from 'node:crypto';
import { nowIso } from '../db/ids.js';
import { conflict, notFound, validationError } from '../errors.js';
import { asObject, boundedText, FieldErrors } from '../http/validation.js';
import { activationBlockers, isLegalTransition } from '../domain/question-lifecycle.js';
import { contentHash } from '../domain/question-validation.js';
import {
  LOCAL_USER, batchActiveIds, duplicateClusters, duplicateFacts, gateRow, listQuestions, markEligible,
  parseListFilters, recordSampling,
} from '../repositories/question-bank.js';
import {
  appendContentVersion, assertId, findQuestion, findReport, hasReviewDecision, insertQuestion,
  insertReport, insertReview, latestValidation, openReports, openSessionHoldsKey, requireQuestion,
  resolveReport, sessionsUsing, toQuestion, updateState, versionHistory,
} from '../repositories/question.js';
import { findNode } from '../repositories/competency.js';

/** Closed sets of REPORT_SPEC — DATABASE_SCHEMA C-9. */
const SEVERITIES = Object.freeze(['critical', 'non_critical']);
const CATEGORIES = Object.freeze(['wrong_key', 'ambiguous', 'typo', 'explanation_unclear', 'other']);
const RESOLUTIONS = Object.freeze(['repaired', 'withdrawn', 'rejected']);
const SAMPLING_OUTCOMES = Object.freeze(['clean', 'findings', 'systemic']);

/**
 * Run `work(client)` inside one transaction.
 * @param {import('pg').Pool} pool
 * @param {(client: import('pg').PoolClient) => Promise<any>} work
 */
async function inTransaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Parse and validate a manual-create body (§6 `POST /questions`, FR-Q6).
 * @param {unknown} body
 * @returns {{test: string, competencyId: string, stimulus: string | null, stem: string,
 *   options: {key: string, text: string}[], answerKey: object, explanation: string,
 *   difficultyAiInitial: string}}
 */
export function parseCreateBody(body) {
  const input = asObject(body);
  const errors = new FieldErrors();
  const allowed = ['test', 'competencyId', 'stimulus', 'stem', 'options', 'answerKey',
    'explanation', 'difficultyAiInitial'];
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) errors.add(key, `${key} is not accepted.`, 'unknown_field');
  }
  if (!['TWK', 'TIU', 'TKP'].includes(input.test)) errors.add('test', 'test must be TWK, TIU or TKP.', 'enum');
  if (typeof input.competencyId !== 'string' || input.competencyId.length === 0) {
    errors.add('competencyId', 'competencyId is required.', 'required');
  }
  if (input.stimulus !== undefined && input.stimulus !== null && typeof input.stimulus !== 'string') {
    errors.add('stimulus', 'stimulus must be a string.', 'type');
  }
  const stem = boundedText(errors, input.stem, 'stem', 4000);
  const explanation = boundedText(errors, input.explanation, 'explanation', 8000);
  if (!['easy', 'medium', 'hard'].includes(input.difficultyAiInitial)) {
    errors.add('difficultyAiInitial', 'difficultyAiInitial must be easy, medium or hard.', 'enum');
  }
  if (!Array.isArray(input.options) || input.options.length < 4 || input.options.length > 5) {
    errors.add('options', 'options must hold 4 or 5 entries.', 'length');
  }
  errors.throwIfAny();
  const options = /** @type {{key: string, text: string}[]} */ (input.options);
  return {
    test: /** @type {string} */ (input.test),
    competencyId: /** @type {string} */ (input.competencyId),
    stimulus: typeof input.stimulus === 'string' ? input.stimulus : null,
    stem: /** @type {string} */ (stem),
    options,
    answerKey: /** @type {object} */ (input.answerKey),
    explanation: /** @type {string} */ (explanation),
    difficultyAiInitial: /** @type {string} */ (input.difficultyAiInitial),
  };
}

/**
 * Refuse a body whose content is an existing non-archived question (V-08, critical).
 * A duplicate is a validation failure on the content, not a conflict: the request is well formed
 * and a different body would be accepted.
 * @param {import('pg').Pool} pool
 * @param {{questionId: string, contentHash: string, stem: string}} input
 */
async function assertNoDuplicate(pool, input) {
  const facts = await duplicateFacts(pool, input);
  if (facts.exactMatch > 0) {
    throw validationError([{ path: 'content', message: 'An identical question already exists.', rule: 'V-08' }]);
  }
  if (facts.nearMatches > 0) {
    throw validationError([{ path: 'content', message: 'A near-identical question already exists.', rule: 'V-09' }]);
  }
}

/**
 * Register the question, report and batch routes.
 * @param {ReturnType<import('../http/router.js').createRouter>} router
 * @param {{pool: import('pg').Pool}} deps
 */
export function registerQuestionRoutes(router, { pool }) {
  router.add('GET', '/questions', async ({ query }) => {
    const filters = parseListFilters(query, (fields) => {
      throw validationError(fields);
    });
    return { data: await listQuestions(pool, filters) };
  });

  router.add('GET', '/questions/duplicates', async () => ({ data: await duplicateClusters(pool) }));

  router.add('GET', '/questions/:id', async ({ params }) => {
    const row = await requireQuestion(pool, assertId(params.id));
    return {
      data: {
        ...toQuestion(row),
        validation: await latestValidation(pool, row.id),
        versionHistory: await versionHistory(pool, row.id),
        sessions: await sessionsUsing(pool, row.id),
      },
    };
  });

  router.add('POST', '/questions', async ({ body }) => {
    const input = parseCreateBody(body);
    const id = `q-${randomUUID()}`;
    const hash = contentHash({ stem: input.stem, options: input.options, explanation: input.explanation });
    const createdAt = nowIso();

    const provenance = { kind: 'human_authored', sampling: { status: 'not_applicable' } };
    const question = {
      id,
      test: input.test,
      competencyId: input.competencyId,
      stimulus: input.stimulus,
      stem: input.stem,
      optionsJson: input.options,
      answerKey: input.answerKey,
      explanation: input.explanation,
      difficultyAiInitial: input.difficultyAiInitial,
      lifecycle: 'draft',
      provenanceJson: JSON.stringify(provenance),
      contentHash: hash,
      // The taxonomy version a manual question is authored against. `ponytail:` a fixed label for
      // the single seeded taxonomy; make it a stored column on `competency` when a second version
      // is ever loaded.
      taxonomyVersion: 'CPNS-2026/1',
      createdAt,
    };

    // A manual question starts `draft`; §3.2's `draft → human_reviewed` needs the checks to pass,
    // and only the user's accept makes that move (PATCH /questions/:id/accept).
    await inTransaction(pool, async (tx) => {
      const node = await findNode(tx, input.competencyId);
      if (node === null) throw validationError([{ path: 'competencyId', message: 'competencyId does not exist.', rule: 'exists' }]);
      await assertNoDuplicate(tx, { questionId: id, contentHash: hash, stem: input.stem });
      await insertQuestion(tx, question);
    });
    return { status: 201, data: toQuestion(await requireQuestion(pool, id)) };
  });

  router.add('PATCH', '/questions/:id', async ({ params, body }) => {
    const row = await requireQuestion(pool, assertId(params.id));
    const input = asObject(body);
    const content = ['stem', 'options', 'explanation', 'answerKey'];
    const errors = new FieldErrors();
    for (const key of Object.keys(input)) {
      if (!content.includes(key)) errors.add(key, `${key} is not accepted; content is edited through the accept contract.`, 'unknown_field');
    }
    errors.throwIfAny();

    // V-06 protection (API_ENDPOINTS §6): the *answer key* is refused while a frozen key is open.
    if (input.answerKey !== undefined && await openSessionHoldsKey(pool, row.id)) {
      throw conflict('question', 'key_frozen_by_open_session', 'The answer key cannot change while an open session holds it.');
    }

    const next = {
      stem: input.stem ?? row.stem,
      options: input.options ?? JSON.parse(row.optionsJson),
      explanation: input.explanation ?? row.explanation,
      answerKey: input.answerKey ?? JSON.parse(row.answerKeyJson),
    };
    const hash = contentHash(next);
    const nextVersion = row.contentVersion + 1;
    const editedFields = Object.keys(input);

    await inTransaction(pool, async (tx) => {
      await assertNoDuplicate(tx, { questionId: row.id, contentHash: hash, stem: next.stem });
      await appendContentVersion(tx, row.id, {
        contentHash: hash,
        stem: next.stem,
        optionsJson: JSON.stringify(next.options),
        answerKeyJson: JSON.stringify(next.answerKey),
        explanation: next.explanation,
        // §6.2: a content edit goes back to `draft` for re-validation, except from `archived`,
        // which is terminal and is not reopened by an edit.
        lifecycle: row.lifecycle === 'archived' || row.lifecycle === 'rejected' ? row.lifecycle : 'draft',
        provenanceJson: row.provenanceJson,
        createdAt: nowIso(),
      }, nextVersion);
      await insertReview(tx, {
        id: `rv-${randomUUID()}`,
        questionId: row.id,
        reviewer: LOCAL_USER,
        reviewedAt: nowIso(),
        decision: 'edited',
        activity: 'content',
        editsJson: JSON.stringify(editedFields),
      });
    });
    return { data: toQuestion(await requireQuestion(pool, row.id)) };
  });

  router.add('PATCH', '/questions/:id/accept', async ({ params, body }) => {
    const row = await requireQuestion(pool, assertId(params.id));
    const input = asObject(body);
    const errors = new FieldErrors();
    for (const key of Object.keys(input)) {
      if (key !== 'decision') errors.add(key, `${key} is not accepted.`, 'unknown_field');
    }
    if (!['accepted', 'rejected'].includes(input.decision)) {
      errors.add('decision', 'decision must be accepted or rejected.', 'enum');
    }
    errors.throwIfAny();

    const decision = /** @type {'accepted' | 'rejected'} */ (input.decision);
    const target = decision === 'accepted' ? 'human_reviewed' : 'rejected';
    if (!isLegalTransition(row.lifecycle, target)) {
      throw conflict('question', 'illegal_transition', 'That decision does not apply in the current state.');
    }

    await inTransaction(pool, async (tx) => {
      await updateState(tx, row.id, { lifecycle: target });
      await insertReview(tx, {
        id: `rv-${randomUUID()}`,
        questionId: row.id,
        reviewer: LOCAL_USER,
        reviewedAt: nowIso(),
        decision,
        activity: 'batch_decision',
      });
    });
    return { data: toQuestion(await requireQuestion(pool, row.id)) };
  });

  router.add('POST', '/questions/:id/activate', async ({ params }) => {
    const row = await requireQuestion(pool, assertId(params.id));
    const latest = await latestValidation(pool, row.id);
    const accepted = await hasReviewDecision(pool, row.id, 'accepted');
    const reasons = activationBlockers({
      question: await gateRow(pool, row.id),
      latestValidation: latest,
      acceptedByUser: accepted,
    });
    if (reasons.length > 0) {
      throw conflict('question', 'illegal_transition', 'The question cannot be activated yet.');
    }
    await inTransaction(pool, async (tx) => {
      await updateState(tx, row.id, { lifecycle: 'active' });
      await insertReview(tx, {
        id: `rv-${randomUUID()}`,
        questionId: row.id,
        reviewer: LOCAL_USER,
        reviewedAt: nowIso(),
        decision: 'accepted',
        activity: 'content',
        notes: 'activated',
      });
    });
    return { data: toQuestion(await requireQuestion(pool, row.id)) };
  });

  router.add('POST', '/questions/:id/archive', async ({ params }) => {
    const row = await requireQuestion(pool, assertId(params.id));
    if (row.lifecycle !== 'active') {
      throw conflict('question', 'illegal_transition', 'Only an active question can be archived.');
    }
    await inTransaction(pool, async (tx) => {
      await updateState(tx, row.id, { lifecycle: 'archived' });
      await insertReview(tx, {
        id: `rv-${randomUUID()}`,
        questionId: row.id,
        reviewer: LOCAL_USER,
        reviewedAt: nowIso(),
        decision: 'accepted',
        activity: 'content',
        notes: 'archived',
      });
    });
    return { data: toQuestion(await requireQuestion(pool, row.id)) };
  });

  router.add('POST', '/questions/bulk', async ({ body }) => {
    const input = asObject(body);
    const errors = new FieldErrors();
    for (const key of Object.keys(input)) {
      if (key !== 'questionIds') errors.add(key, `${key} is not accepted.`, 'unknown_field');
    }
    if (!Array.isArray(input.questionIds) || input.questionIds.length === 0) {
      errors.add('questionIds', 'questionIds is required.', 'required');
    }
    errors.throwIfAny();
    const ids = /** @type {string[]} */ (input.questionIds);

    // FR-Q4: one bad id rejects the whole call (QUESTION_SPECIFICATION §3.2 bulk operation).
    await inTransaction(pool, async (tx) => {
      for (const id of ids) {
        const row = await findQuestion(tx, id);
        if (row === null) throw notFound('question', id);
        if (row.lifecycle !== 'active') {
          throw conflict('question', 'illegal_transition', 'Every submitted question must be active.');
        }
      }
      for (const id of ids) {
        await updateState(tx, id, { lifecycle: 'archived' });
        await insertReview(tx, {
          id: `rv-${randomUUID()}`,
          questionId: id,
          reviewer: LOCAL_USER,
          reviewedAt: nowIso(),
          decision: 'accepted',
          activity: 'content',
          notes: 'bulk archive',
        });
      }
    });
    return { data: { archived: ids.length } };
  });

  router.add('POST', '/questions/:id/quarantine', async ({ params, body }) => {
    const row = await requireQuestion(pool, assertId(params.id));
    const input = asObject(body);
    if (typeof input.reason !== 'string' || input.reason.trim().length === 0) {
      throw validationError([{ path: 'reason', message: 'reason is required.', rule: 'required' }]);
    }
    if (!isLegalTransition(row.lifecycle, 'quarantined')) {
      throw conflict('question', 'illegal_transition', 'That question cannot be quarantined from its current state.');
    }
    await inTransaction(pool, async (tx) => {
      await updateState(tx, row.id, { lifecycle: 'quarantined', quarantinedReason: input.reason });
      await insertReview(tx, {
        id: `rv-${randomUUID()}`,
        questionId: row.id,
        reviewer: LOCAL_USER,
        reviewedAt: nowIso(),
        decision: 'reported',
        activity: 'report_triage',
        notes: input.reason,
      });
    });
    return { data: toQuestion(await requireQuestion(pool, row.id)) };
  });

  router.add('POST', '/questions/:id/reports', async ({ params, body }) => {
    const row = await requireQuestion(pool, assertId(params.id));
    const input = asObject(body);
    const errors = new FieldErrors();
    for (const key of Object.keys(input)) {
      if (!['severity', 'category', 'note'].includes(key)) errors.add(key, `${key} is not accepted.`, 'unknown_field');
    }
    if (!SEVERITIES.includes(input.severity)) errors.add('severity', 'severity must be critical or non_critical.', 'enum');
    if (!CATEGORIES.includes(input.category)) errors.add('category', 'category is not an accepted value.', 'enum');
    if (input.note !== undefined && input.note !== null && typeof input.note !== 'string') {
      errors.add('note', 'note must be a string.', 'type');
    }
    errors.throwIfAny();

    const report = {
      id: `rpt-${randomUUID()}`,
      questionId: row.id,
      contentVersion: row.contentVersion,
      reportedAt: nowIso(),
      severity: /** @type {string} */ (input.severity),
      category: /** @type {string} */ (input.category),
      note: typeof input.note === 'string' ? input.note : null,
    };

    // §6.5(2): a critical report auto-quarantines in the same transaction; the final decision
    // stays with the user. A non-critical report stores the row and changes no state.
    await inTransaction(pool, async (tx) => {
      await insertReport(tx, report);
      if (report.severity === 'critical' && isLegalTransition(row.lifecycle, 'quarantined')) {
        await updateState(tx, row.id, { lifecycle: 'quarantined', quarantinedReason: `report:${report.category}` });
      }
    });
    return { status: 201, data: report };
  });

  router.add('GET', '/question-reports', async () => ({ data: await openReports(pool) }));

  router.add('PATCH', '/question-reports/:id', async ({ params, body }) => {
    const report = await findReport(pool, assertId(params.id));
    if (report === null) throw notFound('question_report', params.id);
    const input = asObject(body);
    if (!RESOLUTIONS.includes(input.resolution)) {
      throw validationError([{ path: 'resolution', message: 'resolution is not an accepted value.', rule: 'enum' }]);
    }
    const resolution = /** @type {string} */ (input.resolution);

    // §6.5(6) + §3.2 `quarantined → human_reviewed`: the user's `repaired` decision is the act
    // that returns a quarantined question to review; `withdrawn`/`rejected` change no state.
    await inTransaction(pool, async (tx) => {
      const resolved = await resolveReport(tx, report.id, { resolution, resolvedAt: nowIso() });
      if (!resolved) throw conflict('question_report', 'illegal_transition', 'The report is already resolved.');
      if (resolution === 'repaired') {
        const row = await findQuestion(tx, report.questionId);
        if (row !== null && row.lifecycle === 'quarantined') {
          await updateState(tx, row.id, { lifecycle: 'human_reviewed', quarantinedReason: null });
        }
      }
    });
    return { data: await findReport(pool, report.id) };
  });

  router.add('POST', '/question-batches/:batchId/sample', async ({ params, body }) => {
    const input = asObject(body);
    if (!SAMPLING_OUTCOMES.includes(input.outcome)) {
      throw validationError([{ path: 'outcome', message: 'outcome must be clean, findings or systemic.', rule: 'enum' }]);
    }
    const outcome = /** @type {string} */ (input.outcome);
    const ids = await batchActiveIds(pool, params.batchId);
    if (ids.length === 0) throw notFound('question_batch', params.batchId);

    const status = outcome === 'clean' ? 'sampled_pass' : outcome === 'findings' ? 'sampled_findings' : 'sampled_systemic';
    const sampling = {
      status,
      sampledAt: nowIso(),
      ...(Array.isArray(input.findings) ? { findings: input.findings } : {}),
    };

    await inTransaction(pool, async (tx) => {
      await recordSampling(tx, ids, sampling);
      // §6.4/FR-G7: only a clean sample moves the batch's active questions into the pool.
      if (outcome === 'clean') await markEligible(tx, ids);
    });
    return { data: { batchId: params.batchId, status, questions: ids.length } };
  });

  router.add('GET', '/question-batches', async () => {
    const { rows } = await pool.query(
      `SELECT "provenanceJson"::jsonb ->> 'batchId' AS "batchId",
              "provenanceJson"::jsonb -> 'sampling' ->> 'status' AS status,
              count(*)::int AS questions
       FROM "question"
       WHERE "provenanceJson"::jsonb ->> 'batchId' IS NOT NULL
       GROUP BY 1, 2 ORDER BY 1`,
    );
    return { data: rows };
  });
}
