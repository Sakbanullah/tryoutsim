/**
 * Response shaping for the exam-config aggregate (API_ENDPOINTS §2, CPNS_2026_REGULATIONS §4.1–§4.4).
 *
 * Pure: rows in, contract objects out. The learner never chooses a config, so there is no fallback or default
 * anywhere here — a missing basis is shown as missing, never filled in.
 */

/**
 * A `thresholds` row as the `ThresholdSet` of SCORING_METHODOLOGY §5 (`null` ≙ mode `none`, which is stored as
 * no row, DATABASE_SCHEMA §2). `source` is parsed from `sourceJson` and may be `null` when the row's source is
 * not valid JSON — surfaced, not repaired.
 * @param {object | null} row
 * @returns {object | null}
 */
export function toThresholdSet(row) {
  if (!row) return { mode: 'none' };
  return {
    mode: row.mode,
    ...(row.twk === null ? {} : { TWK: row.twk }),
    ...(row.tiu === null ? {} : { TIU: row.tiu }),
    ...(row.tkp === null ? {} : { TKP: row.tkp }),
    ...(row.total === null ? {} : { total: row.total }),
    source: parseJson(row.sourceJson),
  };
}

/**
 * A `basis_ref` row as the `BasisRef` of CPNS_2026_REGULATIONS §4.1. `scope` is the row's title (DATABASE_SCHEMA
 * §2 stores the basis's prose there).
 * @param {object} row
 * @returns {object}
 */
export function toBasisRef(row) {
  return {
    document: row.title,
    number: row.id,
    tier: row.tier,
    pathway: row.pathway,
    scope: row.source,
    sourceUrl: row.url,
    fetchedAt: row.accessedAt,
  };
}

/** The `ScoringRules` a config asserts, in the shape pre-flight PF-11 validates (§5, §6.6). */
export function toScoringRules(config) {
  return {
    scoringVersion: config.scoringVersion,
    tkpWeightRange: [config.tkpWeightMin, config.tkpWeightMax],
    perQuestionMax: { TWK: config.twkWeight, TIU: config.tiuWeight, TKP: config.tkpWeightMax },
    unansweredScoreBounds: { min: 0, max: 0 },
    unansweredRule: 'zero',
  };
}

/**
 * The exam config as `GET /exam-configs/:id` returns it (CPNS_2026_REGULATIONS §4.1), plus the management-only
 * `approval` block (newest approval or `null`) and whether a threshold verdict is possible (API_ENDPOINTS §2).
 * @param {object} input
 * @param {object} input.config `exam_config` row
 * @param {object[]} input.basisRefs `basis_ref` rows, in id order
 * @param {object | null} input.thresholds `thresholds` row
 * @param {object | null} input.approval newest `provisional_approval` row for this config version
 * @returns {object}
 */
export function toExamConfig({ config, basisRefs, thresholds, approval }) {
  return {
    id: config.id,
    examYear: config.examYear,
    pathway: config.pathway,
    state: config.state,
    dataProvenance: config.dataProvenance,
    configVersion: config.configVersion,
    scoringVersion: config.scoringVersion,
    regulatoryBasisHash: config.regulatoryBasisHash,
    regulatoryBasis: basisRefs.map(toBasisRef),
    structure: {
      durationMinutes: config.durationMinutes,
      itemCount: config.itemCount,
      counts: { TWK: config.twkCount, TIU: config.tiuCount, TKP: config.tkpCount },
      maxScore: config.maxScore,
    },
    scoring: toScoringRules(config),
    thresholds: toThresholdSet(thresholds),
    notice: config.notice,
    approval,
    thresholdVerdictPossible: verdictPossible(config, thresholds, approval),
  };
}

/**
 * The `ConfigSummary` of API_SPECIFICATION §4.2 — display only: state, label, versions, no hash beyond the one the
 * caller already holds.
 * @param {object} config `exam_config` row
 * @param {object | null} [thresholds] `thresholds` row
 * @returns {object}
 */
export function toConfigSummary(config, thresholds = null) {
  return {
    configId: config.id,
    configVersion: config.configVersion,
    scoringVersion: config.scoringVersion,
    state: config.state,
    label: config.notice,
    thresholds: toThresholdSet(thresholds),
  };
}

/**
 * Whether a verdict could be emitted for this config now: it carries a threshold set and its newest approval binds
 * the current four values. A provisional config without an approval is startable and scorable — only this flag is
 * false (CPNS_2026_REGULATIONS §4.2).
 * @param {object} config
 * @param {object | null} thresholds
 * @param {object | null} approval
 * @returns {boolean}
 */
export function verdictPossible(config, thresholds, approval) {
  if (!thresholds || thresholds.mode === 'none' || !approval) return false;
  return approval.configVersion === config.configVersion
    && approval.scoringVersion === config.scoringVersion
    && approval.regulatoryBasisHash === config.regulatoryBasisHash;
}

/** Parse a stored JSON column, returning `null` rather than throwing on malformed content. */
export function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
