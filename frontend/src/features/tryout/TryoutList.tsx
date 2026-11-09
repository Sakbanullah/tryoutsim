import { Link } from 'react-router-dom'
import { api } from '../../data'
import type { Package } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { ArrowLink, Badge, Button, EmptyState, Notice, Panel, buttonClass } from '../../ui/ui'
import { PageHeader } from '../../ui/page'
import { IconArrowUpRight, IconInfo, IconShield } from '../../ui/icons'
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
                    <PackageCard pkg={p} />
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

/** One package card: title, version, subtest, item count, availability and the repeat statement. */
function PackageCard({ pkg }: { pkg: Package }) {
  const startable = pkg.availability.startable
  const { definition } = pkg
  const repeat = repeatStatement(pkg)
  const body = (
    <Panel
      className={
        startable
          ? 'group flex h-full flex-col p-5 transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-panel-hover'
          : 'flex h-full flex-col bg-surface-muted/70 p-5'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-display text-xl">{pkg.titleId}</h2>
        <Badge tone={startable ? 'success' : 'warning'}>{availabilityText(pkg)}</Badge>
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
