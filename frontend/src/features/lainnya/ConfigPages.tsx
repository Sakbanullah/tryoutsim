import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../data'
import type { ExamConfig, ThresholdSet } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { actionMessage, useAction } from '../shared/useAction'
import { Badge, Button, Dialog, Field, Notice, Panel, controlClass } from '../../ui/ui'
import { ConfigStateBadge, PathwayBadge, tierLabel } from '../shared/badges'
import { OUTSTANDING_WARNINGS } from '../../mock/configs'
import { BackLink } from '../../shell/Layout'
import { PageHeader } from '../../ui/page'
import { IconArrowUpRight, IconCheckCircle, IconLock, IconShield } from '../../ui/icons'

/** Konfigurasi ujian — daftar (`/lainnya/ujian`) — PAGE_SPECIFICATIONS §14. */
export function ConfigList() {
  const configs = useApi<ExamConfig[]>(() => api.examConfigs(), [])
  return (
    <div className="animate-rise space-y-5">
      <BackLink to="/lainnya">Lainnya</BackLink>
      <PageHeader
        eyebrow="Aturan & persetujuan"
        title="Konfigurasi ujian"
        lead="Aturan yang diikuti setiap tryout. Konfigurasi yang belum disetujui tidak bisa dinilai."
      />
      <OutcomeView state={configs.state} retry={configs.retry} loadingLines={3}>
        {(rows) => (
          <ul className="grid gap-4 md:grid-cols-2">
            {rows.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/lainnya/ujian/${c.id}`}
                  className="group flex h-full flex-col rounded-[24px] border border-border bg-surface p-5 shadow-panel transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-panel-hover"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="font-display text-lg">
                      {c.examYear} · {c.pathway === 'CPNS' ? 'CPNS' : 'Sekolah Kedinasan'}
                    </span>
                    <ConfigStateBadge config={c} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral">v{c.configVersion}</Badge>
                    <PathwayBadge config={c} />
                  </div>
                  <p className="mt-3 line-clamp-2 flex-1 text-base leading-relaxed text-muted">{c.notice}</p>
                  {c.thresholds && c.thresholds.mode !== 'none' ? (
                    <p className="mt-3 border-t border-border pt-3 text-sm text-muted">
                      Ambang batas ditetapkan · {tierLabel(c.thresholds.source.tier)}
                    </p>
                  ) : (
                    <p className="mt-3 border-t border-border pt-3 text-sm text-muted">Tanpa ambang batas</p>
                  )}
                  <span className="mt-2 inline-flex items-center gap-1 text-base font-semibold text-primary-ink">
                    Buka konfigurasi
                    <IconArrowUpRight size={16} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OutcomeView>
    </div>
  )
}

/** Detail + persetujuan (`/lainnya/ujian/:id`). */
export function ConfigDetail() {
  const { id = '' } = useParams()
  const config = useApi<ExamConfig>(() => api.examConfig(id), [id])
  return (
    <OutcomeView state={config.state} retry={config.retry}>
      {(c) => <DetailBody config={c} onChanged={config.setData} />}
    </OutcomeView>
  )
}

function DetailBody({ config, onChanged }: { config: ExamConfig; onChanged: (c: ExamConfig) => void }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const needsApproval = config.state === 'provisional' && !config.approvedAt

  /** Sends only what the contract takes; the four bound values are the server's to record. */
  async function approve() {
    setBusy(true)
    setError(null)
    const res = await api.approveConfig(config.id, {
      configId: config.id,
      acknowledgedWarnings: [...checked],
    })
    setBusy(false)
    if (res.ok) {
      onChanged({ ...config, approvedAt: res.data.approvedByUserAt })
      setOpen(false)
      return
    }
    setError(
      res.failure.status === 400 && res.failure.code === 'VALIDATION_FAILED'
        ? (res.failure.fields[0]?.message ?? 'Ada isian yang belum sesuai.')
        : res.failure.status === 409
          ? 'Konfigurasi ini tidak lagi menunggu persetujuan.'
          : 'Persetujuan gagal disimpan. Coba lagi.',
    )
  }

  const allChecked = checked.size === OUTSTANDING_WARNINGS.length

  return (
    <div className="animate-rise space-y-5">
      <BackLink to="/lainnya/ujian">Konfigurasi ujian</BackLink>
      <PageHeader
        eyebrow={`${config.pathway === 'CPNS' ? 'CPNS' : 'Sekolah Kedinasan'} · v${config.configVersion}`}
        title={`${config.examYear} · ${config.pathway === 'CPNS' ? 'CPNS' : 'Sekolah Kedinasan'}`}
        actions={
          <>
            <ConfigStateBadge config={config} />
            <PathwayBadge config={config} />
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-5">
          <Notice tone="warning" title="Pemberitahuan">
            {config.notice}
          </Notice>

          <Panel className="p-6">
            <h2 className="inline-flex items-center gap-2 text-lg">
              <IconShield size={17} className="text-primary-ink" />
              Dasar hukum
            </h2>
            <ul className="mt-3 space-y-3 text-base">
              {config.regulatoryBasis.map((b) => (
                <li key={`${b.document}-${b.number}`} className="rounded-[12px] bg-surface-muted px-3.5 py-2.5">
                  <p className="font-medium">
                    {b.document} Nomor {b.number}
                  </p>
                  <p className="text-sm text-muted">
                    {tierLabel(b.tier)}
                    {b.scope ? ` · ${b.scope}` : ''}
                  </p>
                </li>
              ))}
              {config.regulatoryBasis.length === 0 ? (
                <li className="text-base text-muted">Tidak ada rujukan yang dilampirkan pada konfigurasi ini.</li>
              ) : null}
            </ul>
          </Panel>

          <Panel className="p-6">
            <h2 className="text-lg">Ambang batas</h2>
            {config.thresholds && config.thresholds.mode !== 'none' ? (
              <ul className="mt-3 grid gap-1.5 text-base sm:grid-cols-2">
                {config.thresholds.TWK !== undefined ? (
                  <li className="flex justify-between rounded-[10px] bg-surface-muted px-3 py-1.5">
                    <span>Wawasan Kebangsaan</span>
                    <strong className="tabular-nums">{config.thresholds.TWK}</strong>
                  </li>
                ) : null}
                {config.thresholds.TIU !== undefined ? (
                  <li className="flex justify-between rounded-[10px] bg-surface-muted px-3 py-1.5">
                    <span>Kemampuan Berpikir</span>
                    <strong className="tabular-nums">{config.thresholds.TIU}</strong>
                  </li>
                ) : null}
                {config.thresholds.TKP !== undefined ? (
                  <li className="flex justify-between rounded-[10px] bg-surface-muted px-3 py-1.5">
                    <span>Situasi dan Perilaku Kerja</span>
                    <strong className="tabular-nums">{config.thresholds.TKP}</strong>
                  </li>
                ) : null}
                {config.thresholds.total !== undefined ? (
                  <li className="flex justify-between rounded-[10px] bg-surface-muted px-3 py-1.5">
                    <span>Total</span>
                    <strong className="tabular-nums">{config.thresholds.total}</strong>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-1 text-base text-muted">Konfigurasi ini tidak menetapkan ambang batas.</p>
            )}
            {config.thresholds ? (
              <p className="mt-3 text-sm text-muted">
                Sumber: {config.thresholds.source.document} {config.thresholds.source.number} ·{' '}
                {tierLabel(config.thresholds.source.tier)}
              </p>
            ) : null}
          </Panel>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <Panel className="p-5">
            <h2 className="text-lg">Persetujuan</h2>
            {config.approvedAt ? (
              <p className="mt-1 inline-flex items-start gap-2 text-base leading-relaxed text-muted">
                <IconCheckCircle size={17} className="mt-0.5 shrink-0 text-success" />
                <span>
                  Disetujui pada {config.approvedAt.slice(0, 10)}. Setiap perubahan pada aturan akan membatalkan
                  persetujuan ini.
                </span>
              </p>
            ) : needsApproval ? (
              <>
                <p className="mt-1 inline-flex items-start gap-2 text-base leading-relaxed text-muted">
                  <IconLock size={17} className="mt-0.5 shrink-0" />
                  {/* AUD-75: an unapproved provisional config stays startable; only the verdict is withheld. */}
                  <span>Belum disetujui. Tryout tetap bisa dimulai, tetapi hasil tidak memuat lulus/tidak lulus.</span>
                </p>
                <Button className="mt-3 w-full" onClick={() => setOpen(true)}>
                  Tinjau persetujuan
                </Button>
              </>
            ) : (
              <p className="mt-1 text-base text-muted">Konfigurasi ini tidak memerlukan persetujuan.</p>
            )}

            <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Versi aturan</dt>
                <dd className="font-medium tabular-nums">v{config.configVersion}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Versi penilaian</dt>
                <dd className="font-medium tabular-nums">v{config.scoringVersion}</dd>
              </div>
            </dl>
          </Panel>

          <Panel tone="muted" className="p-5">
            <h2 className="text-md font-semibold">Mengubah konfigurasi</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Konfigurasi yang sudah ada tidak disunting di tempat. Nilai baru selalu disimpan sebagai versi
              sementara yang terpisah, lalu ditinjau dan disetujui sendiri.
            </p>
            <Button className="mt-3 w-full" variant="secondary" onClick={() => setCreating(true)}>
              Buat versi sementara
            </Button>
          </Panel>
        </aside>
      </div>

      <Dialog
        open={open}
        title="Setujui konfigurasi sementara?"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => void approve()}
              disabled={busy || !allChecked}
              reason={allChecked ? undefined : 'Centang semua peringatan dulu.'}
            >
              {busy ? 'Menyimpan…' : 'Setujui'}
            </Button>
          </>
        }
      >
        <p className="text-base">
          Aturan ini masih sementara. Dengan menyetujui, kamu menyatakan sudah membaca semua peringatan berikut.
          Persetujuan bisa dibatalkan dengan mengubah konfigurasi.
        </p>
        <ul className="mt-3 space-y-2">
          {OUTSTANDING_WARNINGS.map((w) => (
            <li key={w.id}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] border border-border px-3 py-2 text-base hover:bg-surface-muted">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--primary)]"
                  checked={checked.has(w.id)}
                  onChange={(e) =>
                    setChecked((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(w.id)
                      else next.delete(w.id)
                      return next
                    })
                  }
                />
                <span>{w.text}</span>
              </label>
            </li>
          ))}
        </ul>
        {error ? (
          <p className="mt-2 text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </Dialog>

      <CreateVersionDialog
        open={creating}
        base={config}
        onClose={() => setCreating(false)}
        onCreated={(created) => {
          onChanged(created)
          setCreating(false)
          navigate(`/lainnya/ujian/${created.id}`)
        }}
      />
    </div>
  )
}

/**
 * `POST /exam-configs` — a new `provisional` version copied from the base config. Only exam year and
 * thresholds are the user's to change; every outstanding warning must be acknowledged, because a value
 * without a documented basis cannot be entered silently (PRD FR-E5).
 */
function CreateVersionDialog({
  open,
  base,
  onClose,
  onCreated,
}: {
  open: boolean
  base: ExamConfig
  onClose: () => void
  onCreated: (created: ExamConfig) => void
}) {
  const action = useAction()
  const [mode, setMode] = useState<ThresholdSet['mode']>(base.thresholds?.mode ?? 'none')
  const [values, setValues] = useState<Record<string, string>>(() => ({
    TWK: base.thresholds?.TWK?.toString() ?? '',
    TIU: base.thresholds?.TIU?.toString() ?? '',
    TKP: base.thresholds?.TKP?.toString() ?? '',
    total: base.thresholds?.total?.toString() ?? '',
  }))
  const [acknowledged, setAcknowledged] = useState<Set<string>>(() => new Set())

  const fields: Array<{ key: string; label: string }> =
    mode === 'none'
      ? []
      : mode === 'per_subtest_only'
        ? [
            { key: 'TWK', label: 'Wawasan Kebangsaan' },
            { key: 'TIU', label: 'Kemampuan Berpikir' },
            { key: 'TKP', label: 'Situasi dan Perilaku Kerja' },
          ]
        : mode === 'total_only'
          ? [{ key: 'total', label: 'Total' }]
          : [
              { key: 'TWK', label: 'Wawasan Kebangsaan' },
              { key: 'TIU', label: 'Kemampuan Berpikir' },
              { key: 'TKP', label: 'Situasi dan Perilaku Kerja' },
              { key: 'total', label: 'Total' },
            ]

  /** Every visible threshold is a whole number, and every warning is acknowledged. */
  const complete =
    fields.every((f) => /^\d+$/.test(values[f.key] ?? '')) && acknowledged.size === OUTSTANDING_WARNINGS.length

  return (
    <Dialog
      open={open}
      title="Buat versi konfigurasi sementara"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button
            disabled={action.busy || !complete}
            reason={!complete ? 'Lengkapi ambang batas dan centang semua peringatan.' : undefined}
            onClick={async () => {
              const created = await action.run(() =>
                api.createExamConfig({
                  examYear: base.examYear,
                  thresholds: { mode, ...Object.fromEntries(fields.map((f) => [f.key, Number(values[f.key])])) },
                  acknowledgedWarnings: [...acknowledged],
                }),
              )
              if (created) onCreated(created)
            }}
          >
            {action.busy ? 'Menyimpan…' : 'Simpan sebagai versi baru'}
          </Button>
        </>
      }
    >
      <p className="text-base text-muted">
        Versi baru disimpan sebagai sementara untuk tahun {base.examYear}. Nilai yang kamu isi belum
        terverifikasi; sertakan dasarnya bila ada.
      </p>
      <div className="mt-3 space-y-3">
        <Field label="Ambang batas">
          {({ id }) => (
            <select id={id} value={mode} onChange={(e) => setMode(e.target.value as ThresholdSet['mode'])} className={controlClass()}>
              <option value="none">Tanpa ambang batas</option>
              <option value="per_subtest_and_total">Per subtes dan total</option>
              <option value="per_subtest_only">Per subtes saja</option>
              <option value="total_only">Total saja</option>
            </select>
          )}
        </Field>
        {fields.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <Field key={f.key} label={f.label} error={action.fieldErrors[`thresholds.${f.key}`]}>
                {({ id, invalid }) => (
                  <input
                    id={id}
                    inputMode="numeric"
                    value={values[f.key]}
                    onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value.replace(/\D/g, '') }))}
                    className={`${controlClass(invalid)} tabular-nums`}
                  />
                )}
              </Field>
            ))}
          </div>
        ) : null}
        <fieldset>
          <legend className="text-sm font-semibold">Peringatan yang dipahami</legend>
          <ul className="mt-1.5 space-y-2">
            {OUTSTANDING_WARNINGS.map((w) => (
              <li key={w.id}>
                <label className="flex min-h-10 cursor-pointer items-start gap-2.5 rounded-[12px] border border-border px-3 py-2 text-sm hover:bg-surface-muted">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={acknowledged.has(w.id)}
                    onChange={(e) =>
                      setAcknowledged((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(w.id)
                        else next.delete(w.id)
                        return next
                      })
                    }
                  />
                  <span>{w.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        {action.failure ? <Notice tone="danger">{actionMessage(action.failure)}</Notice> : null}
      </div>
    </Dialog>
  )
}
