/**
 * Pre-flight validation PF-00…PF-13 / SC-01…SC-08 (SCORING_METHODOLOGY §6–§6.7).
 *
 * Pure. Collects every failure, ordered by `(questionId || '', code)`, and never throws on input an earlier
 * check already rejected (§6.3). Two failure classes are distinguished here, because they rank differently
 * (§11.1) and one of them is not a block at all:
 *   - `errors`  — genuine blocks: PF-00…PF-12. Nothing is scored.
 *   - `withheld` — PF-13's verdict-only outcomes: the score is still computed (via `evaluateApproval`).
 *
 * The taxonomy registry is a `Map<competencyId, {test, deprecated}>` for `snapshot.taxonomyVersion`; PF-07 needs
 * it and nothing here reads the database to build it.
 */

import { TESTS } from './scoring.js';
import { evaluateApproval } from './approval.js';

/** Canonical instrument maxima in points (SCORING_METHODOLOGY §5.3, CPNS_2026_REGULATIONS §2.3). */
export const CEILING_POINTS = Object.freeze({ TWK: 150, TIU: 175, TKP: 225 });

/** Evidence tier at which a CPNS basis is authority (CPNS_2026_REGULATIONS §0, §4.1). */
const AUTHORITY_TIER = 'VERIFIED-2026';

/** A preflight failure, shaped as API_SPECIFICATION §4.1 `PreflightError`. */
function failure(code, path = null, message = '') {
  return { code, path, message, severity: 'block' };
}

/** True when `value` is a finite integer (`Number.isSafeInteger`, VALIDATION §1 `finite_integer`). */
function isInt(value) {
  return Number.isSafeInteger(value);
}

/**
 * SC-01…SC-08 for one frozen key (§6.1).
 * @param {object} key
 * @param {{optionKeys: string[], test: string}} question
 * @param {object} rules `snapshot.scoringRules`
 * @param {number} scoringVersion
 * @returns {string[]} failing SC codes, in rule order
 */
export function keyRuleFailures(key, question, rules, scoringVersion) {
  const codes = [];
  const scores = key.optionScores ?? {};
  const optionKeys = Object.keys(scores);
  const max = rules.perQuestionMax[question.test];
  const weights = Object.values(scores);

  if (optionKeys.length !== question.optionKeys.length || question.optionKeys.some((k) => !optionKeys.includes(k))) {
    codes.push('KEY_OPTION_SET_MISMATCH');
  }
  if (!weights.every(isInt)) codes.push('WEIGHT_NOT_INTEGER');
  else if (!weights.every((w) => w >= 0 && w <= max)) codes.push('WEIGHT_OUT_OF_RANGE');
  if (key.maxScore !== Math.max(...weights) || key.maxScore !== max) codes.push('MAX_SCORE_MISMATCH');

  if (question.test === 'TKP') {
    const [low, high] = rules.tkpWeightRange;
    if (!weights.every((w) => w >= low && w <= high)) codes.push('TKP_WEIGHT_OUT_OF_RANGE');
    if (!weights.some((w) => w === rules.perQuestionMax.TKP)) codes.push('TKP_NO_MAX_WEIGHT');
  } else {
    const atMax = weights.filter((w) => w === max).length;
    if (atMax !== 1 || weights.some((w) => w !== 0 && w !== max)) codes.push('TWK_TIU_KEY_SHAPE');
  }

  const bounds = rules.unansweredScoreBounds;
  const u = key.unansweredScore;
  if (!isInt(u) || u < bounds.min || u > bounds.max || u < 0 || u > max) codes.push('UNANSWERED_SCORE_INVALID');
  if (rules.unansweredRule === 'zero' && u !== 0) codes.push('UNANSWERED_SCORE_INCONSISTENT');
  if (key.scoringVersion !== scoringVersion) codes.push('SCORING_VERSION_MISMATCH');
  return codes;
}

/**
 * PF-09: the ThresholdSet satisfies §5.1 and §5.3, and a set whose basis is not authority for this pathway is
 * allowed only on a `provisional` config (§6.7 last bullet). `mode:'none'` is always valid.
 * @param {{mode: string, TWK?: number, TIU?: number, TKP?: number, total?: number} | null} thresholds
 * @param {object} rules
 * @param {{state: string, thresholdBasisIsAuthority: boolean}} config
 * @returns {string[]} failing codes
 */
export function thresholdFailures(thresholds, rules, config) {
  if (!thresholds || thresholds.mode === 'none') return [];

  const codes = [];
  const present = (field) => thresholds[field] !== undefined && thresholds[field] !== null;
  const required = {
    per_subtest_and_total: ['TWK', 'TIU', 'TKP', 'total'],
    per_subtest_only: ['TWK', 'TIU', 'TKP'],
    total_only: ['total'],
  }[thresholds.mode];

  if (!required) return ['THRESHOLD_CONFIG_INVALID'];
  if (required.some((field) => !present(field)) || ['TWK', 'TIU', 'TKP', 'total'].some((field) => present(field) && !required.includes(field))) {
    return ['THRESHOLD_CONFIG_INVALID'];
  }

  const ceiling = {
    TWK: (CEILING_POINTS.TWK * rules.perQuestionMax.TWK) / 5,
    TIU: (CEILING_POINTS.TIU * rules.perQuestionMax.TIU) / 5,
    TKP: (CEILING_POINTS.TKP * rules.perQuestionMax.TKP) / 5,
  };
  ceiling.total = ceiling.TWK + ceiling.TIU + ceiling.TKP;

  for (const field of required) {
    const value = thresholds[field];
    if (!isInt(value)) codes.push('THRESHOLD_NOT_INTEGER');
    else if (value < 0 || value > ceiling[field]) codes.push('THRESHOLD_EXCEEDS_MAX');
  }
  if (!config.thresholdBasisIsAuthority && config.state !== 'provisional') codes.push('THRESHOLDS_REQUIRE_APPROVAL');
  return [...new Set(codes)];
}

/**
 * PF-11: the frozen `ScoringRules` are themselves sound (§6.6).
 * @param {object} rules
 * @returns {string[]}
 */
export function ruleFieldFailures(rules) {
  const codes = [];
  if (!Number.isSafeInteger(rules?.scoringVersion) || rules.scoringVersion <= 0) codes.push('CONFIG_SCORING_VERSION_INVALID');

  const range = rules?.tkpWeightRange;
  if (!Array.isArray(range) || !range.every(isInt) || range[0] > range[1]) codes.push('CONFIG_WEIGHT_RANGE_INVALID');

  const bounds = rules?.unansweredScoreBounds;
  if (!bounds || !isInt(bounds.min) || !isInt(bounds.max) || bounds.min > bounds.max) codes.push('CONFIG_UNANSWERED_BOUNDS_INVALID');

  const maxima = rules?.perQuestionMax;
  if (!maxima || TESTS.some((test) => !Number.isSafeInteger(maxima[test]) || maxima[test] <= 0)) {
    codes.push('CONFIG_PER_QUESTION_MAX_INVALID');
  }
  return codes;
}

/**
 * PF-12: every BasisRef matches the config's pathway and year, and no non-CPNS instrument claims CPNS authority
 * (§6.7, CPNS_2026_REGULATIONS §4.1). `config.pathway`/`config.examYear` are the snapshot's own values.
 * @param {Array<object>} basisRefs
 * @param {{pathway: string, examYear: number}} config
 * @returns {string[]}
 */
export function regulatoryFailures(basisRefs, config) {
  const codes = [];
  for (const basis of basisRefs ?? []) {
    if (basis.tier !== AUTHORITY_TIER) continue;
    if (basis.pathway !== config.pathway) codes.push('REGULATORY_PATHWAY_MISMATCH');
    else if (basis.examYear !== config.examYear) codes.push('REGULATORY_YEAR_MISMATCH');
  }
  const authorityWithoutPathway = (basisRefs ?? []).some((basis) => basis.tier === AUTHORITY_TIER && !basis.pathway);
  if (authorityWithoutPathway) codes.push('REGULATORY_SCOPE_UNVERIFIED');
  return [...new Set(codes)];
}

/**
 * Run pre-flight (§6). Order follows §6.3; a question already reported missing is skipped by dependent checks.
 *
 * @param {object} input
 * @param {object} input.snapshot normalised snapshot (shape in `scoring.js`)
 * @param {object[]} input.basisRefs the config's `BasisRef[]`, from the snapshot
 * @param {object[]} input.sheets answer rows `{questionId, selected}`
 * @param {Map<string, {test: string, deprecated: boolean}> | null} input.taxonomy the registry for the snapshot's
 *   taxonomy version; `null` when it cannot be resolved (PF-07 then reports `UNKNOWN_COMPETENCY`)
 * @param {object|null} input.liveConfig the config row as it stands now, for the PF-13 drift check
 * @param {{approved: object|null, current: object|null}} input.thresholdsForDiff
 * @returns {{ok: boolean, errors: object[], withheld: {code: string, changed: object[]} | null,
 *   approvalAllowed: boolean, approval: object | null, sheets: Map<string, object> | null}}
 */
export function preflight({ snapshot, basisRefs, sheets, taxonomy, liveConfig, thresholdsForDiff }) {
  const errors = [];
  const roster = snapshot?.questions ?? [];
  const rosterIds = roster.map((q) => q.questionId);

  // PF-00 — non-empty roster, unique ids.
  if (roster.length === 0) errors.push(failure('EMPTY_ROSTER'));
  if (new Set(rosterIds).size !== rosterIds.length) {
    for (const id of rosterIds.filter((id, i) => rosterIds.indexOf(id) !== i)) {
      errors.push(failure('DUPLICATE_ROSTER_QUESTION_ID', id, 'The question appears twice in the roster.'));
    }
  }

  // PF-01/PF-02/PF-03 — the sheet projection is a bijection with the roster.
  const sheetById = new Map();
  for (const sheet of sheets ?? []) {
    if (sheetById.has(sheet.questionId)) errors.push(failure('DUPLICATE_QUESTION_ID', sheet.questionId, 'Two answers for one question.'));
    else sheetById.set(sheet.questionId, sheet);
    if (!rosterIds.includes(sheet.questionId)) errors.push(failure('SHEET_NOT_IN_SESSION', sheet.questionId, 'That answer is not part of this session.'));
  }
  for (const id of new Set(rosterIds)) {
    if (!sheetById.has(id)) errors.push(failure('SHEET_COUNT_MISMATCH', id, 'A question has no answer sheet.'));
  }

  // PF-05 — the key projection is a bijection with the roster.
  const keyById = new Map();
  for (const key of snapshot?.answerKeys ?? []) {
    if (keyById.has(key.questionId)) errors.push(failure('DUPLICATE_QUESTION_ID', key.questionId, 'Two answer keys for one question.'));
    else keyById.set(key.questionId, key);
    if (!rosterIds.includes(key.questionId)) errors.push(failure('ORPHAN_ANSWER_KEY', key.questionId, 'An answer key has no roster question.'));
  }
  for (const id of new Set(rosterIds)) {
    if (!keyById.has(id)) errors.push(failure('KEY_COUNT_MISMATCH', id, 'A question has no answer key.'));
  }

  // PF-04 / PF-06 / PF-07 / PF-08 — per question, skipping what an earlier check already reported missing.
  const rules = snapshot?.scoringRules ?? {};
  const reportedMissing = (id) => !keyById.has(id) || !sheetById.has(id);
  for (const question of roster) {
    const sheet = sheetById.get(question.questionId);
    if (sheet && sheet.selected !== null && !(question.optionKeys ?? []).includes(sheet.selected)) {
      errors.push(failure('INVALID_OPTION_SELECTED', question.questionId, 'The selected option is not part of this question.'));
    }
    if (reportedMissing(question.questionId)) continue;

    if (!TESTS.includes(question.test)) {
      errors.push(failure('INVALID_TEST', question.questionId, 'Unknown subtest.'));
      continue;
    }
    if (!taxonomy) {
      errors.push(failure('UNKNOWN_COMPETENCY', question.questionId, 'The taxonomy for this snapshot could not be resolved.'));
    } else {
      const node = taxonomy.get(question.competencyId);
      if (node?.deprecated === true) errors.push(failure('DEPRECATED_COMPETENCY', question.questionId, 'That competency is deprecated.'));
      else if (!node) errors.push(failure('UNKNOWN_COMPETENCY', question.questionId, 'Unknown competency.'));
      else if (node.test !== question.test) errors.push(failure('COMPETENCY_TEST_MISMATCH', question.questionId, 'The competency belongs to another subtest.'));
    }

    for (const code of keyRuleFailures(keyById.get(question.questionId), question, rules, snapshot.scoringVersion)) {
      errors.push(failure(code, question.questionId, 'The answer key does not match the frozen scoring rules.'));
    }
  }

  // PF-11 then PF-09 (rules sound before keys are checked against them), then PF-12.
  for (const code of ruleFieldFailures(rules)) errors.push(failure(code, 'snapshot.scoringRules', 'The frozen scoring rules are not usable.'));
  for (const code of thresholdFailures(snapshot?.thresholds, rules, {
    state: snapshot?.state,
    thresholdBasisIsAuthority: snapshot?.thresholdBasisIsAuthority === true,
  })) {
    errors.push(failure(code, 'snapshot.thresholds', 'The threshold set is not usable.'));
  }
  for (const code of regulatoryFailures(basisRefs, snapshot ?? {})) {
    errors.push(failure(code, 'snapshot.regulatoryBasis', 'The regulatory basis does not match this configuration.'));
  }

  // PF-10 — the integrity seal: the snapshot is present, complete, and self-consistent.
  errors.push(...snapshotIntegrityFailures(snapshot, rosterIds));

  // PF-13 — verdict-only: never a block (§11).
  const approvalOutcome = evaluateApproval({
    thresholds: snapshot?.thresholds ?? { mode: 'none' },
    approval: snapshot?.provisionalApproval ?? null,
    frozen: {
      configId: snapshot?.configId,
      configVersion: snapshot?.configVersion,
      scoringVersion: snapshot?.scoringVersion,
      regulatoryBasisHash: snapshot?.regulatoryBasisHash,
    },
    live: liveConfig ?? {
      configId: snapshot?.configId,
      configVersion: snapshot?.configVersion,
      scoringVersion: snapshot?.scoringVersion,
      regulatoryBasisHash: snapshot?.regulatoryBasisHash,
    },
    thresholdsForDiff: thresholdsForDiff ?? { approved: snapshot?.thresholds ?? null, current: snapshot?.thresholds ?? null },
  });

  errors.sort((a, b) => (a.path ?? '').localeCompare(b.path ?? '') || a.code.localeCompare(b.code));
  return {
    ok: errors.length === 0,
    errors,
    withheld: approvalOutcome.withheld,
    approvalAllowed: approvalOutcome.verdictAllowed,
    approval: approvalOutcome.approval,
    sheets: errors.length === 0 ? sheetById : null,
  };
}

/**
 * PF-10 findings (§6.5): every required snapshot field present, and the sheet/key projections resolve to *this*
 * snapshot.
 * @param {object} snapshot
 * @param {string[]} rosterIds
 * @returns {object[]}
 */
function snapshotIntegrityFailures(snapshot, rosterIds) {
  if (!snapshot) return [failure('SNAPSHOT_MISSING', 'snapshot')];
  const errors = [];
  const required = ['snapshotVersion', 'configId', 'configVersion', 'scoringVersion', 'taxonomyVersion', 'scoringRules', 'questions', 'answerKeys'];
  const missing = required.filter((field) => snapshot[field] === undefined || snapshot[field] === null);
  if (missing.length > 0) errors.push(failure('SNAPSHOT_INCOMPLETE', `snapshot.${missing[0]}`, 'The frozen snapshot is incomplete.'));
  // §6.5: `thresholds` is required unless its mode is `none`; a mode-`none` set is `{mode:'none'}`, which the
  // repository normalises a missing row to. `null` therefore means the snapshot lost a non-`none` set.
  if (snapshot.thresholds === null || snapshot.thresholds === undefined) {
    errors.push(failure('SNAPSHOT_INCOMPLETE', 'snapshot.thresholds', 'The frozen snapshot carries no thresholds.'));
  }
  const keyIds = (snapshot.answerKeys ?? []).map((key) => key.questionId);
  if (keyIds.length !== new Set(rosterIds).size || keyIds.some((id) => !rosterIds.includes(id)) || new Set(keyIds).size !== keyIds.length) {
    errors.push(failure('SNAPSHOT_MISMATCH', 'snapshot.answerKeys', 'The answer keys are not a projection of this roster.'));
  }
  return errors;
}
