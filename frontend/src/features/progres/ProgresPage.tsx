import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../data'
import type { AnalyticsSnapshot, MetricValue, Test } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { Badge, MetricBar, Notice, Panel } from '../../ui/ui'
import { MetricText } from '../shared/badges'
import { labelOf, leavesOf } from '../shared/taxonomy'
import { formatSeconds, testName } from '../shared/format'
import { PageHeader, Block } from '../../ui/page'
import { IconArrowUpRight, IconChart, IconClock, IconLayers } from '../../ui/icons'
import { SessionHistory } from './SessionHistory'

/**
 * Progres (`/progres`) — FRONTEND_RESULTS_ANALYTICS §6.
 * Every number comes from the analytics snapshot and is rendered verbatim. The UI does not sort by
 * percent (that would re-implement the recommendation engine — BR-X2) and never calls a small sample
 * a weakness (§9). Trends live per competency in `/progres/kompetensi/:id`.
 * Below the dashboard, the session history (`GET /sessions`) with server-described deletion.
 *
 * Desktop: a full-width dashboard — the three subtest figures up top, then competency rows and the
 * difficulty table side by side on a wide page.
 */
export default function ProgresPage() {
  // One analytics call covers every version (§6); the comparability note names the mix instead of a selector.
  const analytics = useApi<AnalyticsSnapshot>(() => api.analytics(), [])
  const [historyKey, setHistoryKey] = useState(0)

  /** After a deletion: refetch the snapshot (derived from sessions) and the history. */
  function onHistoryChanged() {
    setHistoryKey((k) => k + 1)
    analytics.retry()
  }

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow="Progres"
        title="Perkembangan"
        lead="Dihitung dari seluruh sesi yang sudah dinilai, memakai aturan dan penilaian versi yang dipakai tiap sesi."
      />

      <OutcomeView state={analytics.state} retry={analytics.retry} loadingLines={5}>
        {(a) => <Snapshot a={a} />}
      </OutcomeView>

      <Block title="Riwayat latihan" hint="Terbaru di atas. Poin ditampilkan sebagai poin per poin maksimal.">
        <SessionHistory refreshKey={historyKey} onChanged={onHistoryChanged} />
      </Block>
    </div>
  )
}

function Snapshot({ a }: { a: AnalyticsSnapshot }) {
  const tests: Test[] = ['TWK', 'TIU', 'TKP']
  const measured = Object.entries(a.perCompetency)
    .filter(([, m]) => m.state === 'reportable')
    .map(([id]) => id)
  const thin = Object.entries(a.perCompetency)
    .filter(([, m]) => m.state === 'insufficient_data')
    .map(([id, m]) => ({ id, m }))

  return (
    <div className="space-y-6">
      {a.comparability.mixed ? (
        <Notice tone="lavender" title="Data ini mencampur beberapa versi aturan">
          {a.comparability.versions.length} versi aturan terpakai dan tidak dibandingkan satu sama lain:{' '}
          {a.comparability.versions
            .map((v) => `aturan ${v.configVersion}/penilaian ${v.scoringVersion} (${v.sessionCount} sesi)`)
            .join(', ')}
          .
        </Notice>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {tests.map((t) => {
          const m = a.perTest[t]
          return (
            <Panel key={t} className="p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-lg">{testName(t)}</h2>
                <Badge tone={m.metric === 'attainment' ? 'lavender' : 'accent'}>
                  {m.metric === 'attainment' ? 'Pencapaian' : 'Akurasi'}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted">{m.sessionCount} sesi dinilai</p>
              <div className="mt-3 min-h-[32px]">
                <MetricText metric={m} />
              </div>
              <div className="mt-2">
                <MetricBar metric={m} />
              </div>
              <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-sm text-muted">
                <IconClock size={14} />
                ±{formatSeconds(a.responseTime.medianSeconds)} per soal · median (n={a.responseTime.answeredCount})
              </p>
            </Panel>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:items-start">
        <Block
          title="Per kompetensi"
          hint="Urutan mengikuti taksonomi. Buka satu bidang untuk rinciannya."
        >
          <Panel className="divide-y divide-border">
            {tests.map((t) => (
              <section key={t} className="p-5">
                <h3 className="inline-flex items-center gap-2 text-md font-semibold">
                  <IconLayers size={15} className="text-muted" />
                  {testName(t)}
                </h3>
                <ul className="mt-2 space-y-0.5">
                  {competencyRows(a, t).map((row) => (
                    <li key={row.id}>
                      <Link
                        to={`/progres/kompetensi/${row.id}`}
                        className="group flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-[10px] px-2.5 transition-colors hover:bg-surface-muted"
                      >
                        <span
                          className={
                            row.indent
                              ? 'flex items-center gap-2 pl-4 text-base text-muted'
                              : 'flex items-center gap-2 text-md font-medium text-ink'
                          }
                        >
                          {row.indent ? <span aria-hidden className="h-px w-3 bg-border-strong" /> : null}
                          {labelOf(row.id)}
                        </span>
                        <span className="flex items-center gap-2">
                          {row.m ? (
                            <MetricText metric={row.m} noun={`${row.m.sessionCount} sesi`} />
                          ) : (
                            <Badge tone="neutral">Belum cukup data</Badge>
                          )}
                          <IconArrowUpRight size={14} className="text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </Panel>
        </Block>

        <div className="space-y-6">
          <Block title="Tingkat kesulitan" hint="Angka per tingkat, sama seperti yang dikembalikan analytics.">
            <Panel className="overflow-hidden">
              <table className="w-full border-collapse text-left text-base">
                <thead className="bg-surface-muted/70 text-sm text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Bidang
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Mudah
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Sedang
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Sulit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tests.map((t) => (
                    <tr key={t}>
                      <th scope="row" className="px-4 py-3 text-left font-medium">
                        {t}
                      </th>
                      {(['easy', 'medium', 'hard'] as const).map((d) => (
                        <td key={d} className="px-3 py-3">
                          <MetricText metric={a.difficulty[t][d]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </Block>

          <Block title="Bidang yang terukur" hint="Aplikasi tidak membuat peringkat sendiri.">
            <Panel className="p-5">
              {measured.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {measured.map((id) => (
                    <li key={id}>
                      <Link
                        to={`/progres/kompetensi/${id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-3 py-1 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-primary-wash"
                      >
                        {labelOf(id)}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="inline-flex items-center gap-2 text-base text-muted">
                  <IconChart size={16} />
                  Belum ada bidang dengan data cukup.
                </p>
              )}
            </Panel>
          </Block>

          {thin.length > 0 ? (
            <Block title="Belum cukup data" hint="Sampelnya masih kecil, jadi belum bisa dibaca.">
              <Panel tone="muted" className="p-5">
                <ul className="space-y-1.5 text-sm text-muted">
                  {thin.map(({ id, m }) => (
                    <li key={id} className="flex items-center justify-between gap-2">
                      <span>{labelOf(id)}</span>
                      <span className="tabular-nums">n={m.answeredCount}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </Block>
          ) : null}

        </div>
      </div>
    </div>
  )
}

/** Leaves under their domain (domain headings are structure, never a re-summed number). */
function competencyRows(a: AnalyticsSnapshot, t: Test): Array<{ id: string; m?: MetricValue; indent: boolean }> {
  return leavesOf(t).map((leaf) => ({
    id: leaf.id,
    m: a.perCompetency[leaf.id],
    // TIU leaves nest under Verbal/Numerik/Figural; TWK and TKP leaves are top level.
    indent:
      leaf.parentId !== null &&
      (['TIU.VERBAL', 'TIU.NUMERIK', 'TIU.FIGURAL'] as string[]).includes(leaf.parentId),
  }))
}
