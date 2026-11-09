import type {
  BackupRecord,
  BackupSettings,
  Material,
  Package,
  QuestionBatch,
  QuestionReport,
  SessionSummary,
  SubmateriLeaf,
  Test,
  TrendSeries,
} from '../types/contracts'
import { PROVISIONAL_CONFIG_ID } from './configs'

/**
 * `MOCK DATA — NOT FROM API`
 *
 * The seeded rows the mock's second wave of routes serves (packages, history, materials, review queue,
 * notifications and backups). Every count is a hand-written plausibility figure — nothing here runs a
 * formula — and no row makes a regulatory claim: the only rules referenced are the ones already in
 * `configs.ts`.
 */

// ── packages (PACKAGE_SPECIFICATION §2) ────────────────────────────────────────────────────────────

/**
 * A built-in subtest pins the historical config (321/2024, 30/35/45 items) because that is where its
 * item count is documented; the full simulation binds no config (the server resolves one).
 */
const HISTORICAL = 'skd-cpns-2024'

/**
 * The five seeded packages. `pkg-tryout-twk` carries a documented-style unavailable reason only to give
 * the UI its unavailable state: with 30 required and 5 active TWK items the real selector would repeat
 * every item six times, which the mock presents as "Stok soal belum cukup" rather than starting it.
 */
export const PACKAGES: Package[] = [
  {
    id: 'pkg-tryout-skd-full',
    mode: 'tryout',
    source: 'builtin',
    titleId: 'Tryout — Simulasi SKD Lengkap',
    version: 1,
    definition: {
      kind: 'full_simulation',
      itemCount: 110,
      difficultyMix: { easy: 40, medium: 45, hard: 25 },
      repeatPolicy: 'avoid_answered',
    },
    availability: { eligibleStock: 19, requiredStock: 110, repeatCount: 91, startable: true, unavailableReason: null },
    retiredAt: null,
  },
  {
    id: 'pkg-tryout-skd-short',
    mode: 'tryout',
    source: 'builtin',
    titleId: 'Tryout — Simulasi SKD Singkat',
    version: 1,
    definition: {
      kind: 'full_simulation',
      itemCount: 20,
      difficultyMix: { easy: 7, medium: 8, hard: 5 },
      repeatPolicy: 'avoid_answered',
    },
    availability: { eligibleStock: 19, requiredStock: 20, repeatCount: 1, startable: true, unavailableReason: null },
    retiredAt: null,
  },
  {
    id: 'pkg-tryout-twk',
    mode: 'tryout',
    source: 'builtin',
    titleId: 'Tryout — TWK',
    version: 1,
    definition: { kind: 'subtest', test: 'TWK', itemCount: 30, repeatPolicy: 'avoid_answered' },
    availability: { eligibleStock: 5, requiredStock: 30, repeatCount: 0, startable: false, unavailableReason: 'Stok soal belum cukup' },
    configId: HISTORICAL,
    retiredAt: null,
  },
  {
    id: 'pkg-tryout-tiu',
    mode: 'tryout',
    source: 'builtin',
    titleId: 'Tryout — TIU',
    version: 1,
    definition: { kind: 'subtest', test: 'TIU', itemCount: 35, repeatPolicy: 'avoid_answered' },
    availability: { eligibleStock: 7, requiredStock: 35, repeatCount: 28, startable: true, unavailableReason: null },
    configId: HISTORICAL,
    retiredAt: null,
  },
  {
    id: 'pkg-drill-numerik',
    mode: 'latihan',
    source: 'dynamic',
    titleId: 'Latihan — Drill numerik',
    version: 1,
    definition: {
      kind: 'submateri',
      test: 'TIU',
      competencyIds: ['TIU.NUMERIK.BERHITUNG', 'TIU.NUMERIK.DERET', 'TIU.NUMERIK.SOAL_CERITA'],
      itemCount: 3,
      repeatPolicy: 'avoid_answered',
    },
    availability: { eligibleStock: 3, requiredStock: 3, repeatCount: 0, startable: true, unavailableReason: null },
    configId: PROVISIONAL_CONFIG_ID,
    retiredAt: null,
  },
]

// ── submateri leaves (GET /latihan/submateri) ─────────────────────────────────────────────────────

/**
 * Leaves taken verbatim from `src/features/shared/taxonomy.ts` (COMPETENCY_TAXONOMY §3–§5). Stock is
 * hand-written; zero-stock leaves exist so Latihan can show its disabled row.
 */
export const SUBMATERI: SubmateriLeaf[] = [
  { competencyId: 'TWK.NASIONALISME', test: 'TWK', label: 'Nasionalisme', availableQuestions: 2 },
  { competencyId: 'TWK.INTEGRITAS', test: 'TWK', label: 'Integritas', availableQuestions: 1 },
  { competencyId: 'TWK.BELA_NEGARA', test: 'TWK', label: 'Bela negara', availableQuestions: 1 },
  { competencyId: 'TWK.PILAR_NEGARA', test: 'TWK', label: 'Pilar negara', availableQuestions: 1 },
  { competencyId: 'TWK.BAHASA_NEGARA', test: 'TWK', label: 'Bahasa negara', availableQuestions: 1 },
  { competencyId: 'TIU.VERBAL.ANALOGI', test: 'TIU', label: 'Analogi', availableQuestions: 1 },
  { competencyId: 'TIU.VERBAL.SILOGISME', test: 'TIU', label: 'Silogisme', availableQuestions: 1 },
  { competencyId: 'TIU.VERBAL.ANALITIS', test: 'TIU', label: 'Analitis', availableQuestions: 2 },
  { competencyId: 'TIU.NUMERIK.BERHITUNG', test: 'TIU', label: 'Berhitung', availableQuestions: 1 },
  { competencyId: 'TIU.NUMERIK.DERET', test: 'TIU', label: 'Deret angka', availableQuestions: 1 },
  { competencyId: 'TIU.NUMERIK.PERBANDINGAN_KUANTITATIF', test: 'TIU', label: 'Perbandingan kuantitatif', availableQuestions: 0 },
  { competencyId: 'TIU.NUMERIK.SOAL_CERITA', test: 'TIU', label: 'Soal cerita', availableQuestions: 1 },
  { competencyId: 'TIU.FIGURAL.ANALOGI', test: 'TIU', label: 'Figural — analogi', availableQuestions: 0 },
  { competencyId: 'TIU.FIGURAL.KETIDAKSAMAAN', test: 'TIU', label: 'Figural — ketidaksamaan', availableQuestions: 0 },
  { competencyId: 'TIU.FIGURAL.SERIAL', test: 'TIU', label: 'Figural — serial', availableQuestions: 0 },
  { competencyId: 'TKP.PELAYANAN_PUBLIK', test: 'TKP', label: 'Pelayanan publik', availableQuestions: 1 },
  { competencyId: 'TKP.JEJARING_KERJA', test: 'TKP', label: 'Jejaring kerja', availableQuestions: 1 },
  { competencyId: 'TKP.SOSIAL_BUDAYA', test: 'TKP', label: 'Sosial budaya', availableQuestions: 1 },
  { competencyId: 'TKP.TIK', test: 'TKP', label: 'Teknologi informasi dan komunikasi', availableQuestions: 1 },
  { competencyId: 'TKP.PROFESIONALISME', test: 'TKP', label: 'Profesionalisme', availableQuestions: 1 },
  { competencyId: 'TKP.ANTI_RADIKALISME', test: 'TKP', label: 'Anti radikalisme', availableQuestions: 1 },
]

/** Suggested test for a competency id (leaf, domain or parent), for drill package definitions. */
export function testOf(competencyId: string): Test {
  return competencyId.split('.')[0] as Test
}

// ── session history (GET /sessions) ───────────────────────────────────────────────────────────────

/** Hand-written history rows; totals are plausibility figures, not computed scores. */
export const SEED_SESSIONS: SessionSummary[] = [
  {
    id: 'ses-demo-03',
    mode: 'tryout',
    status: 'scored',
    packageId: 'pkg-tryout-skd-full',
    startedAt: '2026-11-06T02:00:00.000Z',
    submittedAt: '2026-11-06T03:40:00.000Z',
    totalEarned: 293,
    totalPossible: 435,
  },
  {
    id: 'ses-demo-02',
    mode: 'latihan',
    status: 'scored',
    packageId: 'pkg-drill-numerik',
    startedAt: '2026-11-03T09:15:00.000Z',
    submittedAt: '2026-11-03T09:24:00.000Z',
    totalEarned: 12,
    totalPossible: 15,
  },
  {
    id: 'ses-demo-01',
    mode: 'tryout',
    status: 'blocked',
    packageId: 'pkg-tryout-skd-short',
    startedAt: '2026-10-29T13:00:00.000Z',
    submittedAt: '2026-10-29T13:52:00.000Z',
    totalEarned: 51,
    totalPossible: 80,
  },
]

// ── trend series (GET /analytics/trends) ─────────────────────────────────────────────────────────

/**
 * Hand-written series per competency (ANALYTICS_ENGINE §6): three reportable competencies and one with
 * two points so the `insufficient_data` path ("butuh ≥3 sesi") has a fixture. Others fall back to a
 * two-point series. `percent` values are integers; nothing derives them.
 */
const TRENDS: Record<string, TrendSeries> = {
  'TWK.NASIONALISME': {
    competencyId: 'TWK.NASIONALISME',
    points: [
      { sessionId: 'ses-demo-01', finishedAt: '2026-10-29T13:52:00.000Z', percent: 60, answeredCount: 5 },
      { sessionId: 'ses-demo-02', finishedAt: '2026-11-03T09:24:00.000Z', percent: 70, answeredCount: 6 },
      { sessionId: 'ses-demo-03', finishedAt: '2026-11-06T03:40:00.000Z', percent: 80, answeredCount: 10 },
    ],
    state: 'reportable',
    direction: 'improving',
  },
  'TIU.NUMERIK.DERET': {
    competencyId: 'TIU.NUMERIK.DERET',
    points: [
      { sessionId: 'ses-demo-01', finishedAt: '2026-10-29T13:52:00.000Z', percent: 50, answeredCount: 4 },
      { sessionId: 'ses-demo-02', finishedAt: '2026-11-03T09:24:00.000Z', percent: 33, answeredCount: 3 },
      { sessionId: 'ses-demo-03', finishedAt: '2026-11-06T03:40:00.000Z', percent: 25, answeredCount: 4 },
    ],
    state: 'reportable',
    direction: 'declining',
  },
  'TIU.VERBAL.ANALOGI': {
    competencyId: 'TIU.VERBAL.ANALOGI',
    points: [
      { sessionId: 'ses-demo-01', finishedAt: '2026-10-29T13:52:00.000Z', percent: 75, answeredCount: 4 },
      { sessionId: 'ses-demo-02', finishedAt: '2026-11-03T09:24:00.000Z', percent: 50, answeredCount: 4 },
      { sessionId: 'ses-demo-03', finishedAt: '2026-11-06T03:40:00.000Z', percent: 100, answeredCount: 4 },
    ],
    state: 'reportable',
    direction: 'mixed',
  },
  'TKP.PELAYANAN_PUBLIK': {
    competencyId: 'TKP.PELAYANAN_PUBLIK',
    points: [
      { sessionId: 'ses-demo-01', finishedAt: '2026-10-29T13:52:00.000Z', percent: 64, answeredCount: 4 },
      { sessionId: 'ses-demo-03', finishedAt: '2026-11-06T03:40:00.000Z', percent: 68, answeredCount: 6 },
    ],
    state: 'insufficient_data',
    direction: 'stable',
  },
}

/** A two-point `insufficient_data` series for any competency without a hand-written one. */
function fallbackTrend(competencyId: string): TrendSeries {
  return {
    competencyId,
    points: [
      { sessionId: 'ses-demo-01', finishedAt: '2026-10-29T13:52:00.000Z', percent: 55, answeredCount: 3 },
      { sessionId: 'ses-demo-03', finishedAt: '2026-11-06T03:40:00.000Z', percent: 60, answeredCount: 3 },
    ],
    state: 'insufficient_data',
    direction: 'stable',
  }
}

/** Returns the hand-written series for a competency, or a deterministic short series. */
export function trendFor(competencyId: string): TrendSeries {
  return TRENDS[competencyId] ?? fallbackTrend(competencyId)
}

// ── materials (GET /materials) ────────────────────────────────────────────────────────────────────

/** Two approved materials and one AI draft holding an unverified source (MATERIAL_SPECIFICATION §1). */
export const MATERIALS: Material[] = [
  {
    id: 'mat-nasionalisme',
    title: 'Nasionalisme: dari Kongres Pemuda ke hari ini',
    contentType: 'historical',
    scope: { kind: 'competency', competencyId: 'TWK.NASIONALISME' },
    status: 'approved',
    version: 2,
    approvalVersion: 2,
    provenance: { kind: 'ai_drafted_reviewed', providerId: 'local-mock', modelId: 'mock-model' },
    sources: [
      { label: 'Materi latihan: Kongres Pemuda Kedua (1928)', verified: true },
      { label: 'Buku sejarah nasional Indonesia', verified: true },
    ],
  },
  {
    id: 'mat-deret',
    title: 'Pola deret angka: selisih dan pembanding',
    contentType: 'strategy',
    scope: { kind: 'competency', competencyId: 'TIU.NUMERIK.DERET' },
    status: 'approved',
    version: 1,
    approvalVersion: 1,
    provenance: { kind: 'manual' },
    sources: [{ label: 'Ringkasan strategi numerik (lokal)', verified: true }],
  },
  {
    id: 'mat-pelayanan',
    title: 'Prinsip pelayanan publik dalam situasi kerja',
    contentType: 'conceptual',
    scope: { kind: 'competency', competencyId: 'TKP.PELAYANAN_PUBLIK' },
    status: 'draft',
    version: 1,
    approvalVersion: null,
    provenance: { kind: 'ai_drafted', providerId: 'local-mock', modelId: 'mock-model' },
    sources: [{ label: 'Artikel daring tentang etika pelayanan (belum diverifikasi)', url: 'https://contoh.invalid/etika-pelayanan', verified: false }],
  },
]

/**
 * `GET /recommendations/materials` — which offer variant a competency gets, by `hash % 3`:
 * 0 → approved material, 1 → draft (approve first), 2 → none (generate). Two special cases give the
 * featured competencies a stable, interesting answer.
 */
export function offerIndexFor(competencyId: string): 0 | 1 | 2 {
  if (competencyId === 'TKP.PELAYANAN_PUBLIK') return 1
  if (competencyId === 'TWK.NASIONALISME') return 0
  let h = 0
  for (const ch of competencyId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (h % 3) as 0 | 1 | 2
}

// ── review queue (GET /question-reports, GET /question-batches) ──────────────────────────────────

/** Two open reports; the critical one's question is already quarantined in the mock state. */
export const QUESTION_REPORTS: QuestionReport[] = [
  {
    id: 'rep-01',
    questionId: 'q-tiu-02',
    severity: 'major',
    category: 'ambiguity',
    note: 'Pilihan jawaban B terdengar sama kuat dengan kesimpulan silogisme yang baku.',
    targetContentVersion: 1,
    createdAt: '2026-11-05T08:30:00.000Z',
  },
  {
    id: 'rep-02',
    questionId: 'q-tkp-05',
    severity: 'critical',
    category: 'factual_error',
    note: 'Contoh teknologi pada opsi B tampak tidak sesuai konteks soal.',
    targetContentVersion: 1,
    createdAt: '2026-11-06T10:12:00.000Z',
  },
]

/** One batch awaiting a user sample (`sampleSize` null) and one already sampled. */
export const QUESTION_BATCHES: QuestionBatch[] = [
  { batchId: 'bat-02', createdAt: '2026-11-07T04:00:00.000Z', total: 12, passedForSampling: 11, quarantined: 1, sampleStatus: 'pending', sampleSize: null },
  { batchId: 'bat-01', createdAt: '2026-11-02T04:00:00.000Z', total: 10, passedForSampling: 9, quarantined: 1, sampleStatus: 'sampled', sampleSize: 3 },
]

// ── backup (GET /settings/backup, GET /backups) ──────────────────────────────────────────────────

export const BACKUP_SETTINGS: BackupSettings = {
  folder: 'D:\\TryoutSim\\backup',
  keepLastN: 7,
  maxAgeDays: 30,
  dataLocation: 'D:\\TryoutSim\\data',
}

export const BACKUPS: BackupRecord[] = [
  { id: 'bak-003', createdAt: '2026-11-08T01:00:00.000Z', status: 'succeeded', reason: null, sizeBytes: 18_432_000 },
  { id: 'bak-002', createdAt: '2026-11-07T01:00:00.000Z', status: 'failed', reason: 'Folder backup tidak dapat diakses', sizeBytes: 0 },
  { id: 'bak-001', createdAt: '2026-11-06T01:00:00.000Z', status: 'succeeded', reason: null, sizeBytes: 17_960_448 },
]
