// ─── usePortfolioHoldings ────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { fetchPortfolioHoldings, type PortfolioResponse, type PortfolioHoldingResponse } from '@/api'
import { ApiError, handleApiError } from '@/api/errors'

interface UsePortfolioHoldingsResult {
  data: PortfolioResponse | null
  holdings: PortfolioHoldingResponse[]
  summary: PortfolioResponse['summary']
  marketAllocation: Record<string, number>
  sectorAllocation: Record<string, number>
  loading: boolean
  error: ApiError | null
  refresh: () => void
  sync: (source?: string) => Promise<void>
}

export function usePortfolioHoldings(): UsePortfolioHoldingsResult {
  const [data, setData] = useState<PortfolioResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetchPortfolioHoldings()
      setData(response)
      setError(null)
    } catch (err) {
      setError(handleApiError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const sync = useCallback(async (source = 'indmoney') => {
    try {
      setLoading(true)
      await fetch('/api/v1/portfolio/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
      await fetchData()
    } catch (err) {
      setError(handleApiError(err))
    } finally {
      setLoading(false)
    }
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Extract holdings, summary, and allocations from data
  const holdings = data?.holdings || []
  const summary = data?.summary || {
    total_invested: 0,
    total_value: 0,
    total_pnl: 0,
    total_gain_pct: 0,
    num_holdings: 0,
    best_performer: null,
    worst_performer: null,
  }
  const marketAllocation = data?.market_allocation || {}
  const sectorAllocation = data?.sector_allocation || {}

  return {
    data,
    holdings,
    summary,
    marketAllocation,
    sectorAllocation,
    loading,
    error,
    refresh: fetchData,
    sync,
  }
}

// ─── Formatters ────────────────────────────────────────────────────────────────

export function formatCurrency(value: number, prefix = '₹'): string {
  if (value >= 1e7) {
    return `${prefix}${(value / 1e7).toFixed(2)} Cr`
  }
  if (value >= 1e5) {
    return `${prefix}${(value / 1e5).toFixed(1)} L`
  }
  return `${prefix}${value.toLocaleString()}`
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}