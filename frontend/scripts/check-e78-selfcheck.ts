import { registerHooks } from 'node:module'

// Same loader shim as check-mock-routes.ts: Vite resolves extensionless imports, Node's type stripping
// does not, and the mock reads . Nothing under src/mock changes for this script.
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
    return { ...result, source: String(result.source).replace('import.meta.env.DEV', 'false') }
  },
})

const { mockClient } = await import('../src/mock/mockClient.ts')

/**
 * Self-check for the E78 review batch (`reviewQuestions`) against the mock. Asserts the refusals of
 * API_SPECIFICATION §7.7 (uniform 400 for any bad id, 409 before scoring), the frozen explainability
 * split, and a TKP tie with one reason per option. `npm run fixtures` style: run with
 * `node --experimental-strip-types scripts/check-e78-selfcheck.ts`.
 */
const assert = (cond: boolean, label: string) => {
  if (!cond) throw new Error(`FAIL · ${label}`)
  console.log(`ok · ${label}`)
}

const started = await mockClient.startSession({ packageId: 'pkg-tryout-skd-full', mode: 'tryout' })
assert(started.ok, 'session starts')
const sessionId = started.ok ? started.data.sessionId : ''
const detail = await mockClient.session(sessionId)
assert(detail.ok, 'session readable')
const ids = detail.ok ? detail.data.questions.map((q) => q.questionId) : []

const beforeSubmit = await mockClient.reviewQuestions(sessionId, ids)
assert(!beforeSubmit.ok, 'refused while the session is open')
assert(!beforeSubmit.ok && beforeSubmit.failure.status === 409, '409 before submit')

await mockClient.submitSession(sessionId, { answers: [{ questionId: ids[0], selectedOption: 'A' }] })

const good = await mockClient.reviewQuestions(sessionId, ids)
assert(good.ok && good.data.questions.length === ids.length, 'one response per requested id')
if (good.ok) {
  assert(good.data.sessionId === sessionId, 'body carries its session id')
  for (const q of good.data.questions) {
    assert(q.latestContentVersion === q.frozenContentVersion, `${q.questionId}: frozen version equals latest`)
    if (q.justificationsSource !== 'none') {
      assert(
        q.optionJustifications !== null && Object.keys(q.optionJustifications).length === Object.keys(q.optionScores).length,
        `${q.questionId}: one reason per option`,
      )
    }
    if (q.test === 'TKP') assert(q.keyedOption === null, `${q.questionId}: TKP has no keyed option`)
    if (q.test !== 'TKP' && q.optionScores[q.keyedOption ?? ''] !== undefined) {
      assert(q.optionScores[q.keyedOption!] === q.maxScore, `${q.questionId}: keyed option at max`)
    }
  }
  const tkp = good.data.questions.find((q) => q.test === 'TKP')
  assert(tkp !== undefined && tkp.justificationsSource === 'frozen', 'TKP reasons come from the frozen key')
  const weights = tkp ? Object.values(tkp.optionScores) : []
  const max = tkp ? Math.max(...Object.values(tkp.optionScores)) : 0
  assert(weights.filter((w) => w === max).length >= 2, 'TKP fixture carries a tie at the maximum')
}

const outOfRoster = await mockClient.reviewQuestions(sessionId, ['q-not-in-roster'])
assert(!outOfRoster.ok && outOfRoster.failure.status === 400, 'unknown id refused with 400')
const duplicated = await mockClient.reviewQuestions(sessionId, [ids[0], ids[0]])
assert(!duplicated.ok && duplicated.failure.status === 400, 'duplicate id refused with 400')
const tooMany = await mockClient.reviewQuestions(sessionId, [...ids, ...ids].slice(0, 21))
assert(!tooMany.ok && tooMany.failure.status === 400, 'more than 20 ids refused with 400')
