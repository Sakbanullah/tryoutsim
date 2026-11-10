/**
 * The session clock: accumulated active time (SCORING_METHODOLOGY §8.1, BUSINESS_RULES BR-S6).
 *
 * Pure arithmetic over stored values; the caller supplies "now" and the ISO formatting. Active time grows only
 * between `runningSince` and now while the session is open; nothing here reads a clock.
 *
 *   start   — new session: active 0, running since now, duration from the snapshot (null = no countdown)
 *   pause   — fold the running interval into `activeMs`, clear `runningSince`
 *   resume  — re-arm the clock; if the stored active time already reached the duration the session is expired
 *   save    — §8.1 rule 2: an autosave stores the active time and clears `runningSince` in the same write
 *   submit  — fold the final interval; the stored active time is evidence only, never a scoring input
 */

/**
 * Milliseconds elapsed between two ISO timestamps; 0 when the clock is stopped or time went backwards.
 * @param {string | null} since
 * @param {number} nowMs
 * @returns {number}
 */
export function elapsedSince(since, nowMs) {
  if (since === null) return 0;
  const started = Date.parse(since);
  return Number.isFinite(started) ? Math.max(0, nowMs - started) : 0;
}

/**
 * The active time a session has right now: stored value plus any interval still running.
 * @param {{activeMs: number, runningSince: string | null}} clock
 * @param {number} [nowMs] the caller's now; defaults to the process clock
 * @returns {number}
 */
export function activeNow(clock, nowMs = Date.now()) {
  return clock.activeMs + elapsedSince(clock.runningSince, nowMs);
}

/**
 * True when the session has reached its duration; `durationMs === null` never expires (§8.1 rule 6).
 * @param {{activeMs: number, runningSince: string | null}} clock
 * @param {number | null} durationMs
 * @param {number} [nowMs] the caller's now; defaults to the process clock
 * @returns {boolean}
 */
export function isExpired(clock, durationMs, nowMs = Date.now()) {
  return durationMs !== null && activeNow(clock, nowMs) >= durationMs;
}

/**
 * §8.1 outcome of asking to write answers. Expiry is decided only on resume, and `PATCH …/answers` answers
 * `409 session_expired` once the accumulated time is at the limit (API_SPECIFICATION §7.5); §8.1 rule 4's
 * automatic submit-on-expiry has no server trigger defined, so the client submits.
 * @param {{status: string}} session
 * @param {number | null} durationMs
 * @param {number} nowMs
 * @returns {{allowed: boolean, expired: boolean}}
 */
export function assessWrite(session, durationMs, nowMs) {
  return { allowed: session.status === 'open', expired: isExpired(session, durationMs, nowMs) };
}

/**
 * The share of the session's active time a question carries: `savedActiveMs - previously spent on that
 * question`, clamped at 0. A deliberate simplification — not the per-question stopwatch of §8.1 rule 8.
 * @param {string | null} previousElapsedMs the answer row's stored `elapsedActiveMs`, if any
 * @param {number} savedActiveMs active time stored by this write
 * @returns {number}
 */
export function questionElapsed(previousElapsedMs, savedActiveMs) {
  return Math.max(0, savedActiveMs - (previousElapsedMs ?? 0));
}

/**
 * Start a session clock.
 * @param {{durationMs: number | null}} timing the frozen `snapshot.timing`
 * @param {string} nowIso
 * @returns {{activeMs: number, runningSince: string, durationMs: number | null}}
 */
export function startClock(timing, nowIso) {
  return { activeMs: 0, runningSince: nowIso, durationMs: timing.durationMs ?? null };
}

/**
 * Fold the running interval and stop the clock.
 * @param {{activeMs: number, runningSince: string | null}} clock
 * @param {number} nowMs
 * @returns {{activeMs: number, runningSince: null}}
 */
export function pause(clock, nowMs) {
  return { activeMs: activeNow(clock, nowMs), runningSince: null };
}

/**
 * Resume an open session or refuse (rules 3 and 4). On expiry the reported active time is capped at the
 * duration, so the evidence never exceeds the countdown the user was given.
 * @param {{activeMs: number, runningSince: string | null}} clock
 * @param {number | null} durationMs
 * @param {number} nowMs
 * @param {string} nowIso
 * @returns {{allowed: boolean, expired: boolean, activeMs: number, runningSince: string | null}}
 */
export function resume(clock, durationMs, nowMs, nowIso) {
  if (isExpired(clock, durationMs, nowMs)) {
    return { allowed: false, expired: true, activeMs: durationMs, runningSince: null };
  }
  return { allowed: true, expired: false, activeMs: activeNow(clock, nowMs), runningSince: nowIso };
}
