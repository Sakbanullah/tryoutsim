import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../data'
import type { ExamConfig, Package, PackageDefinition } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { BackLink } from '../../shell/Layout'
import { useApi } from '../shared/useApi'
import { formatDate } from '../shared/format'
import { labelOf } from '../shared/taxonomy'
import { Badge, Button, EmptyState, Notice, Panel } from '../../ui/ui'
import { Block, PageHeader } from '../../ui/page'
import { IconChevronRight, IconLock, IconLayers } from '../../ui/icons'

/**
 * Manajemen Paket (`/lainnya/paket`, `/lainnya/paket/:id`) — PAGE_SPECIFICATIONS §17;
 * rules in PACKAGE_SPECIFICATION §5.
 * Built-in packages are product data: readable, never editable. A custom package is created from a
 * template; saving an edit creates a new version, and sessions bound to the old version keep it.
 * The optional config pin is management-side information only — the client never sends it.
 */

const KIND: Record<PackageDefinition['kind'], string> = {
  full_simulation: 'Simulasi penuh',
  subtest: 'Satu subtest',
  submateri: 'Drill submateri',
}

/** Availability in words; `repeatCount > 0` is stated before a session can start (contract §4). */
function availabilityBadge(p: Package) {
  return p.availability.startable ? (
    <Badge tone="success">Siap dimulai</Badge>
  ) : (
    <Badge tone="warning">Belum bisa dimulai</Badge>
  )
}

export function PackageList() {
  const list = useApi<Package[]>(() => api.packages(), [])
  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow="Kelola"
        title="Paket"
        lead="Susunan soal yang bisa dimulai sebagai tryout atau latihan. Paket bawaan hanya bisa dibaca; paket buatanmu bisa diubah menjadi versi baru."
      />
      <OutcomeView state={list.state} retry={list.retry} loadingLines={5}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title="Belum ada paket">Paket bawaan muncul di sini setelah kumpulan soal cukup.</EmptyState>
          ) : (
            <div className="space-y-6">
              {(['tryout', 'latihan'] as const).map((mode) => {
                const items = rows.filter((p) => p.mode === mode)
                if (items.length === 0) return null
                return (
                  <section key={mode} aria-labelledby={`mode-${mode}`}>
                    <h2 id={`mode-${mode}`} className="mb-3 text-xl">
                      {mode === 'tryout' ? 'Tryout' : 'Latihan'}
                    </h2>
                    <ul className="grid gap-3 md:grid-cols-2">
                      {items.map((p) => (
                        <li key={p.id}>
                          <Link
                            to={`/lainnya/paket/${p.id}`}
                            className="group flex h-full flex-col rounded-[16px] border border-border bg-surface p-5 shadow-panel transition-[box-shadow,border-color] duration-200 hover:border-border-strong hover:shadow-panel-hover"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="font-display text-lg">{p.titleId}</h3>
                              <IconChevronRight size={18} className="mt-1 shrink-0 text-muted group-hover:text-primary-ink" />
                            </div>
                            <p className="mt-1 text-sm text-muted">
                              {KIND[p.definition.kind]} · versi {p.version} · {p.definition.itemCount} soal
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {availabilityBadge(p)}
                              <Badge tone={p.source === 'builtin' ? 'neutral' : 'lavender'}>
                                {p.source === 'builtin' ? 'Bawaan' : 'Buatan sendiri'}
                              </Badge>
                              {p.retiredAt ? <Badge tone="neutral">Dipensiunkan</Badge> : null}
                            </div>
                            {!p.availability.startable && p.availability.unavailableReason ? (
                              <p className="mt-2 text-sm text-warning">{p.availability.unavailableReason}</p>
                            ) : null}
                            {p.availability.repeatCount > 0 ? (
                              <p className="mt-2 text-sm text-muted">{p.availability.repeatCount} soal akan berulang dari sesi sebelumnya.</p>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>
          )
        }
      </OutcomeView>
    </div>
  )
}

export function PackageDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const pkg = useApi<Package>(() => api.package(id), [id])
  const configs = useApi<ExamConfig[]>(() => api.examConfigs(), [])

  return (
    <div className="animate-rise mx-auto max-w-page space-y-5">
      <BackLink to="/lainnya/paket">Paket</BackLink>
      <OutcomeView state={pkg.state} retry={pkg.retry}>
        {(p) => {
          const pin = p.configId ? (configs.state.phase === 'done' && configs.state.outcome.kind === 'ok' ? configs.state.outcome.data.find((c) => c.id === p.configId) : undefined) : undefined
          const pinUsable = pin && pin.state !== 'provisional'
          return (
            <>
              <PageHeader
                eyebrow={p.mode === 'tryout' ? 'Tryout' : 'Latihan'}
                title={p.titleId}
                lead={`${KIND[p.definition.kind]} · versi ${p.version}`}
                actions={availabilityBadge(p)}
              />

              {p.availability.repeatCount > 0 ? (
                <Notice tone="warning">
                  {p.availability.repeatCount} soal dalam paket ini akan berulang: stok soal yang belum pernah dijawab belum cukup.
                </Notice>
              ) : null}

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
                <div className="space-y-5">
                  <Panel className="p-6">
                    <Block title="Susunan soal">
                      <DefinitionList definition={p.definition} />
                    </Block>
                    <div className="mt-5 border-t border-border pt-4">
                      <Block title="Ketersediaan">
                        <dl className="grid grid-cols-2 gap-3 text-md sm:grid-cols-3">
                          <Stat label="Stok layak" value={p.availability.eligibleStock} />
                          <Stat label="Dibutuhkan" value={p.availability.requiredStock} />
                          <Stat label="Berulang" value={p.availability.repeatCount} />
                        </dl>
                        {!p.availability.startable && p.availability.unavailableReason ? (
                          <p className="mt-3 text-sm text-warning">{p.availability.unavailableReason}</p>
                        ) : null}
                      </Block>
                    </div>
                  </Panel>
                  <Panel className="p-6">
                    <Block title="Riwayat versi">
                      <p className="text-base leading-relaxed text-muted">
                        Versi {p.version} adalah versi terkini. Menyimpan suntingan membuat versi baru; versi lama tetap
                        terbaca dan sesi yang sudah memakainya tetap terikat pada versi itu.
                      </p>
                    </Block>
                  </Panel>
                </div>

                <Panel tone="muted" className="p-6">
                  <Block title="Detail">
                    <dl className="space-y-2.5 text-md">
                      <Row label="Asal" value={p.source === 'builtin' ? 'Bawaan' : p.source === 'dynamic' ? 'Dibuat otomatis' : 'Buatan sendiri'} />
                      <Row label="Jenis" value={KIND[p.definition.kind]} />
                      <Row label="Versi" value={String(p.version)} />
                      <Row label="Status" value={p.retiredAt ? `Dipensiunkan ${formatDate(p.retiredAt)}` : 'Aktif'} />
                    </dl>
                    <div className="mt-4 border-t border-border pt-4">
                      <p className="text-sm font-semibold">Konfigurasi</p>
                      {pin ? (
                        <p className="mt-1 text-base">
                          Paket ini memakai konfigurasi {pin.examYear}. {pinUsable ? null : 'Belum terverifikasi.'}
                        </p>
                      ) : (
                        <p className="mt-1 text-base text-muted">Tidak dipatok; konfigurasi terpakai dipilih saat sesi dimulai.</p>
                      )}
                    </div>
                  </Block>
                  <div className="mt-5 space-y-2">
                    <Button className="w-full" onClick={() => navigate(p.mode === 'tryout' ? `/tryout/${p.id}` : '/latihan')}>
                      {p.mode === 'tryout' ? 'Lihat petunjuk tryout' : 'Mulai dari Latihan'}
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full"
                      disabled={p.source !== 'custom' || Boolean(p.retiredAt)}
                      reason={
                        p.source === 'builtin'
                          ? 'Paket bawaan adalah data produk dan tidak bisa diubah.'
                          : p.retiredAt
                            ? 'Paket sudah dipensiunkan.'
                            : undefined
                      }
                    >
                      <IconLayers size={17} />
                      Simpan sebagai versi baru
                    </Button>
                    <p className="flex items-start gap-2 text-sm text-muted">
                      <IconLock size={15} className="mt-0.5 shrink-0" />
                      Jadwal dan batas waktu sesi mengikuti konfigurasi yang dipakai, bukan paket.
                    </p>
                  </div>
                </Panel>
              </div>
            </>
          )
        }}
      </OutcomeView>
    </div>
  )
}

/** The template that built the package, in plain words from `PackageDefinition`. */
function DefinitionList({ definition }: { definition: PackageDefinition }) {
  return (
    <dl className="grid grid-cols-2 gap-3 text-md">
      <Row label="Jumlah soal" value={String(definition.itemCount)} />
      <Row label="Pengulangan" value={definition.repeatPolicy === 'allow_repeat' ? 'Boleh berulang' : 'Hindari soal yang sudah dijawab'} />
      {definition.test ? <Row label="Subtest" value={definition.test} /> : null}
      {definition.competencyIds?.length ? (
        <div className="col-span-2">
          <dt className="text-sm text-muted">Submateri</dt>
          <dd className="mt-0.5">{definition.competencyIds.map(labelOf).join(' · ')}</dd>
        </div>
      ) : null}
      {definition.difficultyMix ? (
        <div className="col-span-2">
          <dt className="text-sm text-muted">Campuran tingkat kesulitan</dt>
          <dd className="mt-0.5 tabular-nums">
            {definition.difficultyMix.easy} mudah · {definition.difficultyMix.medium} sedang · {definition.difficultyMix.hard} sulit
          </dd>
        </div>
      ) : null}
    </dl>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="tabular-nums text-lg font-semibold">{value}</dd>
    </div>
  )
}
