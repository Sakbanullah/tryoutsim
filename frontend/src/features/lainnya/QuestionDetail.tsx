import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../data'
import type { Question } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { Badge, Button, Dialog, Field, Notice, Panel, controlClass } from '../../ui/ui'
import { LifecycleBadge, ProvenanceBadge, lifecycleLabel } from '../shared/badges'
import { labelOf } from '../shared/taxonomy'
import { formatDate, testName } from '../shared/format'
import { BackLink } from '../../shell/Layout'
import { PageHeader } from '../../ui/page'
import { IconCheck, IconCheckCircle, IconShield } from '../../ui/icons'

/**
 * Detail soal (`/lainnya/soal/:id`) — PAGE_SPECIFICATIONS §11.
 * Legal transitions only (QUESTION_SPECIFICATION §3); an illegal one is shown disabled with its reason,
 * never hidden. "edit & accept" is blocked by GAP-M1, so acceptance here never edits.
 *
 * Desktop: the question and its key on the left, validation / review / status actions in a side column.
 */
export default function QuestionDetail() {
  const { id = '' } = useParams()
  const question = useApi<Question>(() => api.question(id), [id])
  return (
    <OutcomeView state={question.state} retry={question.retry}>
      {(q) => <DetailBody q={q} onChanged={question.setData} />}
    </OutcomeView>
  )
}

type Action = 'accept' | 'reject' | 'activate' | 'archive' | 'quarantine'

function DetailBody({ q, onChanged }: { q: Question; onChanged: (q: Question) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quarantineOpen, setQuarantineOpen] = useState(false)
  const [reason, setReason] = useState('')

  /** Runs a transition, then shows the record the mock returned (or the reason it refused). */
  async function run(action: Action, extra?: string) {
    setBusy(true)
    setError(null)
    const res =
      action === 'accept'
        ? await api.acceptQuestion(q.id, { decision: 'accepted' })
        : action === 'reject'
          ? await api.acceptQuestion(q.id, { decision: 'rejected' })
          : action === 'activate'
            ? await api.activateQuestion(q.id)
            : action === 'archive'
              ? await api.archiveQuestion(q.id)
              : await api.quarantineQuestion(q.id, extra ?? '')
    setBusy(false)
    if (res.ok) {
      onChanged(res.data)
      setQuarantineOpen(false)
    } else {
      setError(
        res.failure.status === 400 && res.failure.code === 'VALIDATION_FAILED'
          ? (res.failure.fields[0]?.message ?? 'Isian belum lengkap.')
          : 'Langkah ini tidak diizinkan dari kondisi soal saat ini.',
      )
    }
  }

  const can = {
    accept: q.lifecycle === 'draft' || q.lifecycle === 'ai_validated' || q.lifecycle === 'quarantined',
    activate: q.lifecycle === 'human_reviewed',
    archive:
      q.lifecycle === 'draft' ||
      q.lifecycle === 'ai_validated' ||
      q.lifecycle === 'human_reviewed' ||
      q.lifecycle === 'active',
    quarantine: q.lifecycle === 'ai_validated' || q.lifecycle === 'active',
  }

  return (
    <div className="animate-rise space-y-5">
      <BackLink to="/lainnya/soal">Kumpulan soal</BackLink>
      <PageHeader
        eyebrow={`${q.test} · ${labelOf(q.competencyId)}`}
        title="Detail soal"
        actions={
          <>
            <LifecycleBadge lifecycle={q.lifecycle} />
            <ProvenanceBadge provenance={q.provenance} />
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start">
        <div className="min-w-0 space-y-5">
          <Panel className="p-6">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="accent">{testName(q.test)}</Badge>
              <Badge tone="neutral">{labelOf(q.competencyId)}</Badge>
              <Badge tone="neutral">
                {{ easy: 'Mudah', medium: 'Sedang', hard: 'Sulit' }[q.difficulty]}
              </Badge>
            </div>
            <p className="mt-4 max-w-[68ch] font-display text-[19px] font-semibold leading-[1.55]">{q.stem}</p>

            <ol className="mt-4 space-y-2">
              {q.options.map((o) => {
                const score = q.answerKey.optionScores[o.key]
                const keyed = score !== undefined && score === q.answerKey.maxScore
                return (
                  <li
                    key={o.key}
                    className={
                      keyed
                        ? 'flex items-start gap-3 rounded-[14px] border border-[#bfe9d8] bg-success-wash px-3.5 py-2.5'
                        : 'flex items-start gap-3 rounded-[14px] border border-border px-3.5 py-2.5'
                    }
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-border-strong bg-surface text-sm font-bold">
                      {o.key}
                    </span>
                    <span className="flex-1 text-md leading-relaxed">{o.text}</span>
                    <span className="flex shrink-0 items-center gap-2 text-sm tabular-nums text-muted">
                      {keyed ? (
                        <Badge tone="success" icon={<IconCheck size={12} />}>
                          kunci
                        </Badge>
                      ) : null}
                      {score ?? '—'}
                    </span>
                  </li>
                )
              })}
            </ol>

            <div className="mt-4 rounded-[14px] bg-surface-muted p-4">
              <p className="text-sm font-semibold text-muted">Penjelasan</p>
              <p className="mt-1 text-md leading-relaxed">{q.explanation}</p>
            </div>
          </Panel>

          <Panel className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="inline-flex items-center gap-2 text-lg">
                <IconShield size={17} className="text-primary-ink" />
                Cek validasi
              </h2>
              {q.validation ? (
                <Badge
                  tone={q.validation.result === 'pass' ? 'success' : q.validation.result === 'fail' ? 'danger' : 'warning'}
                >
                  {q.validation.result === 'pass' ? 'Lolos' : q.validation.result === 'fail' ? 'Gagal' : 'Perlu perhatian'}
                </Badge>
              ) : null}
            </div>
            {q.validation ? (
              <>
                <p className="mt-1 text-sm text-muted">
                  validator {q.validation.validatorVersion} · {formatDate(q.validation.validatedAt)}
                </p>
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {q.validation.checks.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-[10px] bg-surface-muted px-3 py-1.5 text-sm"
                    >
                      <span className="truncate">{c.id}</span>
                      <span
                        className={
                          c.passed ? 'font-semibold text-success' : 'shrink-0 font-semibold text-danger'
                        }
                      >
                        {c.passed ? 'lolos' : 'tidak lolos'}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-1 text-base text-muted">Belum ada catatan validasi untuk soal ini.</p>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel className="p-5">
            <h2 className="text-lg">Riwayat tinjauan</h2>
            <ul className="mt-2 space-y-2 text-base">
              <li>
                <span className="font-medium">{q.review.reviewer}</span> · {formatDate(q.review.reviewedAt)} ·{' '}
                {q.review.decision === 'accepted'
                  ? 'diterima'
                  : q.review.decision === 'edited'
                    ? 'disunting lalu diterima'
                    : 'ditolak'}
                {q.review.notes ? <span className="block text-sm text-muted">{q.review.notes}</span> : null}
              </li>
            </ul>
            <p className="mt-2 text-sm text-muted">Riwayat hanya ditambah, tidak pernah diubah.</p>
          </Panel>

          <Panel className="p-5">
            <h2 className="text-lg">Ubah status</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Status sekarang: {lifecycleLabel(q.lifecycle)}. Hanya langkah yang diizinkan yang bisa dijalankan.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void run('accept')}
                disabled={busy || !can.accept}
                reason={can.accept ? undefined : `Tidak bisa diterima dari status ${lifecycleLabel(q.lifecycle)}.`}
              >
                Terima
              </Button>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => void run('reject')}
                disabled={busy || !can.accept}
                reason={can.accept ? undefined : 'Tidak bisa ditolak dari status ini.'}
              >
                Tolak
              </Button>
              <Button
                size="sm"
                onClick={() => void run('activate')}
                disabled={busy || !can.activate}
                reason={
                  !can.activate
                    ? 'Tidak bisa diaktifkan sebelum diterima dan lolos validasi.'
                    : q.validation?.result !== 'pass'
                      ? 'Catatan validasi terakhir tidak lolos.'
                      : undefined
                }
              >
                <IconCheckCircle size={16} />
                Aktifkan
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setQuarantineOpen(true)}
                disabled={busy || !can.quarantine}
                reason={
                  can.quarantine ? undefined : 'Karantina hanya berlaku untuk soal yang lolos cek otomatis atau aktif.'
                }
              >
                Karantina
              </Button>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => void run('archive')}
                disabled={busy || !can.archive}
                reason={can.archive ? undefined : `Tidak bisa diarsipkan dari status ${lifecycleLabel(q.lifecycle)}.`}
              >
                Arsipkan
              </Button>
            </div>
            {error ? (
              <div className="mt-3">
                <Notice tone="danger">{error}</Notice>
              </div>
            ) : null}
          </Panel>
        </div>
      </div>

      <Dialog
        open={quarantineOpen}
        title="Karantina soal ini?"
        onClose={() => setQuarantineOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQuarantineOpen(false)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={() => void run('quarantine', reason)}
              disabled={busy || !reason.trim()}
              reason={reason.trim() ? undefined : 'Isi alasan dulu.'}
            >
              Karantina
            </Button>
          </>
        }
      >
        <p className="text-base text-muted">
          Soal yang dikarantina tidak dipakai dalam sesi sampai ditinjau ulang. Tuliskan alasannya.
        </p>
        <div className="mt-3">
          <Field label="Alasan (wajib)" hint="Catatan ini tersimpan di riwayat soal.">
            {(ids) => (
              <textarea
                id={ids.id}
                rows={3}
                aria-describedby={ids.describedBy}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={controlClass()}
              />
            )}
          </Field>
        </div>
      </Dialog>
    </div>
  )
}
