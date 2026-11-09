import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../data'
import type { AnalyticsSnapshot, MaterialOffer, TrendSeries } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { Badge, Button, MetricBar, Notice, Panel } from '../../ui/ui'
import { MetricText, tierLabel } from '../shared/badges'
import { nodeOf, TAXONOMY } from '../shared/taxonomy'
import { BackLink } from '../../shell/Layout'
import { PageHeader } from '../../ui/page'
import { IconArrowUpRight, IconBook, IconChart, IconDrill } from '../../ui/icons'
import { startFailureText } from '../shared/package'
import { useStartSession } from '../shared/startSession'
import { TrendChart } from './TrendChart'

/**
 * Detail kompetensi (`/progres/kompetensi/:id`) — FRONTEND_RESULTS_ANALYTICS §7.
 * The title is always the taxonomy label, never the id. The snapshot gives the metric and the
 * children; `trends` gives the chart; `materialsOffer` decides the material action; `drill` starts a
 * one-competency session (FR-L4). A small sample is never worded as weakness (§9).
 */
export default function CompetencyDetail() {
  const { id = '' } = useParams()
  const analytics = useApi<AnalyticsSnapshot>(() => api.analytics(), [])
  const node = nodeOf(id)

  if (!node) {
    return (
      <Notice tone="info" title="Kompetensi tidak dikenal">
        Bidang ini tidak ada dalam taksonomi.{' '}
        <Link className="font-semibold underline" to="/progres">
          Kembali ke Progres
        </Link>
      </Notice>
    )
  }

  const children = TAXONOMY.filter((n) => n.parentId === id)
  return (
    <div className="animate-rise mx-auto max-w-page space-y-5">
      <BackLink to="/progres">Perkembangan</BackLink>
      <PageHeader
        eyebrow={node.test}
        title={node.label.id}
        actions={
          <>
            <Badge tone="accent">{node.test}</Badge>
            <Badge tone={node.tier === 'VERIFIED-2026-SEKOLAH-KEDINASAN' ? 'warning' : 'neutral'}>
              {tierLabel(node.tier)}
            </Badge>
          </>
        }
        lead={
          node.tier === 'VERIFIED-2026-SEKOLAH-KEDINASAN'
            ? 'Nama domain ini berasal dari aturan Sekolah Kedinasan 2026 dan belum diverifikasi untuk CPNS.'
            : undefined
        }
      />

      <OutcomeView state={analytics.state} retry={analytics.retry}>
        {(a) => (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
            <Panel className="p-6">
              <h2 className="inline-flex items-center gap-2 text-lg">
                <IconChart size={17} className="text-primary-ink" />
                Hasilmu
              </h2>
              <div className="mt-3 min-h-[36px]">
                {a.perCompetency[id] ? (
                  <>
                    <MetricText metric={a.perCompetency[id]} noun={`${a.perCompetency[id].sessionCount} sesi`} />
                    <div className="mt-3">
                      <MetricBar metric={a.perCompetency[id]} />
                    </div>
                  </>
                ) : (
                  <Badge tone="neutral">Belum cukup data</Badge>
                )}
              </div>
            </Panel>

            {children.length > 0 ? (
              <Panel className="p-6">
                <h2 className="text-lg">Bagian</h2>
                <ul className="mt-2 space-y-0.5">
                  {children.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/progres/kompetensi/${c.id}`}
                        className="group flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-[10px] px-2.5 transition-colors hover:bg-surface-muted"
                      >
                        <span className="flex items-center gap-2 text-md">
                          {c.label.id}
                          <IconArrowUpRight size={14} className="text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                        {a.perCompetency[c.id] ? (
                          <MetricText metric={a.perCompetency[c.id]} noun={`${a.perCompetency[c.id].sessionCount} sesi`} />
                        ) : (
                          <Badge tone="neutral">Belum cukup data</Badge>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}
          </div>
        )}
      </OutcomeView>

      <TrendSection competencyId={id} />
      <ActionSection competencyId={id} />
    </div>
  )
}

/** The trend chart from `GET /analytics/trends/:competencyId`, in its own load state. */
function TrendSection({ competencyId }: { competencyId: string }) {
  const trend = useApi<TrendSeries>(() => api.trends(competencyId), [competencyId])
  return (
    <OutcomeView state={trend.state} retry={trend.retry} loadingLines={4}>
      {(series) => <TrendChart series={series} />}
    </OutcomeView>
  )
}

/**
 * The two actions §7 gives this screen: drill this submateri, and open its material when the offer
 * says one is available. Every unavailable state states its reason in words.
 */
function ActionSection({ competencyId }: { competencyId: string }) {
  const offer = useApi<MaterialOffer>(() => api.materialsOffer(competencyId), [competencyId])
  const start = useStartSession()
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState<string | null>(null)

  /** Starts a one-competency drill (FR-L4) and opens the practice runner. */
  async function drill() {
    setBusy(true)
    setReason(null)
    const ok = await start(() => api.drill({ competencyIds: [competencyId] }), 'latihan')
    if (!ok) {
      setBusy(false)
      setReason(startFailureText())
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel className="flex flex-col p-5">
        <h2 className="inline-flex items-center gap-2 text-lg">
          <IconDrill size={17} className="text-primary-ink" />
          Latih submateri ini
        </h2>
        <p className="mt-1 flex-1 text-base leading-relaxed text-muted">
          Sesi latihan dibuat hanya dari soal submateri ini. Soal yang sudah dikerjakan bisa muncul lagi bila
          stok soal baru belum cukup.
        </p>
        <div className="mt-4 space-y-2">
          {reason ? <Notice tone="danger">{reason}</Notice> : null}
          <Button className="w-full" onClick={drill} disabled={busy}>
            {busy ? 'Menyiapkan sesi…' : 'Mulai latihan'}
          </Button>
        </div>
      </Panel>

      <Panel className="flex flex-col p-5">
        <h2 className="inline-flex items-center gap-2 text-lg">
          <IconBook size={17} className="text-primary-ink" />
          Materi
        </h2>
        <div className="mt-2 flex-1">
          <OutcomeView state={offer.state} retry={offer.retry} loadingLines={2}>
            {(o) => {
              if (o.status === 'available') {
                return (
                  <Link
                    to={`/lainnya/materi/${o.materialId}`}
                    className="group inline-flex items-center gap-1 text-md font-semibold text-primary-ink underline-offset-4 hover:underline"
                  >
                    <span className="line-clamp-2">{o.title}</span>
                    <IconArrowUpRight size={15} />
                  </Link>
                )
              }
              if (o.status === 'draft_available') {
                return (
                  <p className="text-base leading-relaxed text-muted">
                    Setujui materi dulu sebelum bisa dibuka.{' '}
                    <Link to={`/lainnya/materi/${o.materialId}`} className="font-semibold text-primary-ink underline-offset-4 hover:underline">
                      Buka materi
                    </Link>
                  </p>
                )
              }
              return (
                <p className="text-base leading-relaxed text-muted">
                  Belum ada materi untuk submateri ini, dan tidak ada draf yang menunggu.
                </p>
              )
            }}
          </OutcomeView>
        </div>
      </Panel>
    </div>
  )
}
