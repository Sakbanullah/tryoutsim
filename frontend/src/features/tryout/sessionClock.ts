/**
 * The runner clock as pure arithmetic, so it can be checked without a browser (SCORING_METHODOLOGY §8.1 rules 2–3:
 * saving an answer pauses the session, opening an `open` session resumes it).
 */

/** `mm:ss` for a duration under an hour, `h:mm:ss` otherwise. */
export function clockText(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** What the clock strip shows. `activeMs` is the server's value plus the local advance only while running. */
export type ClockDisplay = { running: boolean; activeMs: number; text: string }

/**
 * A save pauses the session, so `detail.runningSince` alone would freeze the display after every autosave. A
 * successful `POST /sessions/:id/resume` re-arms it; `wake` holds its answer and the wall clock at which it arrived,
 * so the local advance continues from the server's `activeMs` at that instant without inventing a total.
 * An expired wake keeps the clock stopped: the server owns expiry.
 * @param runningSince server's `runningSince` (null means "paused as of the payload")
 * @param wake resume result, or null when none succeeded yet
 * @param nowMs wall clock
 */
export function clockDisplay(
  detail: { durationMs: number | null; activeMs: number; runningSince: string | null; expired: boolean },
  wake: { activeMs: number; runningSince: string | null; at: number } | null,
  nowMs: number,
): ClockDisplay {
  const woken = wake !== null && wake.runningSince !== null && !detail.expired
  const running = detail.runningSince !== null || woken
  const activeMs = woken ? wake.activeMs + Math.max(0, nowMs - wake.at) : detail.activeMs
  const pausedNote = running ? '' : ' · dijeda'
  if (detail.durationMs === null) return { running, activeMs, text: `Waktu aktif ${clockText(activeMs)} · tanpa batas waktu${pausedNote}` }
  const remaining = Math.max(0, detail.durationMs - activeMs)
  return { running, activeMs, text: `Sisa waktu ${clockText(remaining)}${pausedNote}` }
}
