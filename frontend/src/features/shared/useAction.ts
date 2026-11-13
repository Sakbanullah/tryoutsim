import { useCallback, useState } from 'react'
import { toOutcome, type Result } from '../../data'
import type { FieldError, Outcome } from '../../types/contracts'

/**
 * Runs one mutation route from a screen and keeps the three things a mutation screen needs:
 * whether it is in flight, the typed failure (mapped once, through `toOutcome`), and field-level
 * messages for forms. Cleared when a new run starts, so a stale error never outlives its attempt.
 */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Outcome<never> | null>(null)

  const run = useCallback(async <T,>(fn: () => Promise<Result<T>>): Promise<T | null> => {
    setBusy(true)
    setFailure(null)
    const result = await fn()
    setBusy(false)
    if (result.ok) return result.data
    // `toOutcome` never needs the success type; the failure members carry no `T`.
    setFailure(toOutcome<never>(result.failure) as Outcome<never>)
    return null
  }, [])

  const clear = useCallback(() => setFailure(null), [])

  /** Validation messages keyed by field path; empty for every non-validation failure. */
  const fieldErrors: Record<string, string> = {}
  if (failure?.kind === 'validation') {
    for (const f of failure.fields as FieldError[]) fieldErrors[f.path] ??= f.message
  }

  return { busy, failure, fieldErrors, run, clear }
}

/** The one sentence a failed mutation shows in a Notice; codes are never rendered. */
export function actionMessage(outcome: Outcome<never> | null): string | null {
  if (!outcome) return null
  switch (outcome.kind) {
    case 'validation':
      return 'Ada isian yang belum sesuai. Periksa kolom yang ditandai.'
    case 'notFound':
      return 'Data ini sudah tidak ada. Muat ulang halaman.'
    case 'conflict':
      return conflictText(outcome.reason)
    case 'blocked':
      return 'Tindakan ini memerlukan persetujuan konfigurasi yang masih berlaku.'
    case 'preflight':
      return 'Tindakan ini ditolak karena ada yang tidak sesuai pada data sesi.'
    case 'contract':
      return 'Versi aplikasi tidak cocok dengan data. Muat ulang halaman.'
    case 'provider':
      return 'Layanan AI tidak dapat menyelesaikan permintaan. Coba lagi.'
    case 'unavailable':
      return 'Gagal menghubungi aplikasi. Coba lagi.'
    default:
      return null
  }
}

/** Plain Indonesian for the conflict reasons the routes document; an unknown reason stays generic. */
function conflictText(reason: string): string {
  switch (reason) {
    case 'illegal_transition':
      return 'Langkah ini tidak diizinkan dari kondisi saat ini.'
    case 'not_provisional':
      return 'Hanya konfigurasi sementara yang memerlukan persetujuan.'
    case 'not_open':
    case 'session_not_open':
      return 'Sesi sudah tidak terbuka.'
    case 'not_scored':
      return 'Sesi ini belum dinilai, jadi belum ada hasil.'
    case 'not_submitted':
      return 'Sesi ini belum dikirim, jadi belum ada hasil.'
    case 'not_startable':
      return 'Paket ini belum bisa dimulai.'
    case 'package_retired':
      return 'Paket ini sudah dipensiunkan.'
    case 'global_model_unset':
      return 'Belum ada model AI global. Pilih satu model default di Pengaturan AI.'
    case 'provider_missing':
      return 'Penyedia model AI global sudah tidak ada. Pilih model lagi di Pengaturan AI.'
    case 'task_unmapped':
      // No route emits this any more; kept so a stale server is still explained rather than generic.
      return 'Belum ada model AI global. Pilih satu model default di Pengaturan AI.'
    case 'provider_untested':
      return 'Uji koneksi penyedia dulu di Pengaturan AI.'
    case 'last_provider':
      return 'Penyedia terakhir tidak bisa dihapus: minimal satu penyedia harus ada.'
    case 'backup_running':
      return 'Backup lain sedang berjalan. Tunggu hingga selesai.'
    case 'incompatible_archive':
      return 'Arsip ini tidak kompatibel dengan versi aplikasi saat ini.'
    default:
      return 'Permintaan ini tidak bisa dilakukan sekarang.'
  }
}
