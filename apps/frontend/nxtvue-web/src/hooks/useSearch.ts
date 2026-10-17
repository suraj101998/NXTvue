// ─── useSearch ────────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react'
import { searchTickers, type SearchResultItem } from '@/api'
import { ApiError, handleApiError } from '@/api/errors'

interface UseSearchResult {
  results: SearchResultItem[]
  loading: boolean
  error: ApiError | null
  search: (query: string) => Promise<void>
  clear: () => void
}

export function useSearch(): UseSearchResult {
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([])
      return
    }

    try {
      setLoading(true)
      const response = await searchTickers(query)
      setResults(response.results)
      setError(null)
    } catch (err) {
      setError(handleApiError(err))
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    setResults([])
    setError(null)
  }, [])

  return { results, loading, error, search, clear }
}