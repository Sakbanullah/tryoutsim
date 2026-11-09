import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * The whole global surface (FRONTEND_STATE_MANAGEMENT §2): the active session id (with how its
 * autosave is going), a one-shot flash, and the last-result pointer. Nothing else is shared.
 */

export type AutosaveState = 'saving' | 'saved' | 'failed'
export type Flash = { kind: 'info' | 'error'; text: string }

type ShellValue = {
  activeSessionId: string | null
  autosave: AutosaveState | null
  /** Runner registers where its retry lives; the shell bar calls it. */
  retryAutosave: (() => void) | null
  enterSession: (id: string) => void
  leaveSession: () => void
  reportAutosave: (state: AutosaveState, retry?: () => void) => void
  flash: Flash | null
  setFlash: (f: Flash | null) => void
}

const ShellContext = createContext<ShellValue | null>(null)

/** Provides the shared values; mounted once above the router. */
export function ShellProvider({ children }: { children: ReactNode }) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [autosave, setAutosave] = useState<AutosaveState | null>(null)
  const [retryAutosave, setRetryAutosave] = useState<(() => void) | null>(null)
  const [flash, setFlash] = useState<Flash | null>(null)

  const enterSession = useCallback((id: string) => {
    setActiveSessionId(id)
    setAutosave(null)
    setRetryAutosave(null)
  }, [])

  const leaveSession = useCallback(() => {
    setActiveSessionId(null)
    setAutosave(null)
    setRetryAutosave(null)
  }, [])

  const reportAutosave = useCallback((state: AutosaveState, retry?: () => void) => {
    setAutosave(state)
    setRetryAutosave(state === 'failed' ? (retry ?? null) : null)
  }, [])

  const value = useMemo(
    () => ({
      activeSessionId,
      autosave,
      retryAutosave,
      enterSession,
      leaveSession,
      reportAutosave,
      flash,
      setFlash,
    }),
    [activeSessionId, autosave, retryAutosave, enterSession, leaveSession, reportAutosave, flash],
  )

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

export function useShell(): ShellValue {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useShell must be used inside ShellProvider')
  return ctx
}

/** One-shot message after an action; clears itself, never the only copy of an error. */
export function useFlash(): (f: Flash) => void {
  const { setFlash } = useShell()
  return useCallback(
    (f: Flash) => {
      setFlash(f)
      window.setTimeout(() => setFlash(null), 4000)
    },
    [setFlash],
  )
}
