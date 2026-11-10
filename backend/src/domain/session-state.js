/**
 * The session state machine `open → submitted` (DATABASE_SCHEMA §2, FL-4).
 *
 * Three stored statuses: `open`, `submitted`, `blocked`. "Scored" is not a status — it is the existence of the
 * `score_result` row. `blocked` is reserved for a session that never legitimately started and is written by no
 * route in this module. The database trigger T-11 already makes `submitted`/`blocked` terminal and forbids
 * clearing `submittedAt`; the checks here exist so the client receives `409 CONFLICT` with a reason instead of a
 * raw rule violation.
 */

import { conflict } from '../errors.js';

/**
 * Refuse a write to a session whose answers are frozen.
 * @param {{status: string}} session
 * @throws {import('../errors.js').AppError} `CONFLICT` `already_submitted` / `session_not_open`
 */
export function assertOpen(session) {
  if (session.status !== 'open') {
    throw conflict('session', session.status === 'submitted' ? 'already_submitted' : 'session_not_open',
      'This session is no longer open; its answers are frozen.');
  }
}

/**
 * Refuse a submit of a session that is not open.
 * @param {{status: string}} session
 * @throws {import('../errors.js').AppError} `CONFLICT` `already_submitted` / `session_not_open`
 */
export function assertSubmittable(session) {
  if (session.status !== 'open') {
    throw conflict('session', session.status === 'submitted' ? 'already_submitted' : 'session_not_open',
      'This session cannot be submitted again.');
  }
}

/**
 * Refuse `/score` on a session that is not submitted (POST /sessions/:id/score validates `submitted`).
 * @param {{status: string}} session
 * @throws {import('../errors.js').AppError} `CONFLICT` `not_submitted`
 */
export function assertSubmitted(session) {
  if (session.status !== 'submitted') {
    throw conflict('session', 'not_submitted', 'Only a submitted session can be scored.');
  }
}

/**
 * May a stored result be replaced? A result is never re-scored (SCORING_METHODOLOGY §7). The one exception is a
 * stored result whose verdict is `null`: `/score` may re-run the same snapshot to add a verdict, and the score
 * must come out identical (API_SPECIFICATION §7.3 `verdict_only_change_forbidden`).
 * @param {object | null} storedResult a `score_result` row
 * @returns {boolean} true when the stored row may be replaced by a re-score of the same snapshot
 */
export function isRescorable(storedResult) {
  return storedResult === null || storedResult.verdictJson === null;
}

/** The status a successful submit leaves on the session. */
export const SUBMITTED = 'submitted';
