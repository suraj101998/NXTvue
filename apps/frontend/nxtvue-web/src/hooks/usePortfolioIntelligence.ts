// ─── usePortfolioIntelligence ──────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { fetchPortfolioIntelligence, type PortfolioIntelligenceResponse } from '@/api'
import { ApiError, handleApiError } from '@/api/errors'

interface UsePortfolioIntelligenceResult {
  data: PortfolioIntelligenceResponse | null
  loading: boolean
  error: ApiError | null
  refresh: () => void
}

export function usePortfolioIntelligence(): UsePortfolioIntelligenceResult {
  const [data, setData] = useState<PortfolioIntelligenceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetchPortfolioIntelligence()
      setData(response)
      setError(null)
    } catch (err) {
      setError(handleApiError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refresh: fetchData,
  }
}