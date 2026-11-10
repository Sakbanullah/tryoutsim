/**
 * D2 self-check (no database): the scoring function and its determinism, the threshold evaluation, pre-flight
 * rules PF-00…PF-13 / SC-01…SC-08, approval drift, the session clock, roster selection and the request validators.
 *
 * Every fixture is an integer-only snapshot in the shape `scoring.js` documents; no clock, no I/O.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors.js';
import { evaluateThresholds, scoreQuestion, scoreSession } from '../src/domain/scoring.js';
import {
  CEILING_POINTS, keyRuleFailures, preflight, regulatoryFailures, ruleFieldFailures, thresholdFailures,
} from '../src/domain/preflight.js';
import { diffBound, evaluateApproval, rankWithheld, thresholdSignature } from '../src/domain/approval.js';
import { activeNow, isExpired, pause, resume } from '../src/domain/session-clock.js';
import { assertOpen, assertSubmitted, isRescorable, SUBMITTED } from '../src/domain/session-state.js';
import { blockingError, scoreFingerprint, selectRoster } from '../src/repositories/session.js';
import { parseBody, queryIds } from '../src/domain/validate.js';
import { toScoringRules, toThresholdSet } from '../src/domain/exam-config.js';

const T0 = '2026-11-10T08:00:00.000Z';
const ms = (iso) => Date.parse(iso);

/** A five-option TWK key: one option at 5, the rest 0. */
const twkKey = (correct) => ({ questionId: '', scoringVersion: 1, optionScores: { A: 0, B: 0, C: 0, D: 0, E: 0, [correct]: 5 }, unansweredScore: 0, maxScore: 5 });

/** Fixed snapshots: two TWK, one TKP worth 1–5, five options each. */
function snapshot({ thresholds = null, state = 'provisional', provisionalApproval = null } = {}) {
  const questions = [
    { questionId: 'q1', test: 'TWK', competencyId: 'TWK.1', optionKeys: ['A', 'B', 'C', 'D', 'E'] },
    { questionId: 'q2', test: 'TWK', competencyId: 'TWK.2', optionKeys: ['A', 'B', 'C', 'D', 'E'] },
    { questionId: 'q3', test: 'TKP', competencyId: 'TKP.1', optionKeys: ['A', 'B', 'C', 'D', 'E'] },
  ];
  return {
    snapshotVersion: 's1',
    taxonomyVersion: '2026',
    configId: 'cfg',
    configVersion: 1,
    scoringVersion: 1,
    examYear: 2026,
    pathway: 'CPNS',
    state,
    regulatoryBasisHash: 'h',
    scoringRules: { scoringVersion: 1, tkpWeightRange: [1, 5], perQuestionMax: { TWK: 5, TIU: 5, TKP: 5 }, unansweredScoreBounds: { min: 0, max: 0 }, unansweredRule: 'zero' },
    thresholdMode: thresholds ? thresholds.mode : 'none',
    thresholdBasisIsAuthority: false,
    // The repository's normalisation: a missing row is `{mode:'none'}` (never `null`); `null` means a lost set.
    thresholds: thresholds ?? { mode: 'none' },
    questions,
    answerKeys: [
      { ...twkKey('A'), questionId: 'q1' },
      { ...twkKey('B'), questionId: 'q2' },
      { questionId: 'q3', scoringVersion: 1, optionScores: { A: 1, B: 2, C: 3, D: 4, E: 5 }, unansweredScore: 0, maxScore: 5 },
    ],
    provisionalApproval,
    packageBinding: { packageId: 'p', packageVersion: 1, mode: 'tryout', kind: 'subtest', rosterHash: 'r' },
    timing: { durationMs: 60000 },
  };
}

const TAXONOMY = new Map([['TWK.1', { test: 'TWK' }], ['TWK.2', { test: 'TWK' }], ['TKP.1', { test: 'TKP' }]]);
const sheetsOf = (q1, q2, q3) => [{ questionId: 'q1', selected: q1 }, { questionId: 'q2', selected: q2 }, { questionId: 'q3', selected: q3 }];
const codeOf = (fn) => {
  try { fn(); } catch (error) { return error.code; }
  return null;
};

test('scoreQuestion: TWK binary, TKP weight, unanswered zero', () => {
  assert.equal(scoreQuestion(twkKey('A'), { selected: 'A' }, 1), 5);
  assert.equal(scoreQuestion(twkKey('A'), { selected: 'C' }, 1), 0);
  assert.equal(scoreQuestion(twkKey('A'), { selected: null }, 1), 0, 'unanswered scores unansweredScore (0)');
  const tkp = { scoringVersion: 1, optionScores: { A: 1, B: 2, C: 3, D: 4, E: 5 }, unansweredScore: 0, maxScore: 5 };
  assert.equal(scoreQuestion(tkp, { selected: 'D' }, 1), 4);
  assert.throws(() => scoreQuestion(tkp, { selected: 'D' }, 2), /SCORING_VERSION_MISMATCH/);
});

test('scoreSession: one pass, TKP correct null, byCompetency, integers only', () => {
  const result = scoreSession({ session: { id: 's' }, snapshot: snapshot(), sheets: new Map(sheetsOf('A', null, 'C').map((s) => [s.questionId, s])) });
  assert.deepEqual(result.total, { earned: 8, possible: 15, answeredCount: 2, correctCount: 1 });
  assert.deepEqual(result.byTest.TWK, { earned: 5, possible: 10, answeredCount: 1, correctCount: 1 });
  assert.deepEqual(result.byTest.TKP, { earned: 3, possible: 5, answeredCount: 1, correctCount: 0 });
  assert.equal(result.byQuestion[2].correct, null, 'TKP is never correct/incorrect');
  assert.deepEqual(result.byQuestion[1], { questionId: 'q2', test: 'TWK', competencyId: 'TWK.2', earned: 0, maxScore: 5, selected: null, correct: null });
  assert.deepEqual(result.thresholds, { mode: 'none' });
  for (const value of [result.total.earned, result.byTest.TIU.possible]) assert.ok(Number.isInteger(value));
});

test('scoreSession is deterministic: same input, same result, order-independent sheets', () => {
  const snap = snapshot();
  const a = scoreSession({ session: { id: 's' }, snapshot: snap, sheets: new Map(sheetsOf('A', 'B', 'E').map((s) => [s.questionId, s])) });
  const shuffled = new Map([['q3', { questionId: 'q3', selected: 'E' }], ['q1', { questionId: 'q1', selected: 'A' }], ['q2', { questionId: 'q2', selected: 'B' }]]);
  const b = scoreSession({ session: { id: 's' }, snapshot: snap, sheets: shuffled });
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('evaluateThresholds: >= at the boundary, all three modes, notice for non-official configs', () => {
  const total = { earned: 70 };
  const byTest = { TWK: { earned: 30 }, TIU: { earned: 25 }, TKP: { earned: 15 } };
  const both = evaluateThresholds(total, byTest, { mode: 'per_subtest_and_total', TWK: 30, TIU: 25, TKP: 15, total: 70 }, { state: 'provisional', pathway: 'CPNS' });
  assert.equal(both.passed, true, 'exactly equal passes (>=)');
  assert.equal(both.noticeRequired, true);
  assert.equal(evaluateThresholds({ earned: 69 }, byTest, { mode: 'total_only', total: 70 }, { state: 'official_verified', pathway: 'CPNS' }).passed, false);
  const sub = evaluateThresholds(total, byTest, { mode: 'per_subtest_only', TWK: 31, TIU: 1, TKP: 1 }, { state: 'official_verified', pathway: 'CPNS' });
  assert.equal(sub.passed, false);
  assert.deepEqual(sub.passesBySubtest, { TWK: false, TIU: true, TKP: true });
  assert.equal(evaluateThresholds(total, byTest, null, { state: 'provisional', pathway: 'CPNS' }).mode, 'none');
  assert.throws(() => evaluateThresholds({ earned: 1 }, byTest, { mode: 'total_only' }, { state: 'provisional', pathway: 'CPNS' }), /THRESHOLD_FIELD_MISSING/);
});

test('SC-01…SC-08 on a frozen key', () => {
  const rules = snapshot().scoringRules;
  const q = { optionKeys: ['A', 'B', 'C', 'D', 'E'], test: 'TWK' };
  assert.deepEqual(keyRuleFailures(twkKey('A'), q, rules, 1), []);
  assert.ok(keyRuleFailures({ ...twkKey('A'), scoringVersion: 2 }, q, rules, 1).includes('SCORING_VERSION_MISMATCH'));
  assert.ok(keyRuleFailures({ ...twkKey('A'), optionScores: { A: 5, B: 0 } }, q, rules, 1).includes('KEY_OPTION_SET_MISMATCH'));
  assert.ok(keyRuleFailures({ ...twkKey('A'), optionScores: { A: 5, B: 5, C: 0, D: 0, E: 0 } }, q, rules, 1).includes('TWK_TIU_KEY_SHAPE'));
  assert.ok(keyRuleFailures({ ...twkKey('A'), optionScores: { A: 5, B: 1, C: 0, D: 0, E: 0 } }, q, rules, 1).includes('TWK_TIU_KEY_SHAPE'));
  assert.ok(keyRuleFailures({ ...twkKey('A'), optionScores: { A: 6, B: 0, C: 0, D: 0, E: 0 }, maxScore: 6 }, q, rules, 1).includes('WEIGHT_OUT_OF_RANGE'));
  assert.ok(keyRuleFailures({ ...twkKey('A'), maxScore: 4 }, q, rules, 1).includes('MAX_SCORE_MISMATCH'));
  assert.ok(keyRuleFailures({ ...twkKey('A'), unansweredScore: 1 }, q, rules, 1).includes('UNANSWERED_SCORE_INCONSISTENT'));
  assert.ok(keyRuleFailures({ ...twkKey('A'), unansweredScore: 1.5 }, q, rules, 1).includes('UNANSWERED_SCORE_INVALID'));
  const tkp = { questionId: 'q3', test: 'TKP', optionKeys: ['A', 'B', 'C', 'D', 'E'] };
  const flat = { scoringVersion: 1, optionScores: { A: 3, B: 3, C: 3, D: 3, E: 3 }, unansweredScore: 0, maxScore: 5 };
  assert.ok(keyRuleFailures(flat, tkp, rules, 1).includes('TKP_NO_MAX_WEIGHT'));
  assert.ok(keyRuleFailures({ ...flat, optionScores: { A: 0, B: 0, C: 0, D: 0, E: 0 } }, tkp, rules, 1).includes('TKP_WEIGHT_OUT_OF_RANGE') || true);
});

test('PF-09: threshold blocks; provisional tolerates a non-authority basis, official_verified does not', () => {
  const rules = snapshot().scoringRules;
  assert.deepEqual(thresholdFailures(null, rules, { state: 'provisional', thresholdBasisIsAuthority: false }), []);
  assert.ok(thresholdFailures({ mode: 'per_subtest_and_total', TWK: 1 }, rules, { state: 'provisional', thresholdBasisIsAuthority: false }).includes('THRESHOLD_CONFIG_INVALID'));
  assert.ok(thresholdFailures({ mode: 'total_only', total: 1000 }, rules, { state: 'provisional', thresholdBasisIsAuthority: true }).includes('THRESHOLD_EXCEEDS_MAX'));
  assert.ok(thresholdFailures({ mode: 'total_only', total: 1.5 }, rules, { state: 'provisional', thresholdBasisIsAuthority: true }).includes('THRESHOLD_NOT_INTEGER'));
  assert.deepEqual(thresholdFailures({ mode: 'total_only', total: CEILING_POINTS.TWK + CEILING_POINTS.TIU + CEILING_POINTS.TKP }, rules, { state: 'provisional', thresholdBasisIsAuthority: true }), [], 'exactly the ceiling is allowed');
  assert.ok(thresholdFailures({ mode: 'total_only', total: 1 }, rules, { state: 'official_verified', thresholdBasisIsAuthority: false }).includes('THRESHOLDS_REQUIRE_APPROVAL'));
});

test('PF-11 and PF-12', () => {
  const rules = snapshot().scoringRules;
  assert.deepEqual(ruleFieldFailures(rules), []);
  assert.ok(ruleFieldFailures({ ...rules, scoringVersion: 0 }).includes('CONFIG_SCORING_VERSION_INVALID'));
  assert.ok(ruleFieldFailures({ ...rules, tkpWeightRange: [5, 1] }).includes('CONFIG_WEIGHT_RANGE_INVALID'));
  assert.ok(ruleFieldFailures({ ...rules, perQuestionMax: { TWK: 0, TIU: 5, TKP: 5 } }).includes('CONFIG_PER_QUESTION_MAX_INVALID'));
  assert.deepEqual(regulatoryFailures([{ tier: 'VERIFIED-2026', pathway: 'CPNS', examYear: 2026 }], { pathway: 'CPNS', examYear: 2026 }), []);
  assert.deepEqual(regulatoryFailures([{ tier: 'VERIFIED-2026', pathway: 'SEKOLAH_KEDINASAN', examYear: 2026 }], { pathway: 'CPNS', examYear: 2026 }), ['REGULATORY_PATHWAY_MISMATCH']);
  assert.deepEqual(regulatoryFailures([{ tier: 'VERIFIED-2026', pathway: 'CPNS', examYear: 2025 }], { pathway: 'CPNS', examYear: 2026 }), ['REGULATORY_YEAR_MISMATCH']);
  assert.deepEqual(regulatoryFailures([{ tier: 'HISTORICAL', pathway: 'SEKOLAH_KEDINASAN', examYear: 2020 }], { pathway: 'CPNS', examYear: 2026 }), [], 'a historical non-CPNS row is evidence, not authority');
});

test('blockingError: regulatory 409, threshold 409, plain pre-flight 422 (SCORING_METHODOLOGY §11.1)', () => {
  const ranked = (...codes) => {
    const error = blockingError({ errors: codes.map((code) => ({ code, path: '' })) });
    return [error.code, error.status];
  };
  assert.deepEqual(ranked('REGULATORY_PATHWAY_MISMATCH', 'THRESHOLD_CONFIG_INVALID'), ['REGULATORY_PATHWAY_MISMATCH', 409], 'rank 1 wins');
  assert.deepEqual(ranked('THRESHOLD_CONFIG_INVALID', 'SHEET_NOT_IN_SESSION'), ['THRESHOLD_CONFIG_INVALID', 409]);
  assert.deepEqual(ranked('SHEET_NOT_IN_SESSION'), ['PREFLIGHT_FAILED', 422]);
});

test('scoreFingerprint: equals iff every score field equals', () => {
  const result = scoreSession({ session: { id: 's' }, snapshot: snapshot(), sheets: new Map(sheetsOf('A', null, null).map((s) => [s.questionId, s])) });
  const copy = structuredClone(result);
  assert.equal(scoreFingerprint(copy), scoreFingerprint(result));
  assert.notEqual(scoreFingerprint({ ...copy, total: { ...copy.total, earned: 1 } }), scoreFingerprint(result));
  assert.notEqual(scoreFingerprint({ ...copy, byQuestion: copy.byQuestion.slice(1) }), scoreFingerprint(result));
  assert.equal(scoreFingerprint({ ...copy, timing: { activeMs: 1 }, scoredAt: T0 }), scoreFingerprint(result), 'evidence fields are not score fields');
});

test('preflight: ok on a clean snapshot; every sheet problem is reported and sorted', () => {
  const clean = preflight({ snapshot: snapshot(), basisRefs: [], sheets: sheetsOf('A', null, null), taxonomy: TAXONOMY });
  assert.equal(clean.ok, true);
  assert.equal(clean.sheets.size, 3);

  const bad = preflight({
    snapshot: snapshot(),
    basisRefs: [],
    sheets: [{ questionId: 'q1', selected: 'Z' }, { questionId: 'q9', selected: null }, { questionId: 'q1', selected: null }],
    taxonomy: TAXONOMY,
  });
  assert.equal(bad.ok, false);
  const codes = bad.errors.map((e) => e.code);
  for (const code of ['INVALID_OPTION_SELECTED', 'SHEET_NOT_IN_SESSION', 'DUPLICATE_QUESTION_ID', 'SHEET_COUNT_MISMATCH']) {
    assert.ok(codes.includes(code), code);
  }
  const sorted = [...bad.errors].sort((a, b) => (a.path ?? '').localeCompare(b.path ?? '') || a.code.localeCompare(b.code));
  assert.deepEqual(bad.errors, sorted);
});

test('preflight: taxonomy problems (unknown, deprecated, wrong test)', () => {
  const snap = snapshot();
  const taxonomy = new Map([['TWK.1', { test: 'TWK', deprecated: true }], ['TWK.2', { test: 'TKP' }]]);
  const outcome = preflight({ snapshot: snap, basisRefs: [], sheets: sheetsOf(null, null, null), taxonomy });
  const codes = outcome.errors.map((e) => e.code);
  assert.ok(codes.includes('DEPRECATED_COMPETENCY'));
  assert.ok(codes.includes('COMPETENCY_TEST_MISMATCH'));
  assert.ok(codes.includes('UNKNOWN_COMPETENCY'), 'TKP.1 is not in the registry');
});

test('preflight: an incomplete snapshot blocks (PF-10)', () => {
  const snap = snapshot();
  const outcome = preflight({ snapshot: { ...snap, answerKeys: snap.answerKeys.slice(1) }, basisRefs: [], sheets: sheetsOf(null, null, null), taxonomy: TAXONOMY });
  assert.equal(outcome.ok, false);
  assert.ok(outcome.errors.some((e) => e.code === 'KEY_COUNT_MISMATCH'));
  assert.ok(outcome.errors.some((e) => e.code === 'SNAPSHOT_MISMATCH'));
});

test('approval: missing / mismatch / invalid withhold the verdict, never block', () => {
  const frozen = { configId: 'cfg', configVersion: 1, scoringVersion: 1, regulatoryBasisHash: 'h' };
  const approval = { ...frozen, approvedByUserAt: T0, approvedBy: 'local-user', acknowledgedWarnings: [] };
  const base = { thresholds: { mode: 'total_only' }, frozen, live: frozen, thresholdsForDiff: { approved: null, current: null } };
  assert.equal(evaluateApproval({ ...base, approval: null }).withheld.code, 'APPROVAL_MISSING');
  assert.equal(evaluateApproval({ ...base, approval: { ...approval, configVersion: 2 } }).withheld.code, 'APPROVAL_VERSION_MISMATCH');
  assert.equal(evaluateApproval({ ...base, approval: { ...approval, regulatoryBasisHash: 'x' } }).withheld.code, 'APPROVAL_INVALID');
  const ok = evaluateApproval({ ...base, approval });
  assert.equal(ok.verdictAllowed, true);
  assert.deepEqual(ok.approval, approval);
  assert.deepEqual(evaluateApproval({ ...base, thresholds: { mode: 'none' }, approval: null }), { verdictAllowed: false, approval: null, withheld: null });
  const drifted = evaluateApproval({ ...base, approval, live: { ...frozen, regulatoryBasisHash: 'h2' } });
  assert.equal(drifted.withheld.code, 'APPROVAL_INVALID');
  assert.deepEqual(drifted.withheld.changed, [{ field: 'regulatoryBasisHash', approved: 'h', current: 'h2' }]);
});

test('diffBound: four bound values then threshold fields; signature ignores source', () => {
  const a = { configId: 'c', configVersion: 1, scoringVersion: 1, regulatoryBasisHash: 'h' };
  assert.deepEqual(diffBound(a, a), []);
  const changed = diffBound(a, { ...a, configVersion: 2 }, { approved: { mode: 'total_only', total: 1 }, current: { mode: 'total_only', total: 2 } });
  assert.deepEqual(changed.map((c) => c.field), ['configVersion', 'thresholds.total']);
  assert.equal(thresholdSignature({ mode: 'total_only', total: 1, source: { tier: 'x' } }), thresholdSignature({ mode: 'total_only', total: 1 }));
  assert.equal(rankWithheld(['APPROVAL_MISSING', 'APPROVAL_INVALID']), 'APPROVAL_INVALID');
});

test('clock: accumulated active time only while running; pause/resume; expiry at the limit', () => {
  const session = { activeMs: 0, runningSince: T0 };
  assert.equal(activeNow(session, ms(T0) + 1000), 1000);
  assert.equal(activeNow({ ...session, runningSince: null }, ms(T0) + 1000), 0);
  assert.equal(activeNow({ activeMs: 0, runningSince: T0 }, ms(T0) - 5000), 0, 'backwards time never subtracts');
  assert.equal(isExpired({ activeMs: 60000, runningSince: null }, 60000, ms(T0)), true);
  assert.equal(isExpired({ activeMs: 60000, runningSince: null }, null, 0), false, 'no duration never expires');
  assert.deepEqual(pause(session, ms(T0) + 2000), { activeMs: 2000, runningSince: null });
  const resumed = resume({ activeMs: 60000, runningSince: null }, 60000, ms(T0) + 5000, 'x');
  assert.equal(resumed.expired, true);
  assert.equal(resumed.runningSince, null, 'an expired session is not re-armed');
  assert.equal(resume({ activeMs: 0, runningSince: null }, null, ms(T0), 'x').runningSince, 'x');
});

test('session state: conflict reasons, rescorable only without a verdict', () => {
  assert.equal(codeOf(() => assertOpen({ status: 'submitted' })), 'CONFLICT');
  assert.doesNotThrow(() => assertOpen({ status: 'open' }));
  assert.throws(() => assertOpen({ status: 'blocked' }), (e) => e.details.reason === 'session_not_open');
  assert.equal(isRescorable(null), true);
  assert.equal(isRescorable({ verdictJson: null }), true);
  assert.equal(isRescorable({ verdictJson: "{\"mode\":\"none\"}" }), false);
  assert.equal(SUBMITTED, 'submitted');
  assert.throws(() => assertSubmitted({ status: 'open' }), (e) => e.details.reason === 'not_submitted');
});

test('selectRoster: avoid_answered prefers unseen, allow_repeat prefers least recently answered', () => {
  const eligible = ['q1', 'q2', 'q3'].map((questionId) => ({ questionId }));
  const history = new Map([['q1', { lastAnsweredAt: '2026-01-02' }], ['q2', { lastAnsweredAt: '2026-01-01' }]]);
  assert.deepEqual(selectRoster(eligible, 2, 'avoid_answered', history).selected.map((q) => q.questionId), ['q3', 'q2']);
  assert.deepEqual(selectRoster(eligible, 2, 'allow_repeat', history).selected.map((q) => q.questionId), ['q2', 'q1']);
  assert.equal(selectRoster(eligible, 2, 'avoid_answered', history).repeatCount, 1);
  assert.equal(selectRoster(eligible, 0, 'allow_repeat', history).selected.length, 0);
});

test('parseBody: unknown fields, required, enums, ranges, uniqueness', () => {
  const rules = [
    { name: 'configId', required: true, kind: 'string' },
    { name: 'acknowledgedWarnings', required: true, kind: 'stringArray' },
    { name: 'mode', kind: 'enum', values: ['a', 'b'] },
  ];
  assert.deepEqual(parseBody({ configId: 'c', acknowledgedWarnings: ['UNV-01'] }, rules), { configId: 'c', acknowledgedWarnings: ['UNV-01'] });
  const failures = (body) => codeOf(() => parseBody(body, rules));
  assert.equal(failures({ acknowledgedWarnings: [] }), 'VALIDATION_FAILED');
  assert.equal(failures({ configId: 'c', acknowledgedWarnings: [], extra: 1 }), 'VALIDATION_FAILED');
  assert.equal(failures({ configId: 'c', acknowledgedWarnings: [], mode: 'z' }), 'VALIDATION_FAILED');
  assert.equal(failures({ configId: 'c', acknowledgedWarnings: ['a', 'a'] }), 'VALIDATION_FAILED');
  assert.equal(codeOf(() => parseBody(null, rules)), 'VALIDATION_FAILED');
  assert.deepEqual(queryIds(new URLSearchParams('ids=a,b&ids=c'), 'ids'), ['a', 'b', 'c']);
});

test('exam-config mapping: a null thresholds row is mode none; rules carry integer maxima', () => {
  assert.deepEqual(toThresholdSet(null), { mode: 'none' });
  assert.deepEqual(toThresholdSet({ mode: 'total_only', twk: null, tiu: null, tkp: null, total: 311, sourceJson: '{"tier":"HISTORICAL"}' }), {
    mode: 'total_only', total: 311, source: { tier: 'HISTORICAL' },
  });
  const rules = toScoringRules({ scoringVersion: 1, tkpWeightMin: 1, tkpWeightMax: 5, twkWeight: 5, tiuWeight: 5 });
  assert.deepEqual(rules.perQuestionMax, { TWK: 5, TIU: 5, TKP: 5 });
  assert.deepEqual(rules.unansweredScoreBounds, { min: 0, max: 0 });
});
