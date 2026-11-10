/**
 * The pure scoring function (SCORING_METHODOLOGY §4, §5.2, §5.4).
 *
 * `scoreSession` reads only its argument — the frozen snapshot (normalised to the plain shape below) and the
 * answer sheets — never a clock, the network, the live bank or the database. Integers only; iteration is over
 * the roster in snapshot order. Callers must run `preflight` first; the guards here are defence in depth and
 * throw a plain `Error` (they are unreachable on a pre-flighted session, §6.2 "one origin per code").
 *
 * Normalised snapshot (derived from `session_snapshot` by the session repository):
 *   { snapshotVersion, configId, configVersion, scoringVersion, state, pathway, examYear,
 *     scoringRules: { scoringVersion, tkpWeightRange: [min,max], perQuestionMax: {TWK,TIU,TKP},
 *                     unansweredScoreBounds: {min,max}, unansweredRule },
 *     thresholds: ThresholdSet | null,        // null ≙ {mode:'none'}
 *     questions: [{questionId, test, competencyId, optionKeys, maxScore?}],
 *     answerKeys: [{questionId, scoringVersion, optionScores, unansweredScore, maxScore}] }
 * `ThresholdSet.source` is omitted: the basis tier/pathway live in the snapshot's `state`/`pathway`
 * (pre-flight PF-12 checks the basis itself).
 */

export const TESTS = Object.freeze(['TWK', 'TIU', 'TKP']);

/** Empty bucket; every bucket is accumulated in one pass (§2.2). */
function bucket() {
  return { earned: 0, possible: 0, answeredCount: 0, correctCount: 0 };
}

/**
 * Score one answer against its frozen key (§4). `sheets` is keyed by questionId.
 * @param {object} key frozen AnswerKey
 * @param {{selected: string | null}} sheet
 * @param {number} scoringVersion the snapshot's scoringVersion
 * @returns {number}
 */
export function scoreQuestion(key, sheet, scoringVersion) {
  if (key.scoringVersion !== scoringVersion) throw new Error('SCORING_VERSION_MISMATCH');
  if (sheet.selected === null) return key.unansweredScore;
  const score = key.optionScores[sheet.selected];
  if (score === undefined) throw new Error('NO_SCORE_FOR_OPTION');
  return score;
}

/**
 * Evaluate thresholds (§5.1 presence, §5.2 `>=`). Returns `{mode:'none'}` when the snapshot carries none.
 * Pre-flight PF-09 has already rejected a malformed set, so a missing field here throws rather than defaulting.
 * `noticeRequired` is true whenever the config is not `official_verified` for its own pathway (§5.4).
 * @param {object} total
 * @param {Record<string, object>} byTest
 * @param {{mode: string, TWK?: number, TIU?: number, TKP?: number, total?: number} | null} thresholds
 * @param {{state: string, pathway: string}} config
 * @returns {object} ThresholdEvaluation
 */
export function evaluateThresholds(total, byTest, thresholds, config) {
  if (!thresholds || thresholds.mode === 'none') return { mode: 'none' };

  const perSubtest = (field) => {
    if (byTest[field].earned === undefined || thresholds[field] === undefined) throw new Error('THRESHOLD_FIELD_MISSING');
    return byTest[field].earned >= thresholds[field];
  };
  const evaluation = {
    mode: thresholds.mode,
    passed: false,
    // ponytail: the tier of the threshold's basis is not carried (ThresholdSet.source is not frozen);
    // the config's own state is used as a stand-in. Carry `source` into the snapshot when a tier-dependent
    // rule (not just the notice) needs it.
    basisTier: config.state === 'official_verified' ? 'VERIFIED-2026' : 'HISTORICAL',
    basisPathway: config.pathway,
    noticeRequired: config.state !== 'official_verified',
  };

  if (thresholds.mode === 'per_subtest_and_total') {
    evaluation.passesBySubtest = { TWK: perSubtest('TWK'), TIU: perSubtest('TIU'), TKP: perSubtest('TKP') };
    evaluation.passed = evaluation.passesBySubtest.TWK && evaluation.passesBySubtest.TIU
      && evaluation.passesBySubtest.TKP && total.earned >= requireThreshold(thresholds, 'total');
  } else if (thresholds.mode === 'per_subtest_only') {
    evaluation.passesBySubtest = { TWK: perSubtest('TWK'), TIU: perSubtest('TIU'), TKP: perSubtest('TKP') };
    evaluation.passed = evaluation.passesBySubtest.TWK && evaluation.passesBySubtest.TIU && evaluation.passesBySubtest.TKP;
  } else if (thresholds.mode === 'total_only') {
    evaluation.passed = total.earned >= requireThreshold(thresholds, 'total');
  } else {
    throw new Error('THRESHOLD_MODE_UNKNOWN');
  }
  return evaluation;
}

/** Read a threshold field that the mode requires; throw instead of treating absence as 0 (§5.1). */
function requireThreshold(thresholds, field) {
  if (thresholds[field] === undefined) throw new Error('THRESHOLD_FIELD_MISSING');
  return thresholds[field];
}

/**
 * Score a pre-flighted session (§4). Deterministic: the same input returns a deep-equal result.
 * @param {object} input
 * @param {{id: string}} input.session
 * @param {object} input.snapshot normalised snapshot (see file header)
 * @param {Map<string, {questionId: string, selected: string | null}>} input.sheets by questionId
 * @returns {object} ScoreResult (§2.2) without `approval` (the caller adds it when a verdict is emitted)
 */
export function scoreSession({ session, snapshot, sheets }) {
  const keys = new Map(snapshot.answerKeys.map((key) => [key.questionId, key]));
  const total = bucket();
  const byTest = { TWK: bucket(), TIU: bucket(), TKP: bucket() };
  const byCompetency = {};
  const byQuestion = [];

  for (const question of snapshot.questions) {
    const key = keys.get(question.questionId);
    const sheet = sheets.get(question.questionId);
    if (!key || !sheet) throw new Error('PREFLIGHT_NOT_RUN');

    const earned = scoreQuestion(key, sheet, snapshot.scoringVersion);
    const correct = question.test === 'TKP' || sheet.selected === null ? null : earned === key.maxScore;

    for (const target of [total, byTest[question.test], (byCompetency[question.competencyId] ??= bucket())]) {
      target.earned += earned;
      target.possible += key.maxScore;
      if (sheet.selected !== null) target.answeredCount += 1;
      if (correct === true) target.correctCount += 1;
    }

    byQuestion.push({
      questionId: question.questionId,
      test: question.test,
      competencyId: question.competencyId,
      earned,
      maxScore: key.maxScore,
      selected: sheet.selected,
      correct,
    });
  }

  return {
    sessionId: session.id,
    configId: snapshot.configId,
    configVersion: snapshot.configVersion,
    scoringVersion: snapshot.scoringVersion,
    snapshotVersion: snapshot.snapshotVersion,
    total,
    byTest,
    byCompetency,
    byQuestion,
    thresholds: evaluateThresholds(total, byTest, snapshot.thresholds, snapshot),
  };
}
