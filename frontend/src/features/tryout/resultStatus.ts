/**
 * Which threshold band the result page shows, as pure data so it can be checked without a browser
 * (API_SPECIFICATION §4, SCORING_METHODOLOGY §5.4–§5.6):
 *
 *   no_rule    the config sets no threshold at all;
 *   withheld   the config sets one, but no approval authorises a verdict — the score stands, the verdict does not;
 *   verdict    the backend carried a verdict;
 *   undecided  a rule applies and nothing was withheld, yet no verdict exists — said plainly, never invented.
 */
import type { VerdictWithheld } from '../../types/contracts'

/** The fields `bandFor` reads from a `ScoreResult`; the rest of the result is irrelevant to the band. */
export type ResultBandInput = {
  thresholds: { mode: 'none' | 'per_subtest_only' | 'total_only' | 'per_subtest_and_total' }
  verdict: unknown | null
  withheld: VerdictWithheld | null
}

export type ResultBand =
  | { kind: 'no_rule' }
  | { kind: 'withheld'; code: VerdictWithheld['code'] }
  | { kind: 'verdict' }
  | { kind: 'undecided' }

/**
 * Pick the band. `withheld` is checked before `verdict` so a contradictory payload can never render a withheld
 * verdict as a verdict, and the result never renders "no threshold set" when a threshold rule was carried.
 */
export function bandFor(result: ResultBandInput): ResultBand {
  if (result.thresholds.mode === 'none') return { kind: 'no_rule' }
  if (result.withheld !== null) return { kind: 'withheld', code: result.withheld.code }
  if (result.verdict !== null && result.verdict !== undefined) return { kind: 'verdict' }
  return { kind: 'undecided' }
}

/** Why a verdict is absent (API_SPECIFICATION §4): one sentence per verdict-only code, nothing invented. */
export function withheldText(code: VerdictWithheld['code']): string {
  switch (code) {
    case 'APPROVAL_MISSING':
      return 'Konfigurasi ini belum disetujui, jadi tidak ada verdict kelulusan ambang batas.'
    case 'APPROVAL_INVALID':
      return 'Persetujuan konfigurasi tidak lagi berlaku karena pengaturannya berubah, jadi verdict ditahan.'
    case 'APPROVAL_VERSION_MISMATCH':
      return 'Persetujuan konfigurasi berlaku untuk versi yang berbeda, jadi verdict ditahan.'
  }
}
