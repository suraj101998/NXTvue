// ─── useIndMoneyPortfolio ─────────────────────────────────────────────────────
// Fetches live snapshot + all holdings from the INDmoney MCP backend.
// Auto-retries if the backend returns empty groups (silent per-asset MCP errors).

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchIndMoneySnapshot,
  fetchIndMoneyAllHoldings,
  type IndMoneySnapshot,
  type IndMoneyAllHoldings,
} from '@/api'
import { handleApiError, ApiError } from '@/api/errors'

export interface UseIndMoneyPortfolioResult {
  snapshot: IndMoneySnapshot | null
  holdings: IndMoneyAllHoldings | null
  loading: boolean
  retrying: boolean        // true while auto-retry is scheduled/in-flight
  retryAttempt: number     // 0 = first load, 1+ = retry number
  error: ApiError | null
  refresh: () => void
}

/** Returns true if any asset group failed silently (backend sets fetch_error)
 *  OR every group is empty with zero value — both mean the data is not usable yet. */
function hasPartialFailure(h: IndMoneyAllHoldings): boolean {
  const groups = [h.ind_stocks, h.mutual_funds, h.bonds, h.fd]
  if (groups.some(g => g.fetch_error)) return true
  return (
    h.ind_stocks.holdings.length === 0 &&
    h.mutual_funds.holdings.length === 0 &&
    h.ind_stocks.asset_summary.total_value === 0 &&
    h.mutual_funds.asset_summary.total_value === 0
  )
}

// 3 s, 6 s, 9 s, 12 s, 15 s — enough to outlast INDmoney's rate-limit window
const MAX_AUTO_RETRIES = 5
const RETRY_DELAY_MS = 3000

export function useIndMoneyPortfolio(): UseIndMoneyPortfolioResult {
  const [snapshot, setSnapshot] = useState<IndMoneySnapshot | null>(null)
  const [holdings, setHoldings] = useState<IndMoneyAllHoldings | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [error, setError] = useState<ApiError | null>(null)
  const retryCount = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async (isAutoRetry = false, bustCache = false) => {
    if (!isAutoRetry) {
      retryCount.current = 0
      setRetryAttempt(0)
      setRetrying(false)
      if (retryTimer.current) clearTimeout(retryTimer.current)
    }

    try {
      setLoading(true)
      setError(null)

      const [snap, hold] = await Promise.all([
        fetchIndMoneySnapshot(),
        fetchIndMoneyAllHoldings(bustCache),
      ])

      if (hasPartialFailure(hold) && retryCount.current < MAX_AUTO_RETRIES) {
        retryCount.current += 1
        const attempt = retryCount.current
        setRetryAttempt(attempt)
        setRetrying(true)
        setLoading(false)
        setSnapshot(snap)
        // On final retry, bust the backend cache so stale empty data doesn't block
        const isLastRetry = attempt === MAX_AUTO_RETRIES
        retryTimer.current = setTimeout(
          () => fetchData(true, isLastRetry),
          RETRY_DELAY_MS * attempt,
        )
        return
      }

      retryCount.current = 0
      setRetrying(false)
      setRetryAttempt(0)
      setSnapshot(snap)
      setHoldings(hold)
    } catch (err) {
      setRetrying(false)
      setError(handleApiError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current)
    }
  }, [fetchData])

  return { snapshot, holdings, loading, retrying, retryAttempt, error, refresh: () => fetchData(false, true) }
}
