import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BottomDock } from './BottomDock'
import { ThemeToggle } from './ThemeToggle'
import { useShell } from '../state/shell'
import { Panel, cx } from '../ui/ui'
import { IconAlert, IconChevronLeft } from '../ui/icons'

/**
 * App shell: the page canvas, the five-item dock, the global autosave bar and one-shot flash.
 *
 * Desktop is the primary platform: `main` takes the full viewport width and every screen picks its
 * own measure (`max-w-wide` for dashboards and tables, `max-w-page` for forms and reading). The dock
 * is a centered floating bar on desktop and a pinned bottom bar on phones (IA §2, U-F9).
 * The exam runner hides the dock: nothing leaves a session by accident.
 */
export function Layout({ children, hideDock = false }: { children: ReactNode; hideDock?: boolean }) {
  const { pathname, key } = useLocation()
  const { flash, setFlash, retryAutosave } = useShell()

  // A one-shot flash clears on navigation so it never outlives its cause.
  useEffect(() => {
    setFlash(null)
    // On a fresh route, move focus to the content once so keyboard users start there.
    document.getElementById('isi')?.focus()
  }, [key, setFlash])

  return (
    <div className="min-h-dvh">
      <a
        href="#isi"
        onClick={(e) => {
          // A real focus move; #isi is a scroll target, not a heading.
          e.preventDefault()
          document.getElementById('isi')?.focus()
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[10px] focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        Lompat ke isi
      </a>

      {/* Theme switch, top-right on every screen, runner included. Offset so it never covers a page control. */}
      <div className="fixed right-4 top-4 z-30 md:right-8 md:top-6">
        <ThemeToggle />
      </div>

      <main
        id="isi"
        tabIndex={-1}
        className={
          hideDock
            ? 'px-4 py-5 outline-none md:px-8 md:py-6'
            : 'px-4 pb-32 pt-6 outline-none sm:px-6 md:px-8 md:pt-8 lg:px-10 lg:pt-9'
        }
        style={hideDock ? undefined : { paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto w-full max-w-wide">{children}</div>
      </main>

      {/* Feedback stack sits above the dock, centered, never the only copy of an error. */}
      {/* The stack holds nothing most of the time, so it stays out of the layout until it has a child. */}
      <div
        className={cx(
          'pointer-events-none fixed inset-x-0 bottom-24 z-40 flex-col items-center gap-2 px-4 md:bottom-28',
          retryAutosave || flash ? 'flex' : 'hidden',
        )}
      >
        {retryAutosave ? (
          <div
            aria-live="polite"
            className="animate-fade pointer-events-auto flex w-full max-w-[640px] items-center gap-3 rounded-[14px] border border-[#f5c3cc] bg-danger-wash px-4 py-2.5 text-sm text-danger shadow-panel-hover dark:border-[#5c2730]"
          >
            <IconAlert size={18} className="shrink-0" />
            <span className="flex-1">Belum tersimpan — coba lagi agar jawaban terbaru tersimpan.</span>
            <button
              type="button"
              className="rounded-[10px] border border-[#f5c3cc] bg-bg px-3 py-1.5 text-sm font-semibold text-danger hover:bg-surface-muted dark:border-[#5c2730]"
              onClick={retryAutosave}
            >
              Coba lagi
            </button>
          </div>
        ) : null}

        {flash ? (
          <div aria-live="polite" role="status" className="pointer-events-auto animate-rise w-full max-w-[640px]">
            <Panel tone="plain" className="flex items-start gap-3 px-4 py-2.5 shadow-panel-hover">
              <span
                className={
                  flash.kind === 'error'
                    ? 'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-danger-wash text-danger'
                    : 'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-wash text-primary-ink'
                }
              >
                <IconAlert size={14} />
              </span>
              <span className="text-base">{flash.text}</span>
            </Panel>
          </div>
        ) : null}
      </div>

      {hideDock ? null : <BottomDock currentPath={pathname} />}
    </div>
  )
}

/** A compact "back to" row used above detail screens; the dock keeps the global position. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-base font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
    >
      <IconChevronLeft size={16} />
      {children}
    </Link>
  )
}
