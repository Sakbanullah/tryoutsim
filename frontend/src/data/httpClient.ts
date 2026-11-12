import type {
  AiRouting,
  BootstrapResponse,
  DeletionImpact,
  DuplicateCluster,
  ExamConfig,
  GenerationJob,
  Material,
  Notification,
  Package,
  ProviderView,
  Question,
  QuestionBatch,
  QuestionDraft,
  QuestionReport,
  ReviewQuestion,
  ScoreResult,
  SessionDetail,
  SessionQuestion,
  SessionSummary,
  SubmateriLeaf,
} from '../types/contracts'
import type { ApiClient } from './client'
import type { Failure, Result } from './errors'

/**
 * The real backend over HTTP (API_SPECIFICATION §2–§4), behind the same `ApiClient` seam as the mock.
 *
 * `fetch('/api/v1' + path)` is same-origin through the Vite dev proxy (`vite.config.ts`); the backend sends no CORS
 * headers. Every method returns `Result<T>` and never throws. A method whose backend route does not exist returns an
 * explicit "not available" failure (mapped by `toOutcome` to `Outcome.unavailable`), never empty data. Where the
 * backend's wire shape differs from `contracts.ts`, the difference is translated in this file and nowhere else.
 */
const BASE = '/api/v1'
const LOG_TAG = 'API — 127.0.0.1:4317 via /api/v1'

const ok = <T>(data: T): Result<T> => ({ ok: true, data })

/**
 * A route `API_ENDPOINTS` documents but the backend does not serve yet. `UNSUPPORTED` keeps it apart from a
 * transport failure, so the screen offers no retry that cannot succeed and shows no fabricated data.
 */
const notAvailable = (route: string): Failure => ({
  status: 0,
  code: 'UNSUPPORTED',
  message: route,
})

/** A query string from the defined entries only. */
function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, value)
  return search.toString() ? `?${search}` : ''
}

/** Backend values with no documented enum (session mode, status, severities, question difficulty). */
type Wire = Record<string, any>

/**
 * Decode an error envelope into the typed `Failure` the screens branch on. `REGULATORY_*` codes are not in
 * `ErrorCode` (GAP); they arrive as a 409 with `changed[]`, which is how `toOutcome` narrows them.
 */
function toFailure(status: number, body: unknown, retryAfter: string | null): Failure {
  const error = (body as { error?: Wire } | null)?.error
  const code = error?.code ?? ''
  const details = error?.details
  switch (code) {
    case 'VALIDATION_FAILED':
      return { status: 400, code, fields: details?.fields ?? [] }
    case 'NOT_FOUND':
      return { status: 404, code, what: details?.resource ?? 'resource' }
    case 'CONFLICT':
      return { status: 409, code, reason: details?.reason ?? 'unknown' }
    case 'PREFLIGHT_FAILED':
      return { status: 422, code, errors: details?.errors ?? [] }
    case 'APPROVAL_MISSING':
    case 'APPROVAL_INVALID':
    case 'APPROVAL_VERSION_MISMATCH':
    case 'THRESHOLD_CONFIG_INVALID':
      return { status: 409, code, changed: details?.changed ?? [] }
    case 'RATE_LIMITED':
    case 'PROVIDER_UNAVAILABLE':
    case 'PROVIDER_AUTH_FAILED':
    case 'PROVIDER_TIMEOUT':
      return {
        status: status === 429 ? 429 : status === 504 ? 504 : 502,
        code,
        message: error?.message ?? 'The provider call failed.',
        retryAfterMs: retryAfter === null ? details?.retryAfterMs ?? null : Number(retryAfter) * 1000,
      }
    default:
      if (status === 409) {
        return { status: 409, code: 'APPROVAL_INVALID', changed: details?.changed ?? [] }
      }
      if (status === 426) {
        return { status: 426, code: 'CONTRACT_MISMATCH', expected: '1', actual: error?.message ?? 'unknown' }
      }
      return { status: 0, code: 'NETWORK', message: `${status} ${code || 'ERROR'}: ${error?.message ?? 'request failed'}` }
  }
}

/** The backend's mode is `tryout | latihan`; `SessionDetail.mode` on screen is `tryout | practice`. */
const toScreenMode = (mode: string): SessionDetail['mode'] => (mode === 'tryout' ? 'tryout' : 'practice')

/**
 * The backend also emits `blocked`. `SessionStatus` has no `blocked`, and to the runner `blocked` is not open — it
 * is reported as `submitted`; the result screen shows the blocked state from the withheld verdict itself.
 */
const toScreenStatus = (status: string): SessionDetail['status'] =>
  status === 'open' || status === 'scored' ? status : 'submitted'

/**
 * One runner question as `SessionQuestion`. The backend's `difficulty` has no documented enum (a row's
 * `difficultyAiInitial`); any value other than `easy`/`hard` narrows to `medium`.
 */
function toSessionQuestion(raw: Wire): SessionQuestion {
  const difficulty: SessionQuestion['difficulty'] = raw.difficulty === 'easy' || raw.difficulty === 'hard' ? raw.difficulty : 'medium'
  return {
    questionId: raw.questionId,
    test: raw.test,
    competencyId: raw.competencyId,
    difficulty,
    stem: raw.stem,
    options: raw.options,
    provenanceKind: raw.provenanceKind,
    selected: raw.selected ?? null,
    flagged: raw.flagged === true,
    elapsedActiveMs: raw.elapsedActiveMs ?? 0,
  }
}

/** `GET /sessions/:id` and the `runner` of `POST /packages/:id/sessions` share one wire shape (repositories/session). */
function toSessionDetail(raw: Wire): SessionDetail {
  return {
    sessionId: raw.sessionId,
    configId: raw.configId,
    mode: toScreenMode(raw.mode),
    status: toScreenStatus(raw.status),
    durationMs: raw.durationMs,
    activeMs: raw.activeMs,
    runningSince: raw.runningSince,
    expired: raw.expired === true,
    questions: (raw.questions ?? []).map(toSessionQuestion),
  }
}

/** `toPackageView` sends the pin as `examConfigId` / `examConfigVersion`; `Package` carries it as `configId`. */
function toPackage(raw: Wire): Package {
  const { examConfigId, ...rest } = raw
  return { ...rest, configId: examConfigId ?? undefined } as Package
}

/**
 * `toQuestion` sends `difficulty: { aiInitial, empirical }` and carries no explanation, provenance timestamps or
 * review history; the screen reads `difficulty` as a scalar and `explanation` as a string.
 */
function toQuestion(raw: Wire): Question {
  const difficulty = typeof raw.difficulty === 'object' && raw.difficulty !== null ? raw.difficulty.aiInitial : raw.difficulty
  return { ...raw, difficulty, explanation: raw.explanation ?? '' } as Question
}

/** `toMaterial` sends `approval: { version } | null`; `Material` carries `approvalVersion`. */
function toMaterial(raw: Wire): Material {
  const { approval, ...rest } = raw
  return { ...rest, approvalVersion: approval?.version ?? null } as Material
}

/** `toReport` names `contentVersion` / `reportedAt`; `QuestionReport` uses `targetContentVersion` / `createdAt`. */
function toReport(raw: Wire): QuestionReport {
  return {
    id: raw.id,
    questionId: raw.questionId,
    severity: raw.severity === 'critical' ? 'critical' : 'major',
    category: raw.category,
    note: raw.note ?? '',
    targetContentVersion: raw.contentVersion,
    createdAt: raw.reportedAt,
  }
}

/**
 * Backend `ScoreResult` → the screen's type. The backend keeps the threshold evaluation apart as `verdict` (§5.6);
 * `verdict: null` means no verdict exists, rendered as `{ mode: 'none' }` — never a pass or fail the UI would invent.
 */
function toScoreResult(raw: Wire): ScoreResult {
  const { verdict, ...score } = raw
  return { ...score, thresholds: verdict ?? { mode: 'none' } } as ScoreResult
}

/** The manual-create body of `POST /questions` in the row's own field names (routes/questions.js). */
function toQuestionWriteBody(body: QuestionDraft) {
  return {
    test: body.test,
    competencyId: body.competencyId,
    stem: body.stem,
    options: body.options,
    answerKey: body.answerKey,
    explanation: body.explanation,
    difficultyAiInitial: body.difficulty,
  }
}

/**
 * `GET /question-batches` groups questions by generation batch. It carries no `createdAt`, no per-batch passed or
 * quarantined count and no sample size (GAP); those arrive as the documented-sentinel values below, never as a guess.
 */
function toBatchSummary(raw: Wire): QuestionBatch {
  const status: string = raw.status ?? ''
  return {
    batchId: raw.batchId,
    createdAt: '',
    total: raw.questions,
    passedForSampling: 0,
    quarantined: 0,
    sampleStatus: status.startsWith('sampled') ? 'sampled' : 'pending',
    sampleSize: null,
  }
}

/**
 * The client over `fetch`, bound once. Every method delegates to `request`, which is the only place that touches the
 * network and the only place a thrown error is caught.
 */
function buildClient(): ApiClient {
  if (import.meta.env.DEV) console.info(`[data] HTTP mode: ${LOG_TAG}`)

  /** Sends one request and decodes the `{ data }` / `{ error }` envelope. Never throws. */
  async function request<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
    let response: Response
    try {
      response = await fetch(BASE + path, {
        method,
        headers: body === undefined ? { accept: 'application/json' } : { accept: 'application/json', 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      return { ok: false, failure: { status: 0, code: 'NETWORK', message: error instanceof Error ? error.message : 'Network error.' } }
    }
    // DELETE /sessions/:id answers 204 with no body.
    if (response.status === 204) return ok(null as T)
    const payload = (await response.json().catch(() => null)) as { data: T } | null
    if (!response.ok) return { ok: false, failure: toFailure(response.status, payload, response.headers.get('retry-after')) }
    return ok(payload?.data as T)
  }

  return {
    async bootstrap() {
      // The payload carries no `examConfigs` (decision B3: the learner never selects a config), matching the type.
      return request<BootstrapResponse>('GET', '/bootstrap')
    },

    // ── configs ────────────────────────────────────────────────────────────────────────────────────────────
    async examConfigs() {
      // `GET /exam-configs` sends `ConfigSummary` rows (`configId`, `label`, `thresholds`), not `ExamConfig`.
      return request<ExamConfig[]>('GET', '/exam-configs')
    },
    async examConfig(id) {
      return request<ExamConfig>('GET', `/exam-configs/${encodeURIComponent(id)}`)
    },
    async approveConfig(id, body) {
      const res = await request<{ approval: { approvedByUserAt: string } }>('POST', `/exam-configs/${encodeURIComponent(id)}/approval`, body)
      return res.ok ? ok({ approvedByUserAt: res.data.approval.approvedByUserAt }) : res
    },
    async createExamConfig() {
      return { ok: false, failure: notAvailable('POST /exam-configs') }
    },

    // ── packages + session start ───────────────────────────────────────────────────────────────────────────
    async packages(mode) {
      const res = await request<Wire[]>('GET', `/packages${qs({ mode })}`)
      return res.ok ? ok(res.data.map(toPackage)) : res
    },
    async package(id) {
      const res = await request<Wire>('GET', `/packages/${encodeURIComponent(id)}`)
      return res.ok ? ok(toPackage(res.data)) : res
    },
    async createPackage() {
      return { ok: false, failure: notAvailable('POST /packages') }
    },
    async packageVersion() {
      return { ok: false, failure: notAvailable('POST /packages/:id/versions') }
    },
    async retirePackage() {
      return { ok: false, failure: notAvailable('POST /packages/:id/retire') }
    },
    async startSession({ packageId, mode }) {
      // `POST /packages/:id/sessions` → `{ session: { sessionId, … }, runner, configResolution }`.
      const res = await request<{ session: { sessionId: string } }>('POST', `/packages/${encodeURIComponent(packageId)}/sessions`, { mode })
      return res.ok ? ok({ sessionId: res.data.session.sessionId }) : res
    },
    async submateri() {
      return request<SubmateriLeaf[]>('GET', '/latihan/submateri')
    },

    // ── sessions ───────────────────────────────────────────────────────────────────────────────────────────
    async sessions(mode) {
      const res = await request<SessionSummary[]>('GET', `/sessions${qs({ mode })}`)
      return res.ok ? ok(res.data.map((row) => ({ ...row, totalEarned: row.totalEarned ?? null, totalPossible: row.totalPossible ?? null }))) : res
    },
    async session(id) {
      const res = await request<Wire>('GET', `/sessions/${encodeURIComponent(id)}`)
      return res.ok ? ok(toSessionDetail(res.data)) : res
    },
    async saveAnswers(id, body, elapsedActiveMs = 0) {
      // The backend accepts exactly one answer per PATCH (API_SPECIFICATION §7.5); a batch would only keep its last
      // entry anyway. `elapsedActiveMs` is the answer's new cumulative active time; callers without a clock send 0
      // until the runner clock is wired (a later task passes it).
      const answer = body.answers[body.answers.length - 1]
      if (answer === undefined) return ok({ savedAt: new Date().toISOString() })
      return request<{ savedAt: string }>('PATCH', `/sessions/${encodeURIComponent(id)}/answers`, {
        questionId: answer.questionId,
        selected: answer.selectedOption,
        elapsedActiveMs,
      })
    },
    async submitSession(id, body) {
      const res = await request<Wire>('POST', `/sessions/${encodeURIComponent(id)}/submit`, body.answers.length > 0 ? body : undefined)
      return res.ok ? ok(toScoreResult(res.data)) : res
    },
    async rescoreSession(id) {
      const res = await request<Wire>('POST', `/sessions/${encodeURIComponent(id)}/score`)
      return res.ok ? ok(toScoreResult(res.data)) : res
    },
    async sessionResult(id) {
      const res = await request<Wire>('GET', `/sessions/${encodeURIComponent(id)}/result`)
      return res.ok ? ok(toScoreResult(res.data)) : res
    },
    async reviewQuestions(id, ids) {
      return request<{ sessionId: string; questions: ReviewQuestion[] }>('GET', `/sessions/${encodeURIComponent(id)}/questions${qs({ ids: ids.join(',') })}`)
    },
    async deletionImpact(id) {
      return request<DeletionImpact>('GET', `/sessions/${encodeURIComponent(id)}/deletion-impact`)
    },
    async deleteSession(id) {
      return request<null>('DELETE', `/sessions/${encodeURIComponent(id)}`)
    },

    // ── analytics + recommendations (no backend route yet) ─────────────────────────────────────────────────
    async analytics() {
      return { ok: false, failure: notAvailable('GET /analytics') }
    },
    async trends() {
      return { ok: false, failure: notAvailable('GET /analytics/trends') }
    },
    async materialsOffer() {
      return { ok: false, failure: notAvailable('GET /recommendations/materials') }
    },
    async drill() {
      return { ok: false, failure: notAvailable('POST /recommendations/drill') }
    },

    // ── questions ──────────────────────────────────────────────────────────────────────────────────────────
    async questions(filter) {
      // The backend filters by `difficultyAiInitial` and rejects unknown query keys (question-bank.js).
      const res = await request<{ items: Wire[] }>(
        'GET',
        `/questions${qs({
          text: filter.text,
          test: filter.test,
          competencyId: filter.competencyId,
          difficultyAiInitial: filter.difficulty,
          lifecycle: filter.lifecycle,
          provenance: filter.provenance,
        })}`,
      )
      return res.ok ? ok(res.data.items.map(toQuestion)) : res
    },
    async question(id) {
      const res = await request<Wire>('GET', `/questions/${encodeURIComponent(id)}`)
      if (!res.ok) return res
      // `GET /questions/:id` sends the validation records as a list (latest last); the type carries the latest.
      const latest = Array.isArray(res.data.validation) ? res.data.validation.at(-1) : res.data.validation
      return ok(toQuestion({ ...res.data, validation: latest ?? undefined }))
    },
    async createQuestion(body) {
      const res = await request<Wire>('POST', '/questions', toQuestionWriteBody(body))
      return res.ok ? ok(toQuestion(res.data)) : res
    },
    async acceptQuestion(id, body) {
      const res = await request<Wire>('PATCH', `/questions/${encodeURIComponent(id)}/accept`, body)
      return res.ok ? ok(toQuestion(res.data)) : res
    },
    async activateQuestion(id) {
      const res = await request<Wire>('POST', `/questions/${encodeURIComponent(id)}/activate`)
      return res.ok ? ok(toQuestion(res.data)) : res
    },
    async archiveQuestion(id) {
      const res = await request<Wire>('POST', `/questions/${encodeURIComponent(id)}/archive`)
      return res.ok ? ok(toQuestion(res.data)) : res
    },
    async bulkArchive(ids) {
      // Archive-only (PO decision). The route answers `{ archived: n }`; the rows are re-read to keep `Question[]`.
      const res = await request('POST', '/questions/bulk', { questionIds: ids })
      if (!res.ok) return res
      const rows = await Promise.all(ids.map((id) => request<Wire>('GET', `/questions/${encodeURIComponent(id)}`)))
      const failed = rows.find((row) => !row.ok)
      if (failed && !failed.ok) return failed
      return ok(rows.map((row) => toQuestion((row as { ok: true; data: Wire }).data)))
    },
    async quarantineQuestion(id, reason) {
      const res = await request<Wire>('POST', `/questions/${encodeURIComponent(id)}/quarantine`, { reason })
      return res.ok ? ok(toQuestion(res.data)) : res
    },
    async duplicateClusters() {
      return request<DuplicateCluster[]>('GET', '/questions/duplicates')
    },
    async reportQuestion(id, body) {
      // The backend's closed severity set is `critical | non_critical` (REPORT_SPEC); `minor`/`major` file as non-critical.
      const res = await request('POST', `/questions/${encodeURIComponent(id)}/reports`, {
        severity: body.severity === 'critical' ? 'critical' : 'non_critical',
        category: body.category,
        note: body.note,
      })
      return res.ok ? ok(null) : res
    },
    async questionReports() {
      const res = await request<Wire[]>('GET', '/question-reports')
      return res.ok ? ok(res.data.map(toReport)) : res
    },
    async decideReport(id, body) {
      const res = await request<Wire>('PATCH', `/question-reports/${encodeURIComponent(id)}`, { resolution: body.decision })
      return res.ok ? ok(toReport(res.data)) : res
    },
    async questionBatches() {
      const res = await request<Wire[]>('GET', '/question-batches')
      return res.ok ? ok(res.data.map(toBatchSummary)) : res
    },
    async recordSample(batchId, body) {
      const res = await request<{ batchId: string; status: string; questions: number }>('POST', `/question-batches/${encodeURIComponent(batchId)}/sample`, {
        outcome: body.outcome,
        findings: body.findings,
      })
      return res.ok ? ok(toBatchSummary(res.data)) : res
    },

    // ── materials ─────────────────────────────────────────────────────────────────────────────────────────
    async materials() {
      const res = await request<Wire[]>('GET', '/materials')
      return res.ok ? ok(res.data.map(toMaterial)) : res
    },
    async material(id) {
      const res = await request<Wire>('GET', `/materials/${encodeURIComponent(id)}`)
      return res.ok ? ok(toMaterial(res.data)) : res
    },
    async createMaterial(body) {
      const res = await request<Wire>('POST', '/materials', {
        title: body.title,
        contentType: body.contentType,
        scope: body.scope,
        // A material authored here is manual; the backend requires the key (MATERIAL_PROVENANCE_KINDS).
        provenance: { kind: 'manual' },
        sources: body.sources,
        body: body.body,
      })
      return res.ok ? ok(toMaterial(res.data)) : res
    },
    async approveMaterial(id) {
      const res = await request<Wire>('POST', `/materials/${encodeURIComponent(id)}/approve`)
      return res.ok ? ok(toMaterial(res.data)) : res
    },
    async retireMaterial(id) {
      const res = await request<Wire>('POST', `/materials/${encodeURIComponent(id)}/retire`)
      return res.ok ? ok(toMaterial(res.data)) : res
    },

    // ── providers + routing ───────────────────────────────────────────────────────────────────────────────
    async providers() {
      return request<ProviderView[]>('GET', '/providers')
    },
    async createProvider(body) {
      // The backend ignores `name` (no column) and needs no preset model; the body is the documented one.
      return request<ProviderView>('POST', '/providers', body)
    },
    async updateProvider(id, body) {
      return request<ProviderView>('PATCH', `/providers/${encodeURIComponent(id)}`, body)
    },
    async deleteProvider(id) {
      return request<null>('DELETE', `/providers/${encodeURIComponent(id)}`)
    },
    async testProvider(id, modelId) {
      // The model id defaults to the provider's `defaultModel`; a failed test is a 200 with `ok: false`.
      return request<{ ok: boolean; latencyMs: number }>('POST', `/providers/${encodeURIComponent(id)}/test`, modelId ? { modelId } : {})
    },
    async saveCapabilities(id, body) {
      return request<ProviderView>('PUT', `/providers/${encodeURIComponent(id)}/capabilities`, body)
    },
    async refreshModels(id) {
      return request<string[]>('POST', `/providers/${encodeURIComponent(id)}/models`)
    },
    async routing() {
      return request<AiRouting>('GET', '/ai-routing')
    },
    async saveRouting(body) {
      return request<AiRouting>('PUT', '/ai-routing', body)
    },

    // ── generation + notifications ────────────────────────────────────────────────────────────────────────
    async createGenerationJob(body) {
      return request<{ jobId: string }>('POST', '/generation-jobs', body)
    },
    async generationJobs() {
      return request<GenerationJob[]>('GET', '/generation-jobs')
    },
    async generationJob(jobId) {
      return request<GenerationJob>('GET', `/generation-jobs/${encodeURIComponent(jobId)}`)
    },
    async retryGenerationJob(jobId) {
      // `POST …/retry` answers `{ jobId, status }` only; the full report is a second read.
      const res = await request('POST', `/generation-jobs/${encodeURIComponent(jobId)}/retry`)
      return res.ok ? request<GenerationJob>('GET', `/generation-jobs/${encodeURIComponent(jobId)}`) : res
    },
    async notifications() {
      const res = await request<{ items: Notification[] }>('GET', '/notifications')
      return res.ok ? ok(res.data.items) : res
    },
    async markNotification(id, body) {
      return request<Notification>('PATCH', `/notifications/${encodeURIComponent(id)}`, body)
    },
    async markAllNotificationsRead() {
      return request<Notification[]>('POST', '/notifications/read-all')
    },

    // ── backup + restore (no backend route yet) ────────────────────────────────────────────────────────────
    async backupSettings() {
      return { ok: false, failure: notAvailable('GET /settings/backup') }
    },
    async saveBackupSettings() {
      return { ok: false, failure: notAvailable('PUT /settings/backup') }
    },
    async backups() {
      return { ok: false, failure: notAvailable('GET /backups') }
    },
    async runBackup() {
      return { ok: false, failure: notAvailable('POST /backups') }
    },
    async validateRestore() {
      return { ok: false, failure: notAvailable('POST /restores/validate') }
    },
    async restore() {
      return { ok: false, failure: notAvailable('POST /restores') }
    },
  }
}

// ── fixture seam ────────────────────────────────────────────────────────────────────────────────────────
/** The pure mapping functions, exercised by `scripts/check-http-client.ts`; not imported by screens. */
export const __httpMapping = { toFailure, toSessionDetail, toPackage, toQuestion, toMaterial, toReport, toScoreResult, toBatchSummary, toQuestionWriteBody }

/**
 * The client instance. Declared last so every constant it closes over (`BASE`, `LOG_TAG`, `notAvailable`) is already
 * initialised when `buildClient()` runs.
 */
export const httpClient: ApiClient = buildClient()
