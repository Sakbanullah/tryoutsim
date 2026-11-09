import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../data'
import type { Package, Test } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { Badge, Button, Notice, Panel } from '../../ui/ui'
import { BackLink } from '../../shell/Layout'
import { PageHeader } from '../../ui/page'
import { IconBook, IconClock, IconFlag, IconLayers, IconShield } from '../../ui/icons'
import { labelOf, nodeOf } from '../shared/taxonomy'
import {
  availabilityText,
  definitionTitle,
  difficultyMixText,
  repeatPolicyText,
  repeatStatement,
  startFailureText,
  testOf,
  unavailableReason,
} from '../shared/package'
import { useStartSession } from '../shared/startSession'

/**
 * Detail + petunjuk (`/tryout/:packageId`) — PAGE_SPECIFICATIONS §3.
 * Everything the learner needs before starting, including the limitations that actually apply, from
 * `GET /packages/:id`. Starting creates one session through `POST /packages/:id/sessions`; the server
 * binds the exam config, so no config appears here.
 */
export default function TryoutDetail() {
  const { packageId = '' } = useParams()
  const pkg = useApi<Package>(() => api.package(packageId), [packageId])
  return (
    <OutcomeView state={pkg.state} retry={pkg.retry}>
      {(p) => <DetailBody pkg={p} />}
    </OutcomeView>
  )
}

function DetailBody({ pkg }: { pkg: Package }) {
  const startSession = useStartSession()
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const { definition: d } = pkg
  const test = testOf(d)
  const competencies = d.competencyIds ?? []
  const repeat = repeatStatement(pkg)

  /** Creates the tryout session; a failure is stated beside the button, never silently swallowed. */
  async function start() {
    setBusy(true)
    setReason(null)
    const ok = await startSession(() => api.startSession({ packageId: pkg.id, mode: 'tryout' }), 'tryout')
    if (!ok) {
      setBusy(false)
      setReason(startFailureText())
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <div className="space-y-3">
        <BackLink to="/tryout">Semua tryout</BackLink>
        <PageHeader
          eyebrow="Tryout · paket soal"
          title={pkg.titleId}
          lead={definitionTitle(d)}
          actions={
            <>
              <Badge tone={pkg.availability.startable ? 'success' : 'warning'}>{availabilityText(pkg)}</Badge>
              <Badge tone="neutral">Versi paket {pkg.version}</Badge>
            </>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-4">
          {repeat ? (
            <Notice tone="warning" title="Sebagian soal akan diulang">
              {repeat}
            </Notice>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <FactTile icon={<IconBook size={18} />} label="Soal latihan" value={`${d.itemCount}`} unit="soal" />
            <FactTile icon={<IconClock size={18} />} label="Batas waktu" value="Tanpa" unit="hitung mundur" />
            <FactTile icon={<IconShield size={18} />} label="Stok soal baru" value={`${pkg.availability.eligibleStock}`} unit="soal" />
          </div>

          <Panel className="p-6">
            <h2 className="inline-flex items-center gap-2 text-xl">
              <IconLayers size={18} className="text-primary-ink" />
              Isi paket
            </h2>
            <dl className="mt-3 grid gap-3 text-base sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted">Jenis</dt>
                <dd className="font-medium">{definitionTitle(d)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Jumlah soal</dt>
                <dd className="font-medium tabular-nums">{d.itemCount} soal</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Komposisi kesulitan</dt>
                <dd className="font-medium tabular-nums">{difficultyMixText(d)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Kebijakan pengulangan</dt>
                <dd className="font-medium">{repeatPolicyText(d)}</dd>
              </div>
            </dl>
            {competencies.length > 0 ? (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-sm text-muted">Submateri</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {competencies.map((id) => (
                    <li key={id}>
                      <Badge tone="accent">
                        {nodeOf(id) ? `${nodeOf(id)!.test} · ` : ''}
                        {labelOf(id)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>

          <Panel className="p-6">
            <h2 className="text-xl">Petunjuk</h2>
            <ul className="mt-3 space-y-2.5 text-md leading-relaxed">
              <li>
                <strong>{d.itemCount} soal</strong> dalam sesi ini
                {test ? <> dari subtes {testName(test)}</> : <> yang mencakup ketiga subtes</>}. Susunan ini disusun
                untuk latihan, bukan klaim tentang susunan ujian resmi.
              </li>
              <li>Setiap soal memiliki lima pilihan. Pilih satu, lalu gunakan tombol sebelumnya/berikutnya untuk berpindah.</li>
              <li>Jawaban disimpan otomatis saat kamu berpindah soal. Kamu bisa mengirim sebelum menjawab semua soal.</li>
              <li>Hasil menampilkan poin per subtes. Penilaian memakai aturan yang dipilih server saat sesi dibuat.</li>
            </ul>
          </Panel>

          <Panel className="p-6">
            <h2 className="inline-flex items-center gap-2 text-lg">
              <IconFlag size={18} className="text-warning" />
              Batasan yang berlaku sekarang
            </h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed text-muted">
              <li>Tidak ada hitung mundur. Batas waktu resmi belum ditetapkan untuk aturan ini.</li>
              <li>Tanda "tandai soal" hanya tersimpan selama tab ini terbuka.</li>
              <li>Memuat ulang halaman bisa membuat jawaban terbaru tidak muncul kembali.</li>
            </ul>
          </Panel>
        </div>

        <aside className="lg:sticky lg:top-6">
          <Panel className="p-5">
            <h2 className="text-lg">Siap mulai?</h2>
            <p className="mt-1 text-base leading-relaxed text-muted">
              Sesi berisi {d.itemCount} soal latihan. Mulai membuat sesi baru; sesi sebelumnya tetap tersimpan.
            </p>
            <div className="mt-4 space-y-3">
              {reason ? <Notice tone="danger">{reason}</Notice> : null}
              <Button
                className="w-full"
                size="lg"
                onClick={start}
                disabled={!pkg.availability.startable || busy}
                reason={pkg.availability.startable ? undefined : unavailableReason(pkg)}
              >
                {busy ? 'Menyiapkan sesi…' : 'Mulai'}
              </Button>
              {!pkg.availability.startable && pkg.availability.eligibleStock === 0 ? (
                <Link
                  to="/lainnya/generasi"
                  className="inline-flex items-center gap-1 text-base font-semibold text-primary-ink underline-offset-4 hover:underline"
                >
                  Tambah soal dengan AI
                </Link>
              ) : null}
            </div>
            <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Paket</dt>
                <dd className="font-medium">{pkg.titleId}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Versi paket</dt>
                <dd className="font-medium tabular-nums">v{pkg.version}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Jumlah soal</dt>
                <dd className="font-medium tabular-nums">{d.itemCount} soal</dd>
              </div>
            </dl>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

/** A single number from the contract with its unit word, so nothing reads as a threshold. */
function FactTile({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit: string
}) {
  return (
    <Panel tone="flat" className="flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-primary-wash text-primary-ink">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="font-display text-lg font-bold leading-tight tabular-nums">
          {value} <span className="text-base font-medium text-muted">{unit}</span>
        </p>
      </div>
    </Panel>
  )
}

const testName = (t: Test) =>
  ({ TWK: 'Wawasan Kebangsaan (TWK)', TIU: 'Kemampuan Berpikir (TIU)', TKP: 'Situasi dan Perilaku Kerja (TKP)' })[t]
