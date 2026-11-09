import { useCallback, useEffect, useState } from 'react'

/**
 * Light/dark theme, opt-in and persisted. The `dark` class on <html> switches the token block in
 * tokens.css; no component reads this state except the toggle itself.
 */

type Theme = 'light' | 'dark'

const KEY = 'tryoutsim-theme'

function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    // Storage blocked (private mode): stay on the default light theme rather than fail the app.
    return 'light'
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // Preference not persisted; the toggle still works for this visit.
    }
  }, [theme])

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])

  return { theme, toggle }
}
