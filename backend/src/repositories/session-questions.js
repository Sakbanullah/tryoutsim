/**
 * "Tinjau jawaban" block assembly (API_SPECIFICATION §7.7).
 *
 * Pure: it takes the rows a repository read and produces the response body. The
 * split of sources is the whole point of the route —
 *   frozen snapshot   → stem, options, key, optionScores
 *   latest question   → explanation, and optionJustifications only when frozen has none
 *   stored ScoreResult→ earned, maxScore, selected, correct (echoed, never recomputed)
 * — and each is labelled with where it came from so the client can apply its own
 * strict-version rule without guessing.
 *
 * The id rules are enforced *before* any read: a malformed, duplicate, unknown or
 * out-of-roster id is one `400`, indistinguishable, so the route never reveals
 * whether a question exists outside the roster.
 */

import { AppError } from '../errors.js';

/** Largest accepted batch (§7.7). */
export const MAX_REVIEW_IDS = 20;

/**
 * Parse and validate `ids` against the session's frozen roster.
 *
 * @param {string | null} raw comma-separated
 * @param {string[]} roster the session's stored roster ids
 * @returns {string[]} ids in requested order
 * @throws {AppError} one `VALIDATION_FAILED` for every rejection reason
 */
export function parseReviewIds(raw, roster) {
  const fail = (rule, message) =>
    new AppError('VALIDATION_FAILED', 'Invalid question id list.', {
      fields: [{ path: 'ids', message, rule }],
    });

  if (raw === null || raw.length === 0) throw fail('required', 'ids is required.');

  const ids = raw.split(',');
  if (ids.length > MAX_REVIEW_IDS) throw fail('max_items', `At most ${MAX_REVIEW_IDS} ids are accepted.`);
  if (ids.some((id) => id.length === 0 || id.length > 128 || /\s/.test(id))) {
    throw fail('format', 'ids must be non-empty identifiers.');
  }
  if (new Set(ids).size !== ids.length) throw fail('unique_items', 'ids must not repeat.');

  const inRoster = new Set(roster);
  if (ids.some((id) => !inRoster.has(id))) throw fail('membership', 'ids must belong to this session.');

  return ids;
}

/**
 * Compute `keyedOption` from the frozen key: the single TWK/TIU option whose
 * weight equals `maxScore`. `null` for TKP and for any key with zero or several
 * such options — the client never derives it (§7.7).
 *
 * @param {{optionScores: Record<string, number>}} key
 * @param {string} test
 * @param {number} maxScore
 * @returns {string | null}
 */
export function keyedOption(key, test, maxScore) {
  if (test === 'TKP') return null;
  const top = Object.entries(key.optionScores).filter(([, weight]) => weight === maxScore);
  return top.length === 1 ? top[0][0] : null;
}

/**
 * Assemble one review block.
 *
 * @param {object} input
 * @param {string} input.questionId
 * @param {object} input.frozen `session_snapshot.questionsJson` entry (`questionVersion` is the frozen content version)
 * @param {object} input.frozenKey `session_snapshot.answerKeysJson` entry
 * @param {{earned: number, maxScore: number, selected: string | null, correct: boolean | null}} input.scored
 *   the stored `ScoreResult.byQuestion` row for this id
 * @param {{contentVersion: number, explanation: string, answerKeyJson: string, lifecycle: string} | null}
 *   input.latest current `question` row, or `null` when it no longer resolves
 * @returns {object} a `ReviewQuestion`
 */
export function buildReviewBlock({ questionId, frozen, frozenKey, scored, latest }) {
  const latestKey = latest ? JSON.parse(latest.answerKeyJson) : null;

  const frozenJustifications = frozenKey.optionJustifications ?? null;
  const latestJustifications = latestKey?.optionJustifications ?? null;
  const justifications = frozenJustifications ?? latestJustifications ?? null;

  const maxScore = scored.maxScore;

  return {
    questionId,
    test: frozen.test,
    ...(frozen.asset === undefined ? {} : { asset: frozen.asset }),
    options: frozen.options,
    keyedOption: keyedOption(frozenKey, frozen.test, maxScore),
    optionScores: frozenKey.optionScores,
    earned: scored.earned,
    maxScore,
    selected: scored.selected,
    correct: scored.correct,
    // BUG-011: the snapshot entry names the frozen version `questionVersion` (session.js `buildSnapshot`).
    // `null` (not a dropped key) when an older snapshot lacks it, so strict matching never passes by accident.
    frozenContentVersion: frozen.questionVersion ?? null,
    latestContentVersion: latest?.contentVersion ?? null,
    explanation: latest?.explanation ?? null,
    explanationSource: latest?.explanation ? 'latest' : 'none',
    optionJustifications: justifications,
    justificationsSource:
      frozenJustifications ? 'frozen' : latestJustifications ? 'latest' : 'none',
    questionState: latest ? (latest.lifecycle === 'archived' || latest.lifecycle === 'quarantined'
      ? latest.lifecycle
      : 'live') : 'missing',
  };
}

/**
 * Assemble the whole response, in requested order.
 *
 * @param {string} sessionId
 * @param {string[]} ids
 * @param {(id: string) => {frozen: object, frozenKey: object, scored: object, latest: object | null}} read
 * @returns {{sessionId: string, questions: object[]}}
 */
export function buildReviewResponse(sessionId, ids, read) {
  return { sessionId, questions: ids.map((id) => buildReviewBlock({ questionId: id, ...read(id) })) };
}

/**
 * Refuse a session that is still open, for both modes (§7.7).
 * @param {{status: string}} session
 */
export function assertSubmitted(session) {
  if (session.status === 'open') {
    throw new AppError('CONFLICT', 'The session is still open.', {
      resource: 'session',
      reason: 'session_open',
    });
  }
}
