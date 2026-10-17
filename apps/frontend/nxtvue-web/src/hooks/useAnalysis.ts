import { useCallback, useEffect, useRef, useState } from 'react'
import { openStockStream } from '@/api/analysis'
import { ApiError, handleApiError } from '@/api/errors'
import type { AnalysisResult, SseStatus } from '@/api/validators'

export interface UseAnalysisState {
  status: SseStatus | 'idle'
  message: string
  progress: number
  result: AnalysisResult | null
  error: ApiError | null
}

export interface UseAnalysisReturn extends UseAnalysisState {
  run: (ticker: string, market: string, year: number) => void
  reset: () => void
}

const INITIAL: UseAnalysisState = {
  status: 'idle',
  message: '',
  progress: 0,
  result: null,
  error: null,
}

export function useAnalysis(): UseAnalysisReturn {
  const [state, setState] = useState<UseAnalysisState>(INITIAL)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Close any open stream on unmount
  useEffect(() => {
    return () => cleanupRef.current?.()
  }, [])

  const run = useCallback((ticker: string, market: string, year: number) => {
    // Close any previous stream
    cleanupRef.current?.()
    setState({ ...INITIAL, status: 'fetching', message: 'Fetching financial data…', progress: 5 })

    const cleanup = openStockStream(
      ticker,
      market,
      year,
      (event) => {
        if (event.status === 'complete') {
          setState({
            status: 'complete',
            message: event.message,
            progress: event.progress,
            result: event.result as AnalysisResult ?? null,
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