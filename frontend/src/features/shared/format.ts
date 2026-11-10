/**
 * Display-only helpers. They format what the backend returned; none of them derives a score, a
 * percentage, a rank or a threshold verdict (FRONTEND_DATA_CONTRACTS §1).
 */

const date = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

/** Human date from any ISO-ish timestamp or id; falls back to the raw string. */
export function formatDate(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : date.format(parsed)
}

const dateTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

/** Date and time for one moment; falls back to the raw string when it is not a timestamp. */
export function formatDateTime(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : dateTime.format(parsed)
}

/** "1:48" for a median in seconds — the value is shown as-is, rounded to the minute/second pair. */
export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function testName(t: 'TWK' | 'TIU' | 'TKP'): string {
  return { TWK: 'Wawasan Kebangsaan', TIU: 'Kemampuan Berpikir', TKP: 'Situasi dan Perilaku Kerja' }[t]
}

/** The author-assigned difficulty as the learner reads it (QUESTION_SPECIFICATION §1.1 `aiInitial`). */
export function difficultyLabel(d: 'easy' | 'medium' | 'hard'): string {
  return { easy: 'Mudah', medium: 'Sedang', hard: 'Sulit' }[d]
}

/* ── Last-result pointer (FRONTEND_STATE_MANAGEMENT §5) ───────────────────────────────────
 * A pointer only: id + mode + when. Never answers, never scores. Reads/writes are guarded because
 * private modes and cleared storage throw. */

const KEY = 'tryoutsim:lastResult'
const SEEN_KEY = 'tryoutsim:seen'

export type ResultPointer = { sessionId: string; mode: 'tryout' | 'practice'; at: string }

export function readLastResultPointer(): ResultPointer | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ResultPointer>
    return typeof parsed.sessionId === 'string' && parsed.mode ? (parsed as ResultPointer) : null
  } catch {
    return null
  }
}

export function writeLastResultPointer(p: ResultPointer): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // Storage unavailable: the app still works, only the Beranda shortcut is lost.
  }
}

/** The creation timestamp encoded in a mock session id (`ses-<base36 ms>`); "" when absent. */
export function uidOf(sessionId: string): string {
  const ms = Number.parseInt(sessionId.replace(/^ses-/, ''), 36)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : ''
}

const CONFIG_KEY = 'tryoutsim:lastConfig'

/** Last config the learner opened — a convenience preselection, never an answer or a score. */
export function readLastConfigId(): string | null {
  try {
    return window.localStorage.getItem(CONFIG_KEY)
  } catch {
    return null
  }
}

export function writeLastConfigId(configId: string): void {
  try {
    window.localStorage.setItem(CONFIG_KEY, configId)
  } catch {
    // Convenience only.
  }
}

/** True once the learner has seen the three starting steps (stored as a plain flag, no personal data). */
export function readSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // Not important enough to surface.
  }
}
