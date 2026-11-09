/**
 * Runnable check for the mock's route behaviour: `npm run fixtures` (runs after check-fixtures.ts).
 *
 * The app imports modules without extensions (vite resolves them); Node's type stripping does not, and
 * it has no `import.meta.env`. One loader hook fixes both for this run only. Additive: nothing in
 * src/mock changes to satisfy the script.
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
    if (!url.endsWith('/mock/mockClient.ts')) return result
    const source = String(result.source).replace('import.meta.env.DEV', 'false')
    return { ...result, source }
  },
})

const { mockClient, __mockState } = await import('../src/mock/mockClient.ts')

const check = (cond: unknown, message: string): asserts cond => {
  if (!cond) throw new Error(`mock route check failed: ${message}`)
}
const reasonOf = (r: Awaited<ReturnType<typeof mockClient.bulkArchive>>, reason: string) =>
  check(!r.ok && r.failure.code === 'CONFLICT' && r.failure.reason === reason, `expected 409 ${reason}`)

// startSession: missing package, unavailable package, startable package.
check(!(await mockClient.startSession({ packageId: 'nope', mode: 'tryout' })).ok, 'unknown package is 404')
reasonOf(await mockClient.startSession({ packageId: 'pkg-tryout-twk', mode: 'tryout' }), 'no_eligible_stock')
const started = await mockClient.startSession({ packageId: 'pkg-drill-numerik', mode: 'latihan' })
check(started.ok, 'drill package starts')

// A provisional session is startable; it scores with `approval: null` (the withheld verdict) until approved.
if (started.ok) {
  const scored = await mockClient.submitSession(started.data.sessionId, { answers: [] })
  check(scored.ok, 'provisional submit scores without approval')
  const result = await mockClient.sessionResult(started.data.sessionId)
  check(result.ok && result.data.approval === null, 'verdict withheld without approval')
  __mockState.setApproval({ configId: 'skd-cpns-2026-provisional', configVersion: 1, scoringVersion: 1, regulatoryBasisHash: 'x', approvedByUserAt: '', approvedBy: '', acknowledgedWarnings: [] })
  const verdict = await mockClient.sessionResult(started.data.sessionId)
  check(verdict.ok && verdict.data.approval !== null, 'a matching approval is carried into the result')
  __mockState.setApproval(null)
}

// bulkArchive: one bad id leaves every question untouched.
const all = await mockClient.questions({})
check(all.ok, 'questions list')
const firstActive = all.data.find((q) => q.lifecycle === 'active')!
reasonOf(await mockClient.bulkArchive([firstActive.id, 'missing-id']), 'illegal_transition')
const after = await mockClient.question(firstActive.id)
check(after.ok && after.data.lifecycle === 'active', 'nothing archived on failure')

// A critical report quarantines; sampling needs non-empty findings.
check((await mockClient.reportQuestion(firstActive.id, { severity: 'critical', category: 'x', note: 'uji' })).ok, 'report accepted')
const quarantined = await mockClient.question(firstActive.id)
check(quarantined.ok && quarantined.data.lifecycle === 'quarantined', 'critical report quarantines')
const sample = await mockClient.recordSample('bat-02', { outcome: 'findings', findings: [] })
check(!sample.ok && sample.failure.code === 'VALIDATION_FAILED', 'empty findings rejected')
const sampled = await mockClient.recordSample('bat-02', { outcome: 'clean', findings: [] })
check(sampled.ok && sampled.data.sampleStatus === 'sampled', 'clean sample marks sampled')

// Providers: empty key rejected; the only provider cannot be deleted.
const badKey = await mockClient.createProvider({ preset: 'custom', name: 'x', baseUrl: 'http://x', key: ' ', timeoutMs: 1, retries: 0 })
check(!badKey.ok && badKey.failure.code === 'VALIDATION_FAILED', 'empty key rejected')
reasonOf(await mockClient.deleteProvider('local-mock'), 'last_provider')

// Trends below three points are insufficient_data; a seeded history row is not deletable.
const trend = await mockClient.trends('TKP.PELAYANAN_PUBLIK')
check(trend.ok && trend.data.state === 'insufficient_data', 'fewer than 3 points is insufficient_data')
check((await mockClient.deleteSession('ses-demo-01')).ok === false, 'seed session is not deletable')

console.log('ok · mock route checks passed')
