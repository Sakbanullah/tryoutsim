import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../data'
import type { Lifecycle, Provenance, Question } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { actionMessage, useAction } from '../shared/useAction'
import { Badge, Button, Dialog, EmptyState, Field, Notice, Panel, buttonClass, controlClass } from '../../ui/ui'
import { LifecycleBadge, ProvenanceBadge } from '../shared/badges'
import { labelOf } from '../shared/taxonomy'
import { testName } from '../shared/format'
import { BackLink } from '../../shell/Layout'
import { PageHeader } from '../../ui/page'
import { IconSearch, IconSparkle } from '../../ui/icons'

/**
 * Kumpulan soal (`/lainnya/soal`) — PAGE_SPECIFICATIONS §11.
 * Filters live in the URL so a link can carry them (e.g. the generation job links to its drafts) and
 * the back button restores them. Competency is offered by label, never by id. The mock does the
 * filtering; the screen only displays what came back.
 *
 * Bulk is archive-only (`active → archived`, one `POST /questions/bulk`); there is no bulk edit and no
 * import. A single report is filed from the row.
 *
 * Desktop: a sticky filter rail on the left and the result table filling the rest of the width.
 */
const LIFECYCLES: Array<{ value: Lifecycle; label: string }> = [
  { value: 'draft', label: 'Draf' },
  { value: 'ai_validated', label: 'Lolos cek otomatis' },
  { value: 'human_reviewed', label: 'Sudah ditinjau' },
  { value: 'active', label: 'Aktif' },
  { value: 'quarantined', label: 'Karantina' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'archived', label: 'Arsip' },
]

const FILTER_KEYS = ['q', 'test', 'lifecycle', 'provenance', 'difficulty'] as const

export default function QuestionList() {
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const bulk = useAction()
  const [archived, setArchived] = useState<Question[]>([])

  const get = (key: (typeof FILTER_KEYS)[number]) => params.get(key) ?? ''
  const set = (key: (typeof FILTER_KEYS)[number], value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  const q = get('q')
  const test = get('test')
  const lifecycle = get('lifecycle')
  const provenance = get('provenance')
  const difficulty = get('difficulty')
  const filtered = FILTER_KEYS.some((k) => get(k) !== '')

  const list = useApi<Question[]>(
    () =>
      api.questions({
        text: q || undefined,
        test: (test || undefined) as Question['test'] | undefined,
        lifecycle: (lifecycle || undefined) as Lifecycle | undefined,
        provenance: (provenance || undefined) as Provenance['kind'] | undefined,
        difficulty: (difficulty || undefined) as Question['difficulty'] | undefined,
      }),
    [q, test, lifecycle, provenance, difficulty],
  )

  const reset = () => {
    setParams(new URLSearchParams(), { replace: true })
    setSelected(new Set())
  }

  /** Selected ids that are still visible and active; a re-filter must never archive a hidden row. */
  function selectionFor(rows: Question[]) {
    return rows.filter((r) => selected.has(r.id) && r.lifecycle === 'active').map((r) => r.id)
  }

  return (
    <div className="animate-rise space-y-5">
      <BackLink to="/lainnya">Lainnya</BackLink>
      <PageHeader
        eyebrow="Kelola"
        title="Kumpulan soal"
        lead="Hanya soal aktif yang dipakai dalam sesi. Soal lain tetap tersimpan dan bisa ditinjau di sini."
        actions={
          <Link to="/lainnya/generasi" className={buttonClass('secondary')}>
            <IconSparkle size={17} />
            Buat soal dengan AI
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-6">
          <Panel className="p-4">
            <h2 className="inline-flex items-center gap-1.5 text-md font-semibold">
              <IconSearch size={16} className="text-muted" />
              Saring
            </h2>
            <div className="mt-3 space-y-2.5">
              <Field label="Cari teks soal">
                {({ id }) => (
                  <input
                    id={id}
                    type="search"
                    value={q}
                    onChange={(e) => set('q', e.target.value)}
                    placeholder="Kata atau frasa"
                    className={controlClass()}
                  />
                )}
              </Field>
              <Filter label="Bidang" value={test} onChange={(v) => set('test', v)}>
                <option value="">Semua</option>
                <option value="TWK">Wawasan Kebangsaan</option>
                <option value="TIU">Kemampuan Berpikir</option>
                <option value="TKP">Situasi dan Perilaku Kerja</option>
              </Filter>
              <Filter label="Status" value={lifecycle} onChange={(v) => set('lifecycle', v)}>
                <option value="">Semua</option>
                {LIFECYCLES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Filter>
              <Filter label="Asal soal" value={provenance} onChange={(v) => set('provenance', v)}>
                <option value="">Semua</option>
                <option value="ai_generated">AI</option>
                <option value="ai_generated_human_reviewed">AI, sudah ditinjau</option>
                <option value="human_authored">Tulisan sendiri</option>
                <option value="official_historical">Arsip resmi</option>
              </Filter>
              <Filter
                label="Tingkat kesulitan"
                value={difficulty}
                onChange={(v) => set('difficulty', v)}
              >
                <option value="">Semua</option>
                <option value="easy">Mudah</option>
                <option value="medium">Sedang</option>
                <option value="hard">Sulit</option>
              </Filter>
            </div>
            {filtered ? (
              <button
                type="button"
                onClick={reset}
                className="mt-3 text-sm font-semibold text-primary-ink underline-offset-4 hover:underline"
              >
                Hapus semua saringan
              </button>
            ) : null}
          </Panel>
        </aside>

        <div className="min-w-0 space-y-3">
          <OutcomeView state={list.state} retry={list.retry} loadingLines={5}>
            {(loaded) => {
              // Rows the bulk call just archived are shown as returned, without a re-fetch.
              const rows = loaded.map((r) => archived.find((a) => a.id === r.id) ?? r)
              const ids = selectionFor(rows)
              return rows.length === 0 ? (
                <EmptyState
                  title="Tidak ada soal yang cocok"
                  action={
                    filtered ? (
                      <button type="button" onClick={reset} className={buttonClass('secondary')}>
                        Hapus saringan
                      </button>
                    ) : (
                      <Link to="/lainnya/generasi" className={buttonClass('primary')}>
                        Buat soal dengan AI
                      </Link>
                    )
                  }
                >
                  {filtered ? 'Ubah filter untuk melihat soal lain.' : 'Kumpulan soal masih kosong.'}
                </EmptyState>
              ) : (
                <Panel className="overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                    <p className="text-md font-medium">{rows.length} soal</p>
                    {filtered ? <Badge tone="accent">Disaring</Badge> : <Badge tone="neutral">Semua soal</Badge>}
                  </div>

                  {ids.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-primary-wash px-4 py-2.5">
                      <p className="text-md font-medium" role="status">
                        {ids.length} soal aktif dipilih
                      </p>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="quiet" onClick={() => setSelected(new Set())}>
                          Batal pilih
                        </Button>
                        <ArchiveSelected
                          ids={ids}
                          busy={bulk.busy}
                          onDone={(done) => {
                            setSelected(new Set())
                            setArchived((prev) => [...prev, ...done])
                          }}
                          action={bulk}
                        />
                      </div>
                    </div>
                  ) : null}

                  <ul className="divide-y divide-border">
                    {rows.map((row) => (
                      <Row
                        key={row.id}
                        q={row}
                        checked={selected.has(row.id)}
                        onToggle={() =>
                          setSelected((prev) => {
                            const next = new Set(prev)
                            if (next.has(row.id)) next.delete(row.id)
                            else next.add(row.id)
                            return next
                          })
                        }
                      />
                    ))}
                  </ul>
                  <p className="border-t border-border px-4 py-2.5 text-sm text-muted">
                    Bidang: {(['TWK', 'TIU', 'TKP'] as const).map((t) => testName(t)).join(' · ')}. Arsip massal hanya
                    untuk soal aktif; tidak ada sunting massal.
                  </p>
                  {bulk.failure ? (
                    <div className="border-t border-border p-3">
                      <Notice tone="danger">{actionMessage(bulk.failure)}</Notice>
                    </div>
                  ) : null}
                </Panel>
              )
            }}
          </OutcomeView>
        </div>
      </div>
    </div>
  )
}

/* ── Bulk archive ────────────────────────────────────────────────────────────────────── */

/** One confirmation, then one `POST /questions/bulk`; the result replaces the rows in place. */
function ArchiveSelected({
  ids,
  busy,
  onDone,
  action,
}: {
  ids: string[]
  busy: boolean
  onDone: (archived: Question[]) => void
  action: ReturnType<typeof useAction>
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Arsipkan terpilih
      </Button>
      <Dialog
        open={open}
        title={`Arsipkan ${ids.length} soal?`}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                const done = await action.run(() => api.bulkArchive(ids))
                if (done) {
                  setOpen(false)
                  onDone(done)
                }
              }}
            >
              {busy ? 'Mengarsipkan…' : 'Arsipkan'}
            </Button>
          </>
        }
      >
        <p className="text-base text-muted">
          Soal aktif yang dipilih akan dipindah ke arsip dan tidak lagi dipakai dalam sesi. Sesi yang sudah selesai
          tidak berubah.
        </p>
      </Dialog>
    </>
  )
}

/* ── Row ─────────────────────────────────────────────────────────────────────────────── */

/** A question row: selectable when active, readable otherwise; the report action is on the row. */
function Row({
  q,
  checked,
  onToggle,
}: {
  q: Question
  checked: boolean
  onToggle: () => void
}) {
  const [reportOpen, setReportOpen] = useState(false)
  const report = useAction()
  const [severity, setSeverity] = useState<'minor' | 'major' | 'critical'>('major')
  const [category, setCategory] = useState('isi')
  const [note, setNote] = useState('')
  const selectable = q.lifecycle === 'active'

  return (
    <li className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted">
      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center">
        {selectable ? (
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            aria-label={`Pilih soal ${q.test}: ${q.stem.slice(0, 60)}`}
          />
        ) : (
          <span aria-hidden className="h-px w-3 bg-border-strong" />
        )}
      </span>
      <Link to={`/lainnya/soal/${q.id}`} className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-md leading-relaxed">{q.stem}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{q.test}</Badge>
          <Badge tone="neutral">{labelOf(q.competencyId)}</Badge>
          <Badge tone="neutral">{{ easy: 'Mudah', medium: 'Sedang', hard: 'Sulit' }[q.difficulty]}</Badge>
          <LifecycleBadge lifecycle={q.lifecycle} />
          <span className="sm:hidden">
            <ProvenanceBadge provenance={q.provenance} />
          </span>
        </span>
      </Link>
      <span className="hidden shrink-0 sm:block">
        <ProvenanceBadge provenance={q.provenance} />
      </span>
      {q.lifecycle === 'active' ? (
        <Button size="sm" variant="quiet" onClick={() => setReportOpen(true)}>
          Laporkan
        </Button>
      ) : null}

      <Dialog
        open={reportOpen}
        title="Laporkan soal"
        onClose={() => setReportOpen(false)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setReportOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={report.busy || note.trim() === ''}
              reason={note.trim() === '' ? 'Isi catatan dulu.' : undefined}
              onClick={async () => {
                const done = await report.run(() =>
                  api.reportQuestion(q.id, { severity, category, note: note.trim() }),
                )
                if (done !== null) {
                  setReportOpen(false)
                  setNote('')
                  report.clear()
                }
              }}
            >
              {report.busy ? 'Mengirim…' : 'Kirim laporan'}
            </Button>
          </>
        }
      >
        <p className="text-base text-muted">
          Laporan kritis langsung mengarantina soal dari sesi; tingkat lain tetap aktif sampai ditinjau.
        </p>
        <div className="mt-3 space-y-3">
          <Field label="Tingkat">
            {({ id }) => (
              <select
                id={id}
                value={severity}
                onChange={(e) => setSeverity(e.target.value as typeof severity)}
                className={controlClass()}
              >
                <option value="minor">Ringan</option>
                <option value="major">Berat</option>
                <option value="critical">Kritis</option>
              </select>
            )}
          </Field>
          <Field label="Kategori">
            {({ id }) => (
              <select
                id={id}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={controlClass()}
              >
                <option value="isi">Isi soal</option>
                <option value="kunci">Kunci jawaban</option>
                <option value="bahasa">Bahasa</option>
                <option value="lainnya">Lainnya</option>
              </select>
            )}
          </Field>
          <Field label="Catatan (wajib)">
            {({ id }) => (
              <textarea
                id={id}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={controlClass()}
              />
            )}
          </Field>
          {report.failure ? <Notice tone="danger">{actionMessage(report.failure)}</Notice> : null}
        </div>
      </Dialog>
    </li>
  )
}

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block min-h-10 w-full rounded-[10px] border border-border-strong bg-surface px-2.5 text-md text-ink hover:border-muted focus:border-primary focus:shadow-control-focus focus:outline-none"
      >
        {children}
      </select>
    </label>
  )
}
