/**
 * A searchable model picker for one provider card (AI_PROVIDER_ARCHITECTURE §5: the listed models are a picker, and
 * the typed model id stays available on the card). A provider can list hundreds of models, so the list lives in a
 * bounded, scrolling popover with a filter box instead of on the page.
 *
 * One field is a text box for the filter and the selected value. Keyboard: ↓/↑ move through the matches, Enter picks
 * the highlighted one, Escape closes and restores the filter to the selected model, Tab leaves.
 */
import { useId, useMemo, useRef, useState } from 'react'
import { filterModels } from './modelFilter'
import { Badge, Notice, Skeleton, controlClass, cx } from '../../ui/ui'
import { IconAlert, IconCheck, IconSearch } from '../../ui/icons'

export type ModelPickerProps = {
  providerId: string
  /** Every model the endpoint returned, in its order. */
  models: readonly string[]
  /** The provider's current default, or `undefined` when it has none. */
  value: string | undefined
  /** Whether the list was ever loaded (`provider.models` is undefined before the first load). */
  loaded: boolean
  /** Set while the endpoint list is being fetched. */
  loading: boolean
  /** The load failure, already turned into a sentence; `null` when the load succeeded. */
  loadError: string | null
  /** True while a default is being saved. */
  saving: boolean
  /** The last save failure, already turned into a sentence. */
  saveError: string | null
  /** Ask the endpoint for its list (`POST /providers/:id/models`). */
  onLoad: () => void
  /** Save `modelId` as the provider's default (`PATCH /providers/:id`). */
  onSelect: (modelId: string) => void
}

/** The searchable model dropdown of one provider. */
export function ModelPicker({
  providerId,
  models,
  value,
  loaded,
  loading,
  loadError,
  saving,
  saveError,
  onLoad,
  onSelect,
}: ModelPickerProps) {
  const listId = useId()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const matches = useMemo(() => filterModels(models, query), [models, query])
  const selected = value !== undefined && models.includes(value) ? value : undefined
  /** The box shows the selected model until the user types; typing starts a new search. */
  const typed = query !== ''
  const shown = typed ? query : selected ?? ''

  function beginSearch() {
    setOpen(true)
    setQuery('')
    setActive(0)
  }

  function choose(modelId: string) {
    setOpen(false)
    setQuery('')
    if (modelId !== selected) onSelect(modelId)
    inputRef.current?.blur()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) beginSearch()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (matches.length === 0 ? 0 : (i + step + matches.length) % matches.length))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && matches[active] !== undefined) choose(matches[active])
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      return
    }
    if (e.key === 'Tab') setOpen(false)
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-1.5 block text-base font-semibold text-ink">
        Model default
      </label>
      <div className="relative">
        <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] !== undefined ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={shown}
          placeholder={selected ?? 'Pilih model'}
          className={`${controlClass()} min-h-11 pl-9 font-medium`}
          onFocus={beginSearch}
          onClick={() => {
            if (!open) beginSearch()
          }}
          onChange={(e) => {
            setOpen(true)
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          disabled={saving}
        />
        {saving ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">Menyimpan…</span> : null}
      </div>

      {open ? (
        // A bounded popover with internal scrolling; every match stays in the list, none is cut off.
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[12px] border border-border bg-surface shadow-panel-hover">
          {loading ? (
            <div className="p-3">
              <Skeleton lines={3} />
            </div>
          ) : loadError !== null ? (
            <div className="p-3">
              <Notice tone="danger" title="Gagal memuat daftar model">
                {loadError}{' '}
                <button type="button" className="font-semibold underline" onMouseDown={(e) => e.preventDefault()} onClick={onLoad}>
                  Coba lagi
                </button>
              </Notice>
            </div>
          ) : models.length === 0 ? (
            <p className="p-3 text-sm text-muted">
              {loaded ? 'Endpoint tidak mengembalikan model. Muat daftar untuk mencoba lagi.' : 'Daftar model belum dimuat.'}
            </p>
          ) : matches.length === 0 ? (
            <p className="p-3 text-sm text-muted">Tidak ada model yang cocok dengan “{query}”.</p>
          ) : (
            <ul id={listId} role="listbox" aria-label={`Model ${providerId}`} className="max-h-72 overflow-y-auto py-1">
              {matches.map((m, i) => (
                <li
                  key={`${providerId}:${m}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={m === selected}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(m)}
                  className={cx(
                    'flex min-h-10 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-md',
                    i === active ? 'bg-surface-muted' : '',
                  )}
                >
                  <span className="block min-w-0 truncate font-medium" title={m}>
                    {m}
                  </span>
                  {m === selected ? (
                    <Badge tone="success" icon={<IconCheck size={12} />}>
                      Default
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {saveError !== null ? (
        <Notice tone="danger" className="mt-2" title="Default belum berubah">
          {saveError}
        </Notice>
      ) : null}
      {loadError !== null && !open ? (
        <Notice tone="danger" className="mt-2" title="Gagal memuat daftar model">
          <IconAlert size={14} className="mr-1 inline" />
          {loadError}
        </Notice>
      ) : null}
    </div>
  )
}
