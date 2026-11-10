/**
 * Request validation for `/generation-jobs` (VALIDATION §2 "generation";
 * API_ENDPOINTS §8).
 *
 * `competencyIds` is a set of leaf competency ids (`competency` rows with no
 * children); `count` is bounded. The upper bound is NOT a canonical value — see
 * the D4 open questions.
 */

import { FieldErrors, rejectUnknownFields, uniqueStringArray } from '../http/validation.js';

/** Most questions one job may request. Not a canonical value. */
export const MAX_JOB_COUNT = 100;

/** Most competencies one job may name. Not a canonical value. */
export const MAX_COMPETENCY_IDS = 20;

/** The closed difficulty set (`difficultyAiInitial`, QUESTION_SPECIFICATION). */
const DIFFICULTIES = ['easy', 'medium', 'hard'];

/**
 * Validate `POST /generation-jobs`.
 *
 * @param {Record<string, unknown>} body
 * @returns {{competencyIds: string[], count: number, difficulty: string}}
 */
export function parseGenerationRequest(body) {
  const errors = new FieldErrors();
  rejectUnknownFields(errors, body, ['competencyIds', 'count', 'difficulty']);

  const competencyIds = uniqueStringArray(errors, body.competencyIds, 'competencyIds', MAX_COMPETENCY_IDS);
  if (Array.isArray(body.competencyIds) && body.competencyIds.length === 0) {
    errors.add('competencyIds', 'At least one competency is required.', 'required');
  }

  const count = body.count;
  if (!Number.isSafeInteger(count) || /** @type {number} */ (count) < 1 || /** @type {number} */ (count) > MAX_JOB_COUNT) {
    errors.add('count', `count must be an integer between 1 and ${MAX_JOB_COUNT}.`, 'int_range');
  }

  if (typeof body.difficulty !== 'string' || !DIFFICULTIES.includes(body.difficulty)) {
    errors.add('difficulty', `difficulty must be one of ${DIFFICULTIES.join(', ')}.`, 'enum');
  }

  errors.throwIfAny();
  return {
    competencyIds: /** @type {string[]} */ (competencyIds),
    count: /** @type {number} */ (count),
    difficulty: /** @type {string} */ (body.difficulty),
  };
}
