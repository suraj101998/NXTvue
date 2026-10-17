import { useCallback, useEffect, useRef, useState } from 'react'
import { openCompareStream } from '@/api/analysis'
import { ApiError, handleApiError } from '@/api/errors'
import type { CompareResult, SseStatus } from '@/api/validators'

export interface UseCompareState {
  status: SseStatus | 'idle'
  message: string
  progress: number
  result: CompareResult | null
  error: ApiError | null
}

export interface UseCompareReturn extends UseCompareState {
  run: (a: string, ma: string, b: string, mb: string, year: number) => void
  reset: () => void
}

const INITIAL: UseCompareState = {
  status: 'idle',
  message: '',
  progress: 0,
  result: null,
  error: null,
}

export function useCompare(): UseCompareReturn {
  const [state, setState] = useState<UseCompareState>(INITIAL)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => cleanupRef.current?.()
  }, [])

  const run = useCallback((a: string, ma: string, b: string, mb: string, year: number) => {
    cleanupRef.current?.()
    setState({ ...INITIAL, status: 'fetching', message: `Fetching data for ${a} and ${b}…`, progress: 5 })

    const cleanup = openCompareStream(
      a, ma, b, mb, year,
      (event) => {
        if (event.status === 'complete') {
          setState({
            status: 'complete',
            message: event.message,
            progress: event.progress,
            result: event.result as CompareResult ?? null,
            error: null,
          })
          cleanupRef.current = null
        } else if (event.status === 'error') {
          const apiError = handleApiError(new Error(event.message))
          setState({
            status: 'error',
            message: apiError.userMessage,
            progress: 0,
            result: null,
            error: apiError,
          })
          cleanupRef.current = null
        } else {
          setState((prev) => ({
            ...prev,
            status: event.status,
            message: event.message,
            progress: event.progress,
          }))
        }
      },
      (_err) => {
        const apiError = handleApiError(_err)
        setState({
          status: 'error',
          message: apiError.userMessage,
          progress: 0,
          result: null,
          error: apiError,
        })
        cleanupRef.current = null
      },
      {
        maxRetries: 3,
        baseDelayMs: 1000,
        onRetry: (attempt, _error) => {
          setState((prev) => ({
            ...prev,
            message: `Reconnecting... (attempt ${attempt})`,
          }))
        },
      },
    )

    cleanupRef.current = cleanup
  }, [])

  const reset = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    setState(INITIAL)
  }, [])

  return { ...state, run, reset }
}