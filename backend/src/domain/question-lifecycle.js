/**
 * The seven question lifecycle states and every legal edge
 * (QUESTION_SPECIFICATION §3). This is a transition *guard*: it decides whether a
 * transition may be attempted, never writes history. `question.lifecycle` is a cache
 * derivable from the append-only `question_review` / `validation_record` rows
 * (DATABASE_SCHEMA §2); append-only is the database's job (T-2, T-4, T-5), not this file's.
 */

import { conflict } from '../errors.js';
import { isPassingForCurrentHash } from './question-validation.js';

/** The seven states; nothing else is a lifecycle value. */
export const LIFECYCLE_STATES = Object.freeze([
  'draft', 'ai_validated', 'human_reviewed', 'active', 'quarantined', 'rejected', 'archived',
]);

/** `from → to`: the only edges §3.2 draws. */
export const LEGAL_TRANSITIONS = Object.freeze({
  draft: Object.freeze(['ai_validated', 'quarantined', 'human_reviewed', 'rejected']),
  ai_validated: Object.freeze(['human_reviewed', 'rejected']),
  human_reviewed: Object.freeze(['active']),
  active: Object.freeze(['quarantined', 'archived']),
  quarantined: Object.freeze(['human_reviewed', 'rejected']),
  rejected: Object.freeze([]),
  archived: Object.freeze([]),
});

/**
 * Whether `from → to` is one of §3.2's edges.
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function isLegalTransition(from, to) {
  return Array.isArray(LEGAL_TRANSITIONS[/** @type {keyof typeof LEGAL_TRANSITIONS} */ (from)]) &&
    LEGAL_TRANSITIONS[/** @type {keyof typeof LEGAL_TRANSITIONS} */ (from)].includes(to);
}

/**
 * Refuse an edge §3.2 does not draw. Every refusal is the same `409 illegal_transition`
 * (API_SPECIFICATION §7.1), so the reason does not vary by which edge was attempted.
 * @param {string} from
 * @param {string} to
 * @returns {never | void} throws when illegal
 */
export function assertTransition(from, to) {
  if (!isLegalTransition(from, to)) {
    throw conflict('question', 'illegal_transition', `A question cannot move from ${from} to ${to}.`);
  }
}

/** Activities and decisions of `question_review` (QUESTION_SPECIFICATION §4). */
export const REVIEW_DECISIONS = Object.freeze(['accepted', 'edited', 'rejected', 'reported', 'repaired', 'withdrawn']);
export const REVIEW_ACTIVITIES = Object.freeze(['content', 'batch_decision', 'sample_review', 'report_triage', 'repair']);

/**
 * Map `PATCH /questions/:id/accept`'s decision to the next state, after checking legal.
 *
 * `accepted` means the current state itself is the reviewed one, so it is legal only from
 * `draft` / `quarantined` (API_SPECIFICATION §7.1). `edited` keeps the state and bumps the
 * version; `rejected` is terminal.
 *
 * @param {string} lifecycle
 * @param {'accepted' | 'edited' | 'rejected'} decision
 * @returns {{lifecycle: string, reviewDecision: string, activity: string}}
 */
export function applyAcceptDecision(lifecycle, decision) {
  switch (decision) {
    case 'accepted':
      assertTransition(lifecycle, 'human_reviewed');
      return { lifecycle: 'human_reviewed', reviewDecision: 'accepted', activity: 'content' };
    case 'edited':
      return { lifecycle, reviewDecision: 'edited', activity: 'content' };
    case 'rejected':
      assertTransition(lifecycle, 'rejected');
      return { lifecycle: 'rejected', reviewDecision: 'rejected', activity: 'content' };
    default:
      throw conflict('question', 'illegal_transition', 'That decision is not part of the accept contract.');
  }
}

/**
 * A read view of the question state the activation gate needs. Built from the stored row and
 * the newest `validation_record`; scoringVersion is not a gate input.
 *
 * @typedef {object} ActivationInput
 * @property {{lifecycle: string, contentHash: string, answerKeyValidatedAt: string | null, provenanceJson: string}} question
 * @property {{result: string, contentHash: string} | null} latestValidation newest `validation_record`
 * @property {boolean} acceptedByUser a `question_review` entry with `decision = 'accepted'` exists
 */

/**
 * §3.3 + §6.3: list every unmet prerequisite for `human_reviewed → active`. An empty list
 * means `dynamicEligible` may be set to true as part of the same transition.
 *
 * @param {ActivationInput} input
 * @returns {string[]} stable reason codes: `illegal_state`, `validation_stale`, `key_not_validated`,
 *   `ai_review_missing`, `sampling_pending`
 */
export function activationBlockers({ question, latestValidation, acceptedByUser }) {
  if (question.lifecycle !== 'human_reviewed') return ['illegal_state'];

  const reasons = [];
  const provenance = JSON.parse(question.provenanceJson);
  const sampling = provenance?.sampling ?? null;

  if (!isPassingForCurrentHash(latestValidation, question.contentHash)) reasons.push('validation_stale');
  if (question.answerKeyValidatedAt === null || question.answerKeyValidatedAt === '') reasons.push('key_not_validated');
  if (provenance?.kind === 'ai_generated' || provenance?.kind === 'ai_generated_human_reviewed') {
    if (!acceptedByUser) reasons.push('ai_review_missing');
    if (sampling?.status !== 'sampled_pass') reasons.push('sampling_pending');
  } else if (sampling?.status !== 'not_applicable') {
    // §3.3: a human/historical question is activated with sampling not_applicable (§6.1).
    reasons.push('sampling_pending');
  }
  return reasons;
}

/**
 * Throw the single `409 illegal_transition` refusal the contract defines. Which prerequisite
 * is missing is not part of `CONFLICT.details` (API_SPECIFICATION §4), so it is not sent;
 * `activationBlockers` is the testable statement of it.
 * @param {ActivationInput} input
 */
export function assertActivatable(input) {
  if (activationBlockers(input).length > 0) {
    throw conflict('question', 'illegal_transition', 'The question cannot be activated yet.');
  }
}
