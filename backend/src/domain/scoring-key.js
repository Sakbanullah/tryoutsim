/**
 * Answer-key shape rules shared by question authoring (V-06) and scoring
 * (SCORING_METHODOLOGY §6.1 SC-01…SC-08). Kept beside the pure scorer's input
 * rules so a key accepted here is a key scoring can read; the scoring module
 * may consume this file, never the reverse.
 */

import { AppError } from '../errors.js';

/** The five option keys, in order (QUESTION_SPECIFICATION §5.1 V-02). */
export const OPTION_KEYS = Object.freeze(['A', 'B', 'C', 'D', 'E']);

/**
 * Literal or factor of 2, as SCORING_METHODOLOGY §6.1 SC-05 defines it (§3.2 weights).
 * @param {number} n
 * @returns {boolean}
 */
function isOptionWeight(n) {
  return n === 0 || (Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0);
}

/**
 * Read a value that must be a plain object.
 * @param {unknown} value
 * @param {string} what
 * @returns {Record<string, unknown>}
 */
function plainObject(value, what) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('VALIDATION_FAILED', `${what} must be an object.`, {
      fields: [{ path: what, message: `${what} must be an object.`, rule: 'type' }],
    });
  }
  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * Validate one key against its question's test and option set.
 *
 * TWK/TIU: exactly one option scores `maxScore`, the rest 0, no justifications.
 * TKP: every option carries a weight in `[1,5]`, `maxScore` is the largest of them,
 * and `optionJustifications` has exactly the `optionScores` keys, each non-empty (V-13).
 * A TKP weight outside `[1,5]` is a SC-05 fail: whether 2/4 is a literal or a multiple
 * is not self-evident, so accepted weights stay inside the DB's documented range.
 *
 * @param {{questionId: string, test: string, optionKeys: readonly string[], answerKey: unknown}} input
 * @returns {{scoringVersion: number, optionScores: Record<string, number>, optionJustifications: Record<string, string> | null, unansweredScore: number, maxScore: number}}
 * @throws {AppError} one `VALIDATION_FAILED` listing every key failure
 */
export function validateAnswerKey({ questionId, test, optionKeys, answerKey }) {
  /** @type {{path: string, message: string, rule: string}[]} */
  const fields = [];
  const fail = (path, message, rule = 'shape') => fields.push({ path, message, rule });
  const key = plainObject(answerKey, 'answerKey');

  for (const field of Object.keys(key)) {
    if (!['questionId', 'scoringVersion', 'optionScores', 'optionJustifications', 'unansweredScore', 'maxScore'].includes(field)) {
      fail(`answerKey.${field}`, 'Field is not part of an answer key.', 'unknown_field');
    }
  }
  if (key.questionId !== questionId) fail('answerKey.questionId', 'answerKey.questionId must equal the question id.', 'identity');
  if (!Number.isSafeInteger(key.scoringVersion) || Number(key.scoringVersion) <= 0) {
    fail('answerKey.scoringVersion', 'scoringVersion must be a positive integer.', 'finite_integer');
  }
  if (key.unansweredScore !== 0) {
    fail('answerKey.unansweredScore', 'unansweredScore must be 0: blank is never credit.', 'sc_unanswered');
  }
  if (!Number.isSafeInteger(key.maxScore) || Number(key.maxScore) <= 0) {
    fail('answerKey.maxScore', 'maxScore must be a positive integer.', 'finite_integer');
  }

  const scores = plainObject(key.optionScores, 'answerKey.optionScores');
  const scoreKeys = Object.keys(scores);
  if (scoreKeys.length !== optionKeys.length || scoreKeys.some((k) => !optionKeys.includes(k))) {
    fail('answerKey.optionScores', 'optionScores must name exactly the question options.', 'sc_option_mismatch');
  }
  for (const [option, weight] of Object.entries(scores)) {
    if (!isOptionWeight(weight)) {
      fail(`answerKey.optionScores.${option}`, 'Weight must be 0 or a positive integer.', 'sc_weight');
    }
  }

  const justifications = key.optionJustifications;
  if (test === 'TKP') {
    const weights = Object.values(scores).filter((w) => typeof w === 'number');
    for (const [option, weight] of Object.entries(scores)) {
      if (typeof weight !== 'number' || weight < 1 || weight > 5) {
        fail(`answerKey.optionScores.${option}`, 'A TKP weight must be within 1..5.', 'int_range');
      }
    }
    if (weights.length > 0 && key.maxScore !== Math.max(...weights)) {
      fail('answerKey.maxScore', 'maxScore must be the largest option weight.', 'sc_max_not_top');
    }
    if (justifications === undefined) {
      fail('answerKey.optionJustifications', 'A TKP key carries one justification per option.', 'first_mismatch');
    } else {
      const map = plainObject(justifications, 'answerKey.optionJustifications');
      const mapKeys = Object.keys(map);
      const sameSet = mapKeys.length === scoreKeys.length && mapKeys.every((k) => scoreKeys.includes(k));
      if (!sameSet) {
        fail('answerKey.optionJustifications', 'Justification keys must equal the optionScores keys.', 'first_mismatch');
      }
      for (const [option, text] of Object.entries(map)) {
        if (typeof text !== 'string' || text.trim().length === 0) {
          fail(`answerKey.optionJustifications.${option}`, 'Each justification must be non-empty text.', 'non_empty');
        }
      }
    }
  } else {
    if (justifications !== undefined) {
      fail('answerKey.optionJustifications', 'Only a TKP key carries justifications.', 'first_mismatch');
    }
    const top = Object.entries(scores).filter(([, weight]) => weight === key.maxScore);
    if (top.length !== 1) {
      fail('answerKey.optionScores', 'Exactly one option must score maxScore.', 'sc_keyed_count');
    }
    for (const [option, weight] of Object.entries(scores)) {
      if (weight !== 0 && weight !== key.maxScore) {
        fail(`answerKey.optionScores.${option}`, 'Every non-keyed option scores 0.', 'sc_distractor_weight');
      }
    }
  }

  if (fields.length > 0) throw new AppError('VALIDATION_FAILED', 'The answer key is invalid.', { fields });

  const optionScores = /** @type {Record<string, number>} */ (scores);
  return {
    scoringVersion: /** @type {number} */ (key.scoringVersion),
    optionScores,
    optionJustifications:
      test === 'TKP' ? /** @type {Record<string, string>} */ (justifications) : null,
    unansweredScore: 0,
    maxScore: /** @type {number} */ (key.maxScore),
  };
}
