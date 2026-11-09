import { useCallback, useEffect, useRef, useState } from 'react'
import type { Outcome } from '../../types/contracts'
import { toOutcome, type Result } from '../../data'

/** The four states every screen implements; `Outcome` carries success or a typed failure. */
export type Load<T> =
  | { phase: 'loading' }
  | { phase: 'done'; outcome: Outcome<T> }

/**
 * Runs one route on mount and on demand, mapping a failure through the single error mapper.
 * A late response from a previous run is discarded, so a screen never renders stale data.
 */
export function useApi<T>(run: () => Promise<Result<T>>, deps: unknown[]): {
  state: Load<T>
  retry: () => void
  setData: (data: T) => void
} {
  const [state, setState] = useState<Load<T>>({ phase: 'loading' })
  const runId = useRef(0)
  const runRef = useRef(run)
  runRef.current = run

  const execute = useCallback(() => {
    const id = ++runId.current
    setState({ phase: 'loading' })
    runRef.current().then((result) => {
      if (id !== runId.current) return
      setState({ phase: 'done', outcome: result.ok ? { kind: 'ok', data: result.data } : toOutcome(result.failure) })
    })
  }, deps)

  useEffect(execute, [execute])

  /** Replaces the loaded data after a mutation without a re-fetch. */
  const setData = useCallback((data: T) => {
    setState({ phase: 'done', outcome: { kind: 'ok', data } })
  }, [])

  return { state, retry: execute, setData }
}
