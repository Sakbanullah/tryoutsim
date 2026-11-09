import type { BasisRef, ExamConfig, ThresholdSet } from '../types/contracts'

/**
 * `MOCK DATA — NOT FROM API`
 * The three shipped configurations of CPNS_2026_REGULATIONS §4.4, with the basis citations, states and
 * notices that document states. Non-asserted fields (thresholds, duration) are left unasserted:
 * every tier below is the document's own, and 406/2026 appears on exactly one row — the Kedinasan one.
 */

const cpns321: BasisRef = {
  document: 'Keputusan Menteri PANRB',
  number: '321/2024',
  effectiveDate: '2024-07-29',
  tier: 'HISTORICAL',
  pathway: 'CPNS',
  examYear: 2024,
  scope: 'Nilai Ambang Batas SKD seleksi Penerimaan PNS Tahun Anggaran 2024',
  sourceUrl: 'https://jdih.menpan.go.id/',
  fetchedAt: '2026-11-07',
}

const permen6: BasisRef = {
  document: 'Peraturan Menteri PANRB',
  number: '6/2024',
  tier: 'VERIFIED-CURRENT',
  pathway: 'CPNS',
  examYear: 2024,
  scope: 'Pasal 30 — SKD terdiri atas TWK, TIU, dan TKP',
  fetchedAt: '2026-11-07',
}

const kedinasan406: BasisRef = {
  document: 'Keputusan Menteri PANRB',
  number: '406/2026',
  tier: 'VERIFIED-2026-SEKOLAH-KEDINASAN',
  pathway: 'SEKOLAH_KEDINASAN',
  examYear: 2026,
  scope: 'SKD Sekolah Kedinasan TA 2026 — bukan dasar hukum CPNS 2026',
  sourceUrl: 'https://data-jdih.menpan.go.id/dokumen/2026kepmenpanrb406.pdf',
  fetchedAt: '2026-11-07',
}

/** ThresholdSet from a basis; SCORING_METHODOLOGY §5 shape. Not asserted in the provisional config. */
const naB2024General: ThresholdSet = {
  mode: 'per_subtest_only',
  TWK: 65,
  TIU: 80,
  TKP: 166,
  source: { ...cpns321, scope: 'Diktum KEDUA BELAS — penetapan kebutuhan umum dan khusus putra/putri Kalimantan' },
}

export const CONFIGS: ExamConfig[] = [
  {
    id: 'skd-cpns-2024',
    examYear: 2024,
    pathway: 'CPNS',
    state: 'historical',
    configVersion: 1,
    scoringVersion: 1,
    regulatoryBasis: [cpns321],
    structure: {},
    scoring: {},
    thresholds: naB2024General,
    notice:
      'Aturan arsip CPNS 2024. Tryout ini hanya untuk latihan ulang dan tidak menggambarkan aturan seleksi siklus berjalan.',
  },
  {
    id: 'skd-cpns-2026-provisional',
    examYear: 2026,
    pathway: 'CPNS',
    state: 'provisional',
    configVersion: 1,
    scoringVersion: 1,
    regulatoryBasis: [permen6, cpns321],
    structure: {},
    scoring: {},
    notice:
      'Belum ada aturan CPNS 2026 yang terbit. Komposisi soal dan bobot diambil dari Kepmen PANRB 321/2024 dan belum disetujui untuk dinilai. Ambang batas dan durasi ujian tidak ditetapkan.',
    derivedFrom: 'skd-cpns-2024',
  },
  {
    id: 'skd-sekolah-kedinasan-2026',
    examYear: 2026,
    pathway: 'SEKOLAH_KEDINASAN',
    state: 'official_verified',
    configVersion: 1,
    scoringVersion: 1,
    regulatoryBasis: [kedinasan406],
    structure: {},
    scoring: {},
    notice:
      'Aturan Sekolah Kedinasan 2026. Bukan aturan CPNS dan tidak tersedia sebagai tryout di aplikasi ini.',
  },
]

export const PROVISIONAL_CONFIG_ID = 'skd-cpns-2026-provisional'

/** UNV ids still outstanding for the provisional config — GAP-M11: no route exposes this list. */
export const OUTSTANDING_WARNINGS: Array<{ id: string; text: string }> = [
  { id: 'UNV-07', text: 'Belum dipastikan apakah seleksi 2026 memakai Permen PANRB 6/2024 atau penggantinya.' },
  { id: 'UNV-09', text: 'Durasi ujian CPNS 2026 belum ditetapkan untuk peserta umum.' },
  { id: 'UNV-11', text: 'Nama domain kompetensi berasal dari aturan Sekolah Kedinasan 2026, bukan kisi-kisi CPNS 2026.' },
]

/** A hash-shaped value for the approval record — never shown to the user (FRONTEND_RESULTS_ANALYTICS §5). */
export const REGULATORY_BASIS_HASH = 'mock-basis-hash-a3f1c9'
