/**
 * Regression check for BUG-006: a save pauses the session, so the clock must keep advancing after the runner
 * resumes it, and must stay honestly paused with no resume. `node --experimental-strip-types scripts/check-session-clock.ts`.
 */
import { clockDisplay } from '../src/features/tryout/sessionClock.ts'

const check = (cond: unknown, message: string): asserts cond => {
  if (!cond) throw new Error(`session clock check failed: ${message}`)
}

const T0 = Date.parse('2026-11-13T01:00:00.000Z')
const MIN = 60_000
const paused = { durationMs: 90 * MIN, activeMs: 10 * MIN, runningSince: null, expired: false }

// After an autosave the payload is paused; a successful resume keeps the clock running from the server's activeMs.
const woken = clockDisplay(paused, { activeMs: 10 * MIN, runningSince: new Date(T0).toISOString(), at: T0 }, T0 + 30_000)
check(woken.running, 'a resumed session runs after an autosave')
check(!woken.text.includes('dijeda'), `a resumed session is not shown as paused: ${woken.text}`)
check(woken.text === 'Sisa waktu 1:19:30', `remaining counts down: ${woken.text}`)
const later = clockDisplay(paused, { activeMs: 10 * MIN, runningSince: new Date(T0).toISOString(), at: T0 }, T0 + 61_000)
check(later.activeMs > woken.activeMs, 'active time advances between ticks')

// No resume (or an expired one): the server said paused, and the clock says so rather than inventing time.
const stuck = clockDisplay(paused, null, T0 + 30_000)
check(!stuck.running && stuck.text.includes('dijeda'), `paused without a resume: ${stuck.text}`)
check(stuck.activeMs === paused.activeMs, 'paused active time is the server value')
check(!clockDisplay({ ...paused, expired: true }, { activeMs: 10 * MIN, runningSince: new Date(T0).toISOString(), at: T0 }, T0).running, 'an expired session does not run')

// A payload that already runs needs no resume.
check(clockDisplay({ ...paused, runningSince: new Date(T0).toISOString() }, null, T0).running, 'a running payload runs')
