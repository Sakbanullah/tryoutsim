import type { ReactNode } from 'react'
import type { Load } from '../features/shared/useApi'
import { ErrorState, Skeleton } from '../ui/ui'
import { Panel } from '../ui/ui'

/**
 * Renders the four screen states once (FRONTEND_STATE_MANAGEMENT §6). Each failure the registry can
 * produce gets one plain Indonesian sentence — codes are never shown (DESIGN_SYSTEM §10).
 */
export function OutcomeView<T>({
  state,
  retry,
  children,
  loadingLines = 4,
}: {
  state: Load<T>
  retry?: () => void
  children: (data: T) => ReactNode
  loadingLines?: number
}) {
  if (state.phase === 'loading') {
    return (
      <Panel className="p-6">
        <Skeleton lines={loadingLines} />
      </Panel>
    )
  }
  const o = state.outcome
  switch (o.kind) {
    case 'ok':
      return <>{children(o.data)}</>
    case 'notFound':
      return <ErrorState message="Halaman ini tidak ditemukan. Mungkin datanya sudah dihapus." retry={retry} />
    case 'unavailable':
      return <ErrorState message="Gagal memuat. Periksa apakah aplikasi berjalan, lalu coba lagi." retry={retry} />
    case 'notImplemented':
      // The backend does not serve this route yet: no retry is offered because none could succeed.
      return <ErrorState message="Fitur ini belum tersedia di versi backend saat ini." />
    case 'contract':
      return (
        <ErrorState
          message="Versi aplikasi tidak cocok dengan data. Muat ulang halaman untuk melanjutkan."
          retry={() => window.location.reload()}
        />
      )
    case 'validation':
      return (
        <div className="space-y-2">
          <ErrorState message="Ada isian yang belum sesuai." retry={retry} />
          <ul className="list-disc space-y-1 pl-5 text-base text-muted">
            {o.fields.map((f, i) => (
              <li key={`${f.path}-${i}`}>{f.message}</li>
            ))}
          </ul>
        </div>
      )
    case 'provider':
      return <ErrorState message={providerMessage(o.code)} retry={retry} />
    case 'conflict':
      return <ErrorState message={conflictMessage(o.reason)} retry={retry} />
    case 'blocked':
      return <ErrorState message="Sesi ini tersimpan, tetapi belum dinilai." retry={retry} />
    case 'preflight':
      return (
        <div className="space-y-2">
          <ErrorState message="Belum ada yang dinilai karena ada yang tidak sesuai pada jawabanmu." retry={retry} />
          <ul className="list-disc space-y-1 pl-5 text-base text-muted">
            {o.errors.map((e, i) => (
              <li key={`${e.code}-${i}`}>{e.message}</li>
            ))}
          </ul>
        </div>
      )
  }
}

function providerMessage(code: string): string {
  switch (code) {
    case 'PROVIDER_AUTH_FAILED':
      return 'Kunci koneksi AI ditolak. Periksa pengaturan AI.'
    case 'PROVIDER_UNAVAILABLE':
      return 'Layanan AI tidak dapat dihubungi. Coba lagi nanti.'
    case 'PROVIDER_TIMEOUT':
      return 'Layanan AI terlalu lama menjawab. Coba lagi.'
    case 'RATE_LIMITED':
      return 'Terlalu banyak permintaan ke layanan AI. Tunggu sebentar lalu coba lagi.'
    default:
      return 'Permintaan ke layanan AI gagal. Coba lagi.'
  }
}

function conflictMessage(reason: string): string {
  switch (reason) {
    case 'already_submitted':
      return 'Sesi ini sudah dikirim. Hasilnya bisa dilihat di halaman hasil.'
    case 'not_open':
      return 'Sesi ini sudah tidak terbuka; jawaban tidak bisa diubah lagi.'
    case 'task_unmapped':
      return 'Belum ada model untuk membuat soal. Aturlah di Pengaturan AI.'
    case 'pathway_not_offered':
      return 'Tryout ini dari jalur lain dan tidak tersedia di aplikasi ini.'
    case 'illegal_transition':
      return 'Langkah ini tidak diizinkan dari kondisi soal saat ini.'
    default:
      return 'Permintaan ini tidak bisa dilakukan sekarang. Coba lagi.'
  }
}
