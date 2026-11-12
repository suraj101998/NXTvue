import { getJson } from '@/api/market'

/** Live quote straight from Yahoo fast_info (5 s server cache). */
export interface LiveQuote {
  symbol: string
  market: string
  stale: boolean
  yahoo_symbol: string
  price: number
  prevClose: number | null
  open: number | null
  high: number | null
  low: number | null
  volume: number | null
  high52w: number | null
  low52w: number | null
  currency: string | null
  exchange: string | null
}

export interface TapeItem {
  label: string
  name: string
  dp: number
  price: number | null
  changePct: number | null
}

export interface UsFundamentals {
  symbol: string
  stale: boolean
  name: string | null
  sector: string | null
  industry: string | null
  employees: number | null
  description: string | null
  headquarters: string | null
  website: string | null
  ratios: {
    marketCap: number | null
    enterpriseValue: number | null
    evToEbitda: number | null
    pe: number | null
    ps: number | null
    pb: number | null
    priceToCashFlow: number | null
    priceToFreeCashFlow: number | null
    revenuePerShare: number | null
    eps: number | null
    beta: number | null
  }
  fiscalYearEnd: string | null
  lastPeriod: string | null
  cashFlow: Record<'totalRevenue' | 'operating' | 'investing' | 'financing' | 'freeCashFlow' | 'capex', number | null>
  margins: Record<'gross' | 'operating' | 'net' | 'returnOnAssets' | 'returnOnEquity', number | null>
}

export interface MarketClock {
  now_new_york: string
  /** Wall-clock time in the exchange's zone (New York for the NYSE, IST for the NSE). */
  now_local?: string
  tz?: string
  exchange?: string
  date: string
  weekday: string
  calendar_known: boolean
  open: boolean
  reason: string
  early_close: string | null
  opens: string | null
  closes: string | null
  next_open: string | null
}

export interface EntryState {
  status: string
  phase?: string
  reason: string
  side?: string
  setup?: string
  or_minutes?: number
  opening_range?: { high: number; low: number; minutes: number; bars: number; of: number; complete: boolean; avg_volume: number | null }
  level?: number | null
  trigger?: { price: number; time: string; bar_index: number } | null
  last?: { bar_start: string; close: number; vs_level_pct: number } | null
  forming?: { bar_start: string; closes: string; price: number } | null
  no_entries_before?: string
  no_entries_after?: string
  bars_closed?: number
}

export interface ExitPlan {
  side: string
  setup: string
  entry: number
  entry_time: string
  stop: number
  stop_label: string
  stop_detail?: string
  target: number
  target_r: number
  target_label: string
  risk_per_share: number
  reward_risk: number
  flat_by: string
  entry_basis: string
  note?: string
  warnings: string[]
}

export interface SizingLimit {
  name: string
  usd: number
  per: number
  shares: number
  how: string
  binds: boolean
}

export interface Sizing {
  qty: number | null
  bound_by: string | null
  cost: number | null
  max_loss: number | null
  budget: number
  cash_buffer: number
  cash_available: number
  limits: SizingLimit[]
  refusal: string | null
  order_type?: string
  flat_by?: string
}

export interface BracketOrder {
  symbol: string
  side: string
  qty: string
  type: string
  time_in_force: string
  order_class: string
  take_profit_limit_price: string
  stop_loss_stop_price: string
  why: string
}

export interface RiskResult {
  verdict: 'PASS' | 'BLOCK'
  reasons: string[]
  warnings: string[]
  info: string[]
  amount: string
  max_loss: number | null
  reward_risk: number | null
  entry_ref: number | null
  entry_ref_from: string | null
}

export interface AlertRule {
  id: string
  type: string
  price?: number
  note: string
}
export interface AlertRing {
  id: string
  symbol: string
  message: string
}

export interface TradeDesk {
  stale: boolean
  symbol: string
  market?: 'us' | 'india'
  currency?: string
  clock: MarketClock
  session_date: string
  live: { price: number; prev_close: number | null; time: string } | null
  entry: EntryState
  plan: ExitPlan | null
  plan_error: string | null
  sizing: Sizing | null
  order: BracketOrder | null
  risk: { results: RiskResult[]; pass: number; block: number; warnings: string[]; cash_after: number | null; paper: boolean } | null
  alerts: { rules: AlertRule[]; rings: AlertRing[] } | null
  limits: Record<string, number | string | null>
}

export interface TimeMachine {
  stale: boolean
  mc: {
    replays: number
    bars_left: number
    p_target: number
    p_stop: number
    p_neither: number
    p_green: number
    median_close: number
    p5_close: number
    p95_close: number
    avg_R: number
    r_at_target: number
    hist: { lo: number; hi: number; bins: number[] }
    until: string
    pool_sessions: number
    pool_from: string
    pool_to: string
  }
  history: { sessions: number; triggered: number; target: number; stop: number; close: number; green: number; avg_R: number } | null
  verdict: string
  verdict_notes: string[]
  warnings: string[]
  plan: ExitPlan
}

export interface NewsItem {
  id: string
  source: string
  kind: string
  ticker: string
  title: string
  summary: string
  link: string
  time: string
  tags: string[]
}
export interface NewsFeed {
  stale: boolean
  items: NewsItem[]
  moves: { ticker: string; price: number; prev_close: number; pct: number; time: string }[]
  errors: string[]
  sec_enabled: boolean
}

export interface EarningsRow {
  end: string
  revenue: number | null
  net_income: number | null
  eps_diluted: number | null
  gross_margin: number | null
  operating_margin: number | null
  net_margin: number | null
  revenue_yoy: number | null
  net_income_yoy: number | null
  eps_yoy: number | null
  fiscal: string
}
export interface Earnings {
  stale: boolean
  source: string
  rows: EarningsRow[]
  changes: string[]
  sec_enabled: boolean
}

export interface Setups {
  setups: string[]
  labels: Record<string, string>
  numbers: Record<string, number | null>
  close_date: string
  price: number
}

export interface ScanHit {
  symbol: string
  setups: string[]
  price: number
  close_date: string
  rsi: number | null
  volume: number | null
}
export interface Scan {
  market?: string
  state: 'running' | 'ready' | 'error'
  progress: number[]
  as_of: string | null
  counts: Record<string, number> | null
  error: string | null
  hits: ScanHit[]
}

export interface NseAnnouncement {
  time: string | null
  subject: string | null
  text: string | null
  url: string | null
}
export interface NseInsiderTrade {
  date: string | null
  person: string | null
  category: string | null
  type: string | null
  security: string | null
  shares: number | null
  value: number | null
  mode: string | null
  from: string | null
  to: string | null
  url: string | null
}
export interface NseDeal {
  kind: 'Bulk' | 'Block' | 'Short'
  date: string | null
  client: string | null
  side: string | null
  qty: number | null
  price: number | null
}
export interface NseDisclosures {
  stale: boolean
  announcements: NseAnnouncement[]
  insider: NseInsiderTrade[]
  deals: NseDeal[]
  deals_as_on: string | null
  errors: string[]
}

export interface CongressTrade {
  owner_name: string
  type_name: string
  date: string
  amount: string
  ticker: string | null
  asset: string
  days_to_disclose: number
  late: boolean
  member: string
  filed: string
  url: string
  text: string
}
export interface Congress {
  stale: boolean
  as_of: string | null
  filings_scanned: number
  trades: CongressTrade[]
  pelosi: { filings: { doc_id: string; filed: string; url: string; name: string }[]; trades: CongressTrade[] }
  note: string
}

const q = (p: Record<string, string | number | undefined | null>) =>
  Object.entries(p)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')

const M = '/api/v1/market'
const D = '/api/v1/desk'

export const fetchLiveQuote = (symbol: string, market: string, signal?: AbortSignal) =>
  getJson<LiveQuote>(`${M}/quote?${q({ symbol, market })}`, signal)
export const fetchTape = (signal?: AbortSignal) => getJson<{ stale: boolean; items: TapeItem[] }>(`${M}/tape`, signal)
export const fetchUsFundamentals = (symbol: string, signal?: AbortSignal) =>
  getJson<UsFundamentals>(`${M}/us/fundamentals/${encodeURIComponent(symbol)}`, signal)
export const fetchClock = (market: string, signal?: AbortSignal) => getJson<MarketClock>(`${D}/clock?${q({ market })}`, signal)
export const fetchTrade = (symbol: string, market: string, budget: number | null, signal?: AbortSignal) =>
  getJson<TradeDesk>(`${D}/${encodeURIComponent(symbol)}/trade?${q({ market, budget: budget ?? undefined })}`, signal)
export const fetchTimeMachine = (symbol: string, market: string, signal?: AbortSignal) =>
  getJson<TimeMachine>(`${D}/${encodeURIComponent(symbol)}/timemachine?${q({ market })}`, signal)
export const fetchNews = (symbol: string, market: string, name: string | null, signal?: AbortSignal) =>
  getJson<NewsFeed>(`${D}/${encodeURIComponent(symbol)}/news?${q({ market, name })}`, signal)
export const fetchEarnings = (symbol: string, market: string, signal?: AbortSignal) =>
  getJson<Earnings>(`${D}/${encodeURIComponent(symbol)}/earnings?${q({ market })}`, signal)
export const fetchSetups = (symbol: string, market: string, signal?: AbortSignal) =>
  getJson<Setups>(`${D}/${encodeURIComponent(symbol)}/setups?${q({ market })}`, signal)
export const fetchScan = (market: string, signal?: AbortSignal) => getJson<Scan>(`${D}/scan?${q({ market, limit: 12 })}`, signal)
export const fetchDisclosures = (symbol: string, signal?: AbortSignal) =>
  getJson<NseDisclosures>(`${D}/${encodeURIComponent(symbol)}/disclosures?limit=12`, signal)
export const fetchCongress = (signal?: AbortSignal) => getJson<Congress>(`${D}/congress?days=30&limit=40`, signal)
