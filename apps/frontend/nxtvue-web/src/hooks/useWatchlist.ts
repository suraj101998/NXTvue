// ─── useWatchlist ──────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { fetchWatchlist, addToWatchlist, removeFromWatchlist, type WatchlistItem } from '@/api'
import { ApiError, handleApiError } from '@/api/errors'

interface UseWatchlistResult {
  items: WatchlistItem[]
  loading: boolean
  error: ApiError | null
  refresh: () => void
  add: (ticker: string, name?: string, market?: string) => Promise<void>
  remove: (ticker: string) => Promise<void>
  isInWatchlist: (ticker: string) => boolean
}

export function useWatchlist(): UseWatchlistResult {
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetchWatchlist()
      setItems(response.items)
      setError(null)
    } catch (err) {
      setError(handleApiError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const add = useCallback(async (ticker: string, name?: string, market = 'india') => {
    try {
      const response = await addToWatchlist(ticker, name, market)
      setItems(response.items)
    } catch (err) {
      setError(handleApiError(err))
      throw err
    }
  }, [])

  const remove = useCallback(async (ticker: string) => {
    try {
      const response = await removeFromWatchlist(ticker)
      setItems(response.items)
    } catch (err) {
      setError(handleApiError(err))
      throw err
    }
  }, [])

  const isInWatchlist = useCallback((ticker: string) => {
    return items.some(item => item.ticker === ticker)
  }, [items])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    items,
    loading,
    error,
    refresh: fetchData,
    add,
    remove,
    isInWatchlist,
  }
}