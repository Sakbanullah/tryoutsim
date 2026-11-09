import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { MetricValue } from '../types/contracts'
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconChevronRight,
  IconInfo,
  IconRefresh,
  IconSpark,
} from './icons'

/**
 * Presentational primitives (FRONTEND_COMPONENT_ARCHITECTURE §2). No domain logic, no fetching,
 * no scoring rule. Each carries its own accessibility behaviour.
 * Styling is Tailwind utilities; the classes below are the one place the control geometry lives.
 */

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

/* ── Class maps shared by buttons, links and controls ─────────────────────────────────── */

const BUTTON_BASE =
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[14px] font-sans font-semibold leading-tight transition-[background-color,border-color,box-shadow,color,transform] duration-200 active:translate-y-px disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45'

const BUTTON_VARIANT = {
  primary:
    'bg-primary text-white shadow-primary hover:bg-primary-hover disabled:hover:bg-primary',
  secondary:
    'border border-border-strong bg-surface text-ink hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:brightness-110',
  quiet: 'bg-transparent px-3 text-primary-ink hover:bg-primary-wash',
  /*
   * The ink panel is dark in both themes, so the ordinary variants' `text-ink`/`bg-surface` would
   * invert wrongly there. These two read only the fixed ink-panel tokens.
   */
  onInkSecondary:
    'border border-ink-panel-border bg-ink-panel-line text-ink-panel-text hover:bg-ink-panel-border focus-visible:outline-ink-panel-fill',
  onInkQuiet:
    'bg-transparent px-3 text-ink-panel-text hover:bg-ink-panel-line focus-visible:outline-ink-panel-fill',
} as const

const BUTTON_SIZE = {
  sm: 'min-h-9 px-3.5 text-sm',
  md: 'min-h-[46px] px-5 text-md',
  lg: 'min-h-[52px] px-6 text-md',
} as const

export type ButtonVariant = keyof typeof BUTTON_VARIANT

/** Button classes for a router `Link` that must look identical to `Button`. */
export function buttonClass(variant: ButtonVariant = 'primary', size: keyof typeof BUTTON_SIZE = 'md', className?: string): string {
  return cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)
}

/* ── Button ───────────────────────────────────────────────────────────────────────────── */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  /** Shown beneath the control when disabled — every disabled control explains why (§5). */
  reason?: string
  size?: keyof typeof BUTTON_SIZE
}

/** One control with four intents; a disabled state is never silent. */
export function Button({ variant = 'primary', reason, className, children, disabled, size = 'md', ...rest }: ButtonProps) {
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        {...rest}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        className={buttonClass(variant, size, className)}
      >
        {children}
      </button>
      {disabled && reason ? (
        <span className="max-w-[46ch] text-sm leading-snug text-muted">{reason}</span>
      ) : null}
    </span>
  )
}

/* ── Panel ───────────────────────────────────────────────────────────────────────────── */

/**
 * The default container: white surface, 1 px border, 24 px radius, one soft elevation.
 * `tone` paints a whole panel (hero wash, lavender, sunny, ink) and always uses readable ink.
 */
type PanelTone = 'plain' | 'flat' | 'wash' | 'lavender' | 'sunny' | 'ink' | 'muted'

const PANEL_TONE: Record<PanelTone, string> = {
  plain: 'rounded-[24px] border border-border bg-surface shadow-panel',
  flat: 'rounded-[16px] border border-border bg-surface',
  muted: 'rounded-[16px] border border-border bg-surface-muted',
  wash: 'rounded-[24px] border border-primary-line bg-[linear-gradient(160deg,var(--hero-from)_0%,var(--hero-to)_62%)]',
  lavender: 'rounded-[24px] border border-lavender-line bg-lavender',
  sunny: 'rounded-[24px] border border-[#f2de9c] bg-sunny',
  ink: 'rounded-[24px] border border-ink-panel-border bg-ink-panel text-ink-panel-text shadow-panel-hover',
}

export function Panel({
  children,
  className,
  tone = 'plain',
  as: Tag = 'section',
}: {
  children: ReactNode
  className?: string
  tone?: PanelTone
  as?: 'section' | 'div' | 'article' | 'aside' | 'header' | 'form'
}) {
  return <Tag className={cx(PANEL_TONE[tone], className)}>{children}</Tag>
}

/* ── Badge ───────────────────────────────────────────────────────────────────────────── */

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'lavender' | 'sunny'

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'border-border bg-surface-muted text-muted',
  accent: 'border-primary-line bg-primary-wash text-primary-ink',
  success: 'border-[#bfe9d8] bg-success-wash text-success dark:border-[#245c47]',
  warning: 'border-[#f0d9ab] bg-warning-wash text-warning dark:border-[#5c4a1c]',
  danger: 'border-[#f5c3cc] bg-danger-wash text-danger dark:border-[#5c2730]',
  lavender: 'border-lavender-line bg-lavender text-lavender-ink',
  sunny: 'border-sunny-line bg-sunny text-sunny-ink',
}

export function Badge({
  tone = 'neutral',
  children,
  icon,
  className,
}: {
  tone?: BadgeTone
  children: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        BADGE_TONE[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/* ── Notice ──────────────────────────────────────────────────────────────────────────── */

type NoticeTone = 'info' | 'warning' | 'danger' | 'success' | 'lavender'

const NOTICE: Record<NoticeTone, { box: string; icon: typeof IconInfo }> = {
  info: { box: 'border-[#c8d6ff] bg-info-wash text-[#1c3f9e]', icon: IconInfo },
  warning: { box: 'border-[#efdb9b] bg-sunny text-sunny-ink', icon: IconAlert },
  danger: { box: 'border-[#f5c3cc] bg-danger-wash text-danger', icon: IconAlert },
  success: { box: 'border-[#bfe9d8] bg-success-wash text-success', icon: IconCheck },
  lavender: { box: 'border-[#d5ceff] bg-lavender text-lavender-ink', icon: IconSpark },
}

/**
 * Config `notice`, approval warnings, unscored explanations. Always prose, never colour alone:
 * every notice carries an icon and a readable sentence.
 */
export function Notice({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: NoticeTone
  title?: string
  children: ReactNode
  className?: string
}) {
  const { box, icon: NoticeIcon } = NOTICE[tone]
  return (
    <div className={cx('flex gap-3 rounded-[16px] border px-4 py-3.5 text-md leading-relaxed', box, className)}>
      <NoticeIcon size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cx(title && 'mt-0.5')}>{children}</div>
      </div>
    </div>
  )
}

/* ── Metric bar and figure ───────────────────────────────────────────────────────────── */

/**
 * The reported percentage of a metric as one horizontal bar. Width is `MetricValue.percent` exactly
 * as the analytics returned it — no averaging across tests, no re-derivation. A non-reportable sample
 * renders an empty track, matching `MetricText`'s "Belum cukup data". The width is data, not style,
 * so it stays an inline style.
 */
export function MetricBar({ metric, size = 'md' }: { metric: MetricValue; size?: 'sm' | 'md' }) {
  const width =
    metric.state === 'reportable' && metric.percent !== null ? Math.max(0, Math.min(100, metric.percent)) : 0
  return (
    <div aria-hidden className={cx('w-full overflow-hidden rounded-full bg-surface-muted', size === 'sm' ? 'h-1.5' : 'h-2.5')}>
      <div
        className={cx('h-full rounded-full transition-[width] duration-500', metric.state === 'reportable' ? 'bg-primary' : 'bg-transparent')}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

/** The one big figure used for scores and points: value in display face, unit beside it in words. */
export function Figure({
  value,
  unit,
  label,
  size = 'lg',
  className,
}: {
  value: ReactNode
  unit?: string
  label?: string
  size?: 'md' | 'lg' | 'xl'
  className?: string
}) {
  const sizeClass = { md: 'text-[28px]', lg: 'text-[38px]', xl: 'text-[56px]' }[size]
  return (
    <div className={className}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={cx('tabular-nums font-display font-bold leading-none tracking-[-0.03em]', sizeClass)}>{value}</span>
        {unit ? <span className="text-base font-medium text-muted">{unit}</span> : null}
      </p>
      {label ? <p className="mt-1.5 text-base text-muted">{label}</p> : null}
    </div>
  )
}

/* ── Dialog ──────────────────────────────────────────────────────────────────────────── */

/** Focus-trapped confirmation. Restores focus to the opener on close. */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    returnFocus.current = document.activeElement as HTMLElement | null
    const node = ref.current
    const focusables = node?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    focusables?.[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !focusables?.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      returnFocus.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-[#16233f]/45 p-4 backdrop-blur-[2px] sm:items-center">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-rise max-h-[90vh] w-full max-w-[540px] overflow-y-auto rounded-[24px] border border-border bg-bg p-6 shadow-float"
      >
        <h2 id={titleId} className="text-xl">
          {title}
        </h2>
        <div className="mt-3 text-md leading-relaxed">{children}</div>
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  )
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */

/** Skeleton of the final layout — never a spinner-only screen (FRONTEND_STATE_MANAGEMENT §6). */
export function Skeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className={cx('space-y-3', className)}>
      <span className="sr-only">Sedang memuat…</span>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded-full bg-surface-muted"
          style={{ width: `${[100, 92, 78, 85, 64][i % 5]}%` }}
        />
      ))}
    </div>
  )
}

/* ── Empty / error ───────────────────────────────────────────────────────────────────── */

/** `mascot` is for Beranda-level empty states only (DESIGN_SYSTEM §4). */
export function EmptyState({
  title,
  children,
  action,
  mascot,
  className,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
  mascot?: boolean
  className?: string
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-center rounded-[24px] border border-dashed border-border-strong bg-surface/60 px-6 py-10 text-center',
        className,
      )}
    >
      {mascot ? <Mascot size={104} className="mb-2" /> : <EmptyGlyph className="mb-3" />}
      <h2 className="text-lg">{title}</h2>
      <div className="mx-auto mt-1.5 max-w-[52ch] text-base leading-relaxed text-muted">{children}</div>
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ message, retry, className }: { message: string; retry?: () => void; className?: string }) {
  return (
    <div
      role="alert"
      className={cx(
        'flex flex-col gap-3 rounded-[24px] border border-border bg-surface px-6 py-7 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-wash text-danger">
          <IconAlert size={18} />
        </span>
        <p className="text-md leading-relaxed">{message}</p>
      </div>
      {retry ? (
        <Button variant="secondary" onClick={retry} className="shrink-0">
          <IconRefresh size={17} />
          Coba lagi
        </Button>
      ) : null}
    </div>
  )
}

/* ── Field ───────────────────────────────────────────────────────────────────────────── */

/** Classes for a labelled control; the error is linked by id and also stated in text (§2 Forms). */
export const controlClass = (invalid?: boolean) =>
  cx(
    'block w-full rounded-[12px] border bg-surface px-3.5 text-md text-ink transition-[border-color,box-shadow] duration-200',
    invalid ? 'border-danger' : 'border-border-strong hover:border-muted',
    'focus:border-primary focus:shadow-control-focus focus:outline-none',
  )

/** A labelled form control; the error is linked by id and also stated in text. */
export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string
  error?: string
  hint?: string
  children: (ids: { id: string; describedBy?: string; invalid?: boolean }) => ReactNode
  className?: string
}) {
  const id = useId()
  const errId = `${id}-err`
  const hintId = `${id}-hint`
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-base font-semibold text-ink">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errId} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/* ── PointsBar — the signature element (DESIGN_SYSTEM §9) ─────────────────────────────── */

/** A ladder of ticks, one per roster question, filled when that question earned a point. */
export function PointsBar({ ticks, testLabel }: { ticks: boolean[]; testLabel: string }) {
  const gained = ticks.filter(Boolean).length
  return (
    <div
      role="img"
      aria-label={`${testLabel}: ${gained} dari ${ticks.length} soal mendapat poin`}
      className="flex h-4 flex-wrap gap-[3px]"
    >
      {ticks.map((on, i) => (
        <span key={i} className={cx('h-4 w-[7px] rounded-[2px]', on ? 'bg-primary' : 'bg-border')} />
      ))}
    </div>
  )
}

/* ── Steps — an ordered list only where order is real ──────────────────────────────── */

export function Steps({ items }: { items: Array<{ title: string; body: string }> }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-3 sm:gap-5">
      {items.map((it, i) => (
        <li key={it.title} className="rounded-[16px] bg-surface-muted/70 p-4">
          <span className="tabular-nums flex h-8 w-8 items-center justify-center rounded-full bg-bg text-base font-bold text-primary-ink shadow-panel">
            {i + 1}
          </span>
          <p className="mt-2.5 font-display text-md font-semibold">{it.title}</p>
          <p className="mt-0.5 text-base leading-relaxed text-muted">{it.body}</p>
        </li>
      ))}
    </ol>
  )
}

/** A quieter empty glyph than the mascot: a dashed rounded square with a spark. */
export function EmptyGlyph({ className }: { className?: string }) {
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" fill="none" aria-hidden className={className}>
      <rect x="10" y="12" width="52" height="48" rx="14" fill="var(--lavender)" stroke="var(--border-strong)" strokeDasharray="4 4" />
      <path
        d="M36 26l2.6 7.4L46 36l-7.4 2.6L36 46l-2.6-7.4L26 36l7.4-2.6L36 26Z"
        fill="var(--sunny)"
        stroke="var(--sunny-ink)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ── Mascot ──────────────────────────────────────────────────────────────────────────── */

/**
 * The one mascot (DESIGN_SYSTEM §4): a friendly character with a graduation cap, blue and yellow.
 * Decoration only — always paired with a heading that carries the meaning, and only on Beranda,
 * the exam start screen and the finish screen.
 */
export function Mascot({ size = 120, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden className={className}>
      <ellipse cx="60" cy="108" rx="30" ry="5" fill="#1F3157" opacity=".08" />
      <circle cx="60" cy="66" r="33" fill="#EAF0FF" />
      <circle cx="60" cy="66" r="33" stroke="var(--primary)" strokeWidth="2.5" />
      <path d="M60 22 92 36 60 50 28 36 60 22Z" fill="var(--primary)" />
      <path d="M60 30 82 39.6 60 49.2 38 39.6 60 30Z" fill="#1E4ED8" opacity=".35" />
      <path d="M88 38v14" stroke="var(--sunny-ink)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="88" cy="55" r="4.5" fill="var(--sunny)" stroke="var(--sunny-ink)" strokeWidth="2.5" />
      <circle cx="50" cy="64" r="3.6" fill="#1F3157" />
      <circle cx="70" cy="64" r="3.6" fill="#1F3157" />
      <path d="M51 76c2.6 3.4 5.8 5.1 9 5.1s6.4-1.7 9-5.1" stroke="#1F3157" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="41" cy="74" rx="5" ry="3" fill="#4A3BB5" opacity=".18" />
      <ellipse cx="79" cy="74" rx="5" ry="3" fill="#4A3BB5" opacity=".18" />
      <circle cx="26" cy="50" r="4" fill="var(--lavender)" />
      <circle cx="97" cy="76" r="3" fill="var(--sunny)" />
      <circle cx="20" cy="80" r="2.5" fill="var(--primary)" opacity=".5" />
    </svg>
  )
}

/* ── Links ───────────────────────────────────────────────────────────────────────────── */

/** A bare link-with-arrow used in panel corners and list rows. */
export function ArrowLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={cx(
        'inline-flex items-center gap-1 text-base font-semibold text-primary-ink underline-offset-4 hover:underline',
        className,
      )}
    >
      {children}
      <IconChevronRight size={16} />
    </Link>
  )
}

/** A router link styled as a button, with the trailing arrow the primary actions use. */
export function ActionLink({
  to,
  children,
  variant = 'primary',
  size = 'md',
  className,
}: {
  to: string
  children: ReactNode
  variant?: ButtonVariant
  size?: keyof typeof BUTTON_SIZE
  className?: string
}) {
  return (
    <Link to={to} className={buttonClass(variant, size, className)}>
      {children}
      <IconArrowRight size={18} />
    </Link>
  )
}
