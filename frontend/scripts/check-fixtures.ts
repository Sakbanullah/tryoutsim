/**
 * Runnable check for the mock fixtures: `npm run fixtures`.
 * Fails loudly if any fixture breaks an invariant the real scorer guarantees.
 * Node strips the types itself; relative imports must carry their extension.
 */
import { QUESTIONS } from '../src/mock/questions.ts'
import { buildScoreResult, checkScoreResult } from '../src/mock/selfcheck.ts'
import type { Question, ThresholdEvaluation } from '../src/types/contracts.ts'

const roster: Question[] = QUESTIONS.filter((q) => q.lifecycle === 'active')

function covers(...tests: ('TWK' | 'TIU' | 'TKP')[]): ThresholdEvaluation {
  return {
    mode: 'per_subtest_and_total',
    passed: true,
    passesBySubtest: { TWK: tests.includes('TWK'), TIU: false, TKP: true },
    basisTier: 'HISTORICAL',
    basisPathway: 'CPNS',
    noticeRequired: true,
  }
}

const cases = [
  { name: 'no answers', answers: [] },
  { name: 'all answered', answers: roster.map((q) => ({ questionId: q.id, selected: 'A' })) },
  { name: 'one blank TWK/TIU', answers: roster.filter((q) => q.test !== 'TWK' || q.id !== roster.find((r) => r.test === 'TWK')!.id).map((q) => ({ questionId: q.id, selected: 'C' })) },
  { name: 'keyed answers only', answers: roster.map((q) => ({ questionId: q.id, selected: keyedOption(q) })) },
]

for (const c of cases) {
  const result = buildScoreResult({
    sessionId: 's-check',
    configId: 'skd-cpns-2026-provisional',
    configVersion: 1,
    scoringVersion: 1,
    approval: null,
    thresholds: c.name === 'keyed answers only' ? covers() : { mode: 'none' },
    roster,
    answers: c.answers,
  })
  checkScoreResult(result, roster)
  console.log(
    `ok · ${c.name.padEnd(22)} total ${result.total.earned}/${result.total.possible} · TKP correctly 0 · TWK ${result.byTest.TWK.earned}/${result.byTest.TWK.possible}`,
  )
}

console.log(`\n${cases.length} fixture cases consistent, ${roster.length} roster questions.`)

/** The option a TWK/TIU key marks correct; for TKP, the highest-weight option. */
function keyedOption(q: Question): string {
  return Object.entries(q.answerKey.optionScores).sort((a, b) => b[1] - a[1])[0][0]
}
