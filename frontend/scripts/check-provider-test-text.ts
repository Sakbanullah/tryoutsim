/**
 * Regression check for BUG-007: a failed connection test names its cause instead of one generic sentence, and never
 * reads as a success. `node --experimental-strip-types scripts/check-provider-test-text.ts`.
 */
import { providerTestText } from '../src/features/lainnya/providerTestText.ts'

const check = (cond: unknown, message: string): asserts cond => {
  if (!cond) throw new Error(`provider test text check failed: ${message}`)
}

const auth = providerTestText({ ok: false, latencyMs: 12, code: 'PROVIDER_AUTH_FAILED' })
check(!auth.ok && /API/.test(auth.text), 'a rejected key says the key was rejected')

const timeout = providerTestText({ ok: false, latencyMs: 1000, code: 'PROVIDER_TIMEOUT' })
check(!timeout.ok && /waktu/.test(timeout.text), 'a timeout says it timed out')

const limited = providerTestText({ ok: false, latencyMs: 40, code: 'RATE_LIMITED' })
check(!limited.ok && /membatasi/.test(limited.text), 'a rate limit is named')

check(auth.text !== timeout.text && timeout.text !== limited.text, 'the conditions are distinguishable')

const unknown = providerTestText({ ok: false, latencyMs: 3, code: 'SOMETHING_NEW' })
const absent = providerTestText({ ok: false, latencyMs: 3 })
check(!unknown.ok && unknown.text === absent.text, 'a code this client does not know keeps the generic sentence')

const green = providerTestText({ ok: true, latencyMs: 412 })
check(green.ok && /Terhubung \(412 ms\)/.test(green.text), 'a successful test keeps its latency sentence')
