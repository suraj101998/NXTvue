import { getJson, shared } from '@/api/market'

export type HeatmapIndex = 'NIFTY50' | 'NIFTYBANK' | 'NIFTYIT' | 'NIFTYAUTO' | 'NIFTYFMCG' | 'NIFTY100' | 'NIFTY200'

/** Indices the backend can build a live heatmap for (Tickertape serves these constituents). */
export const HEATMAP_INDEX_BY_NAME: Record<string, HeatmapIndex> = {
  'NIFTY 50': 'NIFTY50',
  'NIFTY BANK': 'NIFTYBANK',
  'NIFTY IT': 'NIFTYIT',
  'NIFTY AUTO': 'NIFTYAUTO',
  'NIFTY FMCG': 'NIFTYFMCG',
  'NIFTY 100': 'NIFTY100',
  'NIFTY 200': 'NIFTY200',
}

export interface IndiaStock {
  symbol: string
  name: string | null
  sector: string | null
  price: number
  change: number | null
  changePct: number | null
  prevClose: number | null
  volume: number | null
  /** Traded value in INR. Used as the heatmap tile size. */
  turnover: number | null
  /** Epoch milliseconds of the last trade. */
  asOf: number | null
}

export interface IndiaHeatmap {
  index: HeatmapIndex
  name: string
  count: number
  stale: boolean
  stocks: IndiaStock[]
}

export interface IndiaQuotes {
  stale: boolean
  quotes: IndiaStock[]
}

export interface IndiaQuarter {
  period: string
  endDate: string
  revenue: number | null
  operatingProfit: number | null
  netIncome: number | null
  eps: number | null
}

export interface IndiaFundamentals {
  symbol: string
  stale: boolean
  name: string | null
  description: string | null
  sector: string | null
  industry: string | null
  isin: string | null
  marketCapLabel: string | null
  risk: string | null
  ratios: {
    /** INR crore. */
    marketCap: number | null
    pe: number | null
    industryPe: number | null
    pb: number | null
    industryPb: number | null
    eps: number | null
    roe: number | null
    beta: number | null
    dividendYield: number | null
    industryDividendYield: number | null
    high52w: number | null
    low52w: number | null
    shareholders: number | null
  }
  /** INR crore. */
  quarters: IndiaQuarter[]
}

export interface NseIndexRow {
  name: string
  last: number | null
  change: number | null
  changePct: number | null
  advances: number | null
  declines: number | null
  unchanged: number | null
  /** NSE reports 0 for indices without a P/E (e.g. India VIX). */
  pe: number | null
  pb: number | null
  high52w: number | null
  low52w: number | null
}

export interface Mover {
  symbol: string
  price: number | null
  changePct: number | null
  volume: number | null
}

export interface FiiDiiRow {
  category: string
  date: string
  buy: number | null
  sell: number | null
  net: number | null
}

export interface IndiaPulse {
  stale: boolean
  status: { status: string | null; message: string | null; tradeDate: string | null } | null
  vix: NseIndexRow | null
  indices: NseIndexRow[] | null
  gainers: { asOf: string | null; rows: Mover[] } | null
  losers: { asOf: string | null; rows: Mover[] } | null
  fiiDii: FiiDiiRow[] | null
}

const BASE = '/api/v1/market/india'

export function fetchIndiaHeatmap(index: HeatmapIndex, signal?: AbortSignal): Promise<IndiaHeatmap> {
  return getJson(`${BASE}/heatmap?index=${index}`, signal)
}

export function fetchIndiaQuotes(symbols: string[], signal?: AbortSignal): Promise<IndiaQuotes> {
  const path = `${BASE}/quotes?symbols=${encodeURIComponent(symbols.join(','))}`
  return signal ? getJson(path, signal) : shared(path, () => getJson<IndiaQuotes>(path))
}

export function fetchIndiaFundamentals(symbol: string, signal?: AbortSignal): Promise<IndiaFundamentals> {
  return getJson(`${BASE}/fundamentals/${encodeURIComponent(symbol)}`, signal)
}

export function fetchIndiaPulse(signal?: AbortSignal): Promise<IndiaPulse> {
  return getJson(`${BASE}/pulse?top=5`, signal)
}
