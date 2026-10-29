import { useCallback, useEffect, useRef, useState } from 'react'

export interface Polled<T> {
  data: T | null
  /** True until the first response (or failure) arrives. */
  loading: boolean
  /** Set when the latest attempt failed. `data` keeps the last good value. */
  error: string | null
  updatedAt: Date | null
  refresh: () => void
}

/**
 * Loads `load(signal)` now and every `intervalMs`, only while the tab is visible.
 * Changing `key` discards old data. A failed refresh keeps the last good data and sets `error`.
 * Pass `key = null` to stay idle.
 */
export function usePolled<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
): Polled<T> {
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null; at: Date | null }>({
    key: null,
    data: null,
    error: null,
    at: null,
  })
  const [tick, setTick] = useState(0)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = async () => {
      if (document.hidden) {
        timer = setTimeout(run, intervalMs)
        return
      }
      try {
        const data = await loadRef.current(controller.signal)
        if (controller.signal.aborted) return
        setState({ key, data, error: null, at: new Date() })
      } catch (err) {
        if (controller.signal.aborted) return
        setState((prev) => ({
          key,
          data: prev.key === key ? prev.data : null,
          error: err instanceof Error ? err.message : 'Request failed',
          at: prev.key === key ? prev.at : null,
        }))
      }
      timer = setTimeout(run, intervalMs)
    }
    run()

    return () => {
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [key, intervalMs, tick])

  const refresh = useCallback(() => setTick((n) => n + 1), [])

  if (!key) return { data: null, loading: false, error: null, updatedAt: null, refresh }
  if (state.key !== key) return { data: null, loading: true, error: null, updatedAt: null, refresh }
  return { data: state.data, loading: state.data === null && state.error === null, error: state.error, updatedAt: state.at, refresh }
}
