import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../data'
import type { BackupRecord, BackupSettings, RestoreValidation } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { actionMessage, useAction } from '../shared/useAction'
import { formatDate } from '../shared/format'
import { Badge, Button, Dialog, EmptyState, Field, Notice, Panel, controlClass } from '../../ui/ui'
import { Block, PageHeader } from '../../ui/page'
import { IconCheck, IconClock, IconRefresh } from '../../ui/icons'

/**
 * Pengaturan (`/lainnya/pengaturan`) — PAGE_SPECIFICATIONS §18; rules in DEPLOYMENT_AND_BACKUP §2–§3.
 * Backup folder and retention, a manual backup, honest status (a failure is never styled as success),
 * and the restore wizard: compatibility check → preview → explicit confirmation. Restoring replaces
 * the database, so the confirm step names that consequence and is the only enabled step after the
 * check passes. Keys are never in a backup, and the screen says so.
 */
export default function Pengaturan() {
  const settings = useApi<BackupSettings>(() => api.backupSettings(), [])
  const history = useApi<BackupRecord[]>(() => api.backups(), [])
  const [restoring, setRestoring] = useState(false)

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow="Pengaturan"
        title="Backup dan data"
        lead="Data aplikasi tersimpan di perangkat ini. Backup melindungi riwayat dan kumpulan soal dari kerusakan perangkat."
        actions={
          <Button variant="secondary" onClick={() => { settings.retry(); history.retry() }}>
            <IconRefresh size={17} />
            Muat ulang
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
        <div className="space-y-6">
          <OutcomeView state={settings.state} retry={settings.retry}>
            {(s) => <BackupForm settings={s} />}
          </OutcomeView>

          <section aria-labelledby="backup-history">
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 id="backup-history" className="text-xl">Riwayat backup</h2>
              <ManualBackup onDone={() => history.retry()} />
            </div>
            <OutcomeView state={history.state} retry={history.retry} loadingLines={3}>
              {(rows) =>
                rows.length === 0 ? (
                  <EmptyState title="Belum ada backup">Backup pertama bisa dijalankan sekarang; berkasnya disimpan di folder yang dipilih di atas.</EmptyState>
                ) : (
                  <ul className="divide-y divide-border rounded-[16px] border border-border bg-surface">
                    {rows.map((b) => (
                      <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-md font-medium">{formatDate(b.createdAt)}</p>
                          {b.status === 'failed' ? (
                            <p className="mt-0.5 text-sm text-danger">Gagal: {b.reason ?? 'alasan tidak dicatat'}</p>
                          ) : (
                            <p className="mt-0.5 text-sm text-muted">{(b.sizeBytes / (1024 * 1024)).toFixed(1)} MB</p>
                          )}
                        </div>
                        <Badge tone={b.status === 'succeeded' ? 'success' : 'danger'}>
                          {b.status === 'succeeded' ? 'Berhasil' : 'Gagal'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )
              }
            </OutcomeView>
          </section>
        </div>

        <Panel tone="muted" className="p-6">
          <Block title="Pulihkan dari backup">
            <p className="text-base leading-relaxed text-muted">
              Memulihkan mengganti seluruh data saat ini dengan isi arsip. Kunci API tidak ikut dipulihkan dan harus diisi ulang setelahnya.
            </p>
            <Button className="mt-3" variant="secondary" onClick={() => setRestoring(true)}>
              Pulihkan data
            </Button>
          </Block>
        </Panel>
      </div>

      <RestoreWizard open={restoring} onClose={() => setRestoring(false)} />
    </div>
  )
}

/* ── Folder, retention and data location ─────────────────────────────────────────────── */

/**
 * Editable backup settings. The folder is a path string the app stores; this build has no native
 * folder picker route, so the field takes the path and offers a copy action for the data location.
 */
function BackupForm({ settings }: { settings: BackupSettings }) {
  const action = useAction()
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard refused: the path stays visible above, so nothing is lost.
    }
  }

  return (
    <Panel tone="flat">
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          const done = await action.run(() =>
            api.saveBackupSettings({
              folder: String(form.get('folder') ?? ''),
              keepLastN: Number(form.get('keepLastN')),
              maxAgeDays: Number(form.get('maxAgeDays')),
              dataLocation: settings.dataLocation,
            }),
          )
          if (done) {
            setSaved(true)
            window.setTimeout(() => setSaved(false), 4000)
          }
        }}
      >
        <Block title="Lokasi dan retensi">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Folder backup" error={action.fieldErrors.folder} className="md:col-span-2">
              {({ id, describedBy, invalid }) => (
                <input id={id} name="folder" defaultValue={settings.folder} aria-describedby={describedBy} className={controlClass(invalid)} />
              )}
            </Field>
            <Field label="Simpan N backup terakhir" hint="Backup manual tidak pernah dihapus otomatis." error={action.fieldErrors.keepLastN}>
              {({ id, invalid }) => (
                <input id={id} name="keepLastN" type="number" min={1} defaultValue={settings.keepLastN} className={controlClass(invalid)} />
              )}
            </Field>
            <Field label="Umur maksimum (hari)" error={action.fieldErrors.maxAgeDays}>
              {({ id, invalid }) => (
                <input id={id} name="maxAgeDays" type="number" min={1} defaultValue={settings.maxAgeDays} className={controlClass(invalid)} />
              )}
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button type="submit" disabled={action.busy}>
              {action.busy ? 'Menyimpan…' : 'Simpan pengaturan'}
            </Button>
            {saved ? (
              <span role="status" className="inline-flex items-center gap-1 text-sm font-medium text-success">
                <IconCheck size={15} /> Tersimpan
              </span>
            ) : null}
          </div>
          {action.failure ? (
            <Notice tone="danger" className="mt-3">
              {actionMessage(action.failure)}
            </Notice>
          ) : null}
        </Block>

        <div className="border-t border-border pt-4">
          <p className="text-sm text-muted">Lokasi data aplikasi</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-[10px] bg-surface-muted px-3 py-2 text-sm">{settings.dataLocation}</code>
            <Button size="sm" variant="secondary" type="button" onClick={() => void copy(settings.dataLocation)}>
              {copied ? 'Tersalin' : 'Salin'}
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted">Kunci API tidak disertakan dalam backup.</p>
        </div>
      </form>
    </Panel>
  )
}

/* ── Manual backup ───────────────────────────────────────────────────────────────────── */

/** "Backup sekarang", with the running state the spec words as "Backup sedang berjalan". */
function ManualBackup({ onDone }: { onDone: () => void }) {
  const action = useAction()
  return (
    <Button
      disabled={action.busy}
      onClick={async () => {
        const done = await action.run(() => api.runBackup())
        if (done) onDone()
      }}
    >
      <IconClock size={17} />
      {action.busy ? 'Backup sedang berjalan' : 'Backup sekarang'}
    </Button>
  )
}

/* ── Restore wizard ──────────────────────────────────────────────────────────────────── */

type Step = 'archive' | 'checked' | 'done'

/**
 * Choose archive → compatibility check → preview → confirm → restore. The check is a read-only
 * route; it never writes. A failed check blocks the confirm step and names the failing check.
 */
function RestoreWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const action = useAction()
  const [step, setStep] = useState<Step>('archive')
  const [path, setPath] = useState('')
  const [check, setCheck] = useState<RestoreValidation | null>(null)

  function reset() {
    setStep('archive')
    setPath('')
    setCheck(null)
    action.clear()
  }

  return (
    <Dialog
      open={open}
      title="Pulihkan dari backup"
      onClose={() => {
        reset()
        onClose()
      }}
      footer={
        step === 'archive' ? (
          <>
            <Button variant="quiet" onClick={() => { reset(); onClose() }}>Batal</Button>
            <Button
              disabled={action.busy || path.trim() === ''}
              reason={path.trim() === '' ? 'Isi lokasi berkas arsip.' : undefined}
              onClick={async () => {
                const result = await action.run(() => api.validateRestore(path.trim()))
                setCheck(result)
                if (result) setStep('checked')
              }}
            >
              {action.busy ? 'Memeriksa…' : 'Periksa arsip'}
            </Button>
          </>
        ) : step === 'checked' ? (
          <>
            <Button variant="quiet" onClick={() => setStep('archive')}>Ganti arsip</Button>
            <Button
              variant="danger"
              disabled={!check?.compatible || action.busy}
              reason={check && !check.compatible ? 'Arsip tidak kompatibel.' : undefined}
              onClick={async () => {
                const done = await action.run(() => api.restore(path.trim()))
                if (done) setStep('done')
              }}
            >
              {action.busy ? 'Memulihkan…' : 'Pulihkan dan ganti data'}
            </Button>
          </>
        ) : (
          <Button onClick={() => { reset(); onClose() }}>Tutup</Button>
        )
      }
    >
      {step === 'archive' ? (
        <>
          <Field label="Berkas arsip" hint="Lokasi berkas backup di perangkat ini.">
            {({ id, describedBy }) => (
              <input id={id} value={path} onChange={(e) => setPath(e.target.value)} aria-describedby={describedBy} className={controlClass()} />
            )}
          </Field>
          <Notice tone="info" className="mt-3">
            Pemeriksaan hanya membaca arsip; belum ada data yang diubah.
          </Notice>
        </>
      ) : null}

      {step === 'checked' && check ? (
        <div className="space-y-3">
          <p className="text-md">
            Versi skema arsip: <span className="tabular-nums font-semibold">{check.schemaVersion}</span>
          </p>
          <ul className="space-y-1.5">
            {check.checks.map((c) => (
              <li key={c.name} className="flex items-start justify-between gap-3 text-md">
                <span>{c.name}</span>
                <Badge tone={c.passed ? 'success' : 'danger'}>{c.passed ? 'Lolos' : 'Gagal'}</Badge>
              </li>
            ))}
          </ul>
          {!check.compatible ? (
            <Notice tone="danger">Arsip ini tidak kompatibel. Data saat ini tidak akan diubah.</Notice>
          ) : (
            <Notice tone="warning" title="Langkah ini mengganti data">
              Semua data saat ini akan diganti dengan isi arsip. Kunci API harus diisi ulang setelah pemulihan.
            </Notice>
          )}
        </div>
      ) : null}

      {step === 'done' ? (
        <Notice tone="success" title="Pemulihan dimulai">
          Data sedang dipulihkan di latar belakang. Setelah selesai, isi ulang kunci API di{' '}
          <Link to="/lainnya/ai" className="font-semibold underline">
            Pengaturan AI
          </Link>
          .
        </Notice>
      ) : null}

      {action.failure ? (
        <Notice tone="danger" className="mt-3">
          {actionMessage(action.failure)}
        </Notice>
      ) : null}
    </Dialog>
  )
}
