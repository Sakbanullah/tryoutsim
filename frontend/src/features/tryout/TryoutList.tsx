import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../data'
import type { Package, SessionSummary } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { toLoad, useApi } from '../shared/useApi'
import type { Load } from '../shared/useApi'
import { actionMessage, useAction } from '../shared/useAction'
import { ArrowLink, Badge, Button, Dialog, EmptyState, Notice, Panel, buttonClass } from '../../ui/ui'
import { PageHeader } from '../../ui/page'
import { IconArrowUpRight, IconInfo, IconShield, IconTrash } from '../../ui/icons'
import { readLastResultPointer } from '../shared/format'
import { availabilityText, definitionTitle, repeatStatement, unavailableReason } from '../shared/package'

/**
 * Tryout pilih (`/tryout`) — one card per package from `GET /packages?mode=tryout`
 * (PAGE_SPECIFICATIONS §2). No exam config appears here: the server binds it at session creation.
 * A card with enough stock opens its detail; every other state says why it cannot start and offers
 * the way to add questions.
 */
export default function TryoutList() {
  const packages = useApi<Package[]>(() => api.packages('tryout'), [])
  // GAP-F1 is closed by `GET /sessions`; the pointer stays as the one-click shortcut to the last result.
  const last = readLastResultPointer()

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow="Tryout"
        title="Pilih tryout"
        lead="Setiap kartu adalah satu paket soal. Baca jumlah soal dan catatan pengulangannya sebelum mulai."
      />

      {last?.mode === 'tryout' ? (
        <Panel tone="flat" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="text-md font-medium">Kamu punya sesi tryout yang sudah dinilai.</span>
          <ArrowLink to={`/tryout/sesi/${last.sessionId}/hasil`}>Lihat hasil sesi terakhir</ArrowLink>
        </Panel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <OutcomeView state={packages.state} retry={packages.retry}>
          {(list) =>
            list.length === 0 ? (
              <EmptyState
                title="Belum ada paket tryout"
                action={
                  <Link to="/lainnya/generasi" className={buttonClass('primary')}>
                    Buat soal dengan AI
                  </Link>
                }
              >
                Paket tryout tersedia setelah kumpulan soal memiliki soal aktif.
              </EmptyState>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {list.map((p) => (
                  <li key={p.id}>
                    <PackageCard pkg={p} onDeleted={packages.retry} />
                  </li>
                ))}
              </ul>
            )
          }
        </OutcomeView>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <Panel tone="muted" className="p-5">
            <p className="inline-flex items-center gap-1.5 font-display text-md font-semibold">
              <IconShield size={16} className="text-primary-ink" />
              Membaca labelnya
            </p>
            <dl className="mt-3 space-y-3 text-sm leading-relaxed">
              <div>
                <dt className="font-semibold text-ink">Siap dikerjakan</dt>
                <dd className="text-muted">Stok soal baru cukup untuk seluruh isi paket.</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Sebagian diulang</dt>
                <dd className="text-muted">Stok soal baru kurang, jadi sebagian soal pernah kamu kerjakan.</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Belum cukup soal</dt>
                <dd className="text-muted">Tambah soal sebelum paket ini bisa dimulai.</dd>
              </div>
            </dl>
          </Panel>

          <Panel tone="lavender" className="p-5">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-lavender-ink">
              <IconInfo size={15} />
              Tentang soalnya
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-lavender-ink">
              Soal latihan di aplikasi ini dibuat untuk belajar dan tidak diambil dari naskah resmi tahun
              berjalan.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

/**
 * One package card: title, version, subtest, item count, availability and the repeat statement, plus the delete
 * action. Deleting retires the package on the server (PACKAGE_SPECIFICATION §5), so the list is re-read and the
 * card leaves it; its sessions and results stay in Riwayat.
 */
function PackageCard({ pkg, onDeleted }: { pkg: Package; onDeleted: () => void }) {
  const startable = pkg.availability.startable
  const { definition } = pkg
  const repeat = repeatStatement(pkg)
  const [confirming, setConfirming] = useState(false)
  // Null means "not read yet". A failed read is its own state, never an empty list: the dialog must not claim
  // "no sessions" when it simply could not ask (AGENTS.md: no fallback that hides a failure).
  const [sessions, setSessions] = useState<Load<SessionSummary[]> | null>(null)
  const action = useAction()

  /** Read the package's sessions for the dialog; a failure keeps its outcome so the dialog can offer a retry. */
  const readSessions = useCallback(() => {
    setSessions({ phase: 'loading' })
    void api.sessions().then((res) => setSessions(toLoad(res.ok ? { ok: true, data: res.data.filter((s) => s.packageId === pkg.id) } : res)))
  }, [pkg.id])

  // The sessions are read when the dialog opens, so the warning names the real count, and read again only on retry.
  useEffect(() => {
    if (confirming && sessions === null) readSessions()
  }, [confirming, sessions, readSessions])

  /** Retire this package. A non-null result means it left the list. */
  async function remove() {
    const done = await action.run(() => api.retirePackage(pkg.id))
    if (done) {
      setConfirming(false)
      onDeleted()
    }
  }

  const body = (
    <Panel
      className={
        startable
          ? 'group relative flex h-full flex-col p-5 transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-panel-hover'
          : 'relative flex h-full flex-col bg-surface-muted/70 p-5'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-display text-xl">{pkg.titleId}</h2>
        <div className="flex items-center gap-1">
          <Badge tone={startable ? 'success' : 'warning'}>{availabilityText(pkg)}</Badge>
          <Button
            variant="quiet"
            size="sm"
            className="relative z-10"
            aria-label={`Hapus paket ${pkg.titleId}`}
            title="Hapus paket"
            onClick={() => setConfirming(true)}
          >
            <IconTrash size={16} />
          </Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral">v{pkg.version}</Badge>
        <Badge tone="accent">{definitionTitle(definition)}</Badge>
      </div>
      <p className="mt-3 text-base leading-relaxed text-muted">
        <span className="tabular-nums font-semibold text-ink">{definition.itemCount}</span> soal
      </p>
      {repeat ? (
        <div className="mt-2">
          <Notice tone="warning" className="px-3 py-2 text-sm">
            {repeat}
          </Notice>
        </div>
      ) : null}
      {startable ? (
        <span className="mt-auto pt-3 inline-flex items-center gap-1 text-base font-semibold text-primary-ink">
          Lihat detail
          <IconArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      ) : (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
          <Button disabled reason={unavailableReason(pkg)}>
            Mulai
          </Button>
          {pkg.availability.eligibleStock === 0 ? (
            <Link to="/lainnya/generasi" className={buttonClass('secondary', 'sm')}>
              Tambah soal
            </Link>
          ) : null}
        </div>
      )}

      <Dialog
        open={confirming}
        title="Hapus paket tryout?"
        onClose={() => {
          if (!action.busy) setConfirming(false)
        }}
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirming(false)} disabled={action.busy}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => void remove()} disabled={action.busy}>
              {action.busy ? 'Menghapus…' : 'Hapus paket'}
            </Button>
          </>
        }
      >
        <p>Paket ini akan dihapus dari daftar tryout. Tindakan ini tidak dapat dibatalkan.</p>
        {sessions?.phase === 'done' && sessions.outcome.kind === 'ok' && sessions.outcome.data.length > 0 ? (
          <Notice tone="lavender" className="mt-3">
            Paket ini punya <span className="tabular-nums font-semibold">{sessions.outcome.data.length}</span> sesi
            {sessions.outcome.data.some((s) => s.status === 'scored') ? ', termasuk sesi yang sudah dinilai,' : ''} yang
            tetap tersimpan dan bisa dibuka di Riwayat.
          </Notice>
        ) : null}
        {sessions?.phase === 'done' && sessions.outcome.kind !== 'ok' ? (
          <Notice tone="warning" className="mt-3" title="Jumlah sesi tidak dapat dibaca">
            Sesinya tetap tersimpan dan bisa dibuka di Riwayat.{' '}
            <button type="button" className="font-semibold underline" onClick={readSessions} disabled={action.busy}>
              Coba lagi
            </button>
          </Notice>
        ) : null}
        {action.failure ? (
          <Notice tone="danger" className="mt-3">
            {actionMessage(action.failure)}
          </Notice>
        ) : null}
      </Dialog>
    </Panel>
  )

  return startable ? (
    <Link to={`/tryout/${pkg.id}`} className="block h-full rounded-[24px]">
      {body}
    </Link>
  ) : (
    <div aria-disabled="true" className="h-full">
      {body}
    </div>
  )
}
