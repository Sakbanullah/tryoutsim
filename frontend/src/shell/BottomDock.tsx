import { NavLink } from 'react-router-dom'
import { IconChart, IconDrill, IconExam, IconHome, IconMenu } from '../ui/icons'

/**
 * Five-item bottom dock (FRONTEND_INFORMATION_ARCHITECTURE §2, DESIGN_SYSTEM §7).
 *
 * Desktop-first: a centered floating bar with icon + label per item, active item tinted. Phones get
 * the same five items stacked icon-over-label, pinned to the bottom edge with a safe-area inset.
 * Never an icon-only dock, never a sidebar (U-F9).
 */

const ITEMS = [
  { to: '/', label: 'Beranda', icon: IconHome, match: (p: string) => p === '/' },
  { to: '/tryout', label: 'Tryout', icon: IconExam, match: (p: string) => p.startsWith('/tryout') },
  { to: '/latihan', label: 'Latihan', icon: IconDrill, match: (p: string) => p.startsWith('/latihan') },
  { to: '/progres', label: 'Progres', icon: IconChart, match: (p: string) => p.startsWith('/progres') },
  { to: '/lainnya', label: 'Lainnya', icon: IconMenu, match: (p: string) => p.startsWith('/lainnya') },
]

export function BottomDock({ currentPath }: { currentPath: string }) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/85 md:inset-x-auto md:bottom-5 md:left-1/2 md:w-auto md:-translate-x-1/2 md:rounded-full md:border md:border-border-strong md:p-1.5 md:shadow-[var(--elev-3)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex w-full items-stretch justify-between gap-1 px-2 md:gap-0.5 md:px-0">
        {ITEMS.map(({ to, label, icon: ItemIcon, match }) => {
          const active = match(currentPath)
          return (
            <li key={to} className="flex-1 md:flex-none">
              <NavLink
                to={to}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'group relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-[14px] px-2 text-2xs font-semibold text-primary-ink transition-colors md:min-h-11 md:flex-row md:gap-2 md:rounded-full md:px-4 md:text-base'
                    : 'group relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-[14px] px-2 text-2xs font-medium text-muted transition-colors hover:bg-surface-muted hover:text-ink md:min-h-11 md:flex-row md:gap-2 md:rounded-full md:px-4 md:text-base'
                }
              >
                {active ? (
                  <>
                    <span aria-hidden className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-primary md:hidden" />
                    <span aria-hidden className="absolute inset-0 rounded-[14px] bg-primary-wash md:rounded-full" />
                  </>
                ) : null}
                <ItemIcon size={21} className="relative md:size-[19px]" />
                <span className="relative">{label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
