import { getJson } from '@/api/market'
import type { IndiaHeatmap } from '@/api/india'

export interface UsMove {
  last: number
  prevClose: number
  change: number
  changePct: number
}

export interface UsVix extends UsMove {
  high52w: number | null
  low52w: number | null
}

export interface UsMover {
  symbol: string
  name: string
  price: number
  changePct: number
  volume: number | null
}

export interface UsSector {
  /** GICS sector name, also the key the heatmap endpoint takes. */
  name: string
  etf: string
  changePct: number
  advances: number
  declines: number
}

export interface UsPulse {
  stale: boolean
  status: { status: string; message: string; tradeDate: string | null }
  vix: UsVix | null
  indices: (UsMove & { name: string })[]
  breadth: { advances: number; declines: number; unchanged: number; count: number }
  gainers: UsMover[]
  losers: UsMover[]
  sectors: UsSector[]
  /** Rates, dollar, gold, oil and bitcoin: there is no free daily US fund-flow feed. */
  macro: (UsMove & { name: string })[]
}

const BASE = '/api/v1/market/us'

export function fetchUsPulse(signal?: AbortSignal): Promise<UsPulse> {
  return getJson(`${BASE}/pulse?top=5`, signal)
}

/** S&P 500 stocks of one GICS sector. The result has the same shape as an India heatmap. */
export function fetchUsHeatmap(sector: string, signal?: AbortSignal): Promise<IndiaHeatmap> {
  return getJson(`${BASE}/heatmap?sector=${encodeURIComponent(sector)}`, signal)
}
