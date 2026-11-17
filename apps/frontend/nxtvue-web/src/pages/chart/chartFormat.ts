/** Display formatting for the charts terminal. Pure helpers, no data. */

export const localeFor = (cur: string | null | undefined) => (cur === 'INR' ? 'en-IN' : 'en-US')

export const currencySign = (cur: string | null | undefined) => {
  switch (cur) {
    case 'INR':
      return '₹'
    case 'USD':
      return '$'
    case 'EUR':
      return '€'
    case 'GBP':
      return '£'
    default:
      return cur ? `${cur} ` : ''
  }
}

export const makeFmt = (loc: string) => (p: number) => p.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Yahoo exchange code -> the name traders know. Unknown codes are shown as given. */
const EXCHANGES: Record<string, string> = { NMS: 'NASDAQ', NGM: 'NASDAQ', NCM: 'NASDAQ', NYQ: 'NYSE', ASE: 'AMEX', PCX: 'NYSE Arca', BTS: 'BATS', NSI: 'NSE', BSE: 'BSE', CCY: 'FX' }
export const exchangeLabel = (code: string | null | undefined) => (code ? (EXCHANGES[code] ?? code) : '')

export const fmtVol = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : v.toFixed(0))

export const signed = (x: number, d = 2) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`

/** Return over a chart window, in percent: last price against the open of the window's first bar. */
export function periodReturn(first: number | null | undefined, last: number | null | undefined): number | null {
  if (first == null || last == null || !Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null
  return (last / first - 1) * 100
}

/** "+2.79% over 5D" reads the timeframe as the user picked it; "All" reads as all time. */
export const periodLabel = (tf: string) => (tf === 'All' ? 'all time' : tf)

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Crosshair time label, e.g. "13 Nov '26 10:30" for intraday bars or "13 Nov '26" for daily and longer.
 * `d` carries the exchange wall-clock time in its UTC fields (see `wallClock`).
 */
export function stampLabel(d: Date, intraday: boolean): string {
  const day = `${d.getUTCDate()} ${MON[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`
  if (!intraday) return day
  const p = (x: number) => String(x).padStart(2, '0')
  return `${day} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

/** 4.93T / 302.97B / 12.4M. */
export function big(n: number | null | undefined, d = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const a = Math.abs(n)
  const s = n < 0 ? '−' : ''
  if (a >= 1e12) return `${s}${(a / 1e12).toFixed(d)}T`
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(d)}B`
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(d)}M`
  return `${s}${a.toLocaleString('en-US', { maximumFractionDigits: d })}`
}

/** INR crore -> "15.76 lakh cr" for large caps, otherwise "1,234 cr". */
export function crore(n: number | null | undefined): string {
  if (n == null) return '—'
  return n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} lakh cr` : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })} cr`
}

export const dash = (n: number | null | undefined, d = 2, suffix = '') => (n == null || !Number.isFinite(n) ? '—' : `${n.toFixed(d)}${suffix}`)

export function ago(iso: string, now = Date.now()): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const m = Math.max(0, Math.round((now - t) / 60000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}

/** The exchange a desk panel reads: its name and clock zone. */
export type DeskMarket = 'us' | 'india'
export const EXCHANGE: Record<DeskMarket, { name: string; tz: string }> = {
  us: { name: 'NYSE', tz: 'ET' },
  india: { name: 'NSE', tz: 'IST' },
}
