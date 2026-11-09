import { Link, useParams } from 'react-router-dom'
import { api } from '../../data'
import type { ScoreResult } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { Badge, Figure, Panel, buttonClass } from '../../ui/ui'
import { readSheet } from '../tryout/Runner'
import { testName } from '../shared/format'
import { PageHeader } from '../../ui/page'
import { IconDrill } from '../../ui/icons'

/**
 * Ringkasan latihan (`/latihan/sesi/:id/hasil`) — PAGE_SPECIFICATIONS §8.
 * Practice has no confirmation screen, so the summary itself submits the frozen sheet once, then
 * renders the result. Explanations are not shown: the practice payload carries no disclosed key
 * (GAP-X6), and nothing is invented for it.
 */
export default function PracticeSummary() {
  const { sessionId = '' } = useParams()
  const result = useApi<ScoreResult>(async () => {
    const sheet = readSheet(sessionId)
    return api.submitSession(sessionId, {
      answers: Object.entries(sheet).map(([questionId, selectedOption]) => ({ questionId, selectedOption })),
    })
  }, [sessionId])

  return (
    <OutcomeView state={result.state} retry={result.retry}>
      {(score) => <SummaryBody score={score} />}
    </OutcomeView>
  )
}

function SummaryBody({ score }: { score: ScoreResult }) {
  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow="Ringkasan latihan"
        title="Latihan selesai"
        lead={`${score.total.answeredCount} soal dijawab dari ${score.byQuestion.length} soal.`}
        actions={<Badge tone="lavender" icon={<IconDrill size={13} />}>Sesi latihan</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <Panel tone="wash" className="p-6 lg:sticky lg:top-6">
          <p className="text-sm font-medium text-muted">Total poin</p>
          <Figure value={score.total.earned} unit={`dari ${score.total.possible} poin`} size="xl" className="mt-1" />
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/latihan" className={buttonClass('primary')}>
              Latihan lagi
            </Link>
            <Link to="/progres" className={buttonClass('quiet')}>
              Lihat perkembangan
            </Link>
          </div>
        </Panel>

        <Panel className="min-w-0 p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-xl">Per jawaban</h2>
            <span className="text-sm text-muted">{score.byQuestion.length} soal</span>
          </div>
          <div className="mt-4 overflow-hidden rounded-[16px] border border-border">
            <table className="w-full border-collapse text-left">
              <thead className="bg-surface-muted/70 text-sm text-muted">
                <tr>
                  <th scope="col" className="w-12 px-3 py-2 font-medium">
                    No
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Bidang
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Jawabanmu
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Poin
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {score.byQuestion.map((row, i) => (
                  <tr key={row.questionId} className="text-base">
                    <td className="px-3 py-2.5 tabular-nums text-muted">{i + 1}</td>
                    <td className="px-3 py-2.5">{testName(row.test)}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone="neutral">{row.selected ? `Pilihan ${row.selected}` : 'Tidak dijawab'}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.selected === null ? '—' : `${row.earned} dari ${row.maxScore}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Penjelasan jawaban belum tersedia untuk latihan pada versi ini.
          </p>
        </Panel>
      </div>
    </div>
  )
}
