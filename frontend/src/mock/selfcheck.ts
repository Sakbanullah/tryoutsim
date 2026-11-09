/**
 * Mock self-check — the one runnable assertion behind this folder (`npm run fixtures`).
 *
 * Why it exists: the mock must hand back an INTERNALLY CONSISTENT `ScoreResult` while the UI computes
 * nothing (FRONTEND_MOCK_DATA_STRATEGY §4). This file builds that result and asserts the invariants the
 * real scorer guarantees, so a broken fixture is caught before a screen renders it.
 *
 * It is NOT a scorer. It never ships: the app imports only `buildScoreResult`, which the mock calls.
 * When the backend exists (Gate 3) this file and the scorer-lite go with the mock layer.
 */
import type {
  AnswersPatch,
  Bucket,
  ProvisionalApproval,
  Question,
  QuestionScore,
  ScoreResult,
  Test,
  ThresholdEvaluation,
} from '../types/contracts'

export type FixtureAnswer = { questionId: string; selected: string | null }

export type ScoreRequest = {
  sessionId: string
  configId: string
  configVersion: number
  scoringVersion: number
  approval: ProvisionalApproval | null
  thresholds: ThresholdEvaluation
  roster: Question[]
  answers: FixtureAnswer[]
}

/**
 * Builds a `ScoreResult` from a roster and answers, following SCORING_METHODOLOGY §2.2 exactly:
 * one row per roster item; `correct` is `earned === maxScore` for TWK/TIU and `null` for TKP and for
 * blanks; TKP `correctCount` is always 0; `possible` sums each question's `maxScore`.
 */
export function buildScoreResult(req: ScoreRequest): ScoreResult {
  const selectedBy = new Map(req.answers.map((a) => [a.questionId, a.selected]))
  const byQuestion: QuestionScore[] = req.roster.map((q) => {
    const selected = selectedBy.get(q.id) ?? null
    const earned = selected === null ? q.answerKey.unansweredScore : (q.answerKey.optionScores[selected] ?? 0)
    return {
      questionId: q.id,
      test: q.test,
      competencyId: q.competencyId,
      earned,
      maxScore: q.answerKey.maxScore,
      selected,
      correct: q.test === 'TKP' || selected === null ? null : earned === q.answerKey.maxScore,
    }
  })

  const bucket = (rows: QuestionScore[]): Bucket => ({
    earned: rows.reduce((s, r) => s + r.earned, 0),
    possible: rows.reduce((s, r) => s + r.maxScore, 0),
    answeredCount: rows.filter((r) => r.selected !== null).length,
    correctCount: rows.filter((r) => r.test !== 'TKP' && r.correct === true).length,
  })

  const byTest = {} as Record<Test, Bucket>
  for (const t of ['TWK', 'TIU', 'TKP'] as const) byTest[t] = bucket(byQuestion.filter((r) => r.test === t))

  const competencyIds = [...new Set(byQuestion.map((r) => r.competencyId))]
  const byCompetency = Object.fromEntries(
    competencyIds.map((id) => [id, bucket(byQuestion.filter((r) => r.competencyId === id))]),
  )

  return {
    sessionId: req.sessionId,
    configId: req.configId,
    configVersion: req.configVersion,
    scoringVersion: req.scoringVersion,
    snapshotVersion: `snap-${req.sessionId}`,
    approval: req.approval,
    total: bucket(byQuestion),
    byTest,
    byCompetency,
    byQuestion,
    thresholds: req.thresholds,
  }
}

const isInt = (n: number): boolean => Number.isInteger(n)

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`fixture invariant failed: ${message}`)
}

/**
 * Checks a built result against the guarantees the real scorer makes.
 * `roster` must be the exact question list the session was created with.
 */
export function checkScoreResult(result: ScoreResult, roster: Question[]): void {
  assert(result.byQuestion.length === roster.length, 'one byQuestion row per roster question')
  assert(
    result.byQuestion.every((r, i) => r.questionId === roster[i].id),
    'byQuestion keeps roster order and identity',
  )

  for (const r of result.byQuestion) {
    assert(isInt(r.earned) && isInt(r.maxScore), `integer points on ${r.questionId}`)
    assert(r.earned >= 0 && r.earned <= r.maxScore, `earned ≤ maxScore on ${r.questionId}`)
    if (r.test === 'TKP') assert(r.correct === null, `TKP ${r.questionId} has no correct flag`)
    if (r.selected === null) assert(r.correct === null, `blank ${r.questionId} is not "salah"`)
    if (r.test !== 'TKP' && r.selected !== null) {
      assert(r.correct === (r.earned === r.maxScore), `TWK/TIU correct ⇔ earned === maxScore`)
    }
  }

  for (const t of ['TWK', 'TIU', 'TKP'] as const) {
    const b = result.byTest[t]
    assert(isInt(b.earned) && isInt(b.possible), `${t} bucket is integer`)
    assert(b.earned <= b.possible, `${t} earned ≤ possible`)
    assert(b.correctCount <= b.answeredCount, `${t} correctCount ≤ answeredCount`)
    if (t === 'TKP') assert(b.correctCount === 0, 'TKP correctCount is always 0')
  }

  const sum = (k: keyof Bucket) =>
    ['TWK', 'TIU', 'TKP'].reduce((s, t) => s + result.byTest[t as Test][k], 0)
  assert(result.total.earned === sum('earned'), 'total.earned = sum of byTest')
  assert(result.total.possible === sum('possible'), 'total.possible = sum of byTest')
  assert(result.total.answeredCount === sum('answeredCount'), 'total.answeredCount = sum of byTest')

  if (result.thresholds.mode === 'none') {
    assert(!('passed' in result.thresholds), 'mode none carries no verdict')
  }
}

/** Answers as the submit route would receive them, in roster order. */
export function patchToAnswers(patch: AnswersPatch): FixtureAnswer[] {
  return patch.answers.map((a) => ({ questionId: a.questionId, selected: a.selectedOption }))
}
