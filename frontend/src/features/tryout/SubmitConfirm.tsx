import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../data'
import type { SessionDetail } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { Badge, Button, Notice, Panel, buttonClass } from '../../ui/ui'
import { IconAlert, IconFlag } from '../../ui/icons'
import { readSheet, resultPath } from './Runner'

/**
 * Konfirmasi kirim (`/tryout/sesi/:id/konfirmasi`) — makes submitting explicit (PAGE_SPECIFICATIONS §5).
 * Counts come from the tab's own view of `selected`, so it can say exactly which numbers are blank.
 * "Kembali ke soal" is the safe default focus. Submitting is the irreversible step, so it sits on its
 * own band and says what happens after it.
 */
export default function SubmitConfirm() {
  const { sessionId = '' } = useParams()
  const session = useApi<SessionDetail>(() => api.session(sessionId), [sessionId])
  return (
    <OutcomeView state={session.state} retry={session.retry}>
      {(detail) =>
        detail.status !== 'open' ? (
          <Notice tone="info" title="Sesi ini sudah dikirim">
            <Link className="font-semibold underline" to={resultPath('tryout', sessionId)}>
              Lihat hasil
            </Link>
          </Notice>
        ) : (
          <ConfirmBody detail={detail} />
        )
      }
    </OutcomeView>
  )
}

function ConfirmBody({ detail }: { detail: SessionDetail }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [preflight, setPreflight] = useState<string[]>([])
  // The tab's own answer sheet (GAP-F2 gives no read-back of answers): names the blank numbers and is
  // re-sent so a reloaded session submits what the learner actually selected.
  const [sheet] = useState(() => readSheet(detail.sessionId))
  const numbersByQuestion = new Map(detail.questions.map((q, i) => [q.questionId, i + 1]))
  const unanswered = detail.questions
    .filter((q) => !sheet[q.questionId])
    .map((q) => numbersByQuestion.get(q.questionId)!)
  const answered = detail.questions.length - unanswered.length
  /** Rows are `'passed' | 'failed'` only after a submit attempt; otherwise they are just listed. */
  const [flaggedOnly, setFlaggedOnly] = useState(false)

  async function submit() {
    setBusy(true)
    setFailed(null)
    setPreflight([])
    const res = await api.submitSession(detail.sessionId, {
      answers: Object.entries(sheet).map(([questionId, selectedOption]) => ({ questionId, selectedOption })),
    })
    setBusy(false)
    if (res.ok) {
      navigate(resultPath('tryout', detail.sessionId), { replace: true })
      return
    }
    const f = res.failure
    if (f.status === 422 && f.code === 'PREFLIGHT_FAILED') {
      setPreflight(f.errors.map((e) => (e.path ? `Soal ${e.path}: ${e.message}` : e.message)))
      return
    }
    if (f.status === 409 && f.code === 'CONFLICT') {
      navigate(resultPath('tryout', detail.sessionId), { replace: true })
      return
    }
    if (f.status === 409) {
      // Approval/threshold codes: the session is submitted and kept; the result screen shows why.
      navigate(resultPath('tryout', detail.sessionId), { replace: true })
      return
    }
    setFailed('Gagal mengirim. Jawabanmu aman.')
  }

  return (
    <div className="animate-fade mx-auto max-w-page">
      <div className="grid gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-4">
          <header>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted">Langkah terakhir</p>
            <h1 className="font-display text-[clamp(26px,2vw,32px)] font-bold leading-tight tracking-[-0.025em]">
              Kirim jawaban?
            </h1>
            <p className="mt-2 text-md leading-relaxed text-muted">
              Periksa sisa soal sebelum mengirim. Setelah terkirim, jawaban tidak bisa diubah lagi.
            </p>
          </header>

          <Panel className="p-6">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-[38px] font-bold leading-none tabular-nums">{answered}</span>
              <span className="text-md text-muted">dari {detail.questions.length} soal dijawab</span>
            </div>

            {unanswered.length > 0 ? (
              <>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1.5 text-base font-semibold text-warning">
                    <IconAlert size={16} />
                    Belum dijawab: {unanswered.length} soal
                  </p>
                  <button
                    type="button"
                    onClick={() => setFlaggedOnly((v) => !v)}
                    className="text-sm font-semibold text-primary-ink underline-offset-4 hover:underline"
                  >
                    {flaggedOnly ? 'Tampilkan semua' : 'Tampilkan dalam kisi'}
                  </button>
                </div>
                {flaggedOnly ? (
                  <ol className="mt-3 grid grid-cols-7 gap-1.5 sm:grid-cols-10">
                    {detail.questions.map((q, i) => {
                      const blank = !sheet[q.questionId]
                      return (
                        <li key={q.questionId}>
                          <span
                            className={
                              blank
                                ? 'flex min-h-9 items-center justify-center rounded-[8px] border border-[#efdb9b] bg-sunny text-sm font-semibold tabular-nums text-sunny-ink'
                                : 'flex min-h-9 items-center justify-center rounded-[8px] bg-primary-wash text-sm font-semibold tabular-nums text-primary-ink'
                            }
                          >
                            {i + 1}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                ) : (
                  <p className="mt-2 text-base leading-relaxed text-muted">Soal nomor {unanswered.join(', ')}.</p>
                )}
                <p className="mt-3 text-sm text-muted">
                  Soal kosong dikirim apa adanya; poinnya mengikuti aturan penilaian, bukan dihitung di sini.
                </p>
              </>
            ) : (
              <p className="mt-2 inline-flex items-center gap-1.5 text-base font-medium text-success">
                Semua soal sudah dijawab.
              </p>
            )}
          </Panel>

          {preflight.length > 0 ? (
            <Notice tone="danger" title="Belum ada yang dinilai">
              <ul className="list-disc space-y-1 pl-5">
                {preflight.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </Notice>
          ) : null}
          {failed ? (
            <Notice tone="danger" title={failed}>
              <button type="button" className="font-semibold underline" onClick={() => void submit()}>
                Coba kirim lagi
              </button>
            </Notice>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-6">
          <Panel className="p-5">
            <h2 className="text-lg">Kirim sekarang</h2>
            <p className="mt-1 text-base leading-relaxed text-muted">
              Jawaban tersimpan otomatis selama mengerjakan. Yang belum tersimpan tidak ikut terkirim.
            </p>
            <div className="mt-4 space-y-2.5">
              <Link
                to={`/tryout/sesi/${detail.sessionId}`}
                autoFocus
                className={buttonClass('secondary', undefined, 'w-full')}
              >
                Kembali ke soal
              </Link>
              <Button variant="danger" size="lg" className="w-full" onClick={() => void submit()} disabled={busy}>
                {busy ? 'Mengirim…' : 'Kirim jawaban'}
              </Button>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-sm text-muted">
              <IconFlag size={14} />
              <span>Sesi tetap bisa dibuka dari halaman hasil setelah dikirim.</span>
            </div>
            <Badge tone="neutral" className="mt-3">
              {detail.questions.length} soal
            </Badge>
          </Panel>
        </aside>
      </div>
    </div>
  )
}
