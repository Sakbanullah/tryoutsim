import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../data'
import type { BootstrapResponse } from '../types/contracts'
import { useApi } from '../features/shared/useApi'
import { useFlash } from '../state/shell'
import { buttonClass } from '../ui/ui'
import { setErrorToggle, type ErrorToggle } from '../mock/mockClient'

/**
 * Developer controls — hidden from the normal product surface.
 *
 * The mock layer can rehearse the failure screens (FRONTEND_MOCK_DATA_STRATEGY §3). Reach them with
 * `Shift + D`; the "v" corner badge is the pointer for that. Nothing here is shown unless asked for,
 * and none of it changes what a learner sees.
 */
export function DevPanel() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === 'd') {
        const target = e.target as HTMLElement
        if (target.closest('input, textarea, select')) return
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Kontrol pengembang"
        title="Kontrol pengembang (Shift + D)"
        className="fixed right-3 top-3 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface/80 text-2xs font-bold text-muted opacity-40 transition-opacity hover:opacity-100"
      >
        v
      </button>
      {open ? <DevDialog onClose={() => setOpen(false)} /> : null}
    </>
  )
}

const TOGGLES: Array<{ value: ErrorToggle; label: string }> = [
  { value: 'none', label: 'Normal' },
  // Verdict-only: the session scores and the result withholds its verdict (API_SPECIFICATION §4) — it is not an error.
  { value: 'approval_missing', label: 'Hasil dengan verdict ditahan (tanpa persetujuan)' },
  { value: 'preflight', label: 'Submit ditolak preflight' },
  { value: 'contract', label: 'Versi kontrak tidak cocok' },
]

function DevDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState<ErrorToggle>('none')
  const [mode, setMode] = useState<'error' | 'load'>('error')
  const [lines, setLines] = useState(4)
  const boot = useApi<BootstrapResponse>(() => api.bootstrap(), [])
  const flash = useFlash()

  function pick(value: ErrorToggle) {
    setErrorToggle('submit', value)
    setCurrent(value)
  }

  const providers =
    boot.state.phase === 'done' && boot.state.outcome.kind === 'ok' ? boot.state.outcome.data.providers : []
  const selected = TOGGLES.find((t) => t.value === current)?.label

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kontrol pengembang"
      className="animate-fade fixed inset-0 z-50 flex items-start justify-center bg-[#16233f]/40 p-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-rise w-full max-w-[560px] rounded-[24px] border border-border bg-bg p-6 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Developer</p>
            <h2 className="mt-1 text-xl">Mode data &amp; state</h2>
          </div>
          <button type="button" className={buttonClass('secondary', 'sm')} onClick={onClose}>
            Tutup
          </button>
        </div>

        <p className="mt-3 text-base leading-relaxed text-muted">
          Semua data halaman ini berasal dari lapisan mock lokal, bukan dari API. Kontrol di bawah hanya
          untuk memeriksa layar kegagalan dan pemuatan.
        </p>

        <div className="mt-4 flex gap-2">
          {(['error', 'load'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={buttonClass(mode === m ? 'primary' : 'secondary', 'sm')}
            >
              {m === 'error' ? 'State kegagalan' : 'State pemuatan'}
            </button>
          ))}
        </div>

        {mode === 'error' ? (
          <div className="mt-3 space-y-1">
            {TOGGLES.map((t) => (
              <label
                key={t.value}
                className="flex min-h-10 cursor-pointer items-center gap-3 rounded-[10px] px-2 text-base hover:bg-surface-muted"
              >
                <input
                  type="radio"
                  name="dev-toggle"
                  checked={current === t.value}
                  onChange={() => pick(t.value)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                <span>{t.label}</span>
              </label>
            ))}
            <p className="px-2 pt-1 text-sm text-muted">Dipakai saat kirim jawaban berikutnya: {selected}.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <label className="block text-base font-medium">
              Jumlah baris skeleton
              <input
                type="number"
                min={1}
                max={12}
                value={lines}
                onChange={(e) => setLines(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
                className="mt-1 block min-h-10 w-full rounded-[10px] border border-border-strong bg-surface px-3 text-md tabular-nums focus:border-primary focus:shadow-control-focus focus:outline-none"
              />
            </label>
            <Link to="/progres" onClick={onClose} className={buttonClass('secondary', 'sm')}>
              Lihat state pemuatan di Progres
            </Link>
          </div>
        )}

        <div className="mt-4 rounded-[12px] bg-surface-muted p-3 text-sm text-muted">
          <p>Penyedia terdaftar: {providers.length}</p>
          <p>Penyedia: {providers.map((p) => `${p.name} (${p.keyLast4 ?? 'tanpa akhiran'})`).join(', ') || '—'}</p>
          <button
            type="button"
            className="mt-2 font-semibold text-primary-ink underline-offset-4 hover:underline"
            onClick={() => flash({ kind: 'info', text: 'Pesan contoh: sesi tersimpan.' })}
          >
            Tampilkan contoh pesan
          </button>
        </div>
      </div>
    </div>
  )
}
