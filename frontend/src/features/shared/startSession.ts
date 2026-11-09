import { useNavigate } from 'react-router-dom'
import type { Result } from '../../data'
import { useShell } from '../../state/shell'

/**
 * Runs one session-creating call (`startSession`, `drill`) and, on success, enters the session and
 * opens its runner. The screens that start a session share this so the busy/reason handling and the
 * route stay identical. Returns false when the session could not be created.
 */
export function useStartSession(): (
  create: () => Promise<Result<{ sessionId: string }>>,
  mode: 'tryout' | 'latihan',
) => Promise<boolean> {
  const navigate = useNavigate()
  const { enterSession } = useShell()
  return async (create, mode) => {
    const res = await create()
    if (!res.ok) return false
    enterSession(res.data.sessionId)
    navigate(mode === 'tryout' ? `/tryout/sesi/${res.data.sessionId}` : `/latihan/sesi/${res.data.sessionId}`)
    return true
  }
}
