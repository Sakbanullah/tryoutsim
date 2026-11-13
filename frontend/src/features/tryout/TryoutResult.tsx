import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../data'
import type { QuestionScore, ReviewQuestion, ScoreResult, SessionDetail, Test, ThresholdVerdict } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { Badge, Button, Figure, Notice, Panel, PointsBar, buttonClass } from '../../ui/ui'
import { tierLabel } from '../shared/badges'
import { bandFor, withheldText } from './resultStatus'
import { readLastConfigId, writeLastResultPointer } from '../shared/format'
import { useFlash } from '../../state/shell'
import { PageHeader } from '../../ui/page'
import { IconAlert, IconChart, IconCheck, IconCross, IconDash, IconDot, IconRefresh, IconTable } from '../../ui/icons'

/**
 * Hasil (`/tryout/sesi/:sessionId/hasil`) — renders `ScoreResult` verbatim.
 * No verdict where the contract has none, no key, no recomputed percentage
 * (FRONTEND_RESULTS_ANALYTICS §2–§5).
 *
 * Desktop: a score dashboard on the left (total, three subtest panels, threshold, approval) and the
 * per-question review as the full-width block beneath, so the figures are read before the detail.
 */
export default function TryoutResult({ mode }: { mode: 'tryout' | 'practice' }) {
  const { sessionId = '' } = useParams()
  const result = useApi<ScoreResult>(() => api.sessionResult(sessionId), [sessionId])
  const flash = useFlash()
  /** Only learnt from a refused E78 page — used solely to decide whether a Latihan link is valid. */
  const [session, setSession] = useState<SessionDetail | null>(null)
  const saved = useRef(false)

  /** Used only from the blocked state: after approving the config, score the frozen session. */
  async function retryScore() {
    const r = await api.rescoreSession(sessionId)
    if (r.ok) {
      result.setData(r.data)
      saved.current = false
      flash({ kind: 'info', text: 'Sesi sudah dinilai.' })
    } else {
      flash({ kind: 'error', text: 'Sesi masih belum bisa dinilai.' })
    }
  }

  /** Called once after a page's E78 request is refused; the roster is read only to validate a Latihan link. */
  function onRefused() {
    void api.session(sessionId).then((r) => {
      if (r.ok) setSession(r.data)
    })
  }

  useEffect(() => {
    if (result.state.phase === 'done' && result.state.outcome.kind === 'ok' && !saved.current) {
      saved.current = true
      writeLastResultPointer({ sessionId, mode, at: new Date().toISOString() })
    }
  }, [result.state, sessionId, mode])

  if (result.state.phase === 'done' && result.state.outcome.kind === 'blocked') {
    const o = result.state.outcome
    return <BlockedResult code={o.code} changed={o.changed} retryScore={retryScore} configId={readLastConfigId() ?? ''} />
  }

  return (
    <OutcomeView state={result.state} retry={result.retry}>
      {(score) => <ResultBody score={score} mode={mode} session={session} onRefused={onRefused} />}
    </OutcomeView>
  )
}

function ResultBody({
  score,
  mode,
  session,
  onRefused,
}: {
  score: ScoreResult
  mode: 'tryout' | 'practice'
  session: SessionDetail | null
  onRefused: () => void
}) {
  const tests: Test[] = ['TWK', 'TIU', 'TKP']
  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow={mode === 'tryout' ? 'Hasil tryout' : 'Ringkasan latihan'}
        title="Hasil sesi"
        lead="Angka di bawah ini disalin apa adanya dari hasil penilaian sesi."
        actions={
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="neutral">Versi aturan {score.configVersion}</Badge>
            <Badge tone="neutral">Versi penilaian {score.scoringVersion}</Badge>
            {score.approval ? <Badge tone="warning">Disetujui sementara</Badge> : null}
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)] xl:items-start">
        <Panel tone="ink" className="p-6 xl:sticky xl:top-6">
          <p className="text-sm font-medium text-ink-panel-muted">Total poin</p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-[64px] font-bold leading-none tabular-nums tracking-[-0.04em]">
              {score.total.earned}
            </span>
            <span className="text-md text-ink-panel-muted">dari {score.total.possible} poin</span>
          </p>
          <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-ink-panel-line">
            <TotalBar earned={score.total.earned} possible={score.total.possible} />
          </div>
          <p className="mt-3 text-base text-ink-panel-muted">
            {score.total.answeredCount} soal dijawab dari {score.byQuestion.length} soal.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/progres" className={buttonClass('onInkSecondary', 'md')}>
              <IconChart size={17} />
              Lihat perkembangan
            </Link>
            <Link to={mode === 'tryout' ? '/tryout' : '/latihan'} className={buttonClass('onInkQuiet', 'md')}>
              <IconRefresh size={16} />
              Coba lagi
            </Link>
          </div>
        </Panel>

        <div className="min-w-0 space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            {tests.map((t) => {
              const rows = score.byQuestion.filter((q) => q.test === t)
              const bucket = score.byTest[t]
              return (
                <Panel key={t} className="flex flex-col p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-display text-lg">{TEST_NAME[t]}</h2>
                    <Badge tone="accent">{t}</Badge>
                  </div>
                  <div className="mt-3">
                    <PointsBar ticks={rows.map((r) => r.earned > 0)} testLabel={TEST_NAME[t]} />
                  </div>
                  <Figure value={bucket.earned} unit={`dari ${bucket.possible} poin`} className="mt-3" size="md" />
                  {t === 'TKP' ? (
                    <p className="mt-auto pt-3 text-sm leading-relaxed text-muted">
                      Pencapaian poin — tidak ada jawaban benar atau salah.
                    </p>
                  ) : (
                    <p className="mt-auto pt-3 text-base">
                      <span className="font-semibold">{bucket.correctCount} benar</span>{' '}
                      <span className="text-muted">dari {bucket.answeredCount} dijawab</span>
                    </p>
                  )}
                </Panel>
              )
            })}
          </div>

          <ThresholdBand score={score} />

          {score.approval ? (
            <p className="text-sm leading-relaxed text-muted">
              Disetujui pada {score.approval.approvedByUserAt.slice(0, 10)}. Peringatan yang dicatat saat
              persetujuan: {score.approval.acknowledgedWarnings.join(', ')}.
            </p>
          ) : null}
        </div>
      </div>

      <QuestionReview score={score} mode={mode} session={session} onRefused={onRefused} />
    </div>
  )
}

/**
 * The earned share of the whole total as one bar. The width is a proportional rendering of the two
 * contract integers (geometry only — no percentage is shown as a figure).
 */
function TotalBar({ earned, possible }: { earned: number; possible: number }) {
  const width = possible === 0 ? 0 : Math.round((earned / possible) * 100)
  return <div className="h-full rounded-full bg-ink-panel-fill" style={{ width: `${width}%` }} />
}

/** A submitted session the server could not score. Answers are safe; the reason is stated once. */export function BlockedResult({
  code,
  changed,
  retryScore,
  configId,
}: {
  code: string
  changed: Array<{ field: string; approved: unknown; current: unknown }>
  retryScore: () => Promise<void>
  configId: string
}) {
  const reason =
    {
      APPROVAL_MISSING: 'Konfigurasi ujian ini belum disetujui.',
      APPROVAL_INVALID: 'Pengaturan ujian berubah setelah disetujui.',
      APPROVAL_VERSION_MISMATCH: 'Kamu memulai dengan versi aturan yang berbeda dari yang disetujui.',
      THRESHOLD_CONFIG_INVALID: 'Batasan pada pengaturan ujian tidak valid.',
    }[code] ?? 'Sesi belum bisa dinilai.'
  return (
    <div className="animate-rise mx-auto max-w-page space-y-4">
      <PageHeader title="Hasil sesi" />
      <Notice tone="warning" title="Sesi ini tersimpan, tetapi belum dinilai">
        Jawabanmu aman. {reason}
      </Notice>
      {changed.length > 0 ? (
        <Panel className="p-6">
          <h2 className="text-lg">Yang berbeda</h2>
          <ul className="mt-2 space-y-1.5 text-base">
            {changed.map((c) => (
              <li key={c.field}>
                <strong>{fieldName(c.field)}</strong> — disetujui{' '}
                {c.field === 'regulatoryBasisHash' ? 'dasar hukum berbeda' : String(c.approved)}, sekarang{' '}
                {c.field === 'regulatoryBasisHash' ? 'dasar hukum berbeda' : String(c.current)}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/lainnya/ujian/${configId}`} className={buttonClass('secondary')}>
          Buka Konfigurasi ujian
        </Link>
        <Button onClick={() => void retryScore()}>Nilai ulang sesi</Button>
      </div>
    </div>
  )
}

/** Field keys are contract identifiers; the UI translates them (DESIGN_SYSTEM §10). */
function fieldName(field: string): string {
  return (
    (
      {
        configId: 'Konfigurasi',
        configVersion: 'Versi aturan',
        scoringVersion: 'Versi penilaian',
        regulatoryBasisHash: 'Dasar hukum',
      } as Record<string, string>
    )[field] ?? 'Pengaturan'
  )
}

const TEST_NAME: Record<Test, string> = {
  TWK: 'Wawasan Kebangsaan',
  TIU: 'Kemampuan Berpikir',
  TKP: 'Situasi dan Perilaku Kerja',
}

/** The threshold band `bandFor` names, rendered (resultStatus.ts owns the decision). */
function ThresholdBand({ score }: { score: ScoreResult }) {
  const band = bandFor(score)
  if (band.kind === 'no_rule') {
    return (
      <Notice tone="lavender" title="Ambang batas">
        Konfigurasi ini belum menetapkan ambang batas, jadi belum ada penilaian ambang batas.
      </Notice>
    )
  }
  if (band.kind === 'withheld') {
    // The score exists; only the verdict is withheld (API_SPECIFICATION §4). Never shown as "no threshold".
    return (
      <Notice tone="warning" title="Verdict ditahan">
        {withheldText(band.code)} Skor di atas tetap tersimpan dan tidak berubah.
      </Notice>
    )
  }
  if (band.kind === 'undecided') {
    return (
      <Notice tone="lavender" title="Ambang batas">
        Konfigurasi ini menetapkan ambang batas, tetapi belum ada verdict untuk sesi ini.
      </Notice>
    )
  }
  return score.verdict !== null ? <ThresholdVerdictBlock verdict={score.verdict} /> : null
}

/** The threshold verdict the backend carried as `verdict` (SCORING_METHODOLOGY §5.4). */
function ThresholdVerdictBlock({ verdict }: { verdict: ThresholdVerdict }) {
  const t = verdict
  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg">Ambang batas</h2>
        <Badge tone={t.passed ? 'success' : 'warning'}>{t.passed ? 'Memenuhi' : 'Belum memenuhi'}</Badge>
      </div>
      <p className="mt-2 text-md leading-relaxed">
        <strong>{t.passed ? 'Memenuhi' : 'Belum memenuhi'}</strong> ambang batas menurut{' '}
        {t.basisPathway === 'SEKOLAH_KEDINASAN' ? 'aturan jalur Kedinasan' : 'aturan jalur CPNS'} (
        {tierLabel(t.basisTier)}).
      </p>
      {t.passesBySubtest ? (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-3">
          {(['TWK', 'TIU', 'TKP'] as const).map((k) => (
            <li key={k} className="flex items-center justify-between rounded-[12px] bg-surface-muted px-3 py-2 text-base">
              <span>{TEST_NAME[k]}</span>
              <strong>{t.passesBySubtest![k] ? 'Memenuhi' : 'Belum'}</strong>
            </li>
          ))}
        </ul>
      ) : null}
      {t.noticeRequired ? (
        <div className="mt-3">
          <Notice tone="warning">
            Angka ambang batas ini berasal dari aturan yang belum terverifikasi untuk siklus berjalan. Hasil tidak
            menjamin kelulusan seleksi.
          </Notice>
        </div>
      ) : null}
    </Panel>
  )
}

/** Questions per page in Tinjau jawaban, fixed (FRONTEND_RESULTS_ANALYTICS §2.1). */
const PAGE_SIZE = 5

/** One page's content from E78, kept in component memory so a revisited page makes no request. */
type PageContent =
  | { phase: 'pending' }
  | { phase: 'ready'; questions: Record<string, ReviewQuestion> }
  | { phase: 'unavailable' }

/**
 * Tinjau jawaban — one block per roster question, five per page (FRONTEND_RESULTS_ANALYTICS §2.1–§2.2).
 * Status and points are read from `ScoreResult.byQuestion`; the block's content comes from the E78
 * batch, one request per page. Nothing on the block is computed here (BR-X2).
 */
function QuestionReview({
  score,
  mode,
  session,
  onRefused,
}: {
  score: ScoreResult
  mode: 'tryout' | 'practice'
  session: SessionDetail | null
  onRefused: () => void
}) {
  const byQuestion = score.byQuestion
  const [pages, setPages] = useState<Record<number, PageContent>>({})
  /** Ids from the latest E78 refusal, if it named them — never assumed to be the same roster. */
  const refusedRoster = useRef<string[] | null>(null)
  const [page, setPage] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const pageCount = Math.max(1, Math.ceil(byQuestion.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const ids = byQuestion.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE).map((row) => row.questionId)
  const idsKey = ids.join(',')

  useEffect(() => {
    if (!idsKey || pages[current]) return
    let live = true
    void api.reviewQuestions(score.sessionId, idsKey.split(',')).then((r) => {
      if (!live) return
      setPages((prev) => ({
        ...prev,
        [current]: r.ok
          ? { phase: 'ready', questions: Object.fromEntries(r.data.questions.map((q) => [q.questionId, q])) }
          : { phase: 'unavailable' },
      }))
      if (!r.ok) {
        // The roster is learnt only when the server refused the ids (E78-T3); ids are never derived.
        refusedRoster.current =
          r.failure.status === 400 && r.failure.code === 'VALIDATION_FAILED' ? idsKey.split(',') : null
        onRefused()
      }
    })
    return () => {
      live = false
    }
    // `idsKey` is the stable identity of this page's request; `pages` only gates a repeat.
  }, [current, idsKey, score.sessionId, pages, onRefused])

  /** Moves to page `n` and returns the view to the review heading, not the top of the page. */
  function goTo(n: number) {
    setPage(n)
    headingRef.current?.scrollIntoView({ block: 'start' })
  }

  const content = pages[current]
  // A refusal is what makes a Latihan link resolvable: the parent reads the roster, which re-renders this block.
  const linkFor = (competencyId: string) => session ? latihanTarget(session, refusedRoster.current, competencyId) : null

  return (
    <Panel className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 ref={headingRef} className="scroll-mt-6 text-xl">
            Tinjau jawaban
          </h2>
          <p className="mt-0.5 text-base text-muted">
            {mode === 'tryout'
              ? 'Penjelasan soal ditampilkan setelah sesi berakhir.'
              : 'Penjelasan ditampilkan untuk latihan bila tersedia.'}
          </p>
        </div>
        <span className="text-sm text-muted">{byQuestion.length} soal</span>
      </div>

      <ol className="mt-4 space-y-3">
        {ids.map((questionId, i) => (
          <ReviewBlock
            key={questionId}
            number={current * PAGE_SIZE + i + 1}
            row={byQuestion[current * PAGE_SIZE + i]}
            content={content}
            latihanLink={linkFor(byQuestion[current * PAGE_SIZE + i].competencyId)}
          />
        ))}
      </ol>

      {byQuestion.length > PAGE_SIZE ? (
        <nav aria-label="Halaman tinjauan jawaban" className="mt-3 flex items-start justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Halaman sebelumnya"
            disabled={current === 0}
            reason="Sudah di halaman pertama."
            onClick={() => goTo(current - 1)}
          >
            ‹
          </Button>
          <span
            aria-live="polite"
            aria-current="page"
            className="min-w-14 self-center text-center text-sm tabular-nums text-muted"
          >
            {current + 1} / {pageCount}
          </span>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Halaman berikutnya"
            disabled={current === pageCount - 1}
            reason="Sudah di halaman terakhir."
            onClick={() => goTo(current + 1)}
          >
            ›
          </Button>
        </nav>
      ) : null}

      <p className="mt-3 inline-flex items-start gap-1.5 text-sm leading-relaxed text-muted">
        <IconAlert size={14} className="mt-0.5 shrink-0" />
        Poin adalah nilai yang dikembalikan penilaian sesi, bukan hitungan ulang.
      </p>
    </Panel>
  )
}

/** The status a block shows: a word, an icon and a semantic tone — never colour alone (§2.2). */
function StatusLine({ row }: { row: QuestionScore }) {
  if (row.test === 'TKP') {
    const answered = row.selected !== null
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span
          className={
            answered
              ? 'inline-flex items-center gap-1.5 font-semibold text-lavender-ink'
              : 'inline-flex items-center gap-1.5 font-semibold text-muted'
          }
        >
          {answered ? <IconDot size={14} /> : <IconDash size={16} />}
          {answered
            ? `Dijawab · nilai ${row.earned} dari ${row.maxScore}`
            : `Tidak dijawab · nilai ${row.earned} dari ${row.maxScore}`}
        </span>
        <Badge tone="lavender">Pencapaian</Badge>
      </span>
    )
  }
  if (row.selected === null) {
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-muted">
        <IconDash size={16} />
        Tidak dijawab
      </span>
    )
  }
  return row.correct ? (
    <span className="inline-flex items-center gap-1.5 font-semibold text-success">
      <IconCheck size={16} />
      Benar
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 font-semibold text-danger">
      <IconCross size={16} />
      Salah
    </span>
  )
}

/**
 * One question as a block, in the fixed order of §2.2: identity → stem → answer → status → correct
 * answer (wrong TWK/TIU only) → explanation. Status and points come from `ScoreResult`; the stem,
 * options, key, weights and reasons come from the E78 response and are rendered, never derived.
 */
function ReviewBlock({
  row,
  number,
  content,
  latihanLink,
}: {
  row: QuestionScore
  number: number
  content: PageContent | undefined
  /** A resolved Latihan search URL, or `null` — the notice renders no link when it is `null` (T-02). */
  latihanLink: string | null
}) {
  const q = content?.phase === 'ready' ? content.questions[row.questionId] : undefined
  const options = q?.options ?? []
  const chosen = q && row.selected !== null ? (options.find((o) => o.key === row.selected) ?? null) : null
  const keyed =
    q && row.test !== 'TKP' && row.correct === false && q.keyedOption
      ? (options.find((o) => o.key === q.keyedOption) ?? null)
      : null
  /** Strict version matching (§2.2.3): only the frozen version's own explanation may be shown. */
  const explanationOk =
    q !== undefined &&
    q.explanation !== null &&
    q.explanation.trim() !== '' &&
    q.latestContentVersion === q.frozenContentVersion

  return (
    <li className="rounded-[16px] border border-border bg-surface p-5">
      <h3 className="font-display text-lg">
        No. {number} — {row.test}
      </h3>

      {q ? (
        <div className="mt-2 space-y-2">
          <p className="text-md leading-relaxed">{q.stem}</p>
          {q.asset ? <AssetView asset={q.asset} /> : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">
          {content?.phase === 'unavailable' ? 'Isi soal belum bisa ditampilkan.' : 'Sedang memuat…'}
        </p>
      )}

      <dl className="mt-3 space-y-1.5 text-base">
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-semibold">Jawabanmu:</dt>
          <dd className="text-muted">
            {row.selected === null
              ? 'Tidak dijawab'
              : `Pilihan ${row.selected}${chosen ? ` — ${chosen.text}` : ''}`}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-semibold">Status:</dt>
          <dd>
            <StatusLine row={row} />
          </dd>
        </div>
        {keyed ? (
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold">Jawaban yang benar:</dt>
            <dd>
              Pilihan {keyed.key} — {keyed.text}
            </dd>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-semibold">Poin:</dt>
          <dd className="tabular-nums">
            {row.earned} dari {row.maxScore}
          </dd>
        </div>
      </dl>

      {row.test === 'TKP' && q ? <TkpOptionsTable q={q} selected={row.selected} /> : null}

      {explanationOk && q ? (
        <div className="mt-3 border-t border-border pt-3">
          <p className="font-semibold">Pembahasan:</p>
          <p className="mt-1 max-w-[80ch] leading-relaxed">{q.explanation}</p>
        </div>
      ) : content?.phase === 'ready' || content?.phase === 'unavailable' ? (
        <div className="mt-3 border-t border-border pt-3 text-muted">
          <p>Pembahasan untuk soal ini belum tersedia.</p>
          {latihanLink ? (
            <Link
              to={latihanLink}
              className="mt-1 inline-flex items-center gap-1 font-medium text-primary-ink underline-offset-4 hover:underline"
            >
              Latihan soal sejenis
            </Link>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/** A question's asset, labelled by its alt text (§2.2 part 2). */
function AssetView({ asset }: { asset: NonNullable<ReviewQuestion['asset']> }) {
  if (asset.kind === 'image') {
    return <img src={asset.ref} alt={asset.alt} className="max-h-80 rounded-[12px] border border-border" />
  }
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted">
      <IconTable size={16} />
      {asset.alt}
    </p>
  )
}

/**
 * Every TKP option with its frozen weight and its own reason, highest first; the chosen row is marked
 * **Dipilih** in its own cell. Weights and reasons render as received (§2.2.1.1) — never recomputed,
 * never filled from the explanation when absent.
 */
function TkpOptionsTable({ q, selected }: { q: ReviewQuestion; selected: string | null }) {
  const ordered = [...q.options].sort((a, b) => (q.optionScores[b.key] ?? 0) - (q.optionScores[a.key] ?? 0))
  const reasons = q.justificationsSource === 'none' ? null : q.optionJustifications
  return (
    <figure className="mt-3 rounded-[12px] border border-border">
      <figcaption className="border-b border-border px-3 py-2 text-sm text-muted">Nilai dan alasan setiap opsi</figcaption>
      <table className="w-full border-collapse text-left text-base">
        <thead className="bg-surface-muted/70 text-sm text-muted">
          <tr>
            <th scope="col" className="w-12 px-3 py-2 font-medium">
              Opsi
            </th>
            <th scope="col" className="w-24 px-3 py-2 font-medium">
              Nilai
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Alasan
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {ordered.map((o) => {
            const weight = q.optionScores[o.key]
            const atMax = weight !== undefined && weight === q.maxScore
            const isChosen = selected === o.key
            return (
              <tr key={o.key} className={isChosen ? 'bg-lavender/60' : undefined}>
                <th scope="row" className="px-3 py-2 align-top text-left font-semibold">
                  {o.key}
                </th>
                <td className="px-3 py-2 align-top tabular-nums">
                  {weight ?? '—'}
                  {atMax ? <span className="block text-sm text-lavender-ink">tertinggi</span> : null}
                </td>
                <td className="px-3 py-2 align-top">
                  <span className="block">{o.text}</span>
                  {isChosen ? <span className="mt-0.5 block text-sm font-semibold text-lavender-ink">Dipilih</span> : null}
                  {reasons ? <span className="mt-1 block text-sm text-muted">{reasons[o.key]}</span> : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {reasons ? null : <p className="border-t border-border px-3 py-2 text-muted">Alasan per opsi belum tersedia untuk soal ini.</p>}
    </figure>
  )
}

/**
 * The Latihan screen for one competency — **only** when the relation resolves without guessing: the
 * ids came from a refused E78 page (so they are the server's roster), the server's roster contains
 * every one of them, and that roster carries this competency. Otherwise `null` and the notice renders
 * no link (FRONTEND_RESULTS_ANALYTICS §2.2.3.1, T-02).
 */
function latihanTarget(session: SessionDetail | null, refusedRoster: string[] | null, competencyId: string): string | null {
  if (!refusedRoster || !session) return null
  const ids = new Set(session.questions.map((q) => q.questionId))
  if (!refusedRoster.every((id) => ids.has(id))) return null
  if (!session.questions.some((q) => q.competencyId === competencyId)) return null
  return `/latihan?kompetensi=${encodeURIComponent(competencyId)}`
}
