import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../data'
import type { Question, QuestionBatch, QuestionReport, SampleOutcome } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { actionMessage, useAction } from '../shared/useAction'
import { formatDate } from '../shared/format'
import { labelOf } from '../shared/taxonomy'
import { Badge, Button, Dialog, EmptyState, Notice, Panel, cx } from '../../ui/ui'
import { PageHeader } from '../../ui/page'
import { IconChevronRight, IconRefresh } from '../../ui/icons'

/**
 * Review Soal (`/lainnya/review`) — PAGE_SPECIFICATIONS §12.
 * Three queues in one place: batches awaiting a sample, reported questions awaiting a decision, and
 * questions currently quarantined. Every action here records a decision the user made; none of the
 * counts is derived on the client — `passedForSampling`, `quarantined` and `sampleSize` are shown as
 * the backend returned them.
 */
export default function ReviewSoal() {
  const batches = useApi<QuestionBatch[]>(() => api.questionBatches(), [])
  const reports = useApi<QuestionReport[]>(() => api.questionReports(), [])
  const quarantined = useApi<Question[]>(() => api.questions({ lifecycle: 'quarantined' }), [])

  const reloadAll = () => {
    batches.retry()
    reports.retry()
    quarantined.retry()
  }

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow="Kelola"
        title="Review soal"
        lead="Tindak lanjuti yang ditandai aplikasi: batch yang menunggu sampel dan soal yang dilaporkan."
        actions={
          <Button variant="secondary" onClick={reloadAll}>
            <IconRefresh size={17} />
            Muat ulang
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
        <div className="space-y-6">
          <section aria-labelledby="batch-title">
            <h2 id="batch-title" className="mb-3 text-xl">
              Batch menunggu sampel
            </h2>
            <OutcomeView state={batches.state} retry={batches.retry}>
              {(rows) =>
                rows.length === 0 ? (
                  <EmptyState title="Tidak ada batch yang menunggu" action={<Link className="font-semibold text-primary-ink underline" to="/lainnya/soal">Buka kumpulan soal</Link>}>
                    Batch baru muncul di sini setelah dibuat dan lolos validasi awal.
                  </EmptyState>
                ) : (
                  <ul className="space-y-3">
                    {rows.map((b) => (
                      <li key={b.batchId}>
                        <BatchRow batch={b} onRecorded={() => { batches.retry(); quarantined.retry() }} />
                      </li>
                    ))}
                  </ul>
                )
              }
            </OutcomeView>
          </section>

          <section aria-labelledby="quarantine-title">
            <h2 id="quarantine-title" className="mb-3 text-xl">
              Karantina
            </h2>
            <OutcomeView state={quarantined.state} retry={quarantined.retry} loadingLines={3}>
              {(rows) =>
                rows.length === 0 ? (
                  <EmptyState title="Tidak ada soal dalam karantina" action={<Link className="font-semibold text-primary-ink underline" to="/lainnya/soal?lifecycle=quarantined">Lihat di kumpulan soal</Link>}>
                    Soal dikarantina ketika ada laporan kritis atau ditemukan cacat.
                  </EmptyState>
                ) : (
                  <ul className="divide-y divide-border rounded-[16px] border border-border bg-surface">
                    {rows.map((q) => (
                      <li key={q.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-md font-medium">{q.stem}</p>
                          <p className="mt-0.5 text-sm text-muted">
                            {q.test} · {labelOf(q.competencyId)}
                          </p>
                        </div>
                        <Link
                          to={`/lainnya/soal/${q.id}`}
                          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-ink underline"
                        >
                          Perbaiki
                          <IconChevronRight size={15} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              }
            </OutcomeView>
          </section>
        </div>

        <section aria-labelledby="reports-title">
          <h2 id="reports-title" className="mb-3 text-xl">
            Laporan soal
          </h2>
          <OutcomeView state={reports.state} retry={reports.retry} loadingLines={4}>
            {(rows) =>
              rows.length === 0 ? (
                <EmptyState title="Tidak ada laporan" action={<Link className="font-semibold text-primary-ink underline" to="/lainnya/soal">Buka kumpulan soal</Link>}>
                  Laporan dari halaman hasil atau kumpulan soal muncul di sini.
                </EmptyState>
              ) : (
                <ul className="space-y-3">
                  {rows.map((r) => (
                    <li key={r.id}>
                      <ReportRow report={r} onDecided={() => { reports.retry(); quarantined.retry() }} />
                    </li>
                  ))}
                </ul>
              )
            }
          </OutcomeView>
        </section>
      </div>
    </div>
  )
}

/* ── One batch: counts as returned, then the sampling decision ───────────────────────── */

const SAMPLE_OUTCOMES: Array<{ value: SampleOutcome; label: string; body: string }> = [
  { value: 'clean', label: 'Bersih', body: 'Sampel diperiksa dan tidak ada temuan.' },
  { value: 'findings', label: 'Ada temuan', body: 'Pilih soal yang bermasalah lalu catat temuannya.' },
  { value: 'systemic', label: 'Masalah sistemik', body: 'Seluruh batch tidak layak dipakai.' },
]

/**
 * A batch card. The outcome is a radio group; "Ada temuan" reveals the finding list with one entry
 * per sampled item the user can pick — the sampled item ids are not in the documented row shape, so
 * the finding is recorded per entered question id, which is what the route accepts (`findings[]`).
 */
function BatchRow({ batch, onRecorded }: { batch: QuestionBatch; onRecorded: () => void }) {
  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState<SampleOutcome>('clean')
  const [findingId, setFindingId] = useState('')
  const action = useAction()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const findings = outcome === 'findings' ? findingId.split(/[\s,]+/).filter(Boolean) : []
    const done = await action.run(() => api.recordSample(batch.batchId, { outcome, findings }))
    if (done) {
      setOpen(false)
      setFindingId('')
      onRecorded()
    }
  }

  const pending = batch.sampleStatus === 'pending'
  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-md font-semibold">Batch {batch.batchId}</p>
          <p className="mt-0.5 text-sm text-muted">
            Dibuat {formatDate(batch.createdAt)} · {batch.total} soal
          </p>
        </div>
        <Badge tone={pending ? 'warning' : 'success'}>{pending ? 'Menunggu sampel' : 'Sudah disampel'}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">Lolos ke sampel</dt>
          <dd className="tabular-nums text-md font-semibold">{batch.passedForSampling}</dd>
        </div>
        <div>
          <dt className="text-muted">Dikarantina</dt>
          <dd className="tabular-nums text-md font-semibold">{batch.quarantined}</dd>
        </div>
        <div>
          <dt className="text-muted">Ukuran sampel</dt>
          <dd className="tabular-nums text-md font-semibold">{batch.sampleSize ?? 'Ditarik backend'}</dd>
        </div>
      </dl>
      {pending ? (
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Tinjau sampel
          </Button>
          {!open ? null : (
            <form className="mt-4 space-y-3 border-t border-border pt-4" onSubmit={submit}>
              <fieldset>
                <legend className="text-base font-semibold">Hasil pemeriksaan sampel</legend>
                <div className="mt-2 space-y-2">
                  {SAMPLE_OUTCOMES.map((o) => (
                    <label key={o.value} className={cx('flex cursor-pointer items-start gap-2.5 rounded-[12px] border px-3 py-2.5', outcome === o.value ? 'border-primary bg-primary-wash' : 'border-border-strong hover:bg-surface-muted/60')}>
                      <input
                        type="radio"
                        name={`sample-${batch.batchId}`}
                        value={o.value}
                        checked={outcome === o.value}
                        onChange={() => setOutcome(o.value)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-md font-semibold">{o.label}</span>
                        <span className="block text-sm text-muted">{o.body}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {outcome === 'findings' ? (
                <div>
                  <label htmlFor={`findings-${batch.batchId}`} className="block text-base font-semibold">
                    Soal yang bermasalah
                  </label>
                  <p className="mt-0.5 text-sm text-muted">Satu id soal per baris.</p>
                  <textarea
                    id={`findings-${batch.batchId}`}
                    required
                    value={findingId}
                    onChange={(e) => setFindingId(e.target.value)}
                    rows={2}
                    className="mt-1.5 block w-full rounded-[12px] border border-border-strong bg-surface px-3.5 py-2.5 text-md focus:border-primary focus:shadow-control-focus focus:outline-none"
                  />
                  {action.fieldErrors.findings ? (
                    <p className="mt-1 text-sm font-medium text-danger">{action.fieldErrors.findings}</p>
                  ) : null}
                </div>
              ) : null}

              <Notice tone="info">Sampel sudah diperiksa, bukan jaminan seluruh soal benar.</Notice>
              {action.failure ? <Notice tone="danger">{actionMessage(action.failure)}</Notice> : null}
              <div className="flex gap-2">
                <Button type="submit" disabled={action.busy}>
                  {action.busy ? 'Menyimpan…' : 'Simpan hasil sampel'}
                </Button>
                <Button variant="quiet" type="button" onClick={() => setOpen(false)}>
                  Batal
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </Panel>
  )
}

/* ── One report: excerpt, severity, then the final decision ─────────────────────────── */

/**
 * A report row. `repaired` opens the question editor, as the page spec says; `withdrawn` and
 * `rejected` are recorded directly. The decision is confirmed in a dialog that states what it means.
 */
function ReportRow({ report, onDecided }: { report: QuestionReport; onDecided: () => void }) {
  const [pending, setPending] = useState<'repaired' | 'withdrawn' | 'rejected' | null>(null)
  const action = useAction()

  async function decide(decision: 'repaired' | 'withdrawn' | 'rejected') {
    const done = await action.run(() => api.decideReport(report.id, { decision }))
    if (done) {
      setPending(null)
      onDecided()
    }
  }

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/lainnya/soal/${report.questionId}`} className="block truncate text-md font-semibold underline decoration-border-strong underline-offset-2 hover:text-primary-ink">
            {report.questionId}
          </Link>
          <p className="mt-1 text-base leading-relaxed">{report.note}</p>
        </div>
        <Badge tone={report.severity === 'critical' ? 'danger' : report.severity === 'major' ? 'warning' : 'neutral'}>
          {report.severity === 'critical' ? 'Kritis' : report.severity === 'major' ? 'Penting' : 'Ringan'}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-muted">
        {report.category} · versi {report.targetContentVersion} · {formatDate(report.createdAt)}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setPending('repaired')}>
          Sudah diperbaiki
        </Button>
        <Button size="sm" variant="quiet" onClick={() => setPending('withdrawn')}>
          Tarik laporan
        </Button>
        <Button size="sm" variant="quiet" onClick={() => setPending('rejected')}>
          Tolak laporan
        </Button>
      </div>

      <Dialog
        open={pending !== null}
        title={
          pending === 'repaired' ? 'Buka editor soal?' : pending === 'withdrawn' ? 'Tarik laporan ini?' : 'Tolak laporan ini?'
        }
        onClose={() => { setPending(null); action.clear() }}
        footer={
          pending === 'repaired' ? (
            <Link
              to={`/lainnya/soal/${report.questionId}`}
              className="inline-flex min-h-[46px] items-center rounded-[14px] bg-primary px-5 text-md font-semibold text-white hover:bg-primary-hover"
            >
              Buka soal
            </Link>
          ) : (
            <Button
              variant={pending === 'rejected' ? 'danger' : 'primary'}
              disabled={action.busy}
              onClick={() => pending && void decide(pending)}
            >
              {action.busy ? 'Menyimpan…' : 'Ya, lanjutkan'}
            </Button>
          )
        }
      >
        <p>
          {pending === 'repaired'
            ? 'Laporan tercatat diperbaiki. Soal yang sudah diperbaiki mendapat versi baru dan perlu ditinjau ulang.'
            : pending === 'withdrawn'
              ? 'Pelapor menarik laporan. Soal tidak berubah.'
              : 'Laporan ditolak sebagai tidak beralasan. Soal tidak berubah.'}
        </p>
        {action.failure ? (
          <Notice tone="danger" className="mt-3">
            {actionMessage(action.failure)}
          </Notice>
        ) : null}
      </Dialog>
    </Panel>
  )
}
