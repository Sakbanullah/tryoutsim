import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../data'
import type { Notification } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { actionMessage, useAction } from '../shared/useAction'
import { formatDate } from '../shared/format'
import { Badge, Button, EmptyState, Notice, Panel, cx } from '../../ui/ui'
import { PageHeader } from '../../ui/page'
import { IconCheck, IconChevronRight, IconRefresh } from '../../ui/icons'

/**
 * Pusat pemberitahuan (`/lainnya/notifikasi`) — PAGE_SPECIFICATIONS §19.
 * Newest first, grouped by day; each row shows severity, message, time and — when the record carries
 * one — a deep link. Marking read or dismissed goes through the one PATCH route and updates the row
 * from the response, never by guessing the new state.
 */

/** The severity word beside the dot; colour is never the only carrier. */
const SEVERITY: Record<Notification['severity'], { label: string; tone: 'neutral' | 'warning' | 'danger' | 'accent' }> = {
  info: { label: 'Info', tone: 'neutral' },
  action: { label: 'Perlu tindakan', tone: 'accent' },
  warning: { label: 'Peringatan', tone: 'warning' },
  error: { label: 'Masalah', tone: 'danger' },
}

/** Record `type` → the sentence shown. Titles arrive as a key plus params; unknown keys stay readable. */
function messageOf(n: Notification): string {
  const param = (k: string) => String(n.params[k] ?? '')
  switch (n.type) {
    case 'backup_failed':
      return `Backup gagal: ${param('reason') || 'alasan tidak dicatat'}.`
    case 'generation_completed':
      return `Pekerjaan pembuatan soal selesai dengan ${param('produced')} soal.`
    case 'generation_interrupted':
      return 'Pekerjaan pembuatan soal terhenti dan bisa dicoba lagi.'
    case 'material_ready':
      return `Materi "${param('title')}" siap ditinjau.`
    case 'batch_awaiting_sample':
      return `Batch ${param('batchId')} menunggu pemeriksaan sampel.`
    case 'question_reported':
      return `Soal dilaporkan: ${param('severity') || 'tingkat tidak dicatat'}.`
    case 'restore_completed':
      return 'Pemulihan dari backup selesai.'
    default:
      return n.titleKey
  }
}

export default function Notifikasi() {
  const list = useApi<Notification[]>(() => api.notifications(), [])
  const action = useAction()
  const [rows, setRowsState] = useState<Notification[] | null>(null)
  const data = rows ?? (list.state.phase === 'done' && list.state.outcome.kind === 'ok' ? list.state.outcome.data : null)

  /** Applies one PATCH result to the local copy (dismiss removes the row, read replaces it). */
  async function patch(n: Notification, body: { read?: boolean; dismissed?: boolean }) {
    const next = await action.run(() => api.markNotification(n.id, body))
    if (next && data) {
      setRowsState(body.dismissed ? data.filter((x) => x.id !== n.id) : data.map((x) => (x.id === n.id ? next : x)))
    }
  }

  async function markAll() {
    const next = await action.run(() => api.markAllNotificationsRead())
    if (next) setRowsState(next)
  }

  const reload = () => {
    setRowsState(null)
    list.retry()
  }
  const unread = data?.filter((n) => !n.readAt).length ?? 0

  return (
    <div className="animate-rise mx-auto max-w-reading space-y-6">
      <PageHeader
        eyebrow="Pengaturan"
        title="Pemberitahuan"
        lead="Kejadian yang butuh perhatian: backup, pembuatan soal, dan laporan soal."
        actions={
          <>
            <Button variant="secondary" onClick={reload}>
              <IconRefresh size={17} />
              Muat ulang
            </Button>
            <Button
              disabled={unread === 0 || action.busy}
              reason={unread === 0 ? 'Semua pemberitahuan sudah dibaca.' : undefined}
              onClick={() => void markAll()}
            >
              <IconCheck size={17} />
              Tandai semua dibaca
            </Button>
          </>
        }
      />

      {action.failure ? <Notice tone="danger">{actionMessage(action.failure)}</Notice> : null}

      <OutcomeView state={list.state} retry={reload} loadingLines={5}>
        {(loaded) => {
          const shown = rows ?? loaded
          if (shown.length === 0) {
            return (
              <EmptyState title="Tidak ada pemberitahuan" action={<Link className="font-semibold text-primary-ink underline" to="/">Kembali ke Beranda</Link>}>
                Pemberitahuan muncul saat ada pekerjaan selesai atau sesuatu gagal.
              </EmptyState>
            )
          }
          return (
            <div className="space-y-6">
              {groupByDay(shown).map(([day, items]) => (
                <section key={day} aria-labelledby={`day-${day}`}>
                  <h2 id={`day-${day}`} className="mb-2 text-sm font-semibold uppercase tracking-[0.06em] text-muted">
                    {day}
                  </h2>
                  <Panel className="divide-y divide-border overflow-hidden" tone="flat">
                    {items.map((n) => (
                      <Row key={n.id} n={n} onPatch={patch} busy={action.busy} />
                    ))}
                  </Panel>
                </section>
              ))}
            </div>
          )
        }}
      </OutcomeView>
    </div>
  )
}

/** One notification: severity, message, time, deep link and the two actions. */
function Row({ n, onPatch, busy }: { n: Notification; onPatch: (n: Notification, body: { read?: boolean; dismissed?: boolean }) => void; busy: boolean }) {
  const unread = !n.readAt
  return (
    <div className={cx('flex items-start gap-3 px-4 py-3.5', unread && 'bg-primary-wash/40')}>
      <span aria-hidden className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', unread ? 'bg-primary' : 'bg-border-strong')} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={SEVERITY[n.severity].tone}>{SEVERITY[n.severity].label}</Badge>
          {unread ? <span className="text-sm font-semibold text-primary-ink">Belum dibaca</span> : null}
        </div>
        <p className="mt-1.5 text-md leading-relaxed">{messageOf(n)}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted">{formatDate(n.createdAt)}</span>
          {n.link ? (
            <Link to={n.link.route} className="inline-flex items-center gap-0.5 font-semibold text-primary-ink underline">
              {n.link.entityId}
              <IconChevronRight size={14} />
            </Link>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {unread ? (
          <Button size="sm" variant="quiet" disabled={busy} onClick={() => onPatch(n, { read: true })}>
            Tandai dibaca
          </Button>
        ) : null}
        <Button size="sm" variant="quiet" disabled={busy} onClick={() => onPatch(n, { dismissed: true })}>
          Singkirkan
        </Button>
      </div>
    </div>
  )
}

/** Groups newest-first rows under their calendar day, labelled in Indonesian. */
function groupByDay(rows: Notification[]): Array<[string, Notification[]]> {
  const label = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
  const groups = new Map<string, Notification[]>()
  for (const n of [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const key = label.format(new Date(n.createdAt))
    groups.set(key, [...(groups.get(key) ?? []), n])
  }
  return [...groups]
}
