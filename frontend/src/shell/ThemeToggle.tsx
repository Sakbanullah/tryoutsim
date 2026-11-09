import { IconMoon, IconSun } from '../ui/icons'
import { cx } from '../ui/ui'
import { useTheme } from '../state/theme'

/** Light/dark switch. Sits in the shell's top-right corner on every screen. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Pakai tema terang' : 'Pakai tema gelap'}
      aria-pressed={isDark}
      className={cx(
        'inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors',
        'hover:border-border-strong hover:bg-surface-muted hover:text-ink',
      )}
    >
      <span className="sr-only">Tema</span>
      {isDark ? <IconSun size={19} /> : <IconMoon size={19} />}
    </button>
  )
}
