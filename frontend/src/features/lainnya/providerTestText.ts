/**
 * The sentence a provider connection test shows (PROVIDER_INTEGRATION §5: a failed test surfaces the scrubbed reason,
 * AI_PROVIDER_ARCHITECTURE §7 lists the conditions). Pure, so the mapping is checked without a browser; the reason
 * itself is never rendered raw — it is a backend sentence and may change wording.
 */
import type { ProviderTestResult } from '../../types/contracts'

export type ProviderTestText = { ok: boolean; text: string }

/** One sentence per registry code; an unknown code keeps the honest generic one. */
const FAILURE_TEXT: Record<string, string> = {
  PROVIDER_AUTH_FAILED: 'Kunci API ditolak penyedia. Periksa kuncinya, lalu uji lagi.',
  PROVIDER_TIMEOUT: 'Penyedia tidak menjawab dalam batas waktu. Coba lagi.',
  RATE_LIMITED: 'Penyedia membatasi jumlah permintaan. Tunggu sebentar, lalu coba lagi.',
  PROVIDER_UNAVAILABLE: 'Penyedia tidak dapat dihubungi atau menjawab dengan galat. Periksa alamat endpoint, lalu coba lagi.',
}

const GENERIC_FAILURE = 'Percobaan koneksi tidak berhasil. Periksa pengaturan penyedia, lalu coba lagi.'

/**
 * The test result as the card renders it. A failed test never reads as a success, and a code the client does not know
 * falls back to the generic sentence rather than a raw backend message.
 * @param result the route's 200 payload
 */
export function providerTestText(result: ProviderTestResult): ProviderTestText {
  if (result.ok) return { ok: true, text: `Terhubung (${result.latencyMs} ms). Kemampuan model diperiksa.` }
  return { ok: false, text: (result.code !== undefined && FAILURE_TEXT[result.code]) || GENERIC_FAILURE }
}
