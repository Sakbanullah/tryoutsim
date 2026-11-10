# Frontend Data Contracts

The frontend's read of every backend shape. Mirror of [API_SPECIFICATION](../backend/API_SPECIFICATION.md)
and [API_ENDPOINTS](../backend/API_ENDPOINTS.md): the backend implements, the frontend types against
these. **No field here is invented.** Where a contract is not documented, the type is marked `GAP` and the
gap id points at [FRONTEND_GAP_REGISTER](./FRONTEND_GAP_REGISTER.md).

---

## 1. The one rule

**The frontend renders, never recomputes.** Scores, percentages, sample-status flags, weaknesses, verdicts
and coverage all arrive from the backend; the UI formats and displays them. Any derivation a screen needs
(e.g. "which subtest has the largest remaining gap") is a render concern over returned values only, never
a scoring or metrics computation.

## 2. Envelopes

```ts
type ApiEnvelope<T> = { data: T; meta: { version: string } }   // API_SPECIFICATION §2

type ApiError = {                                              // API_SPECIFICATION §3 + §4 registry
  error: {
    code: ErrorCode
    message: string
    details: unknown                                           // narrowed per code below
    requestId: string                                          // log-only; never shown
  }
}

type ErrorCode =
  | 'VALIDATION_FAILED' | 'NOT_FOUND' | 'CONFLICT'
  | 'PROVIDER_UNAVAILABLE' | 'PROVIDER_AUTH_FAILED' | 'RATE_LIMITED' | 'PROVIDER_TIMEOUT'
  | 'PREFLIGHT_FAILED' | 'THRESHOLD_CONFIG_INVALID'
  | 'CONTRACT_MISMATCH' | 'UNSUPPORTED'

// Verdict-only codes — never an HTTP error, always a field on a 200 result (API_SPECIFICATION §4)
type VerdictWithheldCode = 'APPROVAL_MISSING' | 'APPROVAL_INVALID' | 'APPROVAL_VERSION_MISMATCH'
```

The registry is closed ([ERROR_HANDLING](../backend/ERROR_HANDLING.md) §1). Details typed per code:

```ts
type FieldError = { path: string; message: string; rule: string }

type PreflightError = {
  code: string                  // PF-00…PF-13 / SC-01…SC-08 (SCORING_METHODOLOGY §6.1)
  path: string | null
  message: string
  severity: 'block'
}

type ChangeEntry = { field: string; approved: unknown; current: unknown }   // API_SPECIFICATION §4.2

type VerdictWithheld = {        // API_SPECIFICATION §4 — carried on a 200 ScoreResult
  code: VerdictWithheldCode
  changed: ChangeEntry[]        // empty only for APPROVAL_MISSING
  config?: ConfigSummary        // summary for display: state, label, thresholds — no hashes
}
type ThresholdError = { changed: ChangeEntry[]; thresholds: ThresholdSummary }   // THRESHOLD_CONFIG_INVALID only
```

`RATE_LIMITED.details` is `{ providerId: string; retryAfterMs: int | null }` — the UI shows a retry delay
only when `retryAfterMs` is non-null.

## 3. Core domain types

Each is the backend type of the same name; the backend document wins on any difference.

```ts
// Bucket — SCORING_METHODOLOGY §2.2
type Bucket = { earned: number; possible: number; answeredCount: number; correctCount: number }

type Test = 'TWK' | 'TIU' | 'TKP'

// One row per roster question, answered or not — SCORING_METHODOLOGY §2.2
type QuestionScore = {
  questionId: string
  test: Test
  competencyId: string
  earned: number
  maxScore: number                 // per-question maximum, NOT `possible`
  selected: string | null          // null = unanswered
  correct: boolean | null          // TWK/TIU true|false|null; TKP always null
}

/**
 * Tinjau jawaban block content — API_SPECIFICATION §7.7 (`GET /sessions/:id/questions`).
 * Mixed source by decision: frozen text/options/key/weights from the session snapshot; `explanation`
 * from the question's latest version, rendered only when `latestContentVersion === frozenContentVersion`
 * (strict version matching, PO 2026-11-09). `optionJustifications` normally come with the frozen key
 * (§1.2); `latest` is the fallback for a key frozen before the field existed. The `?ids=` batch
 * (1–20 roster ids, identical 400 for every bad id) is the approved E78 contract.
 * The UI renders these fields verbatim and never derives `keyedOption`.
 */
type ReviewQuestion = {
  questionId: string
  test: Test
  stem: string
  asset?: { ref: string; kind: 'image' | 'table'; alt: string }
  options: Array<{ key: string; text: string }>      // frozen option keys and texts
  keyedOption: string | null                          // TWK/TIU keyed option, server-computed; null for TKP
  optionScores: Record<string, number>                // frozen weights, "A".."E"
  earned: number                                      // echoed from ScoreResult.byQuestion
  maxScore: number
  selected: string | null                              // null = unanswered
  correct: boolean | null                              // TWK/TIU true|false|null; TKP always null
  frozenContentVersion: number
  latestContentVersion: number | null                  // null = current question row missing
  explanation: string | null                           // render only if latestContentVersion === frozenContentVersion
  explanationSource: 'latest' | 'none'                 // no snapshot fallback exists
  optionJustifications: Record<string, string> | null  // TKP only — QUESTION_SPECIFICATION §1.2
  justificationsSource: 'latest' | 'frozen' | 'none'  // 'frozen' = from the scored key (normal)
  questionState: 'live' | 'archived' | 'quarantined' | 'missing'
}

type ScoreResult = {               // API_SPECIFICATION §5 — the wire object, one shape
  sessionId: string
  configId: string
  configVersion: number
  scoringVersion: number
  snapshotVersion: string
  approval: ProvisionalApproval | null     // present iff a verdict was authorised
  total: Bucket
  byTest: Record<Test, Bucket>
  byCompetency: Record<string, Bucket>
  byQuestion: QuestionScore[]
  thresholds: ThresholdEvaluation
  verdict: ThresholdVerdict | null         // null when no verdict is possible (SCORING_METHODOLOGY §5.6)
  withheld: VerdictWithheld | null         // why the verdict is absent, when a verdict-only code applied
  timing: { activeMs: number; durationMs: number | null }
  packageBinding: PackageBinding
}

type ThresholdVerdict = {          // SCORING_METHODOLOGY §5.4 — present only with a valid approval
  mode: 'per_subtest_only' | 'total_only' | 'per_subtest_and_total'
  passed: boolean
  passesBySubtest?: { TWK: boolean; TIU: boolean; TKP: boolean }
  basisTier: EvidenceTier
  basisPathway?: 'CPNS' | 'SEKOLAH_KEDINASAN'
  noticeRequired: boolean
}

type ThresholdEvaluation = { mode: 'none' } | ThresholdVerdict
// `thresholds` carries the configuration; `verdict` carries the outcome. They are never merged, so a
// threshold set without an approval renders as { mode: 'per_subtest_and_total' } with verdict === null.

type EvidenceTier =
  | 'VERIFIED-2026' | 'VERIFIED-CURRENT' | 'HISTORICAL' | 'VERIFIED-ABSENCE' | 'UNVERIFIED'
  | 'EVIDENCE-BACKED-NOT-CPNS-2026'          // corroboration only; never a CPNS claim

type ProvisionalApproval = {       // CPNS_2026_REGULATIONS §4.3 — canonical
  configId: string
  configVersion: number
  scoringVersion: number
  regulatoryBasisHash: string
  approvedByUserAt: string
  approvedBy: string
  acknowledgedWarnings: string[]
}

type MetricValue = {               // ANALYTICS_ENGINE §6
  percent: number | null           // integer 0..100; null iff state === 'insufficient_data'
  numerator: number
  denominator: number
  answeredCount: number
  sessionCount: number
  state: 'reportable' | 'insufficient_data' | 'zero_correct' | 'zero_attainment'
  sampleNote?: string
}

type Coverage = {                  // ANALYTICS_ENGINE §4.2
  attemptedQuestions: number
  availableQuestions: number
  percent: number | null
  state: 'reportable' | 'insufficient_data'
}

type Consistency = {               // ANALYTICS_ENGINE §4.3
  state: 'reportable' | 'insufficient_data'
  spreadPercent: number | null
  direction: 'stable' | 'improving' | 'declining' | 'mixed'
}

type TrendSeries = {               // ANALYTICS_ENGINE §6
  competencyId: string
  points: Array<{ sessionId: string; finishedAt: string; percent: number; answeredCount: number }>
  state: 'reportable' | 'insufficient_data'
  direction: Consistency['direction']
}

type AnalyticsSnapshot = {         // ANALYTICS_ENGINE §6
  configId: string
  configVersion: number
  scoringVersion: number
  perTest: Record<Test, MetricValue & { metric: 'accuracy' | 'attainment' }>
  perCompetency: Record<string, MetricValue & { metric: 'accuracy' | 'attainment' }>
  difficulty: Record<Test, Record<'easy' | 'medium' | 'hard', MetricValue>>
  empiricalDifficulty: Record<Test, Record<'easy' | 'medium' | 'hard', MetricValue>>
  responseTime: { medianSeconds: number; answeredCount: number }
  coverage: Record<string, Coverage>
  trends: TrendSeries[]
  consistency: Record<string, Consistency>
  testMean: Record<Test, number | null>
  comparability: {
    mixed: boolean
    versions: Array<{ configId: string; configVersion: number; scoringVersion: number; sessionCount: number }>
  }
  history: { deletedSessionCount: number; lastDeletionAt: string | null }   // deletions leave a tombstone; they are not a permanent purge
}

type ExamConfig = {                // CPNS_2026_REGULATIONS §4.1
  id: string
  examYear: number
  pathway: 'CPNS' | 'SEKOLAH_KEDINASAN'   // storage enum; only CPNS is ever returned (§8 rule 7)
  state: 'official_verified' | 'historical' | 'provisional'
  configVersion: number
  scoringVersion: number
  regulatoryBasis: BasisRef[]
  structure: SubtestStructure[]    // SubtestStructure undefined — GAP-M12; not rendered
  scoring: ScoringRules
  thresholds?: ThresholdSet
  notice: string
  dataProvenance: 'seed' | 'legacy'
  derivedFrom?: string
  effectiveFrom?: string
}

type BasisRef = {
  document: string
  number: string
  effectiveDate?: string
  tier: EvidenceTier
  pathway?: 'CPNS' | 'SEKOLAH_KEDINASAN'
  examYear?: number
  scope?: string
  sourceUrl?: string
  fetchedAt?: string
}

type ThresholdSet = {              // SCORING_METHODOLOGY §5
  mode: 'per_subtest_and_total' | 'per_subtest_only' | 'total_only' | 'none'
  TWK?: number; TIU?: number; TKP?: number; total?: number
  source: BasisRef
}

type Question = {                  // QUESTION_SPECIFICATION §1
  id: string
  configId: string
  test: Test
  competencyId: string
  difficulty: Difficulty
  stem: string
  asset?: { ref: string; kind: 'image' | 'table'; alt: string }
  options: Array<{ key: 'A' | 'B' | 'C' | 'D' | 'E'; text: string }>
  answerKey: unknown               // shape owned by SCORING_METHODOLOGY §2.2; never sent to a tryout runner
  explanation: string
  sourceRefs?: string[]
  provenance: Provenance
  lifecycle: Lifecycle
  dynamicEligible: boolean
  review: ReviewHistory
  validation?: ValidationRecord
  language: 'id'
  createdAt: string
  contentVersion: number
  contentHash: string
}

type Difficulty = {                // QUESTION_SPECIFICATION §1.1 — two separate fields
  aiInitial: 'easy' | 'medium' | 'hard'
  empirical: { band: 'easy' | 'medium' | 'hard'; basis: 'attainment' | 'accuracy'
               sampleCount: number; computedAt: string } | null
}

type Lifecycle =                   // QUESTION_SPECIFICATION §3 — seven states
  | 'draft' | 'ai_validated' | 'human_reviewed' | 'active'
  | 'quarantined' | 'rejected' | 'archived'

type ProvenanceKind =
  | 'ai_generated' | 'ai_generated_human_reviewed' | 'human_authored' | 'official_historical'

type Package = {                   // PACKAGE_SPECIFICATION §1
  id: string
  mode: 'tryout' | 'latihan'
  source: 'builtin' | 'dynamic' | 'custom'
  titleId: string
  version: number
  definition: PackageDefinition
  examConfigId: string | null      // optional custom-package pin (AUD-87); null = resolution only
  examConfigVersion: number | null
  availability: {
    eligibleStock: number
    requiredStock: number
    repeatCount: number            // items that would repeat
    startable: boolean
    unavailableReason: string | null
  }
  retiredAt: string | null
}

type PackageDefinition = {
  kind: 'full_simulation' | 'subtest' | 'submateri'
  test?: Test                     // required for subtest/submateri
  competencyIds?: string[]        // required for submateri
  itemCount: number
  difficultyMix?: { easy: number; medium: number; hard: number }
  repeatPolicy: 'avoid_answered' | 'allow_repeat'
}

type PackageBinding = {            // SCORING_METHODOLOGY §7
  packageId: string
  packageVersion: number
  mode: 'tryout' | 'latihan'
  kind: PackageDefinition['kind']
  rosterHash: string
}

type Session = {                   // DATABASE_SCHEMA §2 + API_SPECIFICATION §7.4
  id: string
  mode: 'tryout' | 'latihan'
  status: 'open' | 'submitted' | 'blocked'
  packageId: string
  packageVersion: number
  startedAt: string
  submittedAt: string | null
  activeMs: number
  durationMs: number | null
  runningSince: string | null
  roster: { repeatCount: number; attemptedBefore: number }
}

type RunnerPayload = {             // GET /sessions/:id, POST /packages/:id/sessions
  session: Session
  questions: Array<{               // frozen content; NO answerKey/explanation for a tryout
    questionId: string
    test: Test
    competencyId: string
    stem: string
    asset?: { ref: string; kind: 'image' | 'table'; alt: string }
    options: Array<{ key: 'A' | 'B' | 'C' | 'D' | 'E'; text: string }>
    selected: string | null
    flagged: boolean
  }>
}

type AnswerFeedback = {            // POST /sessions/:id/answer-feedback — Latihan only
  questionId: string
  selected: string | null
  earned: number
  maxScore: number
  correct: boolean | null          // always null for TKP
  optionScores: Record<'A' | 'B' | 'C' | 'D' | 'E', number>
  explanation: string
}

type Notification = {              // NOTIFICATION_SPECIFICATION §3
  id: string
  type: string                     // closed set, §2 there
  severity: 'info' | 'action' | 'warning' | 'error'
  titleKey: string
  params: Record<string, string | number>
  link?: { route: string; entityId: string }
  createdAt: string
  readAt: string | null
  dismissedAt: string | null
}

type Material = {                  // MATERIAL_SPECIFICATION §1
  id: string
  title: string
  contentType: 'conceptual' | 'strategy' | 'factual' | 'legal' | 'historical' | 'policy'
  scope: { kind: 'competency' | 'domain'; competencyId: string } | { kind: 'free'; note: string }
  status: 'draft' | 'approved' | 'retired'
  version: number
  approvalVersion: number | null
  provenance: { kind: 'manual' | 'ai_drafted' | 'ai_drafted_reviewed'; providerId?: string; modelId?: string }
  sources: Array<{ label: string; url?: string; verified: boolean }>
}

type MaterialOffer =               // RECOMMENDATION_ENGINE §4
  | { status: 'available'; materialId: string; version: number; title: string }
  | { status: 'draft_available'; materialId: string; hint: 'setujui_dulu' }
  | { status: 'none'; action: 'generate_material' }

type GenerationJob = {             // GENERATION_JOBS §2–§3
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'interrupted'   // no cancel/pause state (GENERATION_JOBS §2)
  providerId: string
  modelId: string
  batches: Array<{ batchId: string; status: 'completed' | 'failed' | 'interrupted'
                   produced: number; quarantined: number; failureCategory?: string }>
  produced: number
  quarantined: number
  partial: boolean
  awaitingSampling: boolean
}
```

`Provenance`, `ReviewHistory` and `ValidationRecord` are imported verbatim from
[QUESTION_SPECIFICATION](../examination/QUESTION_SPECIFICATION.md) §2, §4, §5 — not restated.
`Provider`, `ModelCapabilities` and `AiRouting` are imported from
[AI_PROVIDER_ARCHITECTURE](../ai/AI_PROVIDER_ARCHITECTURE.md) §3–§4.

## 4. Render rules encoded above

- `correct === null` on an answered TWK/TIU question is **impossible**; on a TKP question it is always
  `null`. Unanswered TWK/TIU is `selected === null` **and** `correct === null` → render `—`, never
  "salah".
- TKP `correctCount` is always `0`; show attainment (`earned/possible`), never a right/wrong count.
- `MetricValue.percent === null` iff `state === 'insufficient_data'`; render "Belum cukup data" and still
  show `answeredCount`.
- `zero_correct` / `zero_attainment` are explicit states with their own text, never a 0 %.
- `verdict === null` → **no pass/fail is rendered**; the score, the analysis and the "ambang batas belum
  terverifikasi" note still are. `thresholds.mode === 'none'` renders the same way.
- `comparability.mixed === true` renders a note that the data mixes rule versions; no number across
  different triples is presented as a comparison, and no config id is named.
- `difficulty.empirical === null` renders "belum cukup data" under the empirical tab; `aiInitial` still
  renders under the authoring tab.
- `Package.availability.repeatCount > 0` must be stated before a session starts.
- `RunnerPayload.questions[]` never carries `answerKey` or `explanation` for a tryout; a Latihan runner
  obtains feedback only through `AnswerFeedback`.
- `ReviewQuestion.keyedOption` is **server-computed**: the UI prints it, never re-derives it from
  `optionScores` and `correct` (API_SPECIFICATION §7.7). TKP always has `keyedOption === null`.
- `ReviewQuestion.explanation` is rendered **only** when `latestContentVersion === frozenContentVersion`
  (strict version matching, PO 2026-11-09); otherwise the block shows the not-available notice. No
  comparator, no fuzzy match, no AI check on the client.

## 5. Error mapping

The Data layer narrows every error to a discriminated union; screens never branch on a raw body:

```ts
type Outcome<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'validation'; fields: FieldError[] }
  | { kind: 'verdictWithheld'; code: VerdictWithheldCode | 'THRESHOLD_CONFIG_INVALID'; changed: ChangeEntry[] }   // score exists
  | { kind: 'preflight'; errors: PreflightError[] }
  | { kind: 'contract'; expected: string; actual: string }
  | { kind: 'provider'; code: ErrorCode; message: string }
  | { kind: 'notFound' }
  | { kind: 'conflict'; reason: string }
  | { kind: 'unavailable'; reason: string }            // network, no backend
```

`verdictWithheld` is **not** a failed request: a submit that withholds a verdict returns `200` with a
`ScoreResult` whose `verdict` is `null` and whose `withheld` field explains why. The union member exists so
the same presentation is reused wherever a withheld verdict is surfaced.

## 6. Unresolved types (declared, not invented)

| Type | Needed by | Gap |
|---|---|---|
| `SubtestStructure` | tryout instructions | GAP-M12 |
| `ScoringRules` detail | tryout instructions | GAP-M12 |
| `ConfigSummary`, `ThresholdSummary` | approval dialog, disclosure | GAP-M9 |
| `FieldEdit` | review edit mode | GAP-M1 |
| `DuplicateCluster[]` | Bank Soal | GAP-M4 |

Everything the screens of [FRONTEND_PAGE_SPECIFICATIONS](./FRONTEND_PAGE_SPECIFICATIONS.md) need outside
this list now has a named contract in [API_ENDPOINTS](../backend/API_ENDPOINTS.md).

## 7. Mock parity

The mock layer returns these exact shapes, including error envelopes, so the error mapper is exercised
before a backend exists ([FRONTEND_MOCK_DATA_STRATEGY](./FRONTEND_MOCK_DATA_STRATEGY.md)). A mock type with
no contract above is labelled `MOCK DATA — NOT FROM API`.
