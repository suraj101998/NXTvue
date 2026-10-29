import { buildApiUrl } from '@/api/config'
import type { HistoryMarket } from '@/utils/resolveSymbol'

export type Interval = '5m' | '15m' | '60m' | '1d' | '1wk' | '1mo'

export interface Candle {
  /** 'YYYY-MM-DD' for daily and longer, epoch seconds (UTC) for intraday. */
  time: string | number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface HistoryResponse {
  symbol: string
  market: HistoryMarket
  interval: Interval
  range_period: string
  yahoo_symbol: string
  currency: string | null
  candles: Candle[]
  count: number
}

export interface Technicals {
  symbol: string
  market: HistoryMarket
  currency: string | null
  signal: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell'
  score: number
  price: number
  rsi14: number
  macd_histogram: number
  sma20: number | null
  sma50: number | null
  sma200: number | null
  votes: Record<string, number>
  candles_used: number
}

export interface ResolvedExchange {
  symbol: string
  exchange: string
  tv_symbol: string | null
  currency: string | null
}

/** Typed error so the UI can tell "no such symbol" (404) from "bad request" (422) or an outage. */
export class MarketApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'MarketApiError'
    this.status = status
  }
}

// Same request made twice within a few seconds (the chart and its header) shares one call.
const inflight = new Map<string, { at: number; promise: Promise<unknown> }>()
const DEDUPE_MS = 5_000

export function shared<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = inflight.get(key)
  if (hit && Date.now() - hit.at < DEDUPE_MS) return hit.promise as Promise<T>
  const promise = load().catch((err) => {
    inflight.delete(key) // never keep a failure
    throw err
  })
  inflight.set(key, { at: Date.now(), promise })
  return promise
}

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(buildApiUrl(path), { signal })
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      /* non-JSON error body */
    }
    throw new MarketApiError(detail, res.status)
  }
  return res.json() as Promise<T>
}

const qs = (params: Record<string, string | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join('&')

/** Identical concurrent calls (chart header + chart canvas) share one network request. */
export function fetchHistory(
  symbol: string,
  market: HistoryMarket,
  interval: Interval = '1d',
  range?: string,
): Promise<HistoryResponse> {
  const path = `/api/v1/market/history?${qs({ symbol, market, interval, range_period: range })}`
  return shared(path, () => getJson<HistoryResponse>(path))
}

export function fetchTechnicals(symbol: string, market: HistoryMarket, signal?: AbortSignal): Promise<Technicals> {
  return getJson(`/api/v1/market/technicals/${encodeURIComponent(symbol)}?${qs({ market })}`, signal)
}

export function fetchExchange(symbol: string, market: HistoryMarket, signal?: AbortSignal): Promise<ResolvedExchange> {
  return getJson(`/api/v1/market/resolve?${qs({ symbol, market })}`, signal)
}
