/**
 * `/sessions` (API_ENDPOINTS §4–§5; API_SPECIFICATION §5, §7.3, §7.5, §7.7).
 *
 * Thin: every rule lives in the repository or a domain module. The one thing decoded here is the answer body, because
 * §7.5 documents a single `{questionId, selected, flagged?, elapsedActiveMs}` object while the client autosaves
 * `{answers: [{questionId, selectedOption}]}` (FRONTEND_DATA_CONTRACTS `AnswersPatch`, GAP-F3). Both are accepted;
 * nothing else is. `selected` is A–E or `null`; membership in the question's own frozen keys is checked against the
 * snapshot by `saveAnswer` and PF-04, not guessed here.
 *
 * Response caveat: `src/http/server.js` sends no `Cache-Control`, so a 200 is cacheable by default. Reported as an
 * open item rather than edited, because that file is outside this task.
 */

import { AppError, notFound, validationError } from '../errors.js';
import { parseBody } from '../domain/validate.js';
import {
  deleteSession, deletionImpact, listSessions, loadResult, loadReview, loadRunner, pauseSession, rescoreSession,
  resumeSession, saveAnswer, submitSession, toSessionSummary,
} from '../repositories/session.js';

const OPTION_KEYS = Object.freeze(['A', 'B', 'C', 'D', 'E']);
const ANSWER_KEYS = Object.freeze(['questionId', 'selected', 'selectedOption', 'flagged']);

/**
 * Decode the autosave/submit body into answer rows plus the optional elapsed time.
 * @param {unknown} body
 * @param {{allowElapsed: boolean}} options autosave carries `elapsedActiveMs` (§7.5); submit does not
 * @returns {{answers: {questionId: string, selected: string | null, flagged: boolean}[], elapsedActiveMs: number | null}}
 */
export function decodeAnswerBody(body, { allowElapsed }) {
  const input = body !== null && typeof body === 'object' && !Array.isArray(body) ? /** @type {Record<string, unknown>} */ (body) : null;
  if (!input) throw validationError([{ path: '', message: 'Body must be a JSON object.', rule: 'type' }]);

  const fields = [];
  const allowed = allowElapsed ? [...ANSWER_KEYS, 'answers', 'elapsedActiveMs'] : [...ANSWER_KEYS, 'answers'];
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) fields.push({ path: key, message: `${key} is not accepted here.`, rule: 'unknown_field' });
  }

  let elapsedActiveMs = null;
  if (allowElapsed) {
    elapsedActiveMs = input.elapsedActiveMs;
    if (!Number.isSafeInteger(elapsedActiveMs) || /** @type {number} */ (elapsedActiveMs) < 0) {
      fields.push({ path: 'elapsedActiveMs', message: 'elapsedActiveMs must be a non-negative integer.', rule: 'finite_integer' });
    }
  }

  const raw = Array.isArray(input.answers) ? input.answers : [input];
  const answers = raw.map((item, index) => {
    const path = Array.isArray(input.answers) ? `answers[${index}]` : '';
    const at = (name) => (path ? `${path}.${name}` : name);
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      fields.push({ path, message: 'Each answer must be an object.', rule: 'type' });
      return { questionId: '', selected: null, flagged: false };
    }
    const answer = /** @type {Record<string, unknown>} */ (item);
    // The single-object form shares one object with the body, so only the answer keys are inspected here.
    for (const key of Object.keys(answer)) {
      if (!ANSWER_KEYS.includes(key) && !(Array.isArray(input.answers) === false && key === 'elapsedActiveMs')) {
        fields.push({ path: at(key), message: `${key} is not accepted here.`, rule: 'unknown_field' });
      }
    }
    if (typeof answer.questionId !== 'string' || !/^\S{1,256}$/.test(answer.questionId)) {
      fields.push({ path: at('questionId'), message: 'questionId is required.', rule: 'required' });
    }
    if ('selected' in answer && 'selectedOption' in answer) {
      fields.push({ path: at('selectedOption'), message: 'Send selected or selectedOption, not both.', rule: 'conflict' });
    }
    const selected = 'selected' in answer ? answer.selected : answer.selectedOption;
    if (selected === undefined) fields.push({ path: at('selectedOption'), message: 'selectedOption is required.', rule: 'required' });
    else if (selected !== null && !OPTION_KEYS.includes(/** @type {string} */ (selected))) {
      fields.push({ path: at('selectedOption'), message: 'selectedOption must be A–E or null.', rule: 'enum' });
    }
    if (answer.flagged !== undefined && typeof answer.flagged !== 'boolean') {
      fields.push({ path: at('flagged'), message: 'flagged must be a boolean.', rule: 'type' });
    }
    return {
      questionId: /** @type {string} */ (answer.questionId),
      selected: selected === undefined ? null : /** @type {string | null} */ (selected),
      flagged: answer.flagged === true,
    };
  });

  if (fields.length > 0) throw validationError(fields);
  return { answers, elapsedActiveMs: /** @type {number | null} */ (elapsedActiveMs) };
}

/**
 * Register the session routes.
 * @param {ReturnType<import('../http/router.js').createRouter>} router
 * @param {{prisma: object, now: () => number, nowIso: () => string}} deps
 */
export function registerSessionRoutes(router, { prisma, now, nowIso }) {
  /** History, newest first; filters `mode`, `status`, `from`, `to` (200, 400). */
  router.add('GET', '/sessions', async ({ query }) => {
    const fields = [];
    const mode = query.get('mode');
    const status = query.get('status');
    const from = isoOrNull(query.get('from'), 'from', fields);
    const to = isoOrNull(query.get('to'), 'to', fields);
    if (mode !== null && !['tryout', 'latihan'].includes(mode)) fields.push({ path: 'mode', message: 'mode must be tryout or latihan.', rule: 'enum' });
    if (status !== null && !['open', 'submitted', 'blocked'].includes(status)) {
      fields.push({ path: 'status', message: 'status must be open, submitted or blocked.', rule: 'enum' });
    }
    if (fields.length > 0) throw validationError(fields);
    return { data: (await listSessions(prisma, { mode, status, from, to })).map(toSessionSummary) };
  });

  /**
   * Delete several entries. Per-session atomic: the delete function is called once per id (SCHEMA_CONTRACT_REVIEW
   * §1.3), and each outcome is reported instead of aborting the batch.
   */
  router.add('POST', '/sessions/bulk-delete', async ({ body }) => {
    const input = parseBody(body, [{ name: 'sessionIds', required: true, kind: 'stringArray', minItems: 1, itemMax: 200 }]);
    const outcomes = [];
    for (const sessionId of /** @type {string[]} */ (input.sessionIds)) {
      try {
        outcomes.push({ sessionId, deleted: await deleteSession(prisma, sessionId) });
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        outcomes.push({ sessionId, deleted: false, error: { code: error.code, reason: error.details?.reason ?? null } });
      }
    }
    return { data: { deletedCount: outcomes.filter((row) => row.deleted).length, outcomes } };
  });

  /** Runner payload: frozen content, saved answers, clock state (200, 404, 409). */
  router.add('GET', '/sessions/:id', async ({ params }) => ({ data: await loadRunner(prisma, params.id, now()) }));

  /** Autosave one answer, its flag and the clock in one write (200, 400, 404, 409). */
  router.add('PATCH', '/sessions/:id/answers', async ({ params, body }) => {
    const { answers, elapsedActiveMs } = decodeAnswerBody(body, { allowElapsed: true });
    const [answer] = answers;
    if (answers.length !== 1) throw validationError([{ path: 'answers', message: 'Autosave carries exactly one answer.', rule: 'max_items' }]);
    const savedAt = nowIso();
    return {
      data: await saveAnswer(
        prisma,
        params.id,
        { questionId: answer.questionId, selected: answer.selected, flagged: answer.flagged, elapsedActiveMs: /** @type {number} */ (elapsedActiveMs) },
        now(),
        savedAt,
      ),
    };
  });

  /** Persist active time, stop the clock (200, 404, 409). */
  router.add('POST', '/sessions/:id/pause', async ({ params }) => {
    const outcome = await pauseSession(prisma, params.id, now());
    return { data: { activeMs: outcome.activeMs, runningSince: outcome.runningSince } };
  });

  /** Re-arm the clock; reports expiry (200, 404, 409). */
  router.add('POST', '/sessions/:id/resume', async ({ params }) => ({
    data: await resumeSession(prisma, params.id, now(), nowIso()),
  }));

  /** Submit: score the frozen snapshot, freeze the answers (200, 400, 404, 409, 422). */
  router.add('POST', '/sessions/:id/submit', async ({ params, body }) => {
    const hasBody = body !== null && body !== undefined && Object.keys(/** @type {object} */ (body)).length > 0;
    const sheets = hasBody ? decodeAnswerBody(body, { allowElapsed: false }).answers : null;
    return { data: await submitSession(prisma, params.id, sheets, now(), nowIso()) };
  });

  /** Re-score on the same snapshot, or add a withheld verdict (200, 404, 409, 422). */
  router.add('POST', '/sessions/:id/score', async ({ params }) => ({
    data: await rescoreSession(prisma, params.id, now(), nowIso()),
  }));

  /** Stored result, never recomputed (200, 404). */
  router.add('GET', '/sessions/:id/result', async ({ params }) => ({ data: await loadResult(prisma, params.id) }));

  /** Frozen content + matched explanation for up to 20 roster ids (200, 400, 404, 409). */
  router.add('GET', '/sessions/:id/questions', async ({ params, query }) => ({
    data: await loadReview(prisma, params.id, query.getAll('ids')),
  }));

  /** What deleting this entry changes (200, 404). */
  router.add('GET', '/sessions/:id/deletion-impact', async ({ params }) => ({ data: await deletionImpact(prisma, params.id) }));

  /** Delete one history entry through `tryoutsim.delete_session` (204, 404). */
  router.add('DELETE', '/sessions/:id', async ({ params }) => {
    if (!(await deleteSession(prisma, params.id))) throw notFound('session', params.id);
    return { status: 204, data: null };
  });
}

/**
 * Parse an optional ISO-8601 query value into a normalized timestamp string.
 * @param {string | null} value
 * @param {string} path
 * @param {{path: string, message: string, rule: string}[]} fields
 * @returns {string | null}
 */
function isoOrNull(value, path, fields) {
  if (value === null) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    fields.push({ path, message: `${path} must be an ISO-8601 date.`, rule: 'date' });
    return null;
  }
  return new Date(ms).toISOString();
}
