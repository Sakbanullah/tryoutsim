/**
 * Frontend data contracts — mirrors docs/frontend/FRONTEND_DATA_CONTRACTS.md.
 * The backend document wins on any difference; this file types the frontend's read only.
 * Nothing here computes a score, percentage or rank.
 */

export type Test = 'TWK' | 'TIU' | 'TKP'

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'PROVIDER_TIMEOUT'
  | 'PREFLIGHT_FAILED'
  | 'APPROVAL_MISSING'
  | 'APPROVAL_INVALID'
  | 'APPROVAL_VERSION_MISMATCH'
  | 'THRESHOLD_CONFIG_INVALID'
  | 'CONTRACT_MISMATCH'
  | 'UNSUPPORTED'

export type ApiError = {
  error: { code: ErrorCode; message: string; details: unknown; requestId: string }
}

export type FieldError = { path: string; message: string; rule: string }

export type PreflightError = {
  code: string
  path: string | null
  message: string
  severity: 'block'
}

export type ChangeEntry = { field: string; approved: unknown; current: unknown }

export type EvidenceTier =
  | 'VERIFIED-2026'
  | 'VERIFIED-2026-SEKOLAH-KEDINASAN'
  | 'VERIFIED-CURRENT'
  | 'HISTORICAL'
  | 'VERIFIED-ABSENCE'
  | 'UNVERIFIED'

export type Bucket = {
  earned: number
  possible: number
  answeredCount: number
  correctCount: number
}

export type QuestionScore = {
  questionId: string
  test: Test
  competencyId: string
  earned: number
  maxScore: number
  selected: string | null
  correct: boolean | null
}

/**
 * One reviewed question — `GET /sessions/:id/questions?ids=…` (API_SPECIFICATION §7.7, E78).
 * Status and points are read from `ScoreResult.byQuestion`; this type supplies the block's content.
 * `latestContentVersion` is compared with `frozenContentVersion` by the screen (strict version
 * matching, FRONTEND_RESULTS_ANALYTICS §2.2.3) — the screen never derives the keyed option itself.
 */
export type ReviewQuestion = {
  questionId: string
  test: Test
  stem: string
  asset?: { ref: string; kind: 'image' | 'table'; alt: string }
  options: Array<{ key: 'A' | 'B' | 'C' | 'D' | 'E'; text: string }>
  keyedOption: string | null
  optionScores: Record<string, number>
  earned: number
  maxScore: number
  selected: string | null
  correct: boolean | null
  frozenContentVersion: number
  latestContentVersion: number | null
  explanation: string | null
  explanationSource: 'latest' | 'none'
  optionJustifications: Record<string, string> | null
  justificationsSource: 'latest' | 'frozen' | 'none'
  questionState: 'live' | 'archived' | 'quarantined' | 'missing'
}

export type ProvisionalApproval = {
  configId: string
  configVersion: number
  scoringVersion: number
  regulatoryBasisHash: string
  approvedByUserAt: string
  approvedBy: string
  acknowledgedWarnings: string[]
}

export type ThresholdEvaluation =
  | { mode: 'none' }
  | {
      mode: 'per_subtest_only' | 'total_only' | 'per_subtest_and_total'
      passed: boolean
      passesBySubtest?: Record<Test, boolean>
      basisTier: EvidenceTier
      basisPathway?: 'CPNS' | 'SEKOLAH_KEDINASAN'
      noticeRequired: boolean
    }

export type ScoreResult = {
  sessionId: string
  configId: string
  configVersion: number
  scoringVersion: number
  snapshotVersion: string
  approval: ProvisionalApproval | null
  total: Bucket
  byTest: Record<Test, Bucket>
  byCompetency: Record<string, Bucket>
  byQuestion: QuestionScore[]
  thresholds: ThresholdEvaluation
}

export type SessionScoreResult = ScoreResult & { bucketUnit: 'points' }

export type MetricState = 'reportable' | 'insufficient_data' | 'zero_correct' | 'zero_attainment'

export type MetricValue = {
  percent: number | null
  numerator: number
  denominator: number
  answeredCount: number
  sessionCount: number
  state: MetricState
  sampleNote?: string
}

export type AnalyticsSnapshot = {
  configId: string
  configVersion: number
  scoringVersion: number
  perTest: Record<Test, MetricValue & { metric: 'accuracy' | 'attainment' }>
  perCompetency: Record<string, MetricValue & { metric: 'accuracy' | 'attainment' }>
  difficulty: Record<Test, Record<'easy' | 'medium' | 'hard', MetricValue>>
  responseTime: { medianSeconds: number; answeredCount: number }
  testMean: Record<Test, number | null>
  comparability: {
    mixed: boolean
    versions: Array<{
      configId: string
      configVersion: number
      scoringVersion: number
      sessionCount: number
    }>
  }
}

export type BasisRef = {
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

export type ThresholdSet = {
  mode: 'per_subtest_and_total' | 'per_subtest_only' | 'total_only' | 'none'
  TWK?: number
  TIU?: number
  TKP?: number
  total?: number
  source: BasisRef
}

/**
 * `structure` and `scoring` are passed through untouched: their inner types are not defined in any
 * canonical document (GAP-M12). The UI never renders them, so they stay `unknown`.
 */
export type ExamConfig = {
  id: string
  examYear: number
  pathway: 'CPNS' | 'SEKOLAH_KEDINASAN'
  state: 'official_verified' | 'historical' | 'provisional'
  configVersion: number
  scoringVersion: number
  regulatoryBasis: BasisRef[]
  structure: unknown
  scoring: unknown
  thresholds?: ThresholdSet
  notice: string
  derivedFrom?: string
  effectiveFrom?: string
  /**
   * GAP — no documented field tells the frontend whether a provisional config is approved. The mock
   * carries this display-only marker; the real contract must expose it or the badge cannot be truthful.
   */
  approvedAt?: string
}

export type Lifecycle =
  | 'draft'
  | 'ai_validated'
  | 'human_reviewed'
  | 'active'
  | 'quarantined'
  | 'rejected'
  | 'archived'

export type AnswerKey = {
  questionId: string
  scoringVersion: number
  optionScores: Record<string, number>
  unansweredScore: number
  maxScore: number
  /** TKP only — one reason per option, keyed exactly like `optionScores` (QUESTION_SPECIFICATION §1.2, V-13). */
  optionJustifications?: Record<string, string>
}

export type Provenance = {
  kind: 'ai_generated' | 'ai_generated_human_reviewed' | 'human_authored' | 'official_historical'
  regeneratesQuestionId?: string
  providerId?: string
  modelId?: string
  promptTemplateId?: string
  promptVersion?: string
  generationId?: string
  generatedAt?: string
  authoredAt?: string
  reviewedBy?: string
  reviewedAt?: string
  sourceUrl?: string
  sourceDocument?: string
  sourceYear?: number
  retrievedAt?: string
  transcriptionNote?: string
}

export type ReviewHistory = {
  reviewer: string
  reviewedAt: string
  decision: 'accepted' | 'edited' | 'rejected'
  edits?: Array<{ field: string; beforeHash: string; afterHash: string }>
  answerKeyValidatedBy?: string
  answerKeyValidatedAt?: string
  notes?: string
}

export type ValidationCheck = { id: string; passed: boolean; message?: string }

export type ValidationRecord = {
  contentHash: string
  result: 'pass' | 'fail' | 'flagged'
  checks: ValidationCheck[]
  validatorVersion: string
  validatedAt: string
}

export type Question = {
  id: string
  configId: string
  test: Test
  competencyId: string
  difficulty: 'easy' | 'medium' | 'hard'
  stem: string
  asset?: { ref: string; kind: 'image' | 'table'; alt: string }
  options: Array<{ key: 'A' | 'B' | 'C' | 'D' | 'E'; text: string }>
  answerKey: AnswerKey
  explanation: string
  sourceRefs?: string[]
  provenance: Provenance
  lifecycle: Lifecycle
  review: ReviewHistory
  validation?: ValidationRecord
  language: 'id'
  createdAt: string
  contentVersion: number
  contentHash: string
}

/** AI_PROVIDER_ARCHITECTURE §3. `keyLast4` is absent from this type (GAP-M6). */
export type Provider = {
  id: string
  name: string
  baseUrl: string
  keyRef: string
  headers: Record<string, string>
  timeoutMs: number
  retries: number
  extraParams: Record<string, unknown>
  createdAt: string
}

/** Taxonomy node — COMPETENCY_TAXONOMY §2–§5. */
export type TaxonomyNode = {
  id: string
  test: Test
  parentId: string | null
  label: { id: string; en: string }
  tier: EvidenceTier
  deprecated: boolean
}

/** Session state as returned by `GET /sessions/:id`; content fields are GAP-F2. */
export type SessionStatus = 'open' | 'submitted' | 'scored'

export type Outcome<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'validation'; fields: FieldError[] }
  | {
      kind: 'blocked'
      code:
        | 'APPROVAL_MISSING'
        | 'APPROVAL_INVALID'
        | 'APPROVAL_VERSION_MISMATCH'
        | 'THRESHOLD_CONFIG_INVALID'
      changed: ChangeEntry[]
    }
  | { kind: 'preflight'; errors: PreflightError[] }
  | { kind: 'contract'; expected: string; actual: string }
  | { kind: 'provider'; code: ErrorCode; message: string }
  | { kind: 'notFound' }
  | { kind: 'conflict'; reason: string }
  | { kind: 'unavailable'; reason: string }
  /** The route exists in `API_ENDPOINTS` but the backend does not serve it yet: no retry will help. */
  | { kind: 'notImplemented'; route: string }

/**
 * ── GAP types (FRONTEND_DATA_CONTRACTS §6) ──────────────────────────────────────────────
 * Declared so the screens can be written, but NO canonical document defines these shapes.
 * The mock layer supplies them and every screen using one shows `MOCK DATA — NOT FROM API`.
 */

/** GAP-F2 / GAP-F6 — session + questions the runner renders. */
export type SessionQuestion = {
  questionId: string
  test: Test
  competencyId: string
  difficulty: 'easy' | 'medium' | 'hard'
  stem: string
  asset?: { ref: string; kind: 'image' | 'table'; alt: string }
  options: Array<{ key: 'A' | 'B' | 'C' | 'D' | 'E'; text: string }>
  provenanceKind: Provenance['kind']
  sourceYear?: number
  /** The saved answer and its flag, as stored (`GET /sessions/:id`, repositories/session `loadRunner`). */
  selected: string | null
  flagged: boolean
  /** Time already recorded on this question; evidence only, never a scoring input (§8.1). */
  elapsedActiveMs: number
}

/** Session detail without keys or explanations. Clock fields are server-computed (§8.1); `expired` is never decided here. */
export type SessionDetail = {
  sessionId: string
  configId: string
  mode: 'tryout' | 'practice'
  status: SessionStatus
  /** The session's time limit, or `null` when it has none. */
  durationMs: number | null
  /** Accumulated active time; not a remaining-time countdown. */
  activeMs: number
  /** When the clock started running, or `null` while paused. */
  runningSince: string | null
  expired: boolean
  questions: SessionQuestion[]
}

/**
 * Autosave request. The backend takes one answer per `PATCH` with its cumulative `elapsedActiveMs`
 * (API_SPECIFICATION §7.5); the client sends the last entry and the elapsed value passed beside it.
 */
export type AnswersPatch = {
  answers: Array<{ questionId: string; selectedOption: string | null }>
}

/**
 * `POST /generation-jobs` — GENERATION_JOBS §2 / VALIDATION §2: a **plural** competency set, difficulty
 * and a per-competency count. No token or cost field exists anywhere in this contract.
 */
export type GenerationRequest = {
  competencyIds: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  count: number
}

/** `GET /generation-jobs/:id` — GENERATION_JOBS §2–§3. No cancel/pause/resume state exists. */
export type GenerationJob = {
  jobId: string
  status: 'queued' | 'running' | 'done' | 'failed' | 'interrupted'
  requested: number
  created: number
  failed: number
  createdAt: string
  failureCategory?: string
  interruptedReason?: string
  drafts?: Array<{ questionId: string; stem: string; lifecycle: Lifecycle }>
}

/** GAP-M4 — duplicate clusters, counts only. */
export type DuplicateCluster = { contentHash: string; count: number }

/** GAP-M6 — a provider row with the secret tail the display rule expects. */
export type ProviderView = Provider & {
  keyLast4?: string
  hasKey: boolean
  capabilities?: ModelCapabilities
  /** The provider's own default model (`provider.defaultModel` on the wire). */
  defaultModel?: string
  /** Last `listModels()` result, from the provider's model cache. Display only — never an allow-list. */
  models?: string[]
}

/**
 * `POST /providers/:id/test` (API_SPECIFICATION §7 x / PROVIDER_INTEGRATION §5). A failed test is a 200 with
 * `ok: false`; `code` is the registry code so the card can say why it failed (unknown to this client → generic).
 */
export type ProviderTestResult =
  | { ok: true; latencyMs: number; detected?: unknown }
  | { ok: false; latencyMs: number; reason?: string; code?: string }

/** GAP-M8 — task→model map. */
export type TaskId = 'question' | 'explanation' | 'material' | 'analysis'
export type TaskMapEntry = { task: TaskId; providerId: string | null; modelId: string | null }
export type TaskMapUpdate = {
  tasks: TaskMapEntry[]
  capabilityFlags: { jsonMode: boolean; streaming: boolean; maxContext: number | null }
}

/** GAP-M9 — ConfigSummary used by blocked states. */
export type ConfigSummary = {
  configId: string
  configVersion: number
  scoringVersion: number
  state: ExamConfig['state']
  label: string
}

/**
 * ── FRONTEND_DATA_CONTRACTS §3 types — API_ENDPOINTS + the canonical docs of each ──────────
 */

/** `GET /latihan/submateri` — a leaf usable as a practice unit, with its stock (API_ENDPOINTS §3). */
export type SubmateriLeaf = {
  competencyId: string
  test: Test
  label: string
  availableQuestions: number
}

/** `Package.definition` — PACKAGE_SPECIFICATION §1. */
export type PackageDefinition = {
  kind: 'full_simulation' | 'subtest' | 'submateri'
  test?: Test
  competencyIds?: string[]
  itemCount: number
  difficultyMix?: { easy: number; medium: number; hard: number }
  repeatPolicy: 'avoid_answered' | 'allow_repeat'
}

export type PackageAvailability = {
  eligibleStock: number
  requiredStock: number
  repeatCount: number
  startable: boolean
  unavailableReason: string | null
}

/** `GET /packages` — API_ENDPOINTS §3. */
export type Package = {
  id: string
  mode: 'tryout' | 'latihan'
  source: 'builtin' | 'dynamic' | 'custom'
  titleId: string
  version: number
  definition: PackageDefinition
  availability: PackageAvailability
  /** The config pin, adapted from the backend's `examConfigId`; absent when the version pins none. */
  configId?: string
  examConfigVersion?: number | null
  retiredAt: string | null
}

/** `GET /sessions` — history row (API_ENDPOINTS §4: mode + result summary). */
export type SessionSummary = {
  id: string
  mode: 'tryout' | 'latihan'
  status: 'open' | 'submitted' | 'scored' | 'blocked'
  packageId: string
  /** The package version the session was frozen on, and the config it was scored under. */
  packageVersion?: number
  configId?: string
  startedAt: string
  submittedAt: string | null
  totalEarned: number | null
  totalPossible: number | null
}

export type DeletionImpact = { derivedChanges: string[]; sessionsAffected: number }

/** `GET /analytics` — only the per-competency series the detail screen charts (ANALYTICS_ENGINE §6). */
export type TrendPoint = { sessionId: string; finishedAt: string; percent: number; answeredCount: number }
export type TrendSeries = {
  competencyId: string
  points: TrendPoint[]
  state: 'reportable' | 'insufficient_data'
  direction: 'stable' | 'improving' | 'declining' | 'mixed'
}

/** `GET /recommendations/materials` — RECOMMENDATION_ENGINE §4. */
export type MaterialOffer =
  | { status: 'available'; materialId: string; version: number; title: string }
  | { status: 'draft_available'; materialId: string; hint: 'setujui_dulu' }
  | { status: 'none'; action: 'generate_material' }

/** `GET /materials` — MATERIAL_SPECIFICATION §1. */
export type Material = {
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

/** `GET /question-reports` — the queue rows the tiering screen decides on. */
export type QuestionReport = {
  id: string
  questionId: string
  severity: 'minor' | 'major' | 'critical'
  category: string
  note: string
  targetContentVersion: number
  createdAt: string
}

/**
 * `GET /question-batches` — the counts the review screen renders as returned. The sampled items
 * themselves have no defined shape (GAP-M3 sibling, see FRONTEND_GAP_REGISTER): the queue row carries
 * only what is documented.
 */
export type QuestionBatch = {
  batchId: string
  createdAt: string
  total: number
  passedForSampling: number
  quarantined: number
  sampleStatus: 'pending' | 'sampled'
  sampleSize: number | null
}

/** Sampling outcome submitted to `POST /question-batches/:batchId/sample` (API_ENDPOINTS §6). */
export type SampleOutcome = 'clean' | 'findings' | 'systemic'

/** `GET /settings/backup` and `GET /backups` — DEPLOYMENT_AND_BACKUP §2. */
export type BackupSettings = { folder: string; keepLastN: number; maxAgeDays: number; dataLocation: string }
export type BackupRecord = {
  id: string
  createdAt: string
  status: 'succeeded' | 'failed'
  reason: string | null
  sizeBytes: number
}
export type RestoreValidation = {
  compatible: boolean
  schemaVersion: string
  checks: Array<{ name: string; passed: boolean; message?: string }>
}

/**
 * `PUT /providers/:id/capabilities` — AI_PROVIDER_ARCHITECTURE §3. Every flag carries where its
 * current value came from: the connection test (`detected`) or the user (`manual`).
 */
export type CapabilityFlag<T> = { value: T; source: 'detected' | 'manual' }
export type ModelCapabilities = {
  jsonMode: CapabilityFlag<boolean>
  streaming: CapabilityFlag<boolean>
  maxContext: CapabilityFlag<number | null>
}

/** `GET /ai-routing` — AI_PROVIDER_ARCHITECTURE §4. */
export type AiRouting = {
  default: { providerId: string | null; modelId: string | null }
  perTask: TaskMapEntry[]
}

/** `GET /notifications` — NOTIFICATION_SPECIFICATION §3. */
export type Notification = {
  id: string
  type: string
  severity: 'info' | 'action' | 'warning' | 'error'
  titleKey: string
  params: Record<string, string | number>
  link?: { route: string; entityId: string }
  createdAt: string
  readAt: string | null
  dismissedAt: string | null
}

/** Body of `POST /questions` — QUESTION_SPECIFICATION §1 (the authoring half only). */
export type QuestionDraft = {
  test: Test
  competencyId: string
  difficulty: 'easy' | 'medium' | 'hard'
  stem: string
  options: Array<{ key: 'A' | 'B' | 'C' | 'D' | 'E'; text: string }>
  answerKey: AnswerKey
  explanation: string
}

/** Body of `POST /packages` — PACKAGE_SPECIFICATION §1. */
export type PackageDraft = {
  mode: 'tryout' | 'latihan'
  titleId: string
  definition: PackageDefinition
}

/**
 * `GET /bootstrap` — the read-only snapshot the app paints itself from. It carries no `examConfigs`: the learner
 * never selects a config (PACKAGE_SPECIFICATION §3, decision B3). `taxonomy`, `packages`, `notifications` and
 * `defaults` arrive in the payload; their inner shapes are not in the frontend contracts (GAP), so they stay `unknown`.
 */
export type BootstrapResponse = {
  taxonomy?: unknown
  packages?: unknown
  notifications?: unknown
  defaults?: unknown
  providers: ProviderView[]
  questionBankSummary: { total: number; active: number; byLifecycle: Record<Lifecycle, number> }
  analyticsReady: boolean
}
