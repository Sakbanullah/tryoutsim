import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../data'
import type { SessionDetail, SessionQuestion } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { useShell } from '../../state/shell'
import { Badge, Button, Notice, Panel, cx } from '../../ui/ui'
import { ProvenanceBadge } from '../shared/badges'
import { difficultyLabel, testName } from '../shared/format'
import { IconCheck, IconChevronLeft, IconChevronRight, IconFlag } from '../../ui/icons'

/**
 * Ujian berlangsung (`/tryout/sesi/:id`, `/latihan/sesi/:id`) — FRONTEND_EXAM_FLOW.
 *
 * Rules the code enforces:
 * - The clock is server state (FRONTEND_EXAM_FLOW §6): remaining = `durationMs − activeMs` when a duration is set,
 *   otherwise elapsed active time with "tanpa batas waktu". The client never decides expiry from its own wall clock.
 * - No right/wrong, no key, no weight shown — before or after answering. TKP is never worded as a verdict.
 * - The flag is tab-only and the screen says so (GAP-F4).
 * - Every selection is autosaved; submit is refused while the last save failed.
 *
 * Layout: a single wide question column so the stem keeps a readable measure, a status strip on top,
 * and a sticky answer-map rail on the right at `lg` and above.
 */

export default function Runner({ mode }: { mode: 'tryout' | 'practice' }) {
  const { sessionId = '' } = useParams()
  const session = useApi<SessionDetail>(() => api.session(sessionId), [sessionId])
  const { enterSession } = useShell()

  useEffect(() => {
    enterSession(sessionId)
  }, [sessionId, enterSession])

  return (
    <OutcomeView state={session.state} retry={session.retry} loadingLines={6}>
      {(detail) =>
        detail.status !== 'open' ? (
          <Notice tone="info" title="Sesi ini sudah ditutup">
            Jawaban tidak bisa diubah lagi.{' '}
            <Link className="font-semibold underline" to={resultPath(mode, sessionId)}>
              Lihat hasil
            </Link>
          </Notice>
        ) : (
          <RunnerBody detail={detail} mode={mode} />
        )
      }
    </OutcomeView>
  )
}

/**
 * The clock, rendered from the server's state only (FRONTEND_EXAM_FLOW §6). Between polls the display advances
 * locally by the time elapsed since the payload arrived, so a minute does not freeze; the server stays the owner
 * of `activeMs` and of expiry, and any reload corrects the display.
 * @param {{detail: SessionDetail}} props
 */
function SessionClock({ detail }: { detail: SessionDetail }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const running = detail.runningSince !== null
  const sincePayload = running ? Math.max(0, now - Date.parse(detail.runningSince as string)) : 0
  const activeMs = detail.activeMs + sincePayload
  const pausedNote = running ? '' : ' · dijeda'

  if (detail.durationMs === null) {
    return <>Waktu aktif {clockText(activeMs)} · tanpa batas waktu{pausedNote}</>
  }
  const remaining = Math.max(0, detail.durationMs - activeMs)
  return <>Sisa waktu {clockText(remaining)}{pausedNote}</>
}

/** `mm:ss` for a duration under an hour, `h:mm:ss` otherwise. */
function clockText(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export const resultPath = (mode: 'tryout' | 'practice', sessionId: string) =>
  mode === 'tryout' ? `/tryout/sesi/${sessionId}/hasil` : `/latihan/sesi/${sessionId}/hasil`

export const confirmPath = (sessionId: string) => `/tryout/sesi/${sessionId}/konfirmasi`

/** Answers keyed by question id, kept in sessionStorage so a reload or the confirm screen keeps them. */
export const SHEET_KEY = (sessionId: string) => `tryoutsim:sheet:${sessionId}`

export function readSheet(sessionId: string): Record<string, string> {
  try {
    const raw = window.sessionStorage.getItem(SHEET_KEY(sessionId))
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (!parsed || typeof parsed !== 'object') return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (e): e is [string, string] => typeof e[1] === 'string',
      ),
    )
  } catch {
    return {}
  }
}

function writeSheet(sessionId: string, answers: Record<string, string>): void {
  try {
    window.sessionStorage.setItem(SHEET_KEY(sessionId), JSON.stringify(answers))
  } catch {
    // No sheet: the answers still reach the mock, only the reload copy is lost.
  }
}

function RunnerBody({ detail, mode }: { detail: SessionDetail; mode: 'tryout' | 'practice' }) {
  const navigate = useNavigate()
  const { reportAutosave, setFlash } = useShell()
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | null>>(() => readSheet(detail.sessionId))
  const [flags, setFlags] = useState<Set<string>>(new Set())
  const [unsaved, setUnsaved] = useState<Set<string>>(new Set())
  const [leaving, setLeaving] = useState(false)

  const questions = detail.questions
  const current = questions[index]
  const answeredCount = questions.filter((q) => answers[q.questionId]).length

  // A failed save keeps its id here so submit can refuse; the shell's retry re-sends those saves.
  const failed = useRef(new Map<string, string | null>())
  /** Latest `save`, for the retry and flush paths that are created once. */
  const saveRef = useRef<(questionId: string, selected: string | null) => Promise<void>>(async () => {})

  /** Re-sends every failed save. False while any of them still fails — submit then refuses. */
  const flush = useCallback(async () => {
    if (failed.current.size === 0) return true
    await Promise.all([...failed.current].map(([qid, sel]) => saveRef.current(qid, sel)))
    return failed.current.size === 0
  }, [])

  /** Autosave one answer; the bar reflects the newest state (FRONTEND_STATE_MANAGEMENT §4). */
  const save = useCallback(
    async (questionId: string, selected: string | null) => {
      reportAutosave('saving')
      const res = await api.saveAnswers(detail.sessionId, {
        answers: [{ questionId, selectedOption: selected }],
      })
      if (res.ok) {
        failed.current.delete(questionId)
        setUnsaved((prev) => {
          const next = new Set(prev)
          next.delete(questionId)
          return next
        })
        reportAutosave('saved')
      } else {
        failed.current.set(questionId, selected)
        setUnsaved((prev) => new Set(prev).add(questionId))
        reportAutosave('failed', () => void flush())
      }
    },
    [detail.sessionId, reportAutosave, flush],
  )
  saveRef.current = save

  function choose(optionKey: string) {
    if (!current) return
    setAnswers((prev) => {
      const next = { ...prev, [current.questionId]: optionKey }
      writeSheet(
        detail.sessionId,
        Object.fromEntries(Object.entries(next).filter((e): e is [string, string] => Boolean(e[1]))),
      )
      return next
    })
    void save(current.questionId, optionKey)
  }

  function toggleFlag() {
    if (!current) return
    setFlags((prev) => {
      const next = new Set(prev)
      if (next.has(current.questionId)) next.delete(current.questionId)
      else next.add(current.questionId)
      return next
    })
  }

  function go(delta: number) {
    setIndex((i) => Math.min(questions.length - 1, Math.max(0, i + delta)))
  }

  /** Leaving the exam needs a deliberate confirm, since no clock will end it for you. */
  function leave() {
    if (unsaved.size > 0) {
      setFlash({ kind: 'error', text: 'Ada jawaban yang belum tersimpan. Coba lagi sebelum keluar.' })
      return
    }
    setLeaving(true)
  }

  /** Retries any failed save, then moves to the confirmation screen. */
  async function goConfirm() {
    const clean = await flush()
    if (!clean) {
      setFlash({ kind: 'error', text: 'Belum tersimpan. Coba lagi sebelum mengirim.' })
      return
    }
    // Tryout asks for confirmation first; practice goes straight to its summary, which submits itself.
    navigate(mode === 'tryout' ? confirmPath(detail.sessionId) : resultPath('practice', detail.sessionId))
  }

  // Keyboard: → next, ← previous, A–E/1–5 select, M toggles mark.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select')) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(-1)
      } else if (e.key.toLowerCase() === 'm' && current) {
        e.preventDefault()
        toggleFlag()
      } else if (current) {
        const k = e.key.toUpperCase()
        const byLetter = ['A', 'B', 'C', 'D', 'E'].includes(k) ? k : null
        const byNumber = /^[1-5]$/.test(k) ? ['A', 'B', 'C', 'D', 'E'][Number(k) - 1] : null
        const pick = byLetter ?? byNumber
        if (pick) {
          e.preventDefault()
          choose(pick)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /** Moving between questions announces the new stem to assistive tech. */
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [index])

  if (!current) {
    return (
      <Notice tone="danger" title="Sesi ini tidak memuat soal">
        Soal sesi ini belum tersedia.
      </Notice>
    )
  }

  const unfinished = questions.length - answeredCount
  const marked = flags.has(current.questionId)
  const progress = questions.length === 0 ? 0 : Math.round((answeredCount / questions.length) * 100)

  return (
    <div className="animate-fade">
      {/* Status strip: where you are, whether it is saved, and the one way out. */}
      <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-border bg-canvas/95 px-4 py-2.5 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="font-display text-md font-semibold">{mode === 'tryout' ? 'Tryout' : 'Latihan'}</span>
            <span aria-hidden className="h-4 w-px bg-border-strong" />
            <Badge tone="accent">{current.test}</Badge>
            <span className="tabular-nums text-base text-muted">
              Soal {index + 1} dari {questions.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              aria-live="polite"
              className={cx(
                'inline-flex items-center gap-1.5 text-sm',
                unsaved.size > 0 ? 'font-semibold text-danger' : 'text-muted',
              )}
            >
              {unsaved.size > 0 ? null : <IconCheck size={15} className="text-success" />}
              {unsaved.size > 0 ? 'Belum tersimpan' : 'Tersimpan'}
            </span>
            <Button variant="quiet" size="sm" onClick={leave}>
              Keluar
            </Button>
            <Button size="sm" onClick={() => void goConfirm()} disabled={unsaved.size > 0}>
              Selesai &amp; kirim
            </Button>
          </div>
        </div>
      </div>

      {leaving ? (
        <div className="mb-5">
          <Notice tone="warning" title="Keluar dari sesi?">
            Jawaban yang sudah tersimpan tidak hilang, tetapi sesi tetap terbuka. Kamu tidak akan bisa kembali ke
            sesi ini setelah menutup tab.{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => navigate(mode === 'tryout' ? '/tryout' : '/latihan')}
            >
              Ya, keluar
            </button>
            {' · '}
            <button type="button" className="font-semibold underline" onClick={() => setLeaving(false)}>
              Tetap di sini
            </button>
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
        <Panel className="min-w-0 p-5 lg:p-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">{testName(current.test)}</p>
            <button
              type="button"
              onClick={toggleFlag}
              aria-pressed={marked}
              className={cx(
                'inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors',
                marked
                  ? 'border-[#efdb9b] bg-sunny text-sunny-ink'
                  : 'border-border bg-surface text-muted hover:bg-surface-muted hover:text-ink',
              )}
            >
              <IconFlag size={15} />
              {marked ? 'Ditandai' : 'Tandai soal'}
            </button>
          </div>

          <article aria-labelledby="stem-heading">
            <h1
              id="stem-heading"
              ref={headingRef}
              tabIndex={-1}
              className="max-w-[64ch] font-display text-[19px] font-semibold leading-[1.55] tracking-[-0.01em] outline-none lg:text-[22px] lg:leading-[1.5]"
            >
              {current.stem}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ProvenanceBadge provenance={{ kind: current.provenanceKind, sourceYear: current.sourceYear }} />
              {/* The author-assigned difficulty frozen with the session (QUESTION_SPECIFICATION §1.1). */}
              <Badge tone="neutral">{difficultyLabel(current.difficulty)}</Badge>
            </div>

            <p className="mt-4 text-base leading-relaxed text-muted">
              {current.test === 'TKP'
                ? 'Pilih sikap yang paling mencerminkan dirimu dalam situasi ini. Setiap pilihan punya bobotnya sendiri.'
                : 'Pilih satu jawaban yang paling tepat.'}
            </p>

            <fieldset className="mt-4">
              <legend className="sr-only">Pilihan jawaban</legend>
              <div className="grid gap-2.5">
                {current.options.map((o) => (
                  <OptionRow
                    key={o.key}
                    option={o}
                    questionId={current.questionId}
                    checked={answers[current.questionId] === o.key}
                    onSelect={() => choose(o.key)}
                  />
                ))}
              </div>
            </fieldset>
            {current.asset ? (
              <p className="mt-3 text-sm text-muted">Soal ini memiliki gambar: {current.asset.alt}</p>
            ) : null}
          </article>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <Button variant="secondary" onClick={() => go(-1)} disabled={index === 0}>
              <IconChevronLeft size={17} />
              Sebelumnya
            </Button>
            <p className="order-last w-full text-sm text-muted sm:order-none sm:w-auto">
              Tanda soal hilang jika halaman dimuat ulang.
            </p>
            <Button variant="secondary" onClick={() => go(1)} disabled={index === questions.length - 1}>
              Berikutnya
              <IconChevronRight size={17} />
            </Button>
          </div>
        </Panel>

        <aside className="lg:sticky lg:top-[76px]">
          <Panel className="p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg">Daftar soal</h2>
              <span className="tabular-nums text-sm text-muted">{progress}%</span>
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {answeredCount} terjawab · {unfinished} belum
            </p>
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <ol className="mt-4 grid grid-cols-6 gap-2">
              {questions.map((q, i) => {
                const done = Boolean(answers[q.questionId])
                const isMarked = flags.has(q.questionId)
                return (
                  <li key={q.questionId}>
                    <button
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-current={i === index ? 'step' : undefined}
                      aria-label={`Soal ${i + 1}${done ? ', terjawab' : ', belum dijawab'}${isMarked ? ', ditandai' : ''}`}
                      className={cx(
                        'relative flex min-h-10 w-full items-center justify-center rounded-[10px] text-sm font-semibold tabular-nums transition-colors',
                        done
                          ? 'bg-primary text-white hover:bg-primary-hover'
                          : 'border border-border-strong bg-surface text-ink hover:bg-surface-muted',
                        i === index && 'ring-2 ring-primary-ink ring-offset-2 ring-offset-surface',
                      )}
                    >
                      {i + 1}
                      {isMarked ? (
                        <span
                          aria-hidden
                          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-sunny-ink"
                        />
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ol>

            <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm text-muted">
              <li className="flex items-center gap-2">
                <span aria-hidden className="h-3 w-3 rounded-[3px] bg-primary" /> Sudah dijawab
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden className="h-3 w-3 rounded-[3px] border border-border-strong bg-surface" /> Belum
                dijawab
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-sunny-ink" /> Ditandai
              </li>
            </ul>

            <p className="mt-4 text-sm leading-relaxed text-muted">
              <SessionClock detail={detail} />
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

/** One answer option: a real radio input inside a large click target. The letter is its own tile. */
function OptionRow({
  option,
  questionId,
  checked,
  onSelect,
}: {
  option: SessionQuestion['options'][number]
  questionId: string
  checked: boolean
  onSelect: () => void
}) {
  return (
    <label
      className={cx(
        'flex min-h-[56px] cursor-pointer items-start gap-3.5 rounded-[16px] border px-3.5 py-3 transition-[border-color,background-color,box-shadow] duration-200',
        checked
          ? 'border-primary bg-primary-wash shadow-[0_0_0_3px_var(--primary-wash)]'
          : 'border-border-strong bg-surface hover:border-muted hover:bg-surface-muted/60',
      )}
    >
      <input
        type="radio"
        name={`q-${questionId}`}
        value={option.key}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cx(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border text-sm font-bold',
          checked ? 'border-primary bg-primary text-white' : 'border-border-strong bg-surface-muted text-ink',
        )}
      >
        {option.key}
      </span>
      <span className="flex-1 pt-1 text-md leading-relaxed">{option.text}</span>
      {checked ? (
        <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary-ink">
          <IconCheck size={15} />
          Dipilih
        </span>
      ) : null}
    </label>
  )
}
