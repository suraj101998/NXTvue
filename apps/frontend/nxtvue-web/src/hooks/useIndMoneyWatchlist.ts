// ─── useIndMoneyWatchlist ─────────────────────────────────────────────────────
// Fetches live watchlists from the INDmoney MCP backend.

import { useCallback, useEffect, useState } from 'react'
import {
  fetchIndMoneyWatchlist,
  type IndMoneyWatchlistResponse,
  type IndMoneyWatchlistGroup,
} from '@/api'
import { handleApiError, ApiError } from '@/api/errors'

export interface UseIndMoneyWatchlistResult {
  data: IndMoneyWatchlistResponse | null
  watchlists: IndMoneyWatchlistGroup[]
  loading: boolean
  error: ApiError | null
  refresh: () => void
}

export function useIndMoneyWatchlist(): UseIndMoneyWatchlistResult {
  const [data, setData] = useState<IndMoneyWatchlistResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetchIndMoneyWatchlist()
      setData(response)
    } catch (err) {
      setError(handleApiError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const watchlists = data?.watchlists ?? []

  return { data, watchlists, loading, error, refresh: fetchData }
}
