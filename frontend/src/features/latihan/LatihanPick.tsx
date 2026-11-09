import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../data'
import type { AnalyticsSnapshot, SubmateriLeaf, Test } from '../../types/contracts'
import { useApi, type Load } from '../shared/useApi'
import { OutcomeView } from '../../shell/OutcomeView'
import { Badge, Button, EmptyState, MetricBar, Notice, Panel, Skeleton, buttonClass } from '../../ui/ui'
import { MetricText } from '../shared/badges'
import { labelOf } from '../shared/taxonomy'
import { testName } from '../shared/format'
import { startFailureText } from '../shared/package'
import { useStartSession } from '../shared/startSession'
import { PageHeader } from '../../ui/page'
import { IconArrowUpRight, IconBrain, IconDrill, IconTarget } from '../../ui/icons'

/**
 * Latihan — pilih submateri (`/latihan`) — PAGE_SPECIFICATIONS §7.
 * Three subject sections, each listing its leaves with the stock from `GET /latihan/submateri`.
 * "Latih" creates a drill through `POST /recommendations/drill` with that one competency. The weakness
 * rail renders the analytics snapshot as returned; it does not rank.
 */
const SUBJECTS: Array<{ test: Test; blurb: string; note: string }> = [
  { test: 'TWK', blurb: 'Pancasila, integritas, dan pilar negara.', note: 'Dinilai dari akurasi jawaban.' },
  { test: 'TIU', blurb: 'Verbal, numerik, dan figural.', note: 'Dinilai dari akurasi jawaban.' },
  {
    test: 'TKP',
    blurb: 'Sikap kerja dalam situasi nyata.',
    note: 'Dinilai dari pencapaian poin, bukan benar/salah.',
  },
]

export default function LatihanPick() {
  const leaves = useApi<SubmateriLeaf[]>(() => api.submateri(), [])
  const analytics = useApi<AnalyticsSnapshot>(() => api.analytics(), [])

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow="Latihan"
        title="Latihan per submateri"
        lead="Pilih satu submateri. Sesi dibuat dari soal yang tersedia untuk submateri itu."
        actions={<Badge tone="lavender" icon={<IconDrill size={13} />}>Satu submateri per sesi</Badge>}
      />

      <OutcomeView state={leaves.state} retry={leaves.retry} loadingLines={6}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              title="Belum ada submateri siap dilatih"
              action={
                <Link to="/lainnya/generasi" className={buttonClass('primary')}>
                  Buat soal dengan AI
                </Link>
              }
            >
              Submateri muncul di sini setelah kumpulan soal memiliki soal aktif.
            </EmptyState>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {SUBJECTS.map((s) => (
                <SubjectPanel key={s.test} {...s} rows={list.filter((l) => l.test === s.test)} />
              ))}
            </div>
          )
        }
      </OutcomeView>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <WeakPoints state={analytics.state} retry={analytics.retry} />
        <Notice tone="lavender" title="Cara latihan bekerja">
          Setiap sesi berisi soal untuk satu submateri saja. Soal yang sudah dikerjakan bisa muncul lagi
          selama stok soal baru belum cukup.
        </Notice>
      </div>
    </div>
  )
}

/** One subject card: header, note, and the leaf rows with their stock. */
function SubjectPanel({ test, blurb, note, rows }: { test: Test; blurb: string; note: string; rows: SubmateriLeaf[] }) {
  return (
    <Panel className="flex flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-primary-wash font-display text-sm font-bold text-primary-ink">
          {test}
        </span>
        <Badge tone="neutral">{testName(test)}</Badge>
      </div>
      <h2 className="mt-3 font-display text-lg">{testName(test)}</h2>
      <p className="mt-1 text-base leading-relaxed text-muted">{blurb}</p>
      <p className="mt-3 rounded-[10px] bg-surface-muted px-3 py-2 text-sm leading-relaxed text-muted">{note}</p>
      <ul className="mt-3 divide-y divide-border">
        {rows.length === 0 ? (
          <li className="py-2 text-sm text-muted">Belum ada submateri untuk subtes ini.</li>
        ) : (
          rows.map((leaf) => <LeafRow key={leaf.competencyId} leaf={leaf} />)
        )}
      </ul>
    </Panel>
  )
}

/**
 * A leaf row: label, stock, and "Latih". A leaf without stock keeps its action visible but disabled,
 * with the reason in the row (PAGE_SPECIFICATIONS §7).
 */
function LeafRow({ leaf }: { leaf: SubmateriLeaf }) {
  const start = useStartSession()
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const hasStock = leaf.availableQuestions > 0

  /** Creates a one-competency drill and opens its runner. */
  async function drill() {
    setBusy(true)
    setReason(null)
    const ok = await start(() => api.drill({ competencyIds: [leaf.competencyId] }), 'latihan')
    if (!ok) {
      setBusy(false)
      setReason(startFailureText())
    }
  }

  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/progres/kompetensi/${leaf.competencyId}`}
            className="text-md font-medium text-ink underline-offset-4 hover:underline"
          >
            {leaf.label}
          </Link>
          <p className="text-sm tabular-nums text-muted">{leaf.availableQuestions} soal tersedia</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={drill}
          disabled={!hasStock || busy}
          reason={hasStock ? undefined : 'Belum ada soal untuk submateri ini.'}
        >
          {busy ? 'Menyiapkan…' : 'Latih'}
        </Button>
      </div>
      {reason ? (
        <p className="mt-1 text-sm font-medium text-danger" role="alert">
          {reason}
        </p>
      ) : null}
    </li>
  )
}

/** Reportable competencies with their numbers. No ranking (BR-X2) and no action: the drill lives on the leaf rows. */
function WeakPoints({ state, retry }: { state: Load<AnalyticsSnapshot>; retry: () => void }) {
  if (state.phase === 'loading') {
    return (
      <Panel className="p-6">
        <Skeleton lines={3} />
      </Panel>
    )
  }
  if (state.outcome.kind !== 'ok') {
    return (
      <Notice tone="info" title="Bidang terukur">
        Perbandingan dengan hasil sebelumnya belum bisa dimuat.{' '}
        <button type="button" className="font-semibold underline" onClick={retry}>
          Coba lagi
        </button>
      </Notice>
    )
  }
  const cells = Object.entries(state.outcome.data.perCompetency).filter(([, m]) => m.state !== 'insufficient_data')
  if (cells.length === 0) {
    return (
      <EmptyState
        title="Belum ada bidang yang terukur"
        action={
          <Link to="/tryout" className={buttonClass('primary')}>
            Kerjakan tryout pertama
          </Link>
        }
      >
        Setelah satu sesi dinilai, bidang yang sudah terukur muncul di sini dengan angkanya.
      </EmptyState>
    )
  }
  return (
    <Panel className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-xl">
            <IconTarget size={18} className="text-primary-ink" />
            Bidang yang sudah terukur
          </h2>
          <p className="mt-0.5 text-base text-muted">
            Angka dari sesi sebelumnya. Urutannya mengikuti taksonomi, bukan peringkat.
          </p>
        </div>
        <IconBrain size={22} className="shrink-0 text-lavender-ink" />
      </div>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {cells.map(([id, m]) => (
          <li key={id}>
            <Link
              to={`/progres/kompetensi/${id}`}
              className="group block rounded-[14px] border border-border bg-surface-muted/60 p-3.5 transition-colors hover:border-border-strong"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-1 text-md font-medium">
                  <span className="truncate">{labelOf(id)}</span>
                  <IconArrowUpRight size={14} className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <MetricText metric={m} noun={`${m.sessionCount} sesi`} />
              </div>
              <div className="mt-2">
                <MetricBar metric={m} size="sm" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
