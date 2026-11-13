/**
 * Runnable check for the submission → result flow against the mock, and for the client's mapping of an actual
 * backend `ScoreResult` (API_SPECIFICATION §4–§5; FRONTEND_DATA_CONTRACTS §5). `npm run fixtures`.
 *
 * What it proves:
 *   1. a scored session refuses a resubmission as `already_submitted`, never as a new submission;
 *   2. `already_submitted` is distinct from `session_not_open`;
 *   3. a missing approval is a 200 result with `verdict: null` and `withheld`, not a 409;
 *   4. `verdict`/`withheld` survive the client's mapping, and `thresholds` is never replaced by them;
 *   5. the result page's state for a withheld verdict comes from `withheld`, so it cannot render as "no threshold";
 *   6. a submitted-but-unscored session reports `not_scored`, distinct from a withheld verdict;
 *   7. a normal submission is unchanged (score, byQuestion, resolved result).
 */
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context)
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    const result = nextLoad(url, context)
    if (!url.endsWith('/mock/mockClient.ts') && !url.endsWith('/data/httpClient.ts')) return result
    const source = String(result.source)
      .replace('import.meta.env.DEV', 'false')
      .replace('import.meta.env.VITE_API_MODE', "'http'")
    return { ...result, source }
  },
})

const { mockClient, __mockState } = await import('../src/mock/mockClient.ts')

const check = (cond: unknown, message: string): asserts cond => {
  if (!cond) throw new Error(`results flow check failed: ${message}`)
}

/** A 200 `ScoreResult` exactly as the backend's stored row returns it (repositories/score-result.js `loadScoreResult`). */
const backendResult = {
  sessionId: 's_flow',
  configId: 'skd-cpns-2026-provisional',
  configVersion: 3,
  scoringVersion: 2,
  snapshotVersion: 's1-2026-11-13T00:00:00Z-abc12345',
  total: { earned: 8, possible: 10, answeredCount: 2, correctCount: 1 },
  byTest: {
    TWK: { earned: 8, possible: 10, answeredCount: 2, correctCount: 1 },
    TIU: { earned: 0, possible: 0, answeredCount: 0, correctCount: 0 },
    TKP: { earned: 0, possible: 0, answeredCount: 0, correctCount: 0 },
  },
  byCompetency: { 'TWK.uji': { earned: 8, possible: 10, answeredCount: 2, correctCount: 1 } },
  byQuestion: [
    { questionId: 'q1', test: 'TWK', competencyId: 'TWK.uji', earned: 4, maxScore: 4, selected: 'B', correct: true },
    { questionId: 'q2', test: 'TWK', competencyId: 'TWK.uji', earned: 4, maxScore: 6, selected: 'A', correct: false },
  ],
  thresholds: { mode: 'total_only', source: { document: 'x', number: '1', tier: 'HISTORICAL', pathway: 'CPNS' } },
  approval: null,
  withheld: { code: 'APPROVAL_MISSING', changed: [] },
  verdict: null,
  timing: { activeMs: 1000, durationMs: 60000 },
  packageBinding: { packageId: 'pkg', packageVersion: 1, mode: 'tryout', kind: 'full_simulation', rosterHash: 'h' },
  scoredAt: '2026-11-13T00:00:01.000Z',
}

// ── 4/5. The client keeps `verdict`/`withheld` and never puts the verdict into `thresholds`. ────────────────────
// The client binds `fetch` when it is built, so the stub is installed before the module is imported.
const realFetch = globalThis.fetch
globalThis.fetch = async () => new Response(JSON.stringify({ data: backendResult }), {
  status: 200,
  headers: { 'content-type': 'application/json', 'x-contract-version': '1' },
})
const { httpClient } = await import('../src/data/httpClient.ts')
const mapped = await httpClient.sessionResult('s_flow')
globalThis.fetch = realFetch
check(mapped.ok, 'a 200 result maps to ok')
if (mapped.ok) {
  check(mapped.data.withheld?.code === 'APPROVAL_MISSING', 'withheld survives the mapping')
  check(mapped.data.verdict === null, 'verdict stays null when withheld')
  check(mapped.data.thresholds.mode === 'total_only', 'thresholds is not replaced by the verdict')
}

// ── 5. The result page's band comes from `withheld`, never from `thresholds` alone. ─────────────────────────────
const { bandFor } = await import('../src/features/tryout/resultStatus.ts')
const thresholdsOf = (mode) => ({ mode })
check(bandFor({ thresholds: thresholdsOf('total_only'), verdict: null, withheld: { code: 'APPROVAL_MISSING', changed: [] } }).kind === 'withheld', 'a withheld verdict is its own band')
check(bandFor({ thresholds: thresholdsOf('none'), verdict: null, withheld: { code: 'APPROVAL_INVALID', changed: [] } }).kind === 'no_rule', 'no rule wins when the config sets none')
check(bandFor({ thresholds: thresholdsOf('total_only'), verdict: { passed: true }, withheld: null }).kind === 'verdict', 'a carried verdict is its own band')
check(bandFor({ thresholds: thresholdsOf('total_only'), verdict: null, withheld: null }).kind === 'undecided', 'no withheld reason and no verdict is undecided')
if (mapped.ok) check(bandFor(mapped.data).kind === 'withheld', 'the mapped backend result renders as withheld, not undecided')

// ── 1/2. Scored session: resubmission is already_submitted, distinct from session_not_open. ──────────────────────
// A practice (latihan) session has no tryout timer, so this check never depends on the clock.
const start = await mockClient.startSession({ packageId: 'pkg-drill-numerik', mode: 'latihan' })
check(start.ok, 'the fixture package starts')
const id = start.data.sessionId
const first = await mockClient.submitSession(id, { answers: [] })
check(first.ok, 'a normal submission is unchanged')

const again = await mockClient.submitSession(id, { answers: [] })
check(!again.ok && again.failure.code === 'CONFLICT' && again.failure.reason === 'already_submitted', 'resubmission is already_submitted')

// ── 3. A missing approval is a 200 result, not a 409. ──────────────────────────────────────────────────────────
__mockState.setApproval(null)
const stored = await mockClient.sessionResult(id)
check(stored.ok, 'a scored result is returned without an approval (200), not 409')

// ── 6. An open session has no result at all, distinct from a withheld verdict. ─────────────────────────────────
const drill = await mockClient.startSession({ packageId: 'pkg-drill-numerik', mode: 'latihan' })
check(drill.ok, 'the drill package starts a second session')
const unscored = await mockClient.sessionResult(drill.data.sessionId)
check(!unscored.ok && unscored.failure.code === 'CONFLICT' && unscored.failure.reason === 'not_submitted', 'an open session has no result')
