import { useState } from 'react'
import { api } from '../../data'
import type { AiRouting, ModelCapabilities, ProviderView, TaskId, TaskMapEntry } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { actionMessage, useAction } from '../shared/useAction'
import { Badge, Button, Dialog, Field, Notice, Panel, controlClass } from '../../ui/ui'
import { Block, PageHeader } from '../../ui/page'
import { BackLink } from '../../shell/Layout'
import { IconAlert, IconCheck, IconPlug, IconRefresh, IconSparkle } from '../../ui/icons'

/**
 * Pengaturan AI (`/lainnya/ai`) — PAGE_SPECIFICATIONS §15.
 * Providers, one global default, four per-feature overrides, capability flags with their source
 * (`otomatis` / `diatur manual`), and the connection test. The key is write-only: the create form
 * takes it, the list only ever renders `keyLast4`. Token counts, cost and price are never shown.
 */

const TASKS: Array<{ id: TaskId; label: string }> = [
  { id: 'question', label: 'Soal' },
  { id: 'explanation', label: 'Penjelasan' },
  { id: 'material', label: 'Materi' },
  { id: 'analysis', label: 'Analisis' },
]

const PRESETS = [
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { id: 'openai_compatible', label: 'OpenAI-compatible', baseUrl: 'https://api.openai.com/v1' },
  { id: 'ollama', label: 'Ollama', baseUrl: 'http://127.0.0.1:11434/v1' },
  { id: 'custom', label: 'Custom', baseUrl: '' },
] as const

export default function AiSettings() {
  const providers = useApi<ProviderView[]>(() => api.providers(), [])
  const routing = useApi<AiRouting>(() => api.routing(), [])
  const [creating, setCreating] = useState(false)
  const reload = () => {
    providers.retry()
    routing.retry()
  }

  return (
    <div className="animate-rise space-y-6">
      <BackLink to="/lainnya">Lainnya</BackLink>
      <PageHeader
        eyebrow="Koneksi AI"
        title="Pengaturan AI"
        lead="Penyedia model dipakai untuk membuat soal, penjelasan, materi, dan analisis. Kunci disimpan oleh sistem operasi dan tidak pernah ditampilkan."
        actions={
          <>
            <Button variant="secondary" onClick={reload}>
              <IconRefresh size={17} />
              Muat ulang
            </Button>
            <Button onClick={() => setCreating(true)}>
              <IconPlugin />
              Tambah penyedia
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
        <section aria-labelledby="providers-title" className="space-y-4">
          <h2 id="providers-title" className="text-xl">
            Penyedia
          </h2>
          <OutcomeView state={providers.state} retry={providers.retry} loadingLines={3}>
            {(rows) =>
              rows.length === 0 ? (
                <Notice tone="lavender" title="Belum ada penyedia">
                  Tambahkan penyedia model sebelum membuat soal dengan AI.
                </Notice>
              ) : (
                rows.map((p) => <ProviderCard key={p.id} provider={p} onChanged={reload} />)
              )
            }
          </OutcomeView>
        </section>

        <Panel tone="muted" className="p-6">
          <OutcomeView state={routing.state} retry={routing.retry} loadingLines={3}>
            {(r) => (
              <RoutingPanel
                key={routingKey(r)}
                routing={r}
                providers={providers.state.phase === 'done' && providers.state.outcome.kind === 'ok' ? providers.state.outcome.data : []}
              />
            )}
          </OutcomeView>
        </Panel>
      </div>

      <CreateProviderDialog open={creating} onClose={() => setCreating(false)} onCreated={reload} />
    </div>
  )
}

/** The plus glyph drawn locally: the icon set has no plus and a one-off import would break the family. */
function IconPlugin() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden focusable="false">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/* ── One provider ─────────────────────────────────────────────────────────────────────── */

function ProviderCard({ provider, onChanged }: { provider: ProviderView; onChanged: () => void }) {
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null)
  const [models, setModels] = useState<string[] | null>(null)
  const action = useAction()
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function runTest() {
    const res = await action.run(() => api.testProvider(provider.id))
    if (res) setTest({ ok: res.ok, text: res.ok ? `Terhubung (${res.latencyMs} ms). Kemampuan model diperiksa.` : 'Penyedia menjawab, tetapi menolak permintaan percobaan.' })
  }

  async function loadModels() {
    const res = await action.run(() => api.refreshModels(provider.id))
    if (res) setModels(res)
  }

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-lg">
          <IconPlug size={18} className="text-primary-ink" />
          {provider.name}
        </h2>
        <div className="flex items-center gap-2">
          <Badge tone={provider.hasKey ? 'success' : 'warning'} icon={provider.hasKey ? <IconCheck size={12} /> : undefined}>
            {provider.hasKey ? `Kunci ••••${provider.keyLast4 ?? '····'}` : 'Belum ada kunci'}
          </Badge>
          <Button
            size="sm"
            variant="quiet"
            disabled={action.busy}
            onClick={() => setConfirmDelete(true)}
          >
            <IconAlert size={15} />
            Hapus
          </Button>
        </div>
      </div>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-[10px] bg-surface-muted px-3 py-2 sm:col-span-2">
          <dt className="text-muted">Alamat</dt>
          <dd className="truncate font-medium" title={provider.baseUrl}>
            {provider.baseUrl}
          </dd>
        </div>
        <div className="rounded-[10px] bg-surface-muted px-3 py-2">
          <dt className="text-muted">Batas waktu</dt>
          <dd className="tabular-nums font-medium">
            {provider.timeoutMs} ms · {provider.retries} ulangan
          </dd>
        </div>
        <div className="rounded-[10px] bg-surface-muted px-3 py-2">
          <dt className="text-muted">Dibuat</dt>
          <dd className="font-medium">{provider.createdAt.slice(0, 10)}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => void runTest()} disabled={action.busy}>
          {action.busy ? 'Menguji…' : 'Uji koneksi'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => void loadModels()} disabled={action.busy}>
          <IconSparkle size={15} />
          Muat daftar model
        </Button>
      </div>
      {test ? (
        <p role="status" className={test.ok ? 'mt-2 text-sm font-medium text-success' : 'mt-2 text-sm font-medium text-danger'}>
          {test.text}
        </p>
      ) : null}
      {models ? (
        <div className="mt-3">
          <p className="text-sm font-medium">Model tersedia</p>
          {models.length === 0 ? (
            <p className="text-sm text-muted">Daftar model kosong. Nama model bisa diisi manual di bawah.</p>
          ) : (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {models.map((m) => (
                <li key={m}>
                  <Badge tone="neutral">{m}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {action.failure ? (
        <Notice tone="danger" className="mt-3">
          {actionMessage(action.failure)}
        </Notice>
      ) : null}

      {provider.capabilities ? <CapabilityEditor provider={provider} onSaved={onChanged} /> : null}

      <Dialog
        open={confirmDelete}
        title="Hapus penyedia?"
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirmDelete(false)}>
              Batal
            </Button>
            <Button
              variant="danger"
              disabled={action.busy}
              onClick={async () => {
                const done = await action.run(() => api.deleteProvider(provider.id))
                if (done !== null) {
                  setConfirmDelete(false)
                  onChanged()
                }
              }}
            >
              Ya, hapus
            </Button>
          </>
        }
      >
        <p>Provider ini akan dihapus dari pengaturan. Kunci yang tersimpan ikut dihapus dan tidak bisa dipulihkan.</p>
      </Dialog>
    </Panel>
  )
}

/** Capability flags; each states where its value came from, and editing makes it `diatur manual`. */
function CapabilityEditor({ provider, onSaved }: { provider: ProviderView; onSaved: () => void }) {
  const caps = provider.capabilities!
  const action = useAction()
  const [draft, setDraft] = useState<ModelCapabilities>(caps)

  const sourceWord = (s: 'detected' | 'manual') => (s === 'detected' ? 'otomatis' : 'diatur manual')

  return (
    <form
      className="mt-4 border-t border-border pt-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const done = await action.run(() => api.saveCapabilities(provider.id, draft))
        if (done) onSaved()
      }}
    >
      <Block title="Kemampuan model">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="inline-flex min-h-9 items-center gap-2 text-md">
            <input
              type="checkbox"
              checked={draft.jsonMode.value}
              onChange={(e) => setDraft({ ...draft, jsonMode: { value: e.target.checked, source: 'manual' } })}
            />
            JSON mode
            <span className="text-sm text-muted">({sourceWord(draft.jsonMode.source)})</span>
          </label>
          <label className="inline-flex min-h-9 items-center gap-2 text-md">
            <input
              type="checkbox"
              checked={draft.streaming.value}
              onChange={(e) => setDraft({ ...draft, streaming: { value: e.target.checked, source: 'manual' } })}
            />
            Streaming
            <span className="text-sm text-muted">({sourceWord(draft.streaming.source)})</span>
          </label>
          <div className="sm:col-span-2">
            <Field label="Konteks maksimum (token)">
              {(ids) => (
                <input
                  id={ids.id}
                  type="number"
                  min={0}
                  value={draft.maxContext.value ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      maxContext: { value: e.target.value === '' ? null : Number(e.target.value), source: 'manual' },
                    })
                  }
                  className={`${controlClass()} min-h-10 tabular-nums`}
                />
              )}
            </Field>
          </div>
        </div>
        <Button className="mt-3" size="sm" type="submit" variant="secondary" disabled={action.busy}>
          Simpan kemampuan
        </Button>
        {action.failure ? (
          <Notice tone="danger" className="mt-3">
            {actionMessage(action.failure)}
          </Notice>
        ) : null}
      </Block>
    </form>
  )
}

/* ── Global default and per-task routing ─────────────────────────────────────────────── */

/**
 * One global default, then the four overrides. Saving sends the whole map through
 * `PUT /ai-routing`; a task left on "Ikut default" is stored with nulls, which is what the route
 * means by no override.
 */
/** Re-keys the panel when the stored routing changes, so re-opening the screen shows saved values. */
const routingKey = (r: AiRouting) => `${r.default.providerId ?? ''}:${r.default.modelId ?? ''}:${r.perTask.map((t) => `${t.task}=${t.modelId ?? ''}`).join('|')}`

/** Routes the per-task map: "Ikut default" stores nulls, the explicit pair stores the provider + model. */
function RoutingPanel({ routing, providers }: { routing: AiRouting; providers: ProviderView[] }) {
  const action = useAction()
  const [draft, setDraft] = useState<AiRouting>(routing)
  const [saved, setSaved] = useState(false)

  const pair = (t: TaskMapEntry) =>
    t.providerId && t.modelId ? `${providers.find((p) => p.id === t.providerId)?.name ?? t.providerId} · ${t.modelId}` : 'Ikut default'

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        const done = await action.run(() => api.saveRouting(draft))
        if (done) {
          setSaved(true)
          window.setTimeout(() => setSaved(false), 4000)
        }
      }}
    >
      <Block title="Default global">
        <p className="text-sm text-muted">Dipakai untuk semua fitur kecuali yang diatur khusus.</p>
        <div className="mt-2 grid gap-2">
          <Field label="Penyedia">
            {(ids) => (
              <select
                id={ids.id}
                value={draft.default.providerId ?? ''}
                onChange={(e) => setDraft({ ...draft, default: { ...draft.default, providerId: e.target.value || null, modelId: null } })}
                className={`${controlClass()} min-h-10`}
              >
                <option value="">Belum diatur</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Model">
            {(ids) => (
              <input
                id={ids.id}
                value={draft.default.modelId ?? ''}
                onChange={(e) => setDraft({ ...draft, default: { ...draft.default, modelId: e.target.value || null } })}
                placeholder="nama model"
                className={`${controlClass()} min-h-10`}
              />
            )}
          </Field>
        </div>
      </Block>

      <div className="mt-5 border-t border-border pt-4">
        <Block title="Per fitur">
          <ul className="space-y-2">
            {TASKS.map((t) => {
              const entry = draft.perTask.find((x) => x.task === t.id) ?? { task: t.id, providerId: null, modelId: null }
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 text-md">
                  <span>{t.label}</span>
                  <span className="flex items-center gap-2">
                    <span className={entry.modelId ? 'font-medium' : 'text-muted'}>{pair(entry)}</span>
                    <Button
                      size="sm"
                      variant="quiet"
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          perTask: TASKS.map((x) => {
                            const current = x.id === t.id ? (entry.modelId ? { task: x.id, providerId: null, modelId: null } : { task: x.id, providerId: draft.default.providerId, modelId: draft.default.modelId }) : draft.perTask.find((y) => y.task === x.id) ?? { task: x.id, providerId: null, modelId: null }
                            return current
                          }),
                        })
                      }
                    >
                      {entry.modelId ? 'Ikut default' : 'Pakai default'}
                    </Button>
                  </span>
                </li>
              )
            })}
          </ul>
        </Block>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={action.busy}>
          {action.busy ? 'Menyimpan…' : 'Simpan'}
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
    </form>
  )
}

/* ── Create provider ─────────────────────────────────────────────────────────────────── */

/**
 * The create form of the documented body: preset (which prefills the base URL), a write-only key,
 * timeout and retries. The key input is `type=password`, never echoed back, and cleared on success.
 */
function CreateProviderDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const action = useAction()
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>('openrouter')
  const [baseUrl, setBaseUrl] = useState<string>(PRESETS[0].baseUrl)

  return (
    <Dialog
      open={open}
      title="Tambah penyedia"
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="provider-form" disabled={action.busy}>
            {action.busy ? 'Menyimpan…' : 'Simpan penyedia'}
          </Button>
        </>
      }
    >
      <form
        id="provider-form"
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          const created = await action.run(() =>
            api.createProvider({
              preset,
              name: String(form.get('name') ?? '').trim(),
              baseUrl,
              key: String(form.get('key') ?? ''),
              timeoutMs: Number(form.get('timeoutMs')),
              retries: Number(form.get('retries')),
            }),
          )
          if (created) {
            onClose()
            onCreated()
          }
        }}
      >
        <Field label="Jenis penyedia">
          {({ id }) => (
            <select
              id={id}
              value={preset}
              onChange={(e) => {
                const next = PRESETS.find((p) => p.id === e.target.value)!
                setPreset(next.id)
                setBaseUrl(next.baseUrl)
              }}
              className={controlClass()}
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Nama" error={action.fieldErrors.name}>
          {({ id, describedBy, invalid }) => (
            <input id={id} name="name" required aria-describedby={describedBy} className={controlClass(invalid)} />
          )}
        </Field>
        <Field label="Alamat dasar" error={action.fieldErrors.baseUrl}>
          {({ id, describedBy, invalid }) => (
            <input id={id} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required aria-describedby={describedBy} className={controlClass(invalid)} />
          )}
        </Field>
        <Field label="Kunci API" hint="Disimpan oleh sistem operasi. Tidak pernah ditampilkan lagi setelah disimpan." error={action.fieldErrors.key}>
          {({ id, describedBy, invalid }) => (
            <input id={id} name="key" type="password" autoComplete="off" required aria-describedby={describedBy} className={controlClass(invalid)} />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Batas waktu (ms)" error={action.fieldErrors.timeoutMs}>
            {({ id, invalid }) => <input id={id} name="timeoutMs" type="number" min={1000} defaultValue={30000} className={`${controlClass(invalid)} tabular-nums`} />}
          </Field>
          <Field label="Ulangan" error={action.fieldErrors.retries}>
            {({ id, invalid }) => <input id={id} name="retries" type="number" min={0} max={5} defaultValue={2} className={`${controlClass(invalid)} tabular-nums`} />}
          </Field>
        </div>
        {action.failure ? <Notice tone="danger">{actionMessage(action.failure)}</Notice> : null}
      </form>
    </Dialog>
  )
}
