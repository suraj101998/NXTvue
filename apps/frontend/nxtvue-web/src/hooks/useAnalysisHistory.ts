// ─── useAnalysisHistory ────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { fetchAnalysisHistory, type AnalysisHistoryItem } from '@/api'
import { ApiError, handleApiError } from '@/api/errors'

interface UseAnalysisHistoryResult {
  items: AnalysisHistoryItem[]
  loading: boolean
  error: ApiError | null
  total: number
  page: number
  pageSize: number
  refresh: () => void
  goToPage: (pageNum: number) => void
  loadMore: () => void
  hasMore: boolean
}

export function useAnalysisHistory(
  initialPageSize: number = 10,
  analysisType?: string
): UseAnalysisHistoryResult {
  const [items, setItems] = useState<AnalysisHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(initialPageSize)

  const fetchData = useCallback(async (pageNum: number = 1, append = false) => {
    try {
      if (!append) setLoading(true)
      const response = await fetchAnalysisHistory(pageNum, pageSize, analysisType)
      setTotal(response.total)
      if (append) {
        setItems(prev => [...prev, ...response.items])
      } else {
        setItems(response.items)
      }
      setPage(response.page)
      setError(null)
    } catch (err) {
      setError(handleApiError(err))
    } finally {
      setLoading(false)
    }
  }, [pageSize, analysisType])

  const refresh = useCallback(() => {
    fetchData(1, false)
  }, [fetchData])

  const goToPage = useCallback((pageNum: number) => {
    fetchData(pageNum, false)
  }, [fetchData])

  const loadMore = useCallback(() => {
    if (!loading && page * pageSize < total) {
      fetchData(page + 1, true)
    }
  }, [loading, page, pageSize, total, fetchData])

  const hasMore = page * pageSize < total

  useEffect(() => {
    fetchData(1, false)
  }, [fetchData])

  return {
    items,
    loading,
    error,
    total,
    page,
    pageSize,
    refresh,
    goToPage,
    loadMore,
    hasMore,
  }
}