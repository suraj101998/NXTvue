import { useCallback, useEffect, useRef, useState } from 'react'
import { openPortfolioDefaultStream, openPortfolioUploadStream } from '@/api/analysis'
import { ApiError, handleApiError } from '@/api/errors'
import type { PortfolioResult, SseEvent, SseStatus } from '@/api/validators'

export interface UsePortfolioState {
  status: SseStatus | 'idle'
  message: string
  progress: number
  result: PortfolioResult | null
  error: ApiError | null
}

export interface UsePortfolioReturn extends UsePortfolioState {
  runWithFile: (file: File, year?: number) => void
  runDefault: (year?: number) => void
  reset: () => void
}

const INITIAL: UsePortfolioState = {
  status: 'idle',
  message: '',
  progress: 0,
  result: null,
  error: null,
}

function makeHandlers(
  setState: React.Dispatch<React.SetStateAction<UsePortfolioState>>,
  cleanupRef: React.MutableRefObject<(() => void) | null>,
) {
  const onEvent = (event: SseEvent) => {
    if (event.status === 'complete') {
      setState({
        status: 'complete',
        message: event.message,
        progress: event.progress,
        result: event.result as PortfolioResult ?? null,
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
  }

  const onError = (err: Error) => {
    const apiError = handleApiError(err)
    setState({
      status: 'error',
      message: apiError.userMessage,
      progress: 0,
      result: null,
      error: apiError,
    })
    cleanupRef.current = null
  }

  return { onEvent, onError }
}

export function usePortfolio(): UsePortfolioReturn {
  const [state, setState] = useState<UsePortfolioState>(INITIAL)
  // Holds either an EventSource cleanup fn or an AbortController.abort fn
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => cleanupRef.current?.()
  }, [])

  const runWithFile = useCallback((file: File, year = 2026) => {
    cleanupRef.current?.()
    setState({ ...INITIAL, status: 'fetching', message: 'Uploading and pricing your holdings…', progress: 5 })

    const { onEvent, onError } = makeHandlers(setState, cleanupRef)
    const controller = openPortfolioUploadStream(file, year, onEvent, onError, {
      maxRetries: 3,
      baseDelayMs: 1000,
      onRetry: (attempt) => {
        setState((prev) => ({
          ...prev,
          message: `Reconnecting... (attempt ${attempt})`,
        }))
      },
    })
    cleanupRef.current = () => controller.abort()
  }, [])

  const runDefault = useCallback((year = 2026) => {
    cleanupRef.current?.()
    setState({ ...INITIAL, status: 'fetching', message: 'Loading default portfolio and fetching prices…', progress: 5 })

    const { onEvent, onError } = makeHandlers(setState, cleanupRef)
    const cleanup = openPortfolioDefaultStream(year, onEvent, onError, {
      maxRetries: 3,
      baseDelayMs: 1000,
      onRetry: (attempt) => {
        setState((prev) => ({
          ...prev,
          message: `Reconnecting... (attempt ${attempt})`,
        }))
      },
    })
    cleanupRef.current = cleanup
  }, [])

  const reset = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    setState(INITIAL)
  }, [])

  return { ...state, runWithFile, runDefault, reset }
}