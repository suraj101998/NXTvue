/**
 * useIndices.ts
 * Polls GET /api/indices every POLL_INTERVAL ms.
 * Returns live Indian + US index data with loading / error state.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface IndexQuote {
  name: string
  value: number
  change: number
  changePct: number
  positive: boolean
  source: 'NSE' | 'yfinance' | string
}

export interface IndicesData {
  india: IndexQuote[]
  us: IndexQuote[]
  updated_at: number   // unix timestamp (seconds)
  cache_ttl: number
}

interface UseIndicesResult {
  data: IndicesData | null
  loading: boolean
  error: string | null
  lastFetched: Date | null
  refresh: () => void
}

const POLL_INTERVAL = 30_000   // 30 seconds
const API_URL = '/api/indices'

export function useIndices(): UseIndicesResult {
  const [data, setData] = useState<IndicesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async () => {
    // Cancel any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(API_URL, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: IndicesData = await res.json()
      setData(json)
      setError(null)
      setLastFetched(new Date())
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError('Unable to reach the indices API. Retrying…')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(fetchData, POLL_INTERVAL)
    return () => {
      timerRef.current && clearInterval(timerRef.current)
      abortRef.current?.abort()
    }
  }, [fetchData])

  return { data, loading, error, lastFetched, refresh: fetchData }
}
