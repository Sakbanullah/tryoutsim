import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../data'
import type { AnalyticsSnapshot, BootstrapResponse, ScoreResult } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi, type Load } from '../shared/useApi'
import { ActionLink, ArrowLink, Badge, EmptyState, Figure, MetricBar, Mascot, Panel, Steps, buttonClass } from '../../ui/ui'
import { MetricText } from '../shared/badges'
import { PageHeader } from '../../ui/page'
import {
  IconArrowUpRight,
  IconChart,
  IconDrill,
  IconExam,
  IconSpark,
  IconTarget,
} from '../../ui/icons'
import { formatDate, markSeen, readLastResultPointer, readSeen, testName, uidOf } from '../shared/format'

/**
 * Beranda (`/`) — what to do next, and where a returning learner stands (PAGE_SPECIFICATIONS §1).
 *
 * Desktop reads as three bands: the greeting, the primary start panel beside the next-step card,
 * then the standing (per-test accuracy, last session) in a metric rail. Every number below is a field
 * the analytics snapshot or the session result already returned; nothing is derived or ranked.
 */
export default function BerandaPage() {
  const shell = useApi<BootstrapResponse>(() => api.bootstrap(), [])
  const analytics = useApi<AnalyticsSnapshot>(() => api.analytics(), [])
  const [last, setLast] = useState<ScoreResult | null>(null)
  const pointer = readLastResultPointer()
  const seen = readSeen()

  useEffect(() => {
    // The three starting steps show once; the flag is a plain boolean, no personal data.
    markSeen()
  }, [])

  useEffect(() => {
    if (!pointer) return
    let live = true
    api.sessionResult(pointer.sessionId).then((r) => {
      if (live && r.ok) setLast(r.data)
    })
    return () => {
      live = false
    }
  }, [pointer?.sessionId])

  const snapshot = okData(analytics.state)

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow="Beranda"
        title="Latihan SKD, satu langkah tiap hari"
        lead="Mulai dari satu tryout, lihat hasilnya, lalu latih bagian yang masih perlu diperkuat."
        actions={
          <ActionLink to="/tryout" size="lg">
            Mulai tryout
          </ActionLink>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:items-stretch">
        <div className="flex flex-col gap-5">
          <OutcomeView state={shell.state} retry={shell.retry} loadingLines={4}>
            {(boot) => <StartPanel boot={boot} />}
          </OutcomeView>
          <ActionRow bankActive={shell.state.phase === 'done' && shell.state.outcome.kind === 'ok' ? shell.state.outcome.data.questionBankSummary.active : null} />
        </div>
        <div className="flex flex-col gap-5">
          {snapshot ? <NextStep snapshot={snapshot} /> : <NextStepLoading />}
          {last ? <LastSession last={last} /> : <NoSessions />}
        </div>
      </div>

      {shell.state.phase === 'done' && shell.state.outcome.kind === 'ok' ? (
        <Standing snapshot={snapshot} analytics={analytics.state} />
      ) : null}

      {!seen && last === null ? (
        <Panel className="p-6 lg:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl">Cara memulai</h2>
              <p className="mt-0.5 text-base text-muted">Tiga langkah singkat sebelum sesi pertama.</p>
            </div>
            <Badge tone="accent" icon={<IconSpark size={13} />}>
              Sekali saja
            </Badge>
          </div>
          <div className="mt-5">
            <Steps
              items={[
                { title: 'Pilih tryout', body: 'Buka tab Tryout, lalu pilih tahun dan jalur yang tersedia.' },
                { title: 'Baca petunjuk dan mulai', body: 'Petunjuk menjelaskan apa yang berlaku dan apa yang belum.' },
                { title: 'Kerjakan dan kirim', body: 'Jawaban tersimpan saat kamu berpindah soal. Kirim setelah selesai.' },
              ]}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  )
}

/** The analytics snapshot, or null while loading / on failure — the screen renders the gaps as empty states. */
function okData(state: Load<AnalyticsSnapshot>): AnalyticsSnapshot | null {
  return state.phase === 'done' && state.outcome.kind === 'ok' ? state.outcome.data : null
}

/**
 * The hero start panel: the one action that matters, the configuration it will use, and — when a
 * start is blocked — the exact reason instead of a disabled button with no explanation.
 */
function StartPanel({ boot }: { boot: BootstrapResponse }) {
  // Bootstrap carries no config list (decision B3): the start is gated by the bank's own active stock.
  const ready = boot.questionBankSummary.active > 0
  const bankEmpty = !ready
  // No config in the payload (B3), so the year and version chips have no value to show — the bank count stands alone.

  return (
    <Panel tone="wash" className="relative overflow-hidden p-6 lg:p-8">
      <Mascot size={132} className="pointer-events-none absolute -right-2 -top-3 opacity-90 lg:right-6 lg:top-8" />
      <div className="relative max-w-[38rem] lg:pr-40">
        <Badge tone="accent">Sesi berikutnya</Badge>
        <h2 className="mt-3 font-display text-[26px] font-bold leading-[1.15] tracking-[-0.02em] lg:text-[30px]">
          {ready ? 'Pilih tryout dan mulai sesi' : 'Tryout belum bisa dimulai'}
        </h2>
        <p className="mt-2 max-w-[48ch] text-md leading-relaxed text-muted">
          {ready
            ? 'Setiap tryout memakai aturan tahun dan jalur tertentu. Baca petunjuknya, lalu mulai saat siap.'
            : 'Kumpulan soal belum memiliki soal yang bisa dipakai. Tambahkan soal dengan AI atau tulis sendiri.'}
        </p>

        {ready ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <ConfigChip label="Soal aktif" value={String(boot.questionBankSummary.active)} />
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {ready ? (
            <ActionLink to="/tryout" size="lg">
              Pilih tryout
            </ActionLink>
          ) : bankEmpty ? (
            <>
              <Link to="/lainnya/generasi" className={buttonClass('secondary')}>
                Buat soal dengan AI
              </Link>
              <Link to="/lainnya/soal" className={buttonClass('quiet')}>
                Kumpulan soal
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </Panel>
  )
}

/** One read-only configuration fact on the hero panel: a label and the contract value. */
function ConfigChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-2 rounded-full border border-border bg-surface/90 px-3 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-ink tabular-nums">{value}</span>
    </span>
  )
}

/** The two everyday entries, same weight, so neither reads as decoration. */
function ActionRow({ bankActive }: { bankActive: number | null }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ActionTile
        to="/tryout"
        icon={<IconExam size={22} />}
        title="Tryout penuh"
        body="Kerjakan satu sesi lengkap dan lihat hasil per bidang."
      />
      <ActionTile
        to="/latihan"
        icon={<IconDrill size={22} />}
        title="Latihan singkat"
        body="Beberapa soal untuk menjaga kebiasaan belajar harian."
        foot={bankActive !== null ? `${bankActive} soal aktif` : undefined}
      />
    </div>
  )
}

/** A large clickable surface: icon, title, sentence, and an arrow that says it goes somewhere. */
function ActionTile({
  to,
  icon,
  title,
  body,
  foot,
}: {
  to: string
  icon: React.ReactNode
  title: string
  body: string
  foot?: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 rounded-[24px] border border-border bg-surface p-5 shadow-panel transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-panel-hover"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-primary-wash text-primary-ink">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-semibold">{title}</span>
        <span className="mt-0.5 block text-base leading-relaxed text-muted">{body}</span>
        {foot ? <span className="mt-2 block text-sm font-medium text-muted">{foot}</span> : null}
      </span>
      <IconArrowUpRight size={18} className="mt-1 shrink-0 text-muted transition-colors group-hover:text-primary-ink" />
    </Link>
  )
}

/**
 * The per-test rail: accuracy for TWK/TIU, point attainment for TKP, exactly as the analytics
 * returned them. A non-reportable sample says so instead of drawing a 0%.
 */
function Standing({
  snapshot,
  analytics,
}: {
  snapshot: AnalyticsSnapshot | null
  analytics: Load<AnalyticsSnapshot>
}) {
  const tests = ['TWK', 'TIU', 'TKP'] as const
  return (
    <Panel className="p-6 lg:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">Perkembangan</h2>
          <p className="mt-0.5 text-base text-muted">
            Akurasi TWK dan TIU, pencapaian poin TKP. Angka mengikuti data yang sudah dinilai.
          </p>
        </div>
        <ArrowLink to="/progres">Buka Progres</ArrowLink>
      </div>

      {snapshot ? (
        <ul className="mt-5 grid gap-4 md:grid-cols-3">
          {tests.map((t) => {
            const m = snapshot.perTest[t]
            return (
              <li key={t} className="rounded-[16px] border border-border bg-surface-muted/60 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-md font-semibold">{t}</span>
                  <Badge tone="neutral">{m.metric === 'attainment' ? 'Poin' : 'Akurasi'}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted">{testName(t)}</p>
                <div className="mt-3">
                  <MetricText metric={m} />
                </div>
                <div className="mt-2">
                  <MetricBar metric={m} />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {m.sessionCount} sesi · {m.answeredCount} soal terjawab
                </p>
              </li>
            )
          })}
        </ul>
      ) : analytics.phase === 'loading' ? (
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {tests.map((t) => (
            <div key={t} className="h-[132px] animate-pulse rounded-[16px] bg-surface-muted" />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Angka belum ada"
          className="mt-5"
          action={<ActionLink to="/tryout">Kerjakan tryout pertama</ActionLink>}
        >
          Perkembangan muncul setelah satu sesi dinilai. Belum ada yang hilang.
        </EmptyState>
      )}
    </Panel>
  )
}

/** Last scored session — the only history the frontend may reopen (GAP-F1). */
function LastSession({ last }: { last: ScoreResult }) {
  const when = uidOf(last.sessionId)
  return (
    <Panel className="flex flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg">Sesi terakhir</h2>
        {when ? <span className="text-sm text-muted">{formatDate(when)}</span> : null}
      </div>
      <div className="mt-3 flex-1">
        <Figure value={last.total.earned} unit={`dari ${last.total.possible} poin`} size="lg" />
      </div>
      <ArrowLink to={`/tryout/sesi/${last.sessionId}/hasil`} className="mt-4">
        Lihat hasilnya
      </ArrowLink>
    </Panel>
  )
}

/** No session yet: the empty state says what will appear here, not a zero. */
function NoSessions() {
  return (
    <Panel className="p-5">
      <h2 className="text-lg">Sesi terakhir</h2>
      <p className="mt-2 text-base leading-relaxed text-muted">
        Belum ada sesi yang dikerjakan. Setelah tryout atau latihan pertama selesai, hasilnya bisa dibuka
        dari sini.
      </p>
    </Panel>
  )
}

/** The next useful action. No ranking and no threshold verdict is computed here (BR-X2). */
function NextStep({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  const weakestMeasured = Object.entries(snapshot.perCompetency).find(
    ([, m]) => m.state === 'reportable' && m.percent !== null && m.percent < 75,
  )

  return (
    <Panel tone="sunny" className="flex flex-1 flex-col p-5">
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-sunny-ink">
        <IconTarget size={14} />
        Langkah berikutnya
      </p>
      {weakestMeasured ? (
        <>
          <p className="mt-2 font-display text-lg font-semibold leading-snug text-sunny-ink">
            Latih lagi bidang yang persentasenya masih di bawah 75%.
          </p>
          <div className="mt-auto pt-4">
            <Link
              to={`/progres/kompetensi/${weakestMeasured[0]}`}
              className="inline-flex items-center gap-1.5 text-base font-semibold text-sunny-ink underline underline-offset-4"
            >
              Buka rincian bidangnya
              <IconChart size={16} />
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 font-display text-lg font-semibold leading-snug text-sunny-ink">
            Angka yang ada belum cukup untuk menyebut satu bidang. Tambah satu sesi lagi.
          </p>
          <div className="mt-auto pt-4">
            <Link
              to="/tryout"
              className="inline-flex items-center gap-1.5 text-base font-semibold text-sunny-ink underline underline-offset-4"
            >
              Kerjakan tryout lagi
              <IconExam size={16} />
            </Link>
          </div>
        </>
      )}
    </Panel>
  )
}

/** While the snapshot loads, the next-step card holds its space instead of shifting the page. */
function NextStepLoading() {
  return (
    <Panel tone="sunny" className="min-h-[180px] animate-pulse p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-sunny-ink">Langkah berikutnya</p>
      <div className="mt-3 h-4 w-3/4 rounded-full bg-[#00000014]" />
      <div className="mt-2 h-4 w-1/2 rounded-full bg-[#00000014]" />
    </Panel>
  )
}

