/**
 * useIndices.ts
 * Polls GET /api/v1/indices every POLL_INTERVAL ms.
 * Returns live Indian + US index data with loading / error state.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchIndices, type IndicesData, type IndexQuote } from '@/api/client'
import { ApiError, handleApiError } from '@/api/errors'

interface UseIndicesResult {
  data: IndicesData | null
  loading: boolean
  error: ApiError | null
  lastFetched: Date | null
  refresh: () => void
}

const POLL_INTERVAL = 30_000 // 30 seconds

export function useIndices(): UseIndicesResult {
  const [data, setData] = useState<IndicesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const json = await fetchIndices()
      setData(json)
      setError(null)
      setLastFetched(new Date())
    } catch (err: unknown) {
      const apiError = handleApiError(err)
      setError(apiError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(fetchData, POLL_INTERVAL)
    return () => {
      timerRef.current && clearInterval(timerRef.current)
    }
  }, [fetchData])

  return { data, loading, error, lastFetched, refresh: fetchData }
}

// Re-export types for convenience
export type { IndicesData, IndexQuote }