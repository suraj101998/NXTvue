import { useEffect, useState } from 'react'
import {
  fetchExchange,
  fetchHistory,
  fetchTechnicals,
  MarketApiError,
  type Technicals,
} from '@/api/market'
import type { ResolvedSymbol } from '@/utils/resolveSymbol'

export type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'not_found'; message: string }
  | { status: 'error'; message: string }

export interface Quote {
  price: number
  change: number
  changePct: number
  currency: string | null
  /** Date of the most recent daily bar (YYYY-MM-DD). This is a daily close, not a live tick. */
  asOf: string
  sessionHigh: number
  sessionLow: number
  sessionVolume: number
  high52w: number
  low52w: number
}

function toState<T>(err: unknown): LoadState<T> {
  if (err instanceof MarketApiError && (err.status === 404 || err.status === 422)) {
    return { status: 'not_found', message: err.message }
  }
  return { status: 'error', message: err instanceof Error ? err.message : 'Request failed' }
}

/** Runs `load` whenever `key` changes; ignores results from superseded runs. */
function useLoader<T>(key: string | null, load: () => Promise<T>): LoadState<T> {
  const [state, setState] = useState<{ key: string | null; value: LoadState<T> }>({
    key: null,
    value: { status: 'idle' },
  })

  useEffect(() => {
    if (!key) return
    let cancelled = false
    load()
      .then((data) => !cancelled && setState({ key, value: { status: 'ready', data } }))
      .catch((err) => !cancelled && setState({ key, value: toState<T>(err) }))
    return () => {
      cancelled = true
    }
    // `load` is derived from `key`; depending on it would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!key) return { status: 'idle' }
  // Stale data from a previous symbol must not be shown against the new one.
  return state.key === key ? state.value : { status: 'loading' }
}

/** Header stats from daily candles. Shares its request with NativeChart's default 1d/1y call. */
export function useQuote(resolved: ResolvedSymbol): LoadState<Quote> {
  const h = resolved.history
  const key = h ? `${h.market}:${h.symbol}` : null
  return useLoader<Quote>(key, async () => {
    const res = await fetchHistory(h!.symbol, h!.market, '1d', '1y')
    const c = res.candles
    const last = c[c.length - 1]
    const prev = c.length > 1 ? c[c.length - 2] : last
    return {
      price: last.close,
      change: last.close - prev.close,
      changePct: prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0,
      currency: res.currency,
      asOf: String(last.time),
      sessionHigh: last.high,
      sessionLow: last.low,
      sessionVolume: last.volume,
      high52w: Math.max(...c.map((x) => x.high)),
      low52w: Math.min(...c.map((x) => x.low)),
    }
  })
}

export function useTechnicals(resolved: ResolvedSymbol): LoadState<Technicals> {
  const h = resolved.history
  const key = h ? `${h.market}:${h.symbol}` : null
  return useLoader<Technicals>(key, () => fetchTechnicals(h!.symbol, h!.market))
}

/**
 * Exchange-qualified TradingView symbol. Immediate when the user or widget supplied the
 * exchange; otherwise looked up from the backend so e.g. JPM becomes NYSE:JPM, not NASDAQ:JPM.
 */
export function useTvSymbol(resolved: ResolvedSymbol): LoadState<string> {
  const needs = resolved.engine === 'tv' && resolved.needsExchange
  const key = needs ? `us:${resolved.symbol}` : null
  const looked = useLoader<string>(key, async () => {
    const r = await fetchExchange(resolved.symbol, 'us')
    if (!r.tv_symbol) throw new MarketApiError(`No TradingView listing for ${resolved.symbol}`, 404)
    return r.tv_symbol
  })
  if (resolved.engine !== 'tv') return { status: 'idle' }
  if (resolved.tvSymbol) return { status: 'ready', data: resolved.tvSymbol }
  return looked
}
