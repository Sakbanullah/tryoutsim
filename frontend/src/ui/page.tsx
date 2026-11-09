import type { ReactNode } from 'react'

/**
 * Page scaffolding shared by every screen except the exam runner: a header band with the title,
 * supporting sentence and actions, then the screen's own composition. Keeping this in one place is
 * what makes the pages read as one product from Beranda to the management screens.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
  aside,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  lead?: ReactNode
  actions?: ReactNode
  aside?: ReactNode
  className?: string
}) {
  return (
    <header className={className}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="min-w-0 max-w-[62ch]">
          {eyebrow ? (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted">{eyebrow}</p>
          ) : null}
          <h1 className="font-display text-[clamp(26px,2vw,32px)] font-bold leading-[1.12] tracking-[-0.025em]">{title}</h1>
          {lead ? <p className="mt-2.5 text-md leading-relaxed text-muted">{lead}</p> : null}
        </div>
        {aside ?? (actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null)}
      </div>
    </header>
  )
}

/** A titled block inside a page column; the heading sits outside the surface so the surface stays quiet. */
export function Block({
  title,
  hint,
  action,
  children,
  className,
  id,
}: {
  title?: ReactNode
  hint?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={className}>
      {title ? (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl">{title}</h2>
            {hint ? <p className="mt-0.5 text-base text-muted">{hint}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}
