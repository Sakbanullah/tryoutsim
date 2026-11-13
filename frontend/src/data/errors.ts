import type { ChangeEntry, ErrorCode, FieldError, Outcome, PreflightError } from '../types/contracts'

/** The typed failure a route can return; every failure is narrowed once, here (§5 of the contracts). */
export type Failure =
  | { status: 400; code: 'VALIDATION_FAILED'; fields: FieldError[] }
  | { status: 404; code: 'NOT_FOUND'; what: string }
  | { status: 409; code: 'CONFLICT'; reason: string }
  | { status: 422; code: 'PREFLIGHT_FAILED'; errors: PreflightError[] }
  /** A genuine block (API_SPECIFICATION §4). The approval codes are not here: a 200 result withholds its verdict. */
  | { status: 409; code: 'THRESHOLD_CONFIG_INVALID'; changed: ChangeEntry[] }
  | { status: 426; code: 'CONTRACT_MISMATCH'; expected: string; actual: string }
  | { status: 429 | 502 | 504; code: ErrorCode; message: string; retryAfterMs: number | null }
  | { status: 0; code: 'NETWORK'; message: string }
  /** A documented route the backend does not serve yet (plan Tahap A). Distinct from `NETWORK`: retrying cannot help. */
  | { status: 0; code: 'UNSUPPORTED'; message: string }


/**
 * Turns a route failure into the discriminated `Outcome` screens branch on. Only genuine blocks reach here: a
 * withheld verdict is a `200` `ScoreResult` (`withheld`), never a failure (FRONTEND_DATA_CONTRACTS §5).
 */
export function toOutcome<T>(failure: Failure): Outcome<T> {
  if (failure.status === 400 && failure.code === 'VALIDATION_FAILED') {
    return { kind: 'validation', fields: failure.fields }
  }
  if (failure.status === 404) return { kind: 'notFound' }
  if (failure.status === 409 && 'reason' in failure) {
    return { kind: 'conflict', reason: failure.reason }
  }
  if (failure.status === 409 && failure.code === 'THRESHOLD_CONFIG_INVALID') {
    return { kind: 'blocked', code: failure.code, changed: failure.changed }
  }
  if (failure.status === 422) return { kind: 'preflight', errors: failure.errors }
  if (failure.status === 426) {
    return { kind: 'contract', expected: failure.expected, actual: failure.actual }
  }
  if (failure.status === 0 && failure.code === 'UNSUPPORTED') {
    return { kind: 'notImplemented', route: failure.message }
  }
  if (failure.status === 0) return { kind: 'unavailable', reason: failure.message }
  if (failure.status === 429 || failure.status === 502 || failure.status === 504) {
    return { kind: 'provider', code: failure.code, message: failure.message }
  }
  // Unreachable for well-formed failures; surfaces a contract bug instead of an `undefined` message.
  throw new Error(`Unnarrowed failure: ${failure.status} ${failure.code}`)
}

/** A route that returns data or a typed failure — the only shape the mock and the client share. */
export type Result<T> = { ok: true; data: T } | { ok: false; failure: Failure }

/** Thrown by the real client for HTTP; screens only ever see `Outcome`. */
export type ErrorDetailsBag = {
  fields?: FieldError[]
  preflight?: PreflightError[]
  changed?: ChangeEntry[]
  retryAfterMs?: number | null
}
