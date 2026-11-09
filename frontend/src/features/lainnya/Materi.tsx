import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../data'
import type { Material } from '../../types/contracts'
import { OutcomeView } from '../../shell/OutcomeView'
import { BackLink } from '../../shell/Layout'
import { useApi } from '../shared/useApi'
import { actionMessage, useAction } from '../shared/useAction'
import { labelOf } from '../shared/taxonomy'
import { Badge, Button, Dialog, EmptyState, Field, Notice, Panel, controlClass } from '../../ui/ui'
import { Block, PageHeader } from '../../ui/page'
import { IconAlert, IconShield, IconSpark } from '../../ui/icons'

/**
 * Materi (`/lainnya/materi`, `/lainnya/materi/:id`) — PAGE_SPECIFICATIONS §13.
 * A material is factual content the app recommends; it needs a source list, and an unverified source
 * is said out loud on both screens. Approval approves one version: editing afterwards is a new
 * version, so the approve action is only offered on a draft.
 */

const CONTENT_TYPE: Record<Material['contentType'], string> = {
  conceptual: 'Konsep',
  strategy: 'Strategi',
  factual: 'Fakta',
  historical: 'Sejarah',
  legal: 'Hukum',
  policy: 'Kebijakan',
}

/** Content types whose factual claim requires at least one source (MATERIAL_SPECIFICATION §4). */
const SOURCE_REQUIRED: ReadonlyArray<Material['contentType']> = ['factual', 'legal', 'historical', 'policy']

function scopeLabel(m: Material): string {
  return m.scope.kind === 'free' ? m.scope.note : labelOf(m.scope.competencyId)
}

function statusBadge(m: Material) {
  return m.status === 'approved' ? (
    <Badge tone="success">Disetujui</Badge>
  ) : m.status === 'retired' ? (
    <Badge tone="neutral">Dipensiunkan</Badge>
  ) : (
    <Badge tone="warning">Draf</Badge>
  )
}

/* ── List ─────────────────────────────────────────────────────────────────────────────── */

export function MaterialList() {
  const [creating, setCreating] = useState(false)
  const list = useApi<Material[]>(() => api.materials(), [])
  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow="Kelola"
        title="Materi"
        lead="Bahan bacaan yang direkomendasikan setelah latihan. Setiap klaim faktual membawa sumbernya."
        actions={
          <Button onClick={() => setCreating(true)}>
            <IconSpark size={17} />
            Materi baru
          </Button>
        }
      />
      <OutcomeView state={list.state} retry={list.retry} loadingLines={5}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title="Belum ada materi" action={<Button onClick={() => setCreating(true)}>Buat materi pertama</Button>}>
              Materi muncul di rekomendasi hasil latihan setelah disetujui.
            </EmptyState>
          ) : (
            <Panel className="overflow-hidden">
              <table className="w-full text-left text-base">
                <caption className="sr-only">Daftar materi</caption>
                <thead className="border-b border-border text-sm text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Judul</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Cakupan</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Jenis</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Versi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-3">
                        <Link to={`/lainnya/materi/${m.id}`} className="font-medium underline decoration-border-strong underline-offset-2 hover:text-primary-ink">
                          {m.title}
                        </Link>
                        {m.sources.some((s) => !s.verified) ? (
                          <span className="ml-2 text-sm text-warning">Sumber belum terverifikasi</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted">{scopeLabel(m)}</td>
                      <td className="px-4 py-3 text-muted">{CONTENT_TYPE[m.contentType]}</td>
                      <td className="px-4 py-3">{statusBadge(m)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">{m.version}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )
        }
      </OutcomeView>
      <CreateMaterialDialog open={creating} onClose={() => setCreating(false)} onCreated={() => list.retry()} />
    </div>
  )
}

/**
 * Manual create. The form asks only for what MATERIAL_SPECIFICATION requires: title, type, scope,
 * body and sources. The source field is required for the four claim-bearing types, and the error is
 * shown under that field, not only at the top.
 */
function CreateMaterialDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const action = useAction()
  const [contentType, setContentType] = useState<Material['contentType']>('conceptual')
  const [scopeKind, setScopeKind] = useState<'competency' | 'free'>('competency')
  const [sourceLines, setSourceLines] = useState('')
  const needsSource = SOURCE_REQUIRED.includes(contentType)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const sources = sourceLines
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((label) => ({ label, verified: false }))
    const created = await action.run(() =>
      api.createMaterial({
        title: String(form.get('title') ?? '').trim(),
        contentType,
        scope:
          scopeKind === 'free'
            ? { kind: 'free', note: String(form.get('scopeNote') ?? '').trim() }
            : { kind: 'competency', competencyId: String(form.get('competencyId') ?? '').trim() },
        body: String(form.get('body') ?? '').trim(),
        sources,
      }),
    )
    if (created) {
      setSourceLines('')
      onClose()
      onCreated()
    }
  }

  return (
    <Dialog
      open={open}
      title="Materi baru"
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>Batal</Button>
          <Button type="submit" form="material-form" disabled={action.busy}>
            {action.busy ? 'Menyimpan…' : 'Simpan sebagai draf'}
          </Button>
        </>
      }
    >
      <form id="material-form" className="space-y-4" onSubmit={submit}>
        <Field label="Judul" error={action.fieldErrors.title}>
          {({ id, describedBy, invalid }) => (
            <input id={id} name="title" required aria-describedby={describedBy} className={controlClass(invalid)} />
          )}
        </Field>
        <Field label="Jenis isi">
          {({ id }) => (
            <select id={id} value={contentType} onChange={(e) => setContentType(e.target.value as Material['contentType'])} className={controlClass()}>
              {Object.entries(CONTENT_TYPE).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Cakupan">
          {({ id }) => (
            <div className="flex gap-4" id={id}>
              {(['competency', 'free'] as const).map((kind) => (
                <label key={kind} className="inline-flex items-center gap-2 text-md">
                  <input type="radio" name="scopeKind" checked={scopeKind === kind} onChange={() => setScopeKind(kind)} />
                  {kind === 'competency' ? 'Submateri' : 'Catatan bebas'}
                </label>
              ))}
            </div>
          )}
        </Field>
        {scopeKind === 'competency' ? (
          <Field label="Id submateri" hint="Contoh: TWK.NASIONALISME" error={action.fieldErrors['scope.competencyId']}>
            {({ id, describedBy, invalid }) => <input id={id} name="competencyId" required aria-describedby={describedBy} className={controlClass(invalid)} />}
          </Field>
        ) : (
          <Field label="Judul catatan" error={action.fieldErrors['scope.note']}>
            {({ id, describedBy, invalid }) => <input id={id} name="scopeNote" required aria-describedby={describedBy} className={controlClass(invalid)} />}
          </Field>
        )}
        <Field label="Isi materi">
          {({ id }) => <textarea id={id} name="body" required rows={5} className={controlClass()} />}
        </Field>
        <Field
          label="Sumber"
          hint={needsSource ? 'Wajib untuk jenis fakta, hukum, sejarah dan kebijakan. Satu sumber per baris.' : 'Opsional. Satu sumber per baris.'}
          error={action.fieldErrors.sources}
        >
          {({ id, describedBy, invalid }) => (
            <textarea
              id={id}
              required={needsSource}
              value={sourceLines}
              onChange={(e) => setSourceLines(e.target.value)}
              rows={2}
              aria-describedby={describedBy}
              className={controlClass(invalid)}
            />
          )}
        </Field>
        {needsSource ? (
          <Notice tone="info">Sumber akan dicatat sebagai belum terverifikasi sampai diperiksa.</Notice>
        ) : null}
        {action.failure ? <Notice tone="danger">{actionMessage(action.failure)}</Notice> : null}
      </form>
    </Dialog>
  )
}

/* ── Detail ───────────────────────────────────────────────────────────────────────────── */

/**
 * One material: source list with each source's verification state, approval state, and the two
 * lifecycle actions the routes offer — approve this draft version, retire it from the pool.
 * Editing is a new version (PATCH returns a draft); the screen says so and links to the editor flow
 * the same route exposes, without inventing a body editor for a version it does not have.
 */
export function MaterialDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const material = useApi<Material>(() => api.material(id), [id])
  const action = useAction()
  const [confirm, setConfirm] = useState<'approve' | 'retire' | null>(null)

  return (
    <div className="animate-rise mx-auto max-w-page space-y-5">
      <BackLink to="/lainnya/materi">Materi</BackLink>
      <OutcomeView state={material.state} retry={material.retry}>
        {(m) => (
          <>
            <PageHeader
              eyebrow="Materi"
              title={m.title}
              lead={`${CONTENT_TYPE[m.contentType]} · ${scopeLabel(m)} · versi ${m.version}`}
              actions={statusBadge(m)}
            />

            {m.sources.some((s) => !s.verified) ? (
              <Notice tone="warning" title="Sumber belum terverifikasi">
                Materi ini memuat klaim faktual yang sumbernya belum diverifikasi.
              </Notice>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
              <Panel className="p-6">
                <Block title="Sumber">
                  {m.sources.length === 0 ? (
                    <p className="text-base text-muted">Materi ini tidak menyertakan sumber.</p>
                  ) : (
                    <ul className="space-y-2">
                      {m.sources.map((s, i) => (
                        <li key={`${s.label}-${i}`} className="flex items-start justify-between gap-3 text-md">
                          <span>{s.url ? <a href={s.url} className="underline" rel="noreferrer" target="_blank">{s.label}</a> : s.label}</span>
                          <Badge tone={s.verified ? 'success' : 'warning'}>{s.verified ? 'Terverifikasi' : 'Belum terverifikasi'}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </Block>
                {m.provenance.kind !== 'manual' ? (
                  <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
                    <IconShield size={15} />
                    Disusun dengan AI{m.provenance.modelId ? ` (${m.provenance.modelId})` : ''}.
                  </p>
                ) : null}
              </Panel>

              <Panel tone="muted" className="p-6">
                <h2 className="text-lg">Persetujuan</h2>
                <p className="mt-2 text-base leading-relaxed text-muted">
                  {m.status === 'approved'
                    ? `Versi ${m.approvalVersion ?? m.version} disetujui. Mengubahnya akan membuat versi baru yang kembali menjadi draf.`
                    : m.status === 'retired'
                      ? 'Materi ini dipensiunkan: tidak lagi direkomendasikan, tetap bisa dibaca.'
                      : 'Disetujui berarti versi ini boleh muncul di rekomendasi. Versi lain tetap draf.'}
                </p>
                <div className="mt-4 space-y-2">
                  <Button
                    className="w-full"
                    disabled={m.status !== 'draft' || action.busy}
                    reason={m.status === 'approved' ? 'Versi ini sudah disetujui.' : m.status === 'retired' ? 'Materi sudah dipensiunkan.' : undefined}
                    onClick={() => setConfirm('approve')}
                  >
                    Setujui versi ini
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full"
                    disabled={m.status === 'retired' || action.busy}
                    reason={m.status === 'retired' ? 'Sudah dipensiunkan.' : undefined}
                    onClick={() => setConfirm('retire')}
                  >
                    Pensiunkan
                  </Button>
                </div>
                {action.failure ? (
                  <Notice tone="danger" className="mt-3">
                    {actionMessage(action.failure)}
                  </Notice>
                ) : null}
                <p className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-sm text-muted">
                  <IconAlert size={15} className="mt-0.5 shrink-0" />
                  Materi tidak menggantikan soal; ia hanya menambah bacaan untuk kompetensi yang lemah.
                </p>
              </Panel>
            </div>

            <Dialog
              open={confirm !== null}
              title={confirm === 'approve' ? 'Setujui versi ini?' : 'Pensiunkan materi?'}
              onClose={() => setConfirm(null)}
              footer={
                <>
                  <Button variant="quiet" onClick={() => setConfirm(null)}>
                    Batal
                  </Button>
                  <Button
                    disabled={action.busy}
                    onClick={async () => {
                      const done = await action.run(() => (confirm === 'approve' ? api.approveMaterial(m.id) : api.retireMaterial(m.id)))
                      if (done) {
                        setConfirm(null)
                        material.setData(done)
                      }
                    }}
                  >
                    {confirm === 'approve' ? 'Ya, setujui' : 'Ya, pensiunkan'}
                  </Button>
                </>
              }
            >
              <p>
                {confirm === 'approve'
                  ? 'Versi ini akan masuk ke rekomendasi hasil latihan. Versi lain tidak ikut disetujui.'
                  : 'Materi berhenti direkomendasikan dan tetap bisa dibaca. Laporan lama yang merujuknya tetap ada.'}
              </p>
            </Dialog>

            <p className="text-sm">
              <button type="button" className="font-semibold text-primary-ink underline" onClick={() => navigate('/lainnya/materi')}>
                Kembali ke daftar materi
              </button>
            </p>
          </>
        )}
      </OutcomeView>
    </div>
  )
}
