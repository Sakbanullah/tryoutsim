import { useCallback, useState } from 'react'
import { api, toOutcome } from '../../data'
import type { ModelCapabilities, ProviderView } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { useApi } from '../shared/useApi'
import { actionMessage, useAction } from '../shared/useAction'
import { Badge, Button, Dialog, Field, Notice, Panel, Skeleton, controlClass } from '../../ui/ui'
import { Block, PageHeader } from '../../ui/page'
import { BackLink } from '../../shell/Layout'
import { useFlash } from '../../state/shell'
import { IconAlert, IconCheck, IconPlug, IconRefresh, IconSparkle } from '../../ui/icons'
import { providerTestText } from './providerTestText'

/**
 * Pengaturan AI (`/lainnya/ai`) — PAGE_SPECIFICATIONS §15.
 * Providers with their endpoint, connection status and model list, the capability flags with their
 * source (`otomatis` / `diatur manual`), and the connection test. The key is write-only: the create
 * form takes it, the card only ever renders `keyLast4`. Token counts, cost and price are never shown.
 */

const PRESETS = [
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { id: 'openai_compatible', label: 'OpenAI-compatible', baseUrl: 'https://api.openai.com/v1' },
  { id: 'ollama', label: 'Ollama', baseUrl: 'http://127.0.0.1:11434/v1' },
  { id: 'custom', label: 'Custom', baseUrl: '' },
] as const

export default function AiSettings() {
  const providers = useApi<ProviderView[]>(() => api.providers(), [])
  const [creating, setCreating] = useState(false)
  const reload = () => providers.retry()

  /**
   * Remove one provider from the loaded list after the server confirmed its deletion. Only that row goes, so the
   * other cards keep their own state; no refetch is needed because `DELETE` returns 204.
   */
  const removeRow = useCallback(
    (id: string) => {
      if (providers.state.phase !== 'done' || providers.state.outcome.kind !== 'ok') return
      providers.setData(providers.state.outcome.data.filter((p) => p.id !== id))
    },
    [providers],
  )

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

      <div className="space-y-6">
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
                rows.map((p) => <ProviderCard key={p.id} provider={p} onChanged={reload} onDeleted={removeRow} />)
              )
            }
          </OutcomeView>
        </section>
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

function ProviderCard({
  provider,
  onChanged,
  onDeleted,
}: {
  provider: ProviderView
  onChanged: () => void
  onDeleted: (id: string) => void
}) {
  const [config, setConfig] = useState({ baseUrl: provider.baseUrl, timeoutMs: provider.timeoutMs, defaultModel: provider.defaultModel ?? '' })
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null)
  const action = useAction()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const flash = useFlash()
  const dirty =
    config.baseUrl !== provider.baseUrl || config.timeoutMs !== provider.timeoutMs || config.defaultModel !== (provider.defaultModel ?? '')
  /** What goes to PATCH: the model only when it is typed, so an empty field is never written as a model. */
  const patch: { baseUrl: string; timeoutMs: number; defaultModel?: string } = { baseUrl: config.baseUrl, timeoutMs: config.timeoutMs }
  if (config.defaultModel.trim() !== '') patch.defaultModel = config.defaultModel.trim()

  /**
   * Delete this provider. `DELETE` answers 204 (no body), so the outcome is the confirmation; only then does the row
   * leave the list. A second click is refused while one is in flight, and a failed delete keeps the row and says why.
   */
  async function removeProvider() {
    if (deleting) return
    setDeleting(true)
    setDeleteError(null)
    const res = await api.deleteProvider(provider.id)
    setDeleting(false)
    if (!res.ok) {
      setDeleteError(actionMessage(toOutcome(res.failure)))
      return
    }
    setConfirmDelete(false)
    onDeleted(provider.id)
    flash({ kind: 'info', text: `Penyedia ${provider.name} dihapus.` })
  }

  /** Test the stored configuration. The key and the model come from the row, never from this form. */
  async function runTest() {
    const res = await action.run(() => api.testProvider(provider.id))
    if (res) setTest(providerTestText(res))
  }

  /** Save the edited endpoint settings; a key is never part of this patch. */
  async function saveConfig() {
    const done = await action.run(() => api.updateProvider(provider.id, patch))
    if (done) {
      setTest(null)
      onChanged()
    }
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

      <form
        className="mt-3 grid gap-2 text-sm sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          void saveConfig()
        }}
      >
        <Field label="Alamat" error={action.fieldErrors.baseUrl} className="sm:col-span-2">
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="url"
              required
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              aria-describedby={describedBy}
              className={`${controlClass(invalid)} font-medium`}
            />
          )}
        </Field>
        <Field label="Batas waktu (ms)" error={action.fieldErrors.timeoutMs}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="number"
              min={1000}
              required
              value={config.timeoutMs}
              onChange={(e) => setConfig({ ...config, timeoutMs: Number(e.target.value) })}
              aria-describedby={describedBy}
              className={`${controlClass(invalid)} tabular-nums font-medium`}
            />
          )}
        </Field>
        <Field
          label="Model default"
          error={action.fieldErrors.defaultModel}
          className="sm:col-span-2"
          hint="Dipakai uji koneksi dan routing. Menyimpan model lain membatalkan status teruji, jadi uji lagi setelahnya."
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="text"
              value={config.defaultModel}
              onChange={(e) => setConfig({ ...config, defaultModel: e.target.value })}
              aria-describedby={describedBy}
              placeholder="Ketik model id, atau pilih dari daftar di bawah"
              className={`${controlClass(invalid)} font-medium`}
            />
          )}
        </Field>
        <div className="rounded-[10px] bg-surface-muted px-3 py-2">
          <dt className="text-muted">Ulangan</dt>
          <dd className="tabular-nums font-medium">{provider.retries}</dd>
          <p className="text-sm text-muted">Penyimpanan ulangan belum tersedia; nilainya dari bawaan sistem.</p>
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="secondary" size="sm" disabled={action.busy || !dirty}>
            Simpan perubahan
          </Button>
        </div>
      </form>

      <div className="mt-4">
        <Button type="button" variant="secondary" size="sm" onClick={() => void runTest()} disabled={action.busy}>
          {action.busy ? 'Menguji…' : 'Uji koneksi'}
        </Button>
        {dirty ? (
          <span className="ml-2 text-sm text-muted">Pengaturan yang belum disimpan tidak ikut diuji.</span>
        ) : null}
      </div>
      {test ? (
        <p role="status" className={test.ok ? 'mt-2 text-sm font-medium text-success' : 'mt-2 text-sm font-medium text-danger'}>
          {test.text}
        </p>
      ) : null}
      {action.failure ? (
        <Notice tone="danger" className="mt-3">
          {actionMessage(action.failure)}
        </Notice>
      ) : null}

      <ProviderModels provider={provider} onChanged={onChanged} />

      {provider.capabilities ? <CapabilityEditor provider={provider} onSaved={onChanged} /> : null}

      <Dialog
        open={confirmDelete}
        title="Hapus penyedia?"
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Batal
            </Button>
            <Button variant="danger" disabled={deleting} onClick={() => void removeProvider()}>
              {deleting ? 'Menghapus…' : 'Ya, hapus'}
            </Button>
          </>
        }
      >
        <p>Provider ini akan dihapus dari pengaturan. Kunci yang tersimpan ikut dihapus dan tidak bisa dipulihkan.</p>
        {deleteError ? (
          <Notice tone="danger" className="mt-3" title="Penyedia belum terhapus">
            {deleteError}
          </Notice>
        ) : null}
      </Dialog>
    </Panel>
  )
}

/**
 * A provider's models, inside its own card. `POST /providers/:id/models` asks the endpoint
 * (`GET /v1/models` for OpenAI-compatible providers) and stores the answer on the provider row, so the
 * rows survive a reload; they are always the endpoint's answer, never a static list.
 */
function ProviderModels({ provider, onChanged }: { provider: ProviderView; onChanged: () => void }) {
  const action = useAction()
  const [savingModel, setSavingModel] = useState<string | null>(null)
  const models = provider.models ?? []

  /**
   * Make a listed model the provider's default (AI_PROVIDER_ARCHITECTURE §5: the list is a picker, the typed id stays
   * available). The route clears the recorded test on a model change, so the card reloads and a new test is due.
   */
  async function makeDefault(modelId: string) {
    setSavingModel(modelId)
    const res = await action.run(() => api.updateProvider(provider.id, { defaultModel: modelId }))
    setSavingModel(null)
    if (res !== null) onChanged()
  }

  /** Ask the endpoint for its model list. An empty answer is a real empty list, never a fallback. */
  async function load() {
    const res = await action.run(() => api.refreshModels(provider.id))
    if (res === null) return
    onChanged()
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <Block title="Models" hint={`Daftar dari ${provider.baseUrl}/models.`}>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={action.busy}>
            <IconSparkle size={15} />
            {action.busy ? 'Memuat…' : 'Muat daftar model'}
          </Button>
          <span className="text-sm text-muted tabular-nums">{models.length} model</span>
        </div>

        <div className="mt-3" aria-live="polite">
          {action.busy ? <Skeleton lines={3} /> : null}
          {action.failure ? (
            <Notice tone="danger" title="Gagal memuat daftar model">
              {actionMessage(action.failure)}
            </Notice>
          ) : null}
          {!action.busy && !action.failure ? (
            models.length > 0 ? (
              <ul aria-label={`Model ${provider.name}`} className="divide-y divide-border rounded-[12px] border border-border">
                {models.map((m) => (
                  <li key={`${provider.id}:${m}`} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="block min-w-0 truncate text-md font-medium" title={m}>
                      {m}
                    </span>
                    {m === provider.defaultModel ? (
                      <Badge tone="success">Default</Badge>
                    ) : (
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => void makeDefault(m)}
                        disabled={action.busy || savingModel !== null}
                      >
                        Jadikan default
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                {provider.models ? 'Endpoint tidak mengembalikan model.' : 'Daftar model belum dimuat.'}
              </p>
            )
          ) : null}
        </div>
      </Block>
    </div>
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
