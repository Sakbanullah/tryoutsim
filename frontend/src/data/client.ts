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
  GenerationRequest,
  Material,
  MaterialOffer,
  Notification,
  ModelCapabilities,
  Package,
  PackageDraft,
  ProviderView,
  Question,
  QuestionBatch,
  QuestionDraft,
  QuestionReport,
  RestoreValidation,
  ReviewQuestion,
  SampleOutcome,
  ScoreResult,
  SessionDetail,
  SessionSummary,
  SubmateriLeaf,
  Test,
  TrendSeries,
} from '../types/contracts'
import type { Result } from './errors'

/**
 * The one seam between screens and data (FRONTEND_MOCK_DATA_STRATEGY §1).
 * Every route is named exactly as in API_ENDPOINTS; each returns `Result<T>`, never throws.
 * At Gate 2 the only implementation is the mock.
 */
export type ApiClient = {
  bootstrap(): Promise<Result<BootstrapResponse>>

  examConfigs(): Promise<Result<ExamConfig[]>>
  examConfig(id: string): Promise<Result<ExamConfig>>
  approveConfig(
    id: string,
    body: { configId: string; acknowledgedWarnings: string[] },
  ): Promise<Result<{ approvedByUserAt: string }>>
  createExamConfig(body: {
    examYear: number
    thresholds: { mode: 'per_subtest_and_total' | 'per_subtest_only' | 'total_only' | 'none'; TWK?: number; TIU?: number; TKP?: number; total?: number }
    acknowledgedWarnings: string[]
  }): Promise<Result<ExamConfig>>

  packages(mode?: 'tryout' | 'latihan'): Promise<Result<Package[]>>
  package(id: string): Promise<Result<Package>>
  createPackage(body: PackageDraft): Promise<Result<Package>>
  packageVersion(id: string, body: PackageDraft): Promise<Result<Package>>
  retirePackage(id: string): Promise<Result<Package>>
  startSession(body: { packageId: string; mode: 'tryout' | 'latihan' }): Promise<Result<{ sessionId: string }>>
  submateri(): Promise<Result<SubmateriLeaf[]>>

  sessions(mode?: 'tryout' | 'latihan'): Promise<Result<SessionSummary[]>>
  session(id: string): Promise<Result<SessionDetail>>
  /** `elapsedActiveMs` is the answer's cumulative active time (API_SPECIFICATION §7.5); omit it while no clock is wired. */
  saveAnswers(id: string, body: AnswersPatch, elapsedActiveMs?: number): Promise<Result<{ savedAt: string }>>
  submitSession(id: string, body: AnswersPatch): Promise<Result<ScoreResult>>
  rescoreSession(id: string): Promise<Result<ScoreResult>>
  sessionResult(id: string): Promise<Result<ScoreResult>>
  /** `GET /sessions/:id/questions?ids=…` — E78; one request per page, at most 20 ids (API_SPECIFICATION §7.7). */
  reviewQuestions(id: string, ids: string[]): Promise<Result<{ sessionId: string; questions: ReviewQuestion[] }>>
  deletionImpact(id: string): Promise<Result<DeletionImpact>>
  deleteSession(id: string): Promise<Result<null>>

  analytics(): Promise<Result<AnalyticsSnapshot>>
  trends(competencyId: string): Promise<Result<TrendSeries>>
  materialsOffer(competencyId: string): Promise<Result<MaterialOffer>>
  drill(body: { competencyIds: string[] }): Promise<Result<{ sessionId: string; packageId: string }>>

  questions(filter: {
    text?: string
    test?: Test
    competencyId?: string
    difficulty?: 'easy' | 'medium' | 'hard'
    lifecycle?: Question['lifecycle']
    provenance?: Question['provenance']['kind']
  }): Promise<Result<Question[]>>
  question(id: string): Promise<Result<Question>>
  createQuestion(body: QuestionDraft): Promise<Result<Question>>
  acceptQuestion(
    id: string,
    body: { decision: 'accepted' | 'rejected' },
  ): Promise<Result<Question>>
  activateQuestion(id: string): Promise<Result<Question>>
  archiveQuestion(id: string): Promise<Result<Question>>
  bulkArchive(ids: string[]): Promise<Result<Question[]>>
  quarantineQuestion(id: string, reason: string): Promise<Result<Question>>
  duplicateClusters(): Promise<Result<DuplicateCluster[]>>
  reportQuestion(id: string, body: { severity: 'minor' | 'major' | 'critical'; category: string; note: string }): Promise<Result<null>>
  questionReports(): Promise<Result<QuestionReport[]>>
  decideReport(id: string, body: { decision: 'repaired' | 'withdrawn' | 'rejected' }): Promise<Result<QuestionReport>>
  questionBatches(): Promise<Result<QuestionBatch[]>>
  recordSample(batchId: string, body: { outcome: SampleOutcome; findings: string[] }): Promise<Result<QuestionBatch>>

  materials(): Promise<Result<Material[]>>
  material(id: string): Promise<Result<Material>>
  createMaterial(body: { title: string; contentType: Material['contentType']; scope: Material['scope']; body: string; sources: Material['sources'] }): Promise<Result<Material>>
  approveMaterial(id: string): Promise<Result<Material>>
  retireMaterial(id: string): Promise<Result<Material>>

  providers(): Promise<Result<ProviderView[]>>
  createProvider(body: {
    preset: 'openrouter' | 'openai_compatible' | 'ollama' | 'custom'
    name: string
    baseUrl: string
    key: string
    timeoutMs: number
    retries: number
  }): Promise<Result<ProviderView>>
  deleteProvider(id: string): Promise<Result<null>>
  testProvider(id: string): Promise<Result<{ ok: boolean; latencyMs: number }>>
  saveCapabilities(id: string, body: ModelCapabilities): Promise<Result<ProviderView>>
  refreshModels(id: string): Promise<Result<string[]>>
  routing(): Promise<Result<AiRouting>>
  saveRouting(body: AiRouting): Promise<Result<AiRouting>>

  createGenerationJob(body: GenerationRequest): Promise<Result<{ jobId: string }>>
  generationJobs(): Promise<Result<GenerationJob[]>>
  generationJob(jobId: string): Promise<Result<GenerationJob>>
  retryGenerationJob(jobId: string): Promise<Result<GenerationJob>>
  notifications(): Promise<Result<Notification[]>>
  markNotification(id: string, body: { read?: boolean; dismissed?: boolean }): Promise<Result<Notification>>
  markAllNotificationsRead(): Promise<Result<Notification[]>>

  backupSettings(): Promise<Result<BackupSettings>>
  saveBackupSettings(body: BackupSettings): Promise<Result<BackupSettings>>
  backups(): Promise<Result<BackupRecord[]>>
  runBackup(): Promise<Result<BackupRecord>>
  validateRestore(archivePath: string): Promise<Result<RestoreValidation>>
  restore(archivePath: string): Promise<Result<{ restoreId: string }>>
}
