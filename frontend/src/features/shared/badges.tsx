import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ExamConfig, EvidenceTier, MetricValue, Provenance, Question } from '../../types/contracts'
import { Badge } from '../../ui/ui'
import { IconLock } from '../../ui/icons'

/** Shared state vocabulary, DESIGN_SYSTEM §5. One meaning per state across every screen. */

export function ConfigStateBadge({ config }: { config: ExamConfig }) {
  if (config.state === 'official_verified') return <Badge tone="success">Terverifikasi</Badge>
  if (config.state === 'historical') return <Badge tone="accent">Arsip {config.examYear}</Badge>
  // provisional: approval is a server fact; the list shows the config's own state.
  return config.approvedAt ? (
    <Badge tone="warning">Disetujui sementara</Badge>
  ) : (
    <Badge tone="warning" icon={<IconLock size={13} />}>
      Perlu persetujuan
    </Badge>
  )
}

export function PathwayBadge({ config }: { config: ExamConfig }) {
  return config.pathway === 'CPNS' ? (
    <Badge tone="neutral">CPNS</Badge>
  ) : (
    <Badge tone="neutral">Kedinasan — tidak tersedia</Badge>
  )
}

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  switch (provenance.kind) {
    case 'ai_generated':
    case 'ai_generated_human_reviewed':
      return <Badge tone="lavender">Latihan AI — bukan soal resmi</Badge>
    case 'official_historical':
      return <Badge tone="accent">Arsip {provenance.sourceYear} — bukan soal siklus berjalan</Badge>
    case 'human_authored':
      return <Badge tone="neutral">Soal buatanmu</Badge>
  }
}

const LIFECYCLE_LABEL: Record<Question['lifecycle'], string> = {
  draft: 'Draf',
  ai_validated: 'Lolos cek otomatis',
  human_reviewed: 'Sudah ditinjau',
  active: 'Aktif',
  quarantined: 'Karantina',
  rejected: 'Ditolak',
  archived: 'Arsip',
}

export function LifecycleBadge({ lifecycle }: { lifecycle: Question['lifecycle'] }) {
  const tone =
    lifecycle === 'active' ? 'success' : lifecycle === 'quarantined' || lifecycle === 'rejected' ? 'danger' : 'neutral'
  return <Badge tone={tone}>{LIFECYCLE_LABEL[lifecycle]}</Badge>
}

export function lifecycleLabel(lifecycle: Question['lifecycle']): string {
  return LIFECYCLE_LABEL[lifecycle]
}

const TIER_LABEL: Record<EvidenceTier, string> = {
  'VERIFIED-2026': 'Terverifikasi 2026',
  'VERIFIED-2026-SEKOLAH-KEDINASAN': 'Terverifikasi Kedinasan 2026',
  'VERIFIED-CURRENT': 'Berlaku saat ini',
  HISTORICAL: 'Arsip',
  'VERIFIED-ABSENCE': 'Tidak ditemukan',
  UNVERIFIED: 'Belum diverifikasi',
}

export const tierLabel = (tier: EvidenceTier) => TIER_LABEL[tier]

/** Sample-status text; a sample too small says so and is never worded as weakness (RESULTS_ANALYTICS §8). */
export function MetricText({ metric, noun }: { metric: MetricValue; noun?: string }) {
  const n = metric.answeredCount
  switch (metric.state) {
    case 'insufficient_data':
      return <Badge tone="neutral">Belum cukup data (n={n})</Badge>
    case 'zero_correct':
      return <Badge tone="danger">0 benar dari {n} soal</Badge>
    case 'zero_attainment':
      return <Badge tone="danger">0 poin dari {n} soal</Badge>
    case 'reportable':
      return (
        <span className="tnum">
          <span className="font-display text-xl font-bold text-ink">{metric.percent}%</span>
          <span className="ml-1.5 text-sm text-muted">
            ({metric.numerator}/{metric.denominator}){noun ? ` · ${noun}` : ''}
          </span>
        </span>
      )
  }
}

/** A one-line characteristic of a test: TWK/TIU are accuracy, TKP is attainment. */
export function MetricKindNote({ metric }: { metric: MetricValue & { metric: 'accuracy' | 'attainment' } }) {
  return <>{metric.metric === 'attainment' ? 'Pencapaian poin' : 'Akurasi jawaban'}</>
}

/**
 * A linked summary row: title + state on the left, a figure on the right. One target, one line.
 */
export function StatRow({
  to,
  title,
  subtitle,
  right,
}: {
  to?: string
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-md font-medium text-ink">{title}</span>
        {subtitle ? <span className="block text-sm text-muted">{subtitle}</span> : null}
      </span>
      {right}
    </>
  )
  const base = 'flex min-h-14 items-center gap-3 rounded-[12px] px-2.5 py-2'
  return to ? (
    <Link to={to} className={`${base} -mx-1 transition-colors hover:bg-surface-muted`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  )
}
