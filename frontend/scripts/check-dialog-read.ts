/**
 * Regression check for BUG-010: a read the delete dialog runs must be able to say "failed" — a failure is never
 * collapsed into an empty list. The check reads `TryoutList.tsx` itself, so the behaviour cannot silently regress back
 * to `res.ok ? … : []`. `node --experimental-strip-types scripts/check-dialog-read.ts`.
 */
import { readFileSync } from 'node:fs'

const check = (cond: unknown, message: string): asserts cond => {
  if (!cond) throw new Error(`dialog read check failed: ${message}`)
}

const source = readFileSync(new URL('../src/features/tryout/TryoutList.tsx', import.meta.url), 'utf8')

check(!/setSessions\([^)]*:\s*\[\]/.test(source), 'a failed session read is not turned into an empty list')
check(source.includes('toLoad('), 'the read goes through the shared Result → Load mapper')
check(/outcome\.kind !== 'ok'/.test(source), 'the dialog has a branch for a failed read')
check(source.includes('Jumlah sesi tidak dapat dibaca'), 'a failed read says it could not be read')
check(/onClick=\{readSessions\}/.test(source), 'a failed read offers a retry')
check(/outcome\.kind === 'ok' && sessions\.outcome\.data\.length > 0/.test(source), 'the count notice renders only from a successful read')
