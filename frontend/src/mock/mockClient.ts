import type {
  AiRouting,
  AnalyticsSnapshot,
  AnswersPatch,
  BackupRecord,
  BackupSettings,
  BootstrapResponse,
  DeletionImpact,
  DuplicateCluster,
  ExamConfig,
  GenerationJob,
  Lifecycle,
  Material,
  MaterialOffer,
  Notification,
  Package,
  PackageDraft,
  ProvisionalApproval,
  ProviderView,
  Question,
  QuestionDraft,
  RestoreValidation,
  ReviewQuestion,
  ScoreResult,
  SessionDetail,
  SessionScoreResult,
  SessionSummary,
  ThresholdEvaluation,
  TrendSeries,
  VerdictWithheld,
} from '../types/contracts'
import type { ApiClient } from '../data/client'
import type { Failure, Result } from '../data/errors'
import { CONFIGS, OUTSTANDING_WARNINGS, PROVISIONAL_CONFIG_ID, REGULATORY_BASIS_HASH } from './configs'
import { QUESTIONS } from './questions'
import { mockAnalytics } from './analytics'
import { buildScoreResult, patchToAnswers } from './selfcheck'
import { DRILL_ROSTER, EXAM_ROSTER } from './examRoster'
import {
  BACKUPS,
  BACKUP_SETTINGS,
  MATERIALS,
  PACKAGES,
  QUESTION_BATCHES,
  QUESTION_REPORTS,
  SEED_SESSIONS,
  SUBMATERI,
  offerIndexFor,
  testOf,
  trendFor,
} from './data'

/**
 * `MOCK DATA — NOT FROM API`
 *
 * The only implementation of `ApiClient` at Gate 2. It returns the documented envelopes' contents,
 * including typed failures, and it never computes a percentage, rank or threshold verdict — except
 * inside the single scoring helper the real scorer would replace (`selfcheck.buildScoreResult`, which
 * the fixture check verifies). One seam: no component knows whether this module or HTTP answered.
 *
 * Sections follow API_ENDPOINTS: configs · packages/sessions · history/analytics · questions ·
 * materials · providers/routing · generation · notifications · backup.
 */

const ok = <T>(data: T): Result<T> => ({ ok: true, data })
const fail = <T>(f: Failure): Result<T> => ({ ok: false, failure: f })
const notFound = (what: string): Failure => ({ status: 404, code: 'NOT_FOUND', what })
const conflict = (reason: string): Failure => ({ status: 409, code: 'CONFLICT', reason })

const LOG_TAG = 'MOCK DATA — NOT FROM API'
if (import.meta.env.DEV) console.info(`[data] all responses are ${LOG_TAG}`)

/** Explicit dev toggles (FRONTEND_MOCK_DATA_STRATEGY §3). Never random, never automatic. */
export type ErrorToggle = 'approval_missing' | 'preflight' | 'contract' | 'none'
const toggles: { submit: ErrorToggle } = { submit: 'none' }
export function setErrorToggle(which: keyof typeof toggles, value: ErrorToggle): void {
  toggles[which] = value
}
export function getErrorToggles(): typeof toggles {
  return { ...toggles }
}

// ── in-memory state (tab-only; a reload resets it — the mock holds no browser storage) ─────────────

type Session = {
  detail: SessionDetail
  answers: Map<string, string | null>
  summary: SessionSummary
  frozenAt?: string
  result?: SessionScoreResult
  blocked?: Failure
}

const sessions = new Map<string, Session>()
let approval: ProvisionalApproval | null = null
let jobSeq = 1
const jobs = new Map<string, GenerationJob>()

const MOCK_MODELS = ['mock-model', 'mock-model-small']

const PROVIDERS: ProviderView[] = [
  {
    id: 'local-mock',
    name: 'Local mock provider',
    baseUrl: 'http://127.0.0.1:11434/v1',
    keyRef: 'secret:local-mock',
    keyLast4: 'MOCK',
    hasKey: true,
    headers: {},
    timeoutMs: 30000,
    retries: 2,
    extraParams: {},
    createdAt: '2026-11-08T02:00:00.000Z',
    defaultModel: 'mock-model',
    models: [...MOCK_MODELS],
  },
]

const ROUTING_DEFAULT = { providerId: 'local-mock' as string | null, modelId: 'mock-model' as string | null }

/** Prepends one in-app notification; the title is a catalogue key, never free text (§3). */
function pushNotification(type: string, severity: Notification['severity'], params: Notification['params'], link?: Notification['link']): void {
  notifications.unshift({
    id: `ntf-${notifications.length + 1}`,
    type,
    severity,
    titleKey: `notif.${type}`,
    params,
    link,
    createdAt: new Date().toISOString(),
    readAt: null,
    dismissedAt: null,
  })
}

const notifications: Notification[] = [
  {
    id: 'ntf-03',
    type: 'batch_awaiting_sampling',
    severity: 'action',
    titleKey: 'notif.batch_awaiting_sampling',
    params: { batchId: 'bat-02', total: 12 },
    link: { route: '/lainnya/review-soal', entityId: 'bat-02' },
    createdAt: '2026-11-07T04:05:00.000Z',
    readAt: null,
    dismissedAt: null,
  },
  {
    id: 'ntf-02',
    type: 'backup_failed',
    severity: 'error',
    titleKey: 'notif.backup_failed',
    params: { reason: 'Folder backup tidak dapat diakses' },
    createdAt: '2026-11-07T01:02:00.000Z',
    readAt: null,
    dismissedAt: null,
  },
  {
    id: 'ntf-01',
    type: 'generation_completed',
    severity: 'info',
    titleKey: 'notif.generation_completed',
    params: { jobId: 'job-1', created: 5 },
    createdAt: '2026-11-06T06:00:00.000Z',
    readAt: '2026-11-06T07:00:00.000Z',
    dismissedAt: null,
  },
]

function rosterQuestions(): Question[] {
  return QUESTIONS.filter((q) => q.lifecycle === 'active')
}

/**
 * The roster a non-full-simulation package gets: the already-broken-down `EXAM_ROSTER`. Full simulations
 * use the whole live active bank (GAP-F11: no route returns "the roster for this config").
 */
function rosterFor(pkg: Package): SessionDetail['questions'] {
  if (pkg.definition.kind === 'full_simulation') return EXAM_ROSTER
  const ids = new Set(rosterQuestions().map((q) => q.id))
  return EXAM_ROSTER.filter((q) => ids.has(q.questionId))
}

function thresholdsFor(configId: string): ThresholdEvaluation {
  if (configId !== 'skd-cpns-2024') return { mode: 'none' }
  return {
    mode: 'per_subtest_and_total',
    passed: true,
    passesBySubtest: { TWK: true, TIU: false, TKP: true },
    basisTier: 'HISTORICAL',
    basisPathway: 'CPNS',
    noticeRequired: true,
  }
}

/**
 * The verdict-only reason a scored session carries (API_SPECIFICATION §4): a threshold rule applies but no valid
 * approval authorises a verdict, so the result is a 200 with `verdict: null` and this `withheld` — never a 409.
 */
function withheldFor(config: ExamConfig | undefined, validApproval: ProvisionalApproval | null): VerdictWithheld | null {
  const thresholds = thresholdsFor(config?.id ?? '')
  if (thresholds.mode === 'none' || validApproval !== null) return null
  return { code: 'APPROVAL_MISSING', changed: [] }
}

function score(session: Session): SessionScoreResult {
  const config = CONFIGS.find((c) => c.id === session.detail.configId)
  // An approval for an older config version is invalid and is not attached (ADR-004).
  const validApproval = approval && sameVersions(config, approval) ? approval : null
  const thresholds = thresholdsFor(session.detail.configId)
  const withheld = withheldFor(config, validApproval)
  const answers = [...session.answers].map(([questionId, selected]) => ({ questionId, selected }))
  return {
    ...buildScoreResult({
      sessionId: session.detail.sessionId,
      configId: session.detail.configId,
      configVersion: config?.configVersion ?? 1,
      scoringVersion: config?.scoringVersion ?? 1,
      approval: validApproval,
      thresholds,
      // The threshold evaluation is the verdict only when an approval authorises it (SCORING_METHODOLOGY §5.4).
      verdict: validApproval !== null && thresholds.mode !== 'none' ? thresholds : null,
      withheld,
      roster: rosterQuestions(),
      answers,
    }),
    bucketUnit: 'points',
  }
}

const LIFECYCLE_COUNT = (lifecycle: Lifecycle) => QUESTIONS.filter((q) => q.lifecycle === lifecycle).length

const bootstrap = (): BootstrapResponse => ({
  providers: PROVIDERS,
  questionBankSummary: {
    total: QUESTIONS.length,
    active: LIFECYCLE_COUNT('active'),
    byLifecycle: {
      draft: LIFECYCLE_COUNT('draft'),
      ai_validated: LIFECYCLE_COUNT('ai_validated'),
      human_reviewed: LIFECYCLE_COUNT('human_reviewed'),
      active: LIFECYCLE_COUNT('active'),
      quarantined: LIFECYCLE_COUNT('quarantined'),
      rejected: LIFECYCLE_COUNT('rejected'),
      archived: LIFECYCLE_COUNT('archived'),
    },
  },
  analyticsReady: true,
})

const wait = () => new Promise<void>((r) => setTimeout(r, 220))

/**
 * Advances a job one poll step: `queued` → `running`, then one more created draft per call until the
 * requested count is reached (`done`). Drafts carry the shape QUESTION_SPECIFICATION §1 shows for review.
 */
function advance(job: GenerationJob): GenerationJob {
  if (job.status === 'queued') {
    job.status = 'running'
  } else if (job.status === 'running') {
    const draft = rosterQuestions()[job.created % Math.max(rosterQuestions().length, 1)]
    job.created += 1
    if (draft) {
      job.drafts = [...(job.drafts ?? []), { questionId: `q-gen-${job.jobId}-${job.created}`, stem: draft.stem, lifecycle: 'draft' }]
      pushNotification('draft_generated', 'info', { jobId: job.jobId, created: job.created })
    }
    if (job.created >= job.requested) job.status = 'done'
  }
  return { ...job }
}

/** Splits (configId, mode) into the session fields; the client only sends a package id. */
function configForPackage(pkg: Package): string {
  return pkg.configId ?? PROVISIONAL_CONFIG_ID
}

/** Inserts a new open session into the map and returns its id. */
function openSession(configId: string, mode: 'tryout' | 'practice', roster: SessionDetail['questions'], packageId: string): string {
  const sessionId = `ses-${Date.now().toString(36)}-${sessions.size}`
  const startedAt = new Date().toISOString()
  sessions.set(sessionId, {
    // No countdown in the mock (no deadline in its contract), so `durationMs` is null and the clock never expires.
    detail: { sessionId, configId, mode, status: 'open', durationMs: null, activeMs: 0, runningSince: startedAt, expired: false, questions: roster },
    answers: new Map(),
    summary: { id: sessionId, mode: mode === 'tryout' ? 'tryout' : 'latihan', status: 'open', packageId, startedAt, submittedAt: null, totalEarned: null, totalPossible: null },
  })
  return sessionId
}

/** True when an approval binds the config's current `(configVersion, scoringVersion)` pair (ADR-004). */
function sameVersions(config: ExamConfig | undefined, a: ProvisionalApproval): boolean {
  return a.configVersion === config?.configVersion && a.scoringVersion === config?.scoringVersion
}

/** Maps the package mode onto the session payload's two-value `mode` field. */
const sessionMode = (mode: 'tryout' | 'latihan'): 'tryout' | 'practice' => (mode === 'tryout' ? 'tryout' : 'practice')

/** Seed sessions are summaries only (GAP-F2); their result is replayed once from the fixture scorer. */
const seedScored = new Map<string, ScoreResult>()

/**
 * A seed session's result: the fixture scorer applied to the same active roster the review reads.
 * `MOCK DATA — NOT FROM API` — the seed's own numbers are not reachable, and no formula is invented
 * beyond the one `selfcheck.ts` already uses for live mock sessions.
 */
function seedResult(id: string): ScoreResult {
  const cached = seedScored.get(id)
  if (cached) return cached
  const roster = rosterQuestions()
  const chosen = ['C', 'B', 'D', 'E', 'B', 'A']
  const answers = roster.map((q, i) => ({ questionId: q.id, selected: chosen[i % chosen.length] }))
  const result = buildScoreResult({
    sessionId: id,
    configId: PROVISIONAL_CONFIG_ID,
    configVersion: 1,
    scoringVersion: 1,
    approval: null,
    thresholds: thresholdsFor(PROVISIONAL_CONFIG_ID),
    roster,
    answers,
  })
  seedScored.set(id, result)
  return result
}

export const mockClient: ApiClient = {
  // ── configs ─────────────────────────────────────────────────────────────────────────────────────

  async bootstrap() {
    await wait()
    return ok(bootstrap())
  },

  async examConfigs() {
    await wait()
    return ok(CONFIGS)
  },

  async examConfig(id) {
    await wait()
    const config = CONFIGS.find((c) => c.id === id)
    return config ? ok(config) : fail(notFound('konfigurasi'))
  },

  async approveConfig(id, body) {
    await wait()
    const config = CONFIGS.find((c) => c.id === id)
    if (!config) return fail(notFound('konfigurasi'))
    if (config.state !== 'provisional') return fail(conflict('not_provisional'))
    const missing = OUTSTANDING_WARNINGS.filter((w) => !body.acknowledgedWarnings.includes(w.id))
    if (missing.length > 0) {
      return fail({
        status: 400,
        code: 'VALIDATION_FAILED',
        fields: missing.map((m) => ({
          path: 'acknowledgedWarnings',
          message: `Peringatan ${m.id} belum dicentang.`,
          rule: 'all_outstanding_warnings',
        })),
      })
    }
    approval = {
      configId: config.id,
      configVersion: config.configVersion,
      scoringVersion: config.scoringVersion,
      regulatoryBasisHash: REGULATORY_BASIS_HASH,
      approvedByUserAt: new Date().toISOString(),
      approvedBy: 'Pengguna lokal',
      acknowledgedWarnings: [...body.acknowledgedWarnings],
    }
    config.approvedAt = approval.approvedByUserAt
    return ok({ approvedByUserAt: approval.approvedByUserAt })
  },

  async createExamConfig(body) {
    await wait()
    const missing = OUTSTANDING_WARNINGS.filter((w) => !body.acknowledgedWarnings.includes(w.id))
    if (missing.length > 0) {
      return fail({
        status: 400,
        code: 'VALIDATION_FAILED',
        fields: missing.map((m) => ({ path: 'acknowledgedWarnings', message: `Peringatan ${m.id} belum dicentang.`, rule: 'all_outstanding_warnings' })),
      })
    }
    const config = {
      id: `skd-cpns-${body.examYear}-draft-${CONFIGS.length}`,
      examYear: body.examYear,
      pathway: 'CPNS' as const,
      state: 'provisional' as const,
      configVersion: 1,
      scoringVersion: 1,
      regulatoryBasis: CONFIGS.find((c) => c.id === PROVISIONAL_CONFIG_ID)?.regulatoryBasis ?? [],
      structure: {},
      scoring: {},
      thresholds: { ...body.thresholds, source: { document: 'Nilai yang diisi pengguna (mock)', number: '-', tier: 'UNVERIFIED' as const, pathway: 'CPNS' as const } },
      notice: 'Aturan CPNS 2026 belum terbit. Ambang batas ini diisi pengguna dan belum terverifikasi; hasil tidak memuat putusan kelulusan sampai ada dasar hukum dan persetujuan.',
      derivedFrom: PROVISIONAL_CONFIG_ID,
    }
    CONFIGS.push(config)
    return ok(config)
  },

  // ── packages + session start ────────────────────────────────────────────────────────────────────

  async packages(mode) {
    await wait()
    const active = PACKAGES.filter((p) => p.retiredAt === null)
    return ok(mode ? active.filter((p) => p.mode === mode) : active)
  },

  async package(id) {
    await wait()
    const pkg = PACKAGES.find((p) => p.id === id)
    return pkg ? ok(pkg) : fail(notFound('paket'))
  },

  async createPackage(body: PackageDraft) {
    await wait()
    const pkg = buildPackage(`pkg-custom-${PACKAGES.length + 1}`, body, 1)
    PACKAGES.push(pkg)
    return ok(pkg)
  },

  async packageVersion(id, body: PackageDraft) {
    await wait()
    const index = PACKAGES.findIndex((p) => p.id === id)
    if (index === -1) return fail(notFound('paket'))
    const pkg = buildPackage(id, body, PACKAGES[index].version + 1)
    PACKAGES[index] = pkg
    return ok(pkg)
  },

  async retirePackage(id) {
    await wait()
    const pkg = PACKAGES.find((p) => p.id === id)
    if (!pkg) return fail(notFound('paket'))
    if (pkg.retiredAt) return fail(conflict('illegal_transition'))
    pkg.retiredAt = new Date().toISOString()
    return ok(pkg)
  },

  async startSession(body) {
    await wait()
    const pkg = PACKAGES.find((p) => p.id === body.packageId)
    if (!pkg) return fail(notFound('paket'))
    if (pkg.retiredAt) return fail(conflict('package_retired'))
    // API_SPECIFICATION §7.4 names `no_eligible_stock`; the package view carries the user-facing reason.
    if (!pkg.availability.startable) return fail(conflict('no_eligible_stock'))
    const roster = rosterFor(pkg)
    if (roster.length === 0) {
      return fail({ status: 409, code: 'CONFLICT', reason: 'no_eligible_stock' })
    }
    const sessionId = openSession(configForPackage(pkg), sessionMode(body.mode), roster, pkg.id)
    return ok({ sessionId })
  },

  async submateri() {
    await wait()
    return ok(SUBMATERI)
  },

  // ── sessions: history, autosave, scoring, deletion ─────────────────────────────────────────────

  async sessions(mode) {
    await wait()
    const rows = [...SEED_SESSIONS, ...[...sessions.values()].map((s) => s.summary)]
    const filtered = mode ? rows.filter((r) => r.mode === mode) : rows
    return ok([...filtered].sort((a, b) => b.startedAt.localeCompare(a.startedAt)))
  },

  async session(id) {
    await wait()
    const session = sessions.get(id)
    return session ? ok(session.detail) : fail(notFound('sesi'))
  },

  async saveAnswers(id, body: AnswersPatch) {
    await wait()
    const session = sessions.get(id)
    if (!session) return fail(notFound('sesi'))
    if (session.detail.status !== 'open') {
      return fail(conflict(session.detail.status === 'submitted' || session.detail.status === 'scored' ? 'already_submitted' : 'session_not_open'))
    }
    for (const a of patchToAnswers(body)) session.answers.set(a.questionId, a.selected)
    // Rule 2: an answer save pauses the clock; `wakeSession` resumes it.
    session.detail = { ...session.detail, runningSince: null }
    return ok({ savedAt: new Date().toISOString() })
  },

  async wakeSession(id) {
    await wait()
    const session = sessions.get(id)
    if (!session) return fail(notFound('sesi'))
    if (session.detail.status !== 'open') {
      return fail(conflict(session.detail.status === 'submitted' || session.detail.status === 'scored' ? 'already_submitted' : 'session_not_open'))
    }
    const { activeMs, expired } = session.detail
    // Rule 3: resume from the stored `activeMs`. A seeded open session has no store; it resumes as-is.
    const resumed = expired ? { activeMs, runningSince: null as string | null } : { activeMs, runningSince: new Date().toISOString() }
    session.detail = { ...session.detail, ...resumed }
    return ok({ ...resumed, expired })
  },

  async submitSession(id, body) {
    await wait()
    const session = sessions.get(id)
    if (!session) return fail(notFound('sesi'))
    if (session.detail.status !== 'open') {
      return fail(conflict(session.detail.status === 'submitted' || session.detail.status === 'scored' ? 'already_submitted' : 'session_not_open'))
    }

    const known = new Set(session.detail.questions.map((q) => q.questionId))
    const duplicates = patchToAnswers(body).filter((a) => !known.has(a.questionId))
    if (duplicates.length > 0) {
      return fail({
        status: 422,
        code: 'PREFLIGHT_FAILED',
        errors: duplicates.map((d) => ({
          code: 'PF-00',
          path: d.questionId,
          message: 'Jawaban untuk soal yang tidak ada di sesi ini.',
          severity: 'block',
        })),
      })
    }

    for (const a of patchToAnswers(body)) session.answers.set(a.questionId, a.selected)
    session.detail = { ...session.detail, status: 'submitted' }
    session.frozenAt = new Date().toISOString()
    session.summary = { ...session.summary, status: 'submitted', submittedAt: session.frozenAt }

    if (toggles.submit === 'preflight') {
      return fail({
        status: 422,
        code: 'PREFLIGHT_FAILED',
        errors: [{ code: 'SC-03', path: null, message: 'Kunci jawaban tidak konsisten dengan bobot soal.', severity: 'block' }],
      })
    }
    if (toggles.submit === 'contract') {
      return fail({ status: 426, code: 'CONTRACT_MISMATCH', expected: '1', actual: '2' })
    }
    // A missing approval never blocks the submit (SCORING_METHODOLOGY §5.6, §11): the snapshot is
    // scored now and only the verdict is withheld until the result is next read with an approval.
    session.result = score(session)
    session.detail = { ...session.detail, status: 'scored' }
    session.summary = { ...session.summary, status: 'scored', totalEarned: session.result.total.earned, totalPossible: session.result.total.possible }
    return ok(session.result)
  },

  async rescoreSession(id) {
    await wait()
    const session = sessions.get(id)
    if (!session) return fail(notFound('sesi'))
    if (session.detail.status === 'open') return fail(conflict('not_submitted'))
    if (session.detail.status === 'scored') return fail(conflict('not_resubmittable'))
    // Rescoring never blocks on a missing approval: the score stands and only the verdict is withheld
    // (SCORING_METHODOLOGY §5.6, §11; API_SPECIFICATION §4).
    session.result = score(session)
    session.blocked = undefined
    session.detail = { ...session.detail, status: 'scored' }
    session.summary = { ...session.summary, status: 'scored', totalEarned: session.result.total.earned, totalPossible: session.result.total.possible }
    return ok(session.result)
  },

  /** Seed sessions have no in-memory record; they are already scored in the fixture data (GAP-F2). */
  async sessionResult(id) {
    await wait()
    const session = sessions.get(id)
    if (!session && SEED_SESSIONS.some((s) => s.id === id)) return ok(seedResult(id))
    if (!session) return fail(notFound('sesi'))
    if (session.detail.status === 'open') return fail(conflict('not_submitted'))
    // The stored snapshot is scored once; an approval added afterwards fills the verdict slot only.
    if (session.result) {
      const config = CONFIGS.find((c) => c.id === session.detail.configId)
      const valid = approval && sameVersions(config, approval) ? approval : null
      const thresholds = session.result.thresholds
      return ok<ScoreResult>({
        ...session.result,
        approval: valid,
        verdict: valid !== null && thresholds.mode !== 'none' ? thresholds : null,
        withheld: withheldFor(config, valid),
      })
    }
    if (session.blocked) return fail(session.blocked)
    // No stored result: the session was submitted without being scored — distinct from a withheld verdict.
    return fail(conflict('not_scored'))
  },

  async reviewQuestions(id, ids) {
    await wait()
    const session = sessions.get(id)
    /** Every bad id is one refusal, so a caller cannot learn which ids exist (API_SPECIFICATION §7.7, E78-T3). */
    const uniform = (): Failure => ({
      status: 400,
      code: 'VALIDATION_FAILED',
      fields: [{ path: 'ids', message: 'Permintaan soal tidak valid.', rule: 'E78' }],
    })
    const roster = session
      ? session.detail.questions.map((q) => q.questionId)
      : SEED_SESSIONS.some((s) => s.id === id)
        ? rosterQuestions().map((q) => q.id)
        : null
    if (!roster) return fail(notFound('sesi'))
    if (ids.length === 0 || ids.length > 20) return fail(uniform())
    if (new Set(ids).size !== ids.length) return fail(uniform())
    const inRoster = new Set(roster)
    if (!ids.every((qid) => inRoster.has(qid))) return fail(uniform())
    const result = session
      ? session.detail.status === 'scored'
        ? session.result
        : undefined
      : seedResult(id)
    if (!result) return fail(conflict('not_submitted'))
    // The mock freezes at the current version: no re-edited question exists, so every frozen copy matches.
    // Fixture (f) of FRONTEND_MOCK_DATA_STRATEGY §3 (a version mismatch) has no source here — recorded
    // as unverifiable rather than simulated with a fabricated version.
    const byId = new Map<string, ReviewQuestion>()
    for (const qid of ids) {
      const q = QUESTIONS.find((row) => row.id === qid)
      const row = result.byQuestion.find((r) => r.questionId === qid)
      if (!q) {
        byId.set(qid, {
          questionId: qid,
          test: row?.test ?? 'TWK',
          stem: '',
          options: [],
          keyedOption: null,
          optionScores: {},
          earned: row?.earned ?? 0,
          maxScore: row?.maxScore ?? 0,
          selected: row?.selected ?? null,
          correct: row?.correct ?? null,
          frozenContentVersion: 0,
          latestContentVersion: null,
          explanation: null,
          explanationSource: 'none',
          optionJustifications: null,
          justificationsSource: 'none',
          questionState: 'missing',
        })
        continue
      }
      const scores = q.answerKey.optionScores
      const atMax = Object.keys(scores).filter((k) => scores[k] === q.answerKey.maxScore)
      const justifications = q.answerKey.optionJustifications ?? null
      byId.set(qid, {
        questionId: qid,
        test: q.test,
        stem: q.stem,
        asset: q.asset,
        options: q.options,
        // One maximum = the key. The weights are never compared by the screen (BR-X2).
        keyedOption: q.test !== 'TKP' && atMax.length === 1 ? atMax[0] : null,
        optionScores: scores,
        earned: row?.earned ?? 0,
        maxScore: row?.maxScore ?? q.answerKey.maxScore,
        selected: row?.selected ?? null,
        correct: row?.correct ?? null,
        frozenContentVersion: q.contentVersion,
        latestContentVersion: q.contentVersion,
        explanation: q.explanation,
        explanationSource: q.explanation ? 'latest' : 'none',
        optionJustifications: justifications,
        justificationsSource: justifications ? 'frozen' : 'none',
        questionState: q.lifecycle === 'archived' ? 'archived' : q.lifecycle === 'quarantined' ? 'quarantined' : 'live',
      })
    }
    // §7.7: the 200 body is `{ sessionId, questions }`, in the order of `ids`.
    return ok({ sessionId: id, questions: ids.map((qid) => byId.get(qid)!) })
  },

  async deletionImpact(id) {
    await wait()
    if (!sessions.has(id) && !SEED_SESSIONS.some((s) => s.id === id)) return fail(notFound('sesi'))
    return ok<DeletionImpact>({
      derivedChanges: ['Metrik analitik akan dihitung ulang tanpa sesi ini.', 'Tren per kompetensi sesi ini hilang dari grafik.'],
      sessionsAffected: 1,
    })
  },

  async deleteSession(id) {
    await wait()
    if (!sessions.delete(id)) return fail(notFound('sesi'))
    return ok(null)
  },

  // ── analytics + recommendations ─────────────────────────────────────────────────────────────────

  async analytics(): Promise<Result<AnalyticsSnapshot>> {
    await wait()
    return ok(mockAnalytics())
  },

  async trends(competencyId): Promise<Result<TrendSeries>> {
    await wait()
    const series = trendFor(competencyId)
    // ANALYTICS_ENGINE §6: fewer than 3 points is never reportable.
    return ok(series)
  },

  async materialsOffer(competencyId) {
    await wait()
    const index = offerIndexFor(competencyId)
    if (index === 0) {
      const material = MATERIALS.find((m) => m.status === 'approved' && m.scope.kind === 'competency' && m.scope.competencyId === competencyId)
        ?? MATERIALS.find((m) => m.status === 'approved')!
      return ok<MaterialOffer>({ status: 'available', materialId: material.id, version: material.version, title: material.title })
    }
    if (index === 1) {
      const draft = MATERIALS.find((m) => m.status === 'draft')!
      return ok<MaterialOffer>({ status: 'draft_available', materialId: draft.id, hint: 'setujui_dulu' })
    }
    return ok<MaterialOffer>({ status: 'none', action: 'generate_material' })
  },

  async drill(body) {
    await wait()
    if (body.competencyIds.length === 0) {
      return fail({ status: 400, code: 'VALIDATION_FAILED', fields: [{ path: 'competencyIds', message: 'Pilih minimal satu submateri.', rule: 'min_items' }] })
    }
    const packageId = `pkg-custom-${PACKAGES.length + 1}`
    const definition = {
      kind: 'submateri' as const,
      test: testOf(body.competencyIds[0]),
      competencyIds: [...body.competencyIds],
      itemCount: DRILL_ROSTER.length,
      repeatPolicy: 'avoid_answered' as const,
    }
    PACKAGES.push({
      id: packageId,
      mode: 'latihan',
      source: 'dynamic',
      titleId: 'Latihan — Drill',
      version: 1,
      definition,
      availability: { eligibleStock: DRILL_ROSTER.length, requiredStock: DRILL_ROSTER.length, repeatCount: 0, startable: true, unavailableReason: null },
      configId: PROVISIONAL_CONFIG_ID,
      retiredAt: null,
    })
    const sessionId = openSession(PROVISIONAL_CONFIG_ID, 'practice', DRILL_ROSTER, packageId)
    return ok({ sessionId, packageId })
  },

  // ── questions ───────────────────────────────────────────────────────────────────────────────────

  async questions(filter) {
    await wait()
    let rows = QUESTIONS
    if (filter.text) {
      const needle = filter.text.toLowerCase()
      rows = rows.filter((q) => q.stem.toLowerCase().includes(needle))
    }
    if (filter.test) rows = rows.filter((q) => q.test === filter.test)
    if (filter.competencyId) rows = rows.filter((q) => q.competencyId.startsWith(filter.competencyId!))
    if (filter.difficulty) rows = rows.filter((q) => q.difficulty === filter.difficulty)
    if (filter.lifecycle) rows = rows.filter((q) => q.lifecycle === filter.lifecycle)
    if (filter.provenance) rows = rows.filter((q) => q.provenance.kind === filter.provenance)
    return ok(rows)
  },

  async question(id) {
    await wait()
    const q = QUESTIONS.find((row) => row.id === id)
    return q ? ok(q) : fail(notFound('soal'))
  },

  async createQuestion(body: QuestionDraft) {
    await wait()
    const fields = validateDraft(body)
    if (fields.length > 0) return fail({ status: 400, code: 'VALIDATION_FAILED', fields })
    const now = new Date().toISOString()
    const question: Question = {
      id: `q-manual-${QUESTIONS.length + 1}`,
      configId: PROVISIONAL_CONFIG_ID,
      test: body.test,
      competencyId: body.competencyId,
      difficulty: body.difficulty,
      stem: body.stem,
      options: body.options.map((o) => ({ key: o.key, text: o.text })),
      answerKey: { ...body.answerKey, scoringVersion: 1 },
      explanation: body.explanation,
      provenance: { kind: 'human_authored', authoredAt: now },
      lifecycle: 'draft',
      review: { reviewer: 'Pengguna lokal', reviewedAt: now, decision: 'accepted' },
      validation: { contentHash: `mock-manual-${QUESTIONS.length + 1}`, result: 'pass', checks: [{ id: 'V-01', passed: true }], validatorVersion: 'mock-1', validatedAt: now },
      language: 'id',
      createdAt: now,
      contentVersion: 1,
      contentHash: `mock-manual-${QUESTIONS.length + 1}`,
    }
    QUESTIONS.push(question)
    return ok(question)
  },

  async acceptQuestion(id, body) {
    await wait()
    return mutate(id, (q) => {
      if (q.lifecycle !== 'draft' && q.lifecycle !== 'ai_validated' && q.lifecycle !== 'quarantined') {
        return { fail: illegal }
      }
      return {
        next: {
          ...q,
          lifecycle: body.decision === 'accepted' ? 'human_reviewed' : 'rejected',
          review: { ...q.review, decision: body.decision, reviewedAt: new Date().toISOString() },
        },
      }
    })
  },

  async activateQuestion(id) {
    await wait()
    return mutate(id, (q) => {
      if (q.lifecycle !== 'human_reviewed') return { fail: illegal }
      const checksPass = q.validation?.result === 'pass'
      if (!checksPass) return { fail: conflict('validation_missing') }
      return { next: { ...q, lifecycle: 'active' } }
    })
  },

  async archiveQuestion(id) {
    await wait()
    return mutate(id, (q) => (q.lifecycle === 'active' ? { next: { ...q, lifecycle: 'archived' } } : { fail: illegal }))
  },

  async bulkArchive(ids) {
    await wait()
    const unique = [...new Set(ids)]
    const allArchivable = unique.every((id) => QUESTIONS.some((q) => q.id === id && q.lifecycle === 'active'))
    // One transaction: any bad id leaves every question untouched (API_ENDPOINTS §6).
    if (!allArchivable) return fail(illegal)
    const archived = unique.map((id) => {
      const index = QUESTIONS.findIndex((q) => q.id === id)
      QUESTIONS[index] = { ...QUESTIONS[index], lifecycle: 'archived' }
      return QUESTIONS[index]
    })
    return ok(archived)
  },

  async quarantineQuestion(id, reason) {
    await wait()
    if (!reason.trim()) {
      return fail({ status: 400, code: 'VALIDATION_FAILED', fields: [{ path: 'reason', message: 'Alasan wajib diisi.', rule: 'required' }] })
    }
    return mutate(id, (q) =>
      ['active', 'ai_validated', 'human_reviewed'].includes(q.lifecycle)
        ? { next: { ...q, lifecycle: 'quarantined', review: { ...q.review, notes: reason } } }
        : { fail: illegal },
    )
  },

  async duplicateClusters() {
    await wait()
    const clusters: DuplicateCluster[] = []
    return ok(clusters)
  },

  async reportQuestion(id, body) {
    await wait()
    if (!body.note.trim()) {
      return fail({ status: 400, code: 'VALIDATION_FAILED', fields: [{ path: 'note', message: 'Catatan wajib diisi.', rule: 'required' }] })
    }
    const target = QUESTIONS.find((q) => q.id === id)
    if (!target) return fail(notFound('soal'))
    QUESTION_REPORTS.unshift({
      id: `rep-${String(QUESTION_REPORTS.length + 1).padStart(2, '0')}`,
      questionId: id,
      severity: body.severity,
      category: body.category,
      note: body.note,
      targetContentVersion: target.contentVersion,
      createdAt: new Date().toISOString(),
    })
    // A critical report auto-quarantines the question (API_ENDPOINTS §6).
    if (body.severity === 'critical') {
      QUESTIONS[QUESTIONS.indexOf(target)] = { ...target, lifecycle: 'quarantined', review: { ...target.review, notes: body.note } }
      pushNotification('question_quarantined', 'warning', { questionId: id }, { route: '/lainnya/soal', entityId: id })
    }
    return ok(null)
  },

  async questionReports() {
    await wait()
    return ok(QUESTION_REPORTS)
  },

  async decideReport() {
    await wait()
    return fail(notFound('laporan'))
  },

  async questionBatches() {
    await wait()
    return ok(QUESTION_BATCHES)
  },

  async recordSample(batchId, body) {
    await wait()
    const batch = QUESTION_BATCHES.find((b) => b.batchId === batchId)
    if (!batch) return fail(notFound('batch'))
    if (body.outcome === 'findings' && body.findings.length === 0) {
      return fail({ status: 400, code: 'VALIDATION_FAILED', fields: [{ path: 'findings', message: 'Temuan wajib diisi bila hasilnya "findings".', rule: 'min_items' }] })
    }
    const sampleSize = body.outcome === 'findings' ? Math.max(body.findings.length, 3) : 3
    Object.assign(batch, { sampleStatus: 'sampled' as const, sampleSize })
    return ok(batch)
  },

  // ── materials ───────────────────────────────────────────────────────────────────────────────────

  async materials() {
    await wait()
    return ok(MATERIALS)
  },

  async material(id) {
    await wait()
    const m = MATERIALS.find((row) => row.id === id)
    return m ? ok(m) : fail(notFound('materi'))
  },

  async createMaterial(body) {
    await wait()
    if (!body.title.trim()) {
      return fail({ status: 400, code: 'VALIDATION_FAILED', fields: [{ path: 'title', message: 'Judul wajib diisi.', rule: 'required' }] })
    }
    const material: Material = {
      id: `mat-new-${MATERIALS.length + 1}`,
      title: body.title,
      contentType: body.contentType,
      scope: body.scope,
      status: 'draft',
      version: 1,
      approvalVersion: null,
      provenance: { kind: 'manual' },
      sources: body.sources,
    }
    MATERIALS.push(material)
    return ok(material)
  },

  async approveMaterial(id) {
    await wait()
    return materialMutate(id, (m) => (m.status === 'retired' ? null : { ...m, status: 'approved', approvalVersion: m.version }))
  },

  async retireMaterial(id) {
    await wait()
    return materialMutate(id, (m) => ({ ...m, status: 'retired' }))
  },

  // ── providers + routing ─────────────────────────────────────────────────────────────────────────

  async providers() {
    await wait()
    return ok(PROVIDERS)
  },

  async createProvider(body) {
    await wait()
    if (!body.key.trim()) {
      return fail({ status: 400, code: 'VALIDATION_FAILED', fields: [{ path: 'key', message: 'Kunci API wajib diisi.', rule: 'required' }] })
    }
    // The key itself is never stored: only its last four characters, and a reference.
    const id = `prov-${body.preset}-${PROVIDERS.length + 1}`
    const provider: ProviderView = {
      id,
      name: body.name,
      baseUrl: body.baseUrl,
      keyRef: `secret:${id}`,
      headers: {},
      timeoutMs: body.timeoutMs,
      retries: body.retries,
      extraParams: {},
      createdAt: new Date().toISOString(),
      hasKey: true,
      keyLast4: body.key.slice(-4),
    }
    PROVIDERS.push(provider)
    return ok(provider)
  },

  async updateProvider(id, body) {
    await wait()
    const provider = PROVIDERS.find((p) => p.id === id)
    if (!provider) return fail(notFound('penyedia'))
    // Same rule as the route's store: editing baseUrl, key or model resets the recorded test (PROVIDER_ARCHITECTURE §5).
    if (body.baseUrl !== undefined || body.defaultModel !== undefined) provider.testedAt = null
    Object.assign(provider, body)
    return ok({ ...provider })
  },

  async deleteProvider(id) {
    await wait()
    const index = PROVIDERS.findIndex((p) => p.id === id)
    if (index === -1) return fail(notFound('penyedia'))
    if (PROVIDERS.length === 1) return fail(conflict('last_provider'))
    PROVIDERS.splice(index, 1)
    // A provider that carried the global model leaves no model behind: clear it like the route's cascade does.
    if (ROUTING_DEFAULT.providerId === id) ROUTING_DEFAULT.providerId = ROUTING_DEFAULT.modelId = null
    return ok(null)
  },

  async testProvider(id, modelId) {
    await wait()
    if (!PROVIDERS.some((p) => p.id === id)) return fail(notFound('penyedia'))
    void modelId
    return ok({ ok: true, latencyMs: 412 })
  },

  async refreshModels(id) {
    await wait()
    const provider = PROVIDERS.find((p) => p.id === id)
    if (!provider) return fail(notFound('penyedia'))
    provider.models = MOCK_MODELS
    return ok([...MOCK_MODELS])
  },

  async saveCapabilities(id, body): Promise<Result<ProviderView>> {
    await wait()
    const provider = PROVIDERS.find((p) => p.id === id)
    if (!provider) return fail(notFound('penyedia'))
    provider.capabilities = body
    return ok({ ...provider })
  },

  async routing(): Promise<Result<AiRouting>> {
    await wait()
    return ok({ default: { ...ROUTING_DEFAULT } })
  },

  async saveRouting(body) {
    await wait()
    // One global model: a default that names an unknown provider is refused with the route's field path.
    if (body.default.providerId !== null && !PROVIDERS.some((p) => p.id === body.default.providerId)) {
      return fail({ status: 400, code: 'VALIDATION_FAILED', fields: [{ path: 'default.providerId', message: 'Penyedia tidak dikenal.', rule: 'exists' }] })
    }
    ROUTING_DEFAULT.providerId = body.default.providerId
    ROUTING_DEFAULT.modelId = body.default.modelId
    return ok({ default: { ...ROUTING_DEFAULT } })
  },

  // ── generation jobs ─────────────────────────────────────────────────────────────────────────────

  async createGenerationJob(body) {
    await wait()
    if (!rosterQuestions().length) return fail(conflict('no_eligible_stock'))
    const jobId = `job-${jobSeq++}`
    jobs.set(jobId, { jobId, status: 'queued', requested: body.count, created: 0, failed: 0, createdAt: new Date().toISOString() })
    return ok({ jobId })
  },

  async generationJobs() {
    await wait()
    return ok([...jobs.values()].map((job) => advance(job)))
  },

  async generationJob(jobId) {
    await wait()
    const job = jobs.get(jobId)
    return job ? ok(advance(job)) : fail(notFound('pekerjaan'))
  },

  async retryGenerationJob(jobId) {
    await wait()
    const job = jobs.get(jobId)
    if (!job) return fail(notFound('pekerjaan'))
    if (job.status !== 'failed' && job.status !== 'interrupted') return fail(conflict('not_retryable'))
    const restarted: GenerationJob = { jobId: job.jobId, status: 'queued', requested: job.requested, created: 0, failed: 0, createdAt: new Date().toISOString() }
    jobs.set(jobId, restarted)
    return ok({ ...restarted })
  },

  // ── notifications ───────────────────────────────────────────────────────────────────────────────

  async notifications() {
    await wait()
    return ok(notifications.map((n) => ({ ...n })))
  },

  async markNotification(id, body) {
    await wait()
    const n = notifications.find((row) => row.id === id)
    if (!n) return fail(notFound('notifikasi'))
    if (body.read !== undefined) n.readAt = body.read ? (n.readAt ?? new Date().toISOString()) : null
    if (body.dismissed !== undefined) n.dismissedAt = body.dismissed ? new Date().toISOString() : null
    return ok({ ...n })
  },

  async markAllNotificationsRead() {
    await wait()
    const now = new Date().toISOString()
    for (const n of notifications) if (!n.readAt) n.readAt = now
    return ok(notifications.map((n) => ({ ...n })))
  },

  // ── backup + restore ────────────────────────────────────────────────────────────────────────────

  async backupSettings() {
    await wait()
    return ok({ ...BACKUP_SETTINGS })
  },

  async saveBackupSettings(body: BackupSettings) {
    await wait()
    Object.assign(BACKUP_SETTINGS, body)
    return ok({ ...BACKUP_SETTINGS })
  },

  async backups() {
    await wait()
    return ok(BACKUPS.map((b) => ({ ...b })))
  },

  async runBackup() {
    await wait()
    const record: BackupRecord = { id: `bak-${String(BACKUPS.length + 1).padStart(3, '0')}`, createdAt: new Date().toISOString(), status: 'succeeded', reason: null, sizeBytes: 18_874_368 }
    BACKUPS.unshift(record)
    return ok({ ...record })
  },

  async validateRestore(archivePath) {
    await wait()
    if (!archivePath.trim()) {
      return fail({ status: 400, code: 'VALIDATION_FAILED', fields: [{ path: 'archivePath', message: 'Berkas arsip wajib dipilih.', rule: 'required' }] })
    }
    return ok<RestoreValidation>({
      compatible: true,
      schemaVersion: 'mock-1',
      checks: [
        { name: 'integrity', passed: true },
        { name: 'schema', passed: true },
        { name: 'references', passed: true },
      ],
    })
  },

  async restore(archivePath) {
    await wait()
    if (!archivePath.trim()) {
      return fail({ status: 400, code: 'VALIDATION_FAILED', fields: [{ path: 'archivePath', message: 'Berkas arsip wajib dipilih.', rule: 'required' }] })
    }
    return ok({ restoreId: `rst-${Date.now().toString(36)}` })
  },
}

const illegal: Failure = conflict('illegal_transition')

/** Builds a package row from a draft, mirroring its availability from the hand-written stock figures. */
function buildPackage(id: string, body: PackageDraft, version: number): Package {
  const required = body.definition.itemCount
  // Stock is a mock figure derived from the required length so a newly created package is startable.
  const eligibleStock = required
  return {
    id,
    mode: body.mode,
    source: 'custom',
    titleId: body.titleId,
    version,
    definition: body.definition,
    availability: { eligibleStock, requiredStock: required, repeatCount: 0, startable: required > 0, unavailableReason: required > 0 ? null : 'Stok soal belum cukup' },
    configId: PROVISIONAL_CONFIG_ID,
    retiredAt: null,
  }
}

/** Returns the per-field errors that block a manual question create, or an empty list. */
function validateDraft(body: QuestionDraft) {
  const fields: Array<{ path: string; message: string; rule: string }> = []
  if (!body.stem.trim()) fields.push({ path: 'stem', message: 'Perintah soal wajib diisi.', rule: 'required' })
  if (body.options.length !== 5) fields.push({ path: 'options', message: 'Soal harus memuat lima pilihan A–E.', rule: 'length_5' })
  body.options.forEach((o, i) => {
    if (!o.text.trim()) fields.push({ path: `options[${i}].text`, message: `Pilihan ${o.key} tidak boleh kosong.`, rule: 'required' })
  })
  if (!body.explanation.trim()) fields.push({ path: 'explanation', message: 'Pembahasan wajib diisi.', rule: 'required' })
  return fields
}

/** Applies a change to one material and returns the new record; `null` from `fn` is an illegal transition. */
async function materialMutate(id: string, fn: (m: Material) => Material | null): Promise<Result<Material>> {
  const index = MATERIALS.findIndex((m) => m.id === id)
  if (index === -1) return fail(notFound('materi'))
  const next = fn(MATERIALS[index])
  if (next === null) return fail(illegal)
  MATERIALS[index] = next
  return ok(next)
}

/** Applies a lifecycle transition to one question and returns the new record. */
function mutate(id: string, fn: (q: Question) => { next: Question } | { fail: Failure }): Promise<Result<Question>> {
  const index = QUESTIONS.findIndex((q) => q.id === id)
  if (index === -1) return Promise.resolve(fail(notFound('soal')))
  const outcome = fn(QUESTIONS[index])
  if ('fail' in outcome) return Promise.resolve(fail(outcome.fail))
  QUESTIONS[index] = outcome.next
  return Promise.resolve(ok(outcome.next))
}

/** Test-only escape hatch for the fixture script; not imported by screens. */
export const __mockState = { sessions, getApproval: () => approval, setApproval: (a: ProvisionalApproval | null) => (approval = a) }
