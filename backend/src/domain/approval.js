/**
 * Approval integrity: the four bound values, drift detection, and what a drift withholds.
 *
 * Canonical rules: CPNS_2026_REGULATIONS §4.3 (bound values, drift is silent and recomputed), SCORING_METHODOLOGY
 * §5.6 and §11 (a drift withholds the *verdict* only), §11.1 (precedence
 * `APPROVAL_VERSION_MISMATCH` → `APPROVAL_INVALID` → `APPROVAL_MISSING`), API_SPECIFICATION §4.2
 * (`changed[]` bounds). Pure: no clock, no database.
 */

/** The four bound values, in the order `changed[]` lists them (API_SPECIFICATION §4.2). */
export const BOUND_FIELDS = Object.freeze(['configId', 'configVersion', 'scoringVersion', 'regulatoryBasisHash']);

/** `changed[]` field names for the threshold fields, in ThresholdSet order (API_SPECIFICATION §4.2). */
const THRESHOLD_FIELDS = Object.freeze(['mode', 'TWK', 'TIU', 'TKP', 'total']);

/** A threshold drift is only reported when the mode itself did not change (a mode change is one entry). */
const THRESHOLD_VALUES = Object.freeze(['TWK', 'TIU', 'TKP', 'total']);

/** Verdict-only precedence, most specific first (SCORING_METHODOLOGY §11.1 item 4). */
export const WITHHELD_PRECEDENCE = Object.freeze(['APPROVAL_VERSION_MISMATCH', 'APPROVAL_INVALID', 'APPROVAL_MISSING']);

/**
 * Identify a ThresholdSet by its values. `sourceJson` is not compared: every row of one config shares one
 * source row, and the evidence is bound by `regulatoryBasisHash` already.
 * @param {{mode: string, TWK?: number|null, TIU?: number|null, TKP?: number|null, total?: number|null} | null | undefined} thresholds
 * @returns {string | null}
 */
export function thresholdSignature(thresholds) {
  if (!thresholds) return null;
  return [thresholds.mode, thresholds.TWK ?? null, thresholds.TIU ?? null, thresholds.TKP ?? null, thresholds.total ?? null]
    .join('|');
}

/** The approval a `provisional_approval` row denotes; `null` when there is no row. */
function toApproval(row) {
  if (!row) return null;
  return {
    configId: row.configId,
    configVersion: row.configVersion,
    scoringVersion: row.scoringVersion,
    regulatoryBasisHash: row.regulatoryBasisHash,
    approvedByUserAt: row.approvedByUserAt,
    approvedBy: row.approvedBy,
    acknowledgedWarnings: JSON.parse(row.acknowledgedWarningsJson),
  };
}

/**
 * Build the `{ approval | null, source }` a session snapshot carries: a copy of the config's newest approval
 * when one exists, else `null`. The source is kept so a later re-read can detect a *new* approval.
 * @param {{configId: string, configVersion: number}} config
 * @param {Array<object>} approvalRows newest-first rows of `provisional_approval`
 * @returns {{approval: object | null, source: {rowId: string | null}}}
 */
export function buildApprovalRef(config, approvalRows) {
  const row = approvalRows.find((r) => r.configId === config.configId && r.configVersion === config.configVersion) ?? null;
  return { approval: toApproval(row), source: { rowId: row?.id ?? null } };
}

/**
 * Re-read the current approval for a config version, newest first (SCORING_METHODOLOGY §11 "lapsed but config
 * unchanged": a new approval for the same values must reach a later `/score`).
 * @param {{configId: string, configVersion: number}} frozen the values the snapshot froze
 * @param {Array<object>} approvalRows newest-first rows of `provisional_approval`
 * @returns {object | null}
 */
export function currentApproval(frozen, approvalRows) {
  return toApproval(approvalRows.find((r) => r.configId === frozen.configId && r.configVersion === frozen.configVersion) ?? null);
}

/**
 * The `changed[]` entries between what was approved (the frozen snapshot, or the latest approval) and the
 * config as it stands now. Bounded to the four bound values plus the threshold fields (API_SPECIFICATION §4.2).
 * @param {{configId: string, configVersion: number, scoringVersion: number, regulatoryBasisHash: string}} bound approved values
 * @param {{configId: string, configVersion: number, scoringVersion: number, regulatoryBasisHash: string}} current
 * @param {{approved: object|null, current: object|null}} thresholds ThresholdSet-ish values as approved / now
 * @returns {Array<{field: string, approved: unknown, current: unknown}>}
 */
export function diffBound(bound, current, thresholds = { approved: null, current: null }) {
  const entries = [];
  for (const field of BOUND_FIELDS) {
    if (bound?.[field] !== current[field]) entries.push({ field, approved: bound?.[field] ?? null, current: current[field] });
  }
  const a = thresholds.approved;
  const c = thresholds.current;
  if (thresholdSignature(a) !== thresholdSignature(c)) {
    if ((a?.mode ?? null) !== (c?.mode ?? null)) {
      entries.push({ field: 'thresholds.mode', approved: a?.mode ?? null, current: c?.mode ?? null });
    } else {
      for (const key of THRESHOLD_VALUES) {
        if ((a?.[key] ?? null) !== (c?.[key] ?? null)) {
          entries.push({ field: `thresholds.${key}`, approved: a?.[key] ?? null, current: c?.[key] ?? null });
        }
      }
    }
  }
  return entries;
}

/**
 * PF-13: does an approval authorize a verdict for this frozen snapshot? Never a block — a failure is returned as
 * the withheld verdict while the score stands (SCORING_METHODOLOGY §5.6, §11).
 *
 * @param {object} input
 * @param {{mode: string}} input.thresholds the snapshot's ThresholdSet (`{mode:'none'}` when none)
 * @param {object | null} input.approval the snapshot's frozen `provisionalApproval`
 * @param {{configId: string, configVersion: number, scoringVersion: number, regulatoryBasisHash: string}} input.frozen
 * @param {{configId: string, configVersion: number, scoringVersion: number, regulatoryBasisHash: string}} input.live
 *   the config row as it stands now (DATABASE_SCHEMA §1: pre-flight compares snapshots against live rows)
 * @param {{approved: object|null, current: object|null}} input.thresholdsForDiff
 * @returns {{verdictAllowed: boolean, approval: object | null, withheld: {code: string, changed: object[]} | null}}
 */
export function evaluateApproval({ thresholds, approval, frozen, live, thresholdsForDiff }) {
  const withChanged = (code) => ({ verdictAllowed: false, approval: null, withheld: { code, changed: diffBound(frozen, live, thresholdsForDiff) } });

  if (thresholds.mode === 'none') return { verdictAllowed: false, approval: null, withheld: null };
  if (!approval) return withChanged('APPROVAL_MISSING');

  if (approval.configVersion !== frozen.configVersion || approval.scoringVersion !== frozen.scoringVersion) {
    return withChanged('APPROVAL_VERSION_MISMATCH');
  }
  const anyDrift = BOUND_FIELDS.some((field) => approval[field] !== frozen[field]);
  if (anyDrift) return withChanged('APPROVAL_INVALID');

  const liveDrift = BOUND_FIELDS.some((field) => live[field] !== frozen[field])
    || thresholdSignature(thresholdsForDiff.approved) !== thresholdSignature(thresholdsForDiff.current);
  if (liveDrift) return withChanged('APPROVAL_INVALID');

  return { verdictAllowed: true, approval, withheld: null };
}

/**
 * Which verdict-only code is written to `verdictWithheldJson` when several apply at once
 * (SCORING_METHODOLOGY §11.1: most specific first). Only one code appears; `changed[]` keeps the rest visible.
 * @param {string[]} codes
 * @returns {string | null}
 */
export function rankWithheld(codes) {
  return WITHHELD_PRECEDENCE.find((code) => codes.includes(code)) ?? null;
}
