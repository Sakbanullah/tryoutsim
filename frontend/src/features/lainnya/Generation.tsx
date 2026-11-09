import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../data'
import type { GenerationJob, GenerationRequest } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { actionMessage, useAction } from '../shared/useAction'
import { formatDate } from '../shared/format'
import { Badge, Button, Field, Notice, Panel, Skeleton, controlClass, cx } from '../../ui/ui'
import { BackLink } from '../../shell/Layout'
import { PageHeader } from '../../ui/page'
import { IconBook, IconCheckCircle, IconRefresh, IconSparkle } from '../../ui/icons'
import { COMPETENCIES } from './competencies'

/**
 * Generasi AI (`/lainnya/generasi`, `/lainnya/generasi/:jobId`) — PAGE_SPECIFICATIONS §14.
 * Create (plural competency set per VALIDATION §2), list, read and retry only. There is no cancel,
 * pause or resume: a running job runs to completion, and a load on leave said so. A retry re-runs an
 * `interrupted`/`failed` job on the same provider and model; it never claims to continue one.
 */

const STATUS_WORD: Record<GenerationJob['status'], string> = {
  queued: 'Menunggu',
  running: 'Berjalan',
  done: 'Selesai',
  failed: 'Gagal',
  interrupted: 'Terhenti',
}

const FAILURE_TEXT: Record<string, string> = {
  provider_unavailable: 'Layanan AI tidak dapat dihubungi. Uji koneksi di Pengaturan AI, lalu coba lagi.',
  provider_auth: 'Kunci API ditolak. Periksa Pengaturan AI.',
  timeout: 'Layanan AI terlalu lama menjawab. Coba lagi.',
  rate_limited: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
  validation: 'Sebagian soal tidak lolos validasi. Tinjau draf yang dihasilkan.',
}

export function GenerationSetup() {
  return (
    <div className="animate-rise space-y-5">
      <BackLink to="/lainnya">Lainnya</BackLink>
      <PageHeader
        eyebrow="Pembuatan soal"
        title="Buat soal dengan AI"
        lead="Soal baru masuk sebagai draf; tidak dipakai dalam sesi sampai kamu tinjau dan mengaktifkannya."
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <SetupForm />
        <JobList />
      </div>
    </div>
  )
}

/** The create form: which leaves, how hard, how many. Config is implied by the newest usable config. */
function SetupForm() {
  const navigate = useNavigate()
  const action = useAction()
  const [selected, setSelected] = useState<Set<string>>(() => new Set([COMPETENCIES[0]?.id ?? '']))
  const [difficulty, setDifficulty] = useState<GenerationRequest['difficulty']>('medium')
  const [count, setCount] = useState(5)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Panel className="p-6">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const created = await action.run(() =>
            api.createGenerationJob({ competencyIds: [...selected], difficulty, count }),
          )
          if (created) navigate(`/lainnya/generasi/${created.jobId}`)
        }}
      >
        <fieldset>
          <legend className="text-base font-semibold">Submateri</legend>
          <p className="mt-0.5 text-sm text-muted">Pilih satu atau lebih. Setiap submateri menghasilkan satu batch.</p>
          <ul className="mt-2 grid max-h-72 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {COMPETENCIES.map((c) => (
              <li key={c.id}>
                <label className={cx('flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-sm', selected.has(c.id) ? 'border-primary bg-primary-wash font-medium' : 'border-border-strong hover:bg-surface-muted/60')}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="truncate" title={c.label}>{c.label}</span>
                </label>
              </li>
            ))}
          </ul>
          {action.fieldErrors.competencyIds ? (
            <p className="mt-1 text-sm font-medium text-danger">{action.fieldErrors.competencyIds}</p>
          ) : null}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tingkat kesulitan">
            {({ id }) => (
              <select id={id} value={difficulty} onChange={(e) => setDifficulty(e.target.value as GenerationRequest['difficulty'])} className={controlClass()}>
                <option value="easy">Mudah</option>
                <option value="medium">Sedang</option>
                <option value="hard">Sulit</option>
              </select>
            )}
          </Field>
          <Field label="Jumlah soal" hint="Per submateri, 1 sampai 20." error={action.fieldErrors.count}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                aria-describedby={describedBy}
                className={`${controlClass(invalid)} tabular-nums`}
              />
            )}
          </Field>
        </div>

        {action.failure ? (
          <Notice tone="danger" title={action.failure.kind === 'conflict' ? 'Belum bisa dimulai' : 'Permintaan gagal'}>
            {actionMessage(action.failure)}{' '}
            <Link to="/lainnya/ai" className="font-semibold underline">
              Buka Pengaturan AI
            </Link>
          </Notice>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button
            type="submit"
            size="lg"
            disabled={action.busy || selected.size === 0}
            reason={selected.size === 0 ? 'Pilih minimal satu submateri.' : undefined}
          >
            <IconSparkle size={17} />
            {action.busy ? 'Memulai…' : 'Mulai membuat soal'}
          </Button>
          <p className="max-w-[42ch] text-sm text-muted">
            Pekerjaan tetap berjalan di latar belakang bila kamu menutup halaman ini.
          </p>
        </div>
      </form>
    </Panel>
  )
}

/* ── Job list ─────────────────────────────────────────────────────────────────────────── */

function JobList() {
  const jobs = useApi<GenerationJob[]>(() => api.generationJobs(), [])
  return (
    <Panel tone="muted" className="p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg">Pekerjaan terakhir</h2>
        <Button size="sm" variant="quiet" onClick={jobs.retry}>
          <IconRefresh size={15} />
          Muat ulang
        </Button>
      </div>
      <OutcomeView state={jobs.state} retry={jobs.retry} loadingLines={3}>
        {(rows) =>
          rows.length === 0 ? (
            <p className="mt-2 text-base text-muted">Belum ada pekerjaan. Permintaan pertama akan muncul di sini.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {rows.map((j) => (
                <li key={j.jobId}>
                  <Link
                    to={`/lainnya/generasi/${j.jobId}`}
                    className="flex items-center justify-between gap-2 rounded-[12px] border border-border bg-surface px-3 py-2.5 text-md hover:border-border-strong"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{j.jobId}</span>
                      <span className="block text-sm text-muted">
                        {formatDate(j.createdAt ?? '')} · {j.created}/{j.requested}
                      </span>
                    </span>
                    <Badge tone={j.status === 'done' ? 'success' : j.status === 'failed' || j.status === 'interrupted' ? 'danger' : 'accent'}>
                      {STATUS_WORD[j.status]}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </OutcomeView>
    </Panel>
  )
}

/* ── Job detail ───────────────────────────────────────────────────────────────────────── */

/** Polls until a terminal status; every terminal state says what happened and what to do next. */
export function GenerationProgress() {
  const { jobId = '' } = useParams()
  const [job, setJob] = useState<GenerationJob | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const action = useAction()

  useEffect(() => {
    let live = true
    let timer: number | undefined
    const tick = async () => {
      const res = await api.generationJob(jobId)
      if (!live) return
      if (!res.ok) {
        setLoadError('Pekerjaan ini tidak ditemukan atau tidak bisa dibaca.')
        return
      }
      setLoadError(null)
      setJob(res.data)
      // `interrupted` is terminal until the user retries; only queued/running keep polling.
      if (res.data.status === 'queued' || res.data.status === 'running') timer = window.setTimeout(tick, 900)
    }
    void tick()
    return () => {
      live = false
      if (timer) window.clearTimeout(timer)
    }
  }, [jobId])

  const terminal = job ? job.status === 'done' || job.status === 'failed' || job.status === 'interrupted' : false
  const reached = job ? ['queued', 'running', 'done'].indexOf(job.status === 'interrupted' ? 'running' : job.status) : -1

  return (
    <div className="animate-rise mx-auto max-w-page space-y-5">
      <BackLink to="/lainnya/generasi">Buat soal dengan AI</BackLink>
      <PageHeader
        eyebrow="Pembuatan soal"
        title="Membuat soal"
        lead="Halaman ini memperbarui sendiri sampai pekerjaan berhenti. Kamu boleh meninggalkannya."
        actions={job ? <Badge tone={job.status === 'done' ? 'success' : job.status === 'failed' || job.status === 'interrupted' ? 'danger' : 'accent'}>{STATUS_WORD[job.status]}</Badge> : null}
      />

      {loadError ? <Notice tone="danger">{loadError}</Notice> : null}
      {!job && !loadError ? (
        <Panel className="p-6">
          <Skeleton lines={2} />
        </Panel>
      ) : null}

      {job ? (
        <>
          <Panel className="p-6">
            <ol className="flex flex-wrap items-center gap-3" aria-label="Tahap pembuatan soal">
              {(['queued', 'running', 'done'] as const).map((key, i) => {
                const done = job.status === 'done' || i < reached
                const active = i === reached && !terminal
                return (
                  <li key={key} className="flex items-center gap-2">
                    <span
                      className={
                        done
                          ? 'flex h-7 w-7 items-center justify-center rounded-full bg-success-wash text-success'
                          : active
                            ? 'flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white'
                            : 'flex h-7 w-7 items-center justify-center rounded-full bg-surface-muted text-sm font-bold text-muted'
                      }
                    >
                      {done ? <IconCheckCircle size={16} /> : <span className="tabular-nums text-sm">{i + 1}</span>}
                    </span>
                    <span className={active ? 'text-md font-semibold' : 'text-md text-muted'}>{STATUS_WORD[key]}</span>
                    {i < 2 ? <span aria-hidden className="hidden h-px w-8 bg-border-strong sm:block" /> : null}
                  </li>
                )
              })}
            </ol>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Figure label="Diminta" value={job.requested} />
              <Figure label="Dibuat" value={job.created} highlight />
              <Figure label="Gagal" value={job.failed} />
            </div>

            {job.status === 'interrupted' ? (
              <Notice tone="warning" className="mt-4" title="Pekerjaan terhenti">
                {job.interruptedReason ?? 'Pekerjaan berhenti sebelum selesai.'} Soal yang sudah dibuat tetap tersimpan sebagai draf.
              </Notice>
            ) : null}

            {job.status === 'failed' ? (
              <Notice tone="danger" className="mt-4" title="Pembuatan soal gagal">
                {FAILURE_TEXT[job.failureCategory ?? ''] ?? 'Ada kesalahan saat membuat soal. Coba lagi.'}
              </Notice>
            ) : null}

            {action.failure ? (
              <Notice tone="danger" className="mt-4">
                {actionMessage(action.failure)}
              </Notice>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
              {job.status === 'interrupted' || job.status === 'failed' ? (
                <Button
                  disabled={action.busy}
                  onClick={async () => {
                    const next = await action.run(() => api.retryGenerationJob(job.jobId))
                    if (next) setJob(next)
                  }}
                >
                  <IconRefresh size={17} />
                  {action.busy ? 'Mengulang…' : 'Coba lagi'}
                </Button>
              ) : null}
              {!terminal ? (
                <p className="max-w-[52ch] text-sm leading-relaxed text-muted">
                  Pekerjaan berjalan sampai selesai dan tidak bisa dibatalkan. Kamu boleh menutup halaman ini.
                </p>
              ) : null}
              {job.drafts && job.drafts.length > 0 ? (
                <Link to="/lainnya/soal?lifecycle=ai_validated" className="inline-flex items-center gap-1.5 text-base font-semibold text-primary-ink underline-offset-4 hover:underline">
                  <IconBook size={16} />
                  Tinjau {job.drafts.length} draf
                </Link>
              ) : null}
            </div>
          </Panel>

          {job.drafts && job.drafts.length > 0 ? (
            <Panel className="p-5">
              <h2 className="text-lg">Draf yang dihasilkan</h2>
              <ul className="mt-2 divide-y divide-border">
                {job.drafts.map((d) => (
                  <li key={d.questionId} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate text-md">{d.stem}</span>
                    <Link to={`/lainnya/soal/${d.questionId}`} className="shrink-0 text-sm font-semibold text-primary-ink underline">
                      Tinjau
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/** One figure of the job: a contract integer and what it counts. */
function Figure({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={highlight ? 'rounded-[16px] bg-primary-wash px-4 py-3' : 'rounded-[16px] bg-surface-muted px-4 py-3'}>
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-[30px] font-bold leading-tight tabular-nums">{value}</p>
    </div>
  )
}
