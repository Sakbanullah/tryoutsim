import type { TrendSeries } from '../../types/contracts'
import { Badge, Notice, Panel } from '../../ui/ui'
import { formatDate } from '../shared/format'

/**
 * The per-competency trend (FRONTEND_RESULTS_ANALYTICS §7): one inline SVG line, y = the returned
 * `percent` on a fixed 0–100 axis, x = `finishedAt` order. No chart library and no re-derivation.
 * `insufficient_data` never draws a line; it states the count and what is missing. Direction is
 * always written as a word, never colour alone.
 */
export function TrendChart({ series }: { series: TrendSeries }) {
  if (series.state === 'insufficient_data' || series.points.length < 2) {
    const answered = series.points.reduce((sum, p) => sum + p.answeredCount, 0)
    return (
      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">Tren</h2>
          <Badge tone="neutral">Belum cukup data</Badge>
        </div>
        <Notice tone="info" className="mt-3">
          Butuh ≥3 sesi untuk membaca arah. Sejauh ini {series.points.length} sesi tercatat ({answered} soal
          terjawab).
        </Notice>
      </Panel>
    )
  }

  const points = series.points
  const first = points[0]
  const last = points[points.length - 1]
  const summary = `Tren dari ${formatDate(first.finishedAt)} (${first.percent}%) sampai ${formatDate(
    last.finishedAt,
  )} (${last.percent}%), ${points.length} sesi.`

  // Geometry only: the plot box is fixed and the returned percent maps linearly onto the 0–100 axis.
  const W = 520
  const H = 180
  const PAD = { top: 12, right: 12, bottom: 24, left: 34 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW)
  const y = (percent: number) => PAD.top + plotH - (Math.max(0, Math.min(100, percent)) / 100) * plotH
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.percent)}`).join(' ')

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg">Tren</h2>
        <Badge tone={directionTone(series.direction)}>{directionWord(series.direction)}</Badge>
      </div>
      <p className="mt-0.5 text-sm text-muted">
        {points.length} sesi dinilai · {summary}
      </p>

      <div className="mt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={summary}
          className="h-auto w-full max-w-[560px]"
        >
          <title>{summary}</title>
          {/* Grid at 0 / 50 / 100 % so the reader can place each point without a tooltip. */}
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray={v === 0 ? undefined : '3 4'}
              />
              <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
                {v}%
              </text>
            </g>
          ))}
          <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle key={p.sessionId} cx={x(i)} cy={y(p.percent)} r="4" fill="var(--primary)" stroke="var(--surface)" strokeWidth="2">
              <title>
                {formatDate(p.finishedAt)} · {p.percent}% · n={p.answeredCount}
              </title>
            </circle>
          ))}
          <text x={x(0)} y={H - 6} textAnchor="start" fontSize="11" fill="var(--muted)">
            {formatDate(first.finishedAt)}
          </text>
          <text x={x(points.length - 1)} y={H - 6} textAnchor="end" fontSize="11" fill="var(--muted)">
            {formatDate(last.finishedAt)}
          </text>
        </svg>
      </div>

      <ul className="sr-only">
        {points.map((p) => (
          <li key={p.sessionId}>
            {formatDate(p.finishedAt)}: {p.percent}%, {p.answeredCount} soal terjawab.
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/** The direction as a word (RESULTS_ANALYTICS §1: a direction alone is never a colour). */
function directionWord(d: TrendSeries['direction']): string {
  return { stable: 'Arah: stabil', improving: 'Arah: membaik', declining: 'Arah: menurun', mixed: 'Arah: bercampur' }[d]
}

const DIRECTION_TONE: Record<TrendSeries['direction'], 'success' | 'warning' | 'neutral'> = {
  stable: 'neutral',
  improving: 'success',
  declining: 'warning',
  mixed: 'neutral',
}

function directionTone(d: TrendSeries['direction']): 'success' | 'warning' | 'neutral' {
  return DIRECTION_TONE[d]
}
