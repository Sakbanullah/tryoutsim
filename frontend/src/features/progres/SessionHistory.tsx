import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../data'
import type { DeletionImpact, SessionSummary } from '../../types/contracts'
import { useApi } from '../shared/useApi'
import { OutcomeView } from '../../shell/OutcomeView'
import { ArrowLink, Badge, Button, Dialog, EmptyState, Notice, Panel, buttonClass } from '../../ui/ui'
import { resultRouteFor } from './resultRoute'
import { formatDateTime } from '../shared/format'

/**
 * Riwayat sesi (`GET /sessions`) — FRONTEND_RESULTS_ANALYTICS §5.3, PAGE_SPECIFICATIONS §1.6.
 * Newest first. A score is shown as the two returned integers, verbatim. Deleting asks the server
 * what changes (`deletion-impact`) and states exactly that; nothing is inferred here.
 */
export function SessionHistory({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const sessions = useApi<SessionSummary[]>(() => api.sessions(), [refreshKey])
  const [deleting, setDeleting] = useState<SessionSummary | null>(null)

  return (
    <Panel className="p-5">
      <OutcomeView state={sessions.state} retry={sessions.retry} loadingLines={3}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              title="Belum ada riwayat"
              action={<ArrowLink to="/tryout">Kerjakan tryout pertama</ArrowLink>}
            >
              Setiap tryout dan latihan yang selesai muncul di sini sebagai satu baris.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {[...list]
                .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
                .map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge tone={s.mode === 'tryout' ? 'accent' : 'lavender'}>
                        {s.mode === 'tryout' ? 'Tryout' : 'Latihan'}
                      </Badge>
                      <span className="text-base tabular-nums text-muted">{formatDateTime(s.startedAt)}</span>
                      <span className="text-base tabular-nums font-medium">
                        {s.totalEarned !== null && s.totalPossible !== null
                          ? `${s.totalEarned}/${s.totalPossible}`
                          : s.status === 'open'
                            ? 'Belum dikirim'
                            : 'Belum dinilai'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      {/* An open session has no result yet; its route would fail, so it offers none. */}
                      {s.status !== 'open' ? (
                        <Link to={resultRouteFor(s.mode, s.id)} className={buttonClass('quiet', 'sm')}>
                          Lihat hasil
                        </Link>
                      ) : null}
                      <Button variant="quiet" size="sm" className="text-danger hover:bg-danger-wash" onClick={() => setDeleting(s)}>
                        Hapus
                      </Button>
                    </span>
                  </li>
                ))}
            </ul>
          )
        }
      </OutcomeView>
      <DeleteDialog
        session={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null)
          onChanged()
        }}
      />
    </Panel>
  )
}

/**
 * The confirmation dialog: fetches `deletion-impact` first and lists every returned change.
 * Confirm runs the delete; a failure keeps the dialog open with the reason.
 */
function DeleteDialog({
  session,
  onClose,
  onDeleted,
}: {
  session: SessionSummary | null
  onClose: () => void
  onDeleted: () => void
}) {
  const impact = useApi<DeletionImpact>(() => api.deletionImpact(session?.id ?? ''), [session?.id])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!session) return null
  const sessionId = session.id

  /** Applies the deletion the dialog just described. */
  async function confirm() {
    setBusy(true)
    setError(null)
    const res = await api.deleteSession(sessionId)
    setBusy(false)
    if (res.ok) onDeleted()
    else setError('Riwayat belum bisa dihapus. Coba lagi.')
  }

  return (
    <Dialog
      open
      title="Hapus riwayat sesi ini?"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={confirm}
            disabled={busy || impact.state.phase === 'loading' || impact.state.outcome.kind !== 'ok'}
          >
            {busy ? 'Menghapus…' : 'Hapus riwayat'}
          </Button>
        </>
      }
    >
      {error ? (
        <div className="mb-3">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}
      <OutcomeView state={impact.state} retry={impact.retry} loadingLines={2}>
        {(i) => (
          <div className="space-y-3">
            <p>Menghapus riwayat ini mengubah:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              {i.derivedChanges.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="tabular-nums text-sm text-muted">{i.sessionsAffected} sesi terdampak.</p>
          </div>
        )}
      </OutcomeView>
    </Dialog>
  )
}
