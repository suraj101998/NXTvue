/**
 * resolveSymbol: decides which charting engine renders a symbol.
 *
 * - NSE / BSE (and `.NS` / `.BO`, or any bare ticker on the India tab)
 *   -> 'native' (Lightweight Charts fed by /api/v1/market/history).
 *     TradingView's free widgets refuse NSE ("Permission denied") and serve BSE end-of-day only.
 * - `EXCHANGE:SYMBOL` (what TradingView widgets emit in `tv-link-open`, e.g.
 *   `FX_IDC:USDINR`, `NYSE:JPM`) -> 'tv', symbol used as given.
 * - Bare US ticker -> 'tv', but the exchange prefix is unknown. `needsExchange` is true and
 *   the caller resolves it through /api/v1/market/resolve (see useTvSymbol). It is never
 *   guessed: a wrong prefix such as `NASDAQ:JPM` renders "Invalid Symbol".
 */

export type Market = 'india' | 'us' | 'global'
export type HistoryMarket = 'india' | 'us'

export interface ResolvedSymbol {
  engine: 'tv' | 'native'
  /** Clean ticker for display and routing, e.g. "GVT&D", "NVDA", "USDINR". */
  symbol: string
  market: Market
  /** Exchange-qualified TradingView symbol when known, e.g. "NYSE:JPM". */
  tvSymbol?: string
  /** True when engine is 'tv' but the exchange prefix still has to be looked up. */
  needsExchange: boolean
  /** How to request candles from our backend; absent when no Yahoo equivalent is known. */
  history?: { symbol: string; market: HistoryMarket }
  displayName: string
}

const INDIA_EXCHANGES = new Set(['NSE', 'BSE'])
const US_EXCHANGES = new Set(['NASDAQ', 'NYSE', 'AMEX', 'NYSE ARCA', 'NYSEARCA', 'BATS', 'CBOE'])
const PREFIXED = /^([A-Z0-9_ ]+):(.+)$/

/** Known TradingView instruments that Yahoo also serves under a different symbol. */
const YAHOO_ALIASES: Record<string, string> = {
  'FX_IDC:USDINR': 'INR=X',
  'FX:USDINR': 'INR=X',
  'FX_IDC:EURUSD': 'EURUSD=X',
  'FX:EURUSD': 'EURUSD=X',
}

export function normalizeMarket(raw: string | null | undefined): HistoryMarket {
  return raw?.toLowerCase() === 'us' ? 'us' : 'india'
}

export function resolveSymbol(rawTicker: string, rawMarket: string | null | undefined = 'india'): ResolvedSymbol {
  const ticker = (rawTicker || '').trim().toUpperCase().replace(/\s+/g, '')
  const tab = normalizeMarket(rawMarket)

  if (ticker === 'USDINR' || ticker === 'USD/INR') {
    return fx('FX_IDC:USDINR', 'USDINR', 'USD / INR')
  }

  const prefixed = ticker.match(PREFIXED)
  if (prefixed) {
    const exchange = prefixed[1].trim()
    const code = prefixed[2]
    if (INDIA_EXCHANGES.has(exchange)) return india(code)
    if (US_EXCHANGES.has(exchange)) {
      return {
        engine: 'tv',
        symbol: code,
        market: 'us',
        tvSymbol: `${exchange}:${code}`,
        needsExchange: false,
        history: { symbol: code, market: 'us' },
        displayName: code,
      }
    }
    // Forex, crypto, commodities, other global exchanges
    return fx(`${exchange}:${code}`, code, `${exchange}:${code}`)
  }

  if (/\.(NS|BO)$/.test(ticker) || tab === 'india') return india(ticker)

  return {
    engine: 'tv',
    symbol: ticker,
    market: 'us',
    needsExchange: true,
    history: { symbol: ticker, market: 'us' },
    displayName: ticker,
  }
}

function india(raw: string): ResolvedSymbol {
  const clean = raw.replace(/\.(NS|BO)$/, '')
  return {
    engine: 'native',
    symbol: clean,
    market: 'india',
    needsExchange: false,
    history: { symbol: clean, market: 'india' },
    displayName: clean,
  }
}

function fx(tvSymbol: string, symbol: string, displayName: string): ResolvedSymbol {
  const yahoo = YAHOO_ALIASES[tvSymbol]
  return {
    engine: 'tv',
    symbol,
    market: 'global',
    tvSymbol,
    needsExchange: false,
    history: yahoo ? { symbol: yahoo, market: 'us' } : undefined,
    displayName,
  }
}

/** Route used everywhere a chart link is built, so URL and resolver always agree. */
export function chartPath(symbol: string, market?: string | null): string {
  const q = market ? `?market=${encodeURIComponent(market)}` : ''
  return `/chart/${encodeURIComponent(symbol)}${q}`
}
