/**
 * Runnable regression checks for the HTTP client's two fixed defects: `npm run fixtures`.
 *
 * Bug 1 — module initialisation order. `httpClient` is built at import time; every constant `buildClient()` closes
 * over (`BASE`, `LOG_TAG`, `notAvailable`) must already be initialised, or the whole app renders blank. Importing the
 * module is the assertion: a temporal-dead-zone error would throw here.
 *
 * Bug 2 — an unavailable route is not a network error. A route `API_ENDPOINTS` documents but the backend does not
 * serve must map to `UNSUPPORTED`/`notImplemented` (no retry), while a genuine transport failure stays `NETWORK`.
 *
 * Same loader hook as check-mock-routes.ts: vite resolves extensionless imports and provides `import.meta.env`,
 * Node's type stripping does neither.
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
    if (!url.endsWith('/data/httpClient.ts')) return result
    return { ...result, source: String(result.source).replaceAll('import.meta.env.DEV', 'false') }
  },
})

const check = (cond: unknown, message: string): asserts cond => {
  if (!cond) throw new Error(`http client check failed: ${message}`)
}

// Bug 1: the import itself must not throw (TDZ on LOG_TAG produced a blank screen).
const { httpClient, __httpMapping } = await import('../src/data/httpClient.ts')
const { toOutcome } = await import('../src/data/errors.ts')

check(httpClient && typeof httpClient.bootstrap === 'function', 'the client is constructed at import time')

// A backend route the client knows is absent.
const missing = await httpClient.analytics()
check(!missing.ok, 'an unavailable route is not a success')
if (!missing.ok) {
  check(missing.failure.status === 0, 'unavailable stays a status-0 failure')
  check(missing.failure.code === 'UNSUPPORTED', `unavailable carries UNSUPPORTED, got ${missing.failure.code}`)
  const outcome = toOutcome(missing.failure)
  check(outcome.kind === 'notImplemented', `unavailable maps to notImplemented, got ${outcome.kind}`)
}

// A genuine transport failure must NOT be reported as "not implemented".
const network = toOutcome({ status: 0, code: 'NETWORK' as const, message: 'fetch failed' })
check(network.kind === 'unavailable', `a network failure maps to unavailable, got ${network.kind}`)

// The mapping seam still exposes the pure adapters the other checks use.
check(typeof __httpMapping.toScoreResult === 'function', 'the mapping seam is exported')

console.log('ok · httpClient imports without a temporal-dead-zone error (Bug 1)')
console.log('ok · an absent backend route maps to notImplemented, not a network error (Bug 2)')
console.log('ok · a real transport failure still maps to unavailable, with retry')
