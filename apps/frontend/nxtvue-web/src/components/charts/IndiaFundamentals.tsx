import { fetchIndiaFundamentals, type IndiaFundamentals } from '@/api/india'
import { usePolled } from '@/hooks/usePolled'

const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-sm'
const REFRESH_MS = 6 * 60 * 60 * 1000

const num = (v: number | null, digits = 2) =>
  v === null || v === undefined ? '—' : v.toLocaleString('en-IN', { maximumFractionDigits: digits })

/** Market cap arrives in INR crore. */
function crore(v: number | null): string {
  if (v === null || v === undefined) return '—'
  if (v >= 100_000) return `₹${(v / 100_000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} lakh cr`
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })} cr`
}

export function IndiaFundamentals({ symbol }: { symbol: string }) {
  const { data, loading, error } = usePolled<IndiaFundamentals>(
    `fund:${symbol}`,
    (signal) => fetchIndiaFundamentals(symbol, signal),
    REFRESH_MS,
  )

  if (loading) {
    return (
      <section className={`${CARD} p-6`} aria-label="Company profile and fundamentals">
        <p role="status" className="text-xs text-text-secondary">Loading company data…</p>
      </section>
    )
  }
  if (!data) {
    return (
      <section className={`${CARD} p-6`} aria-label="Company profile and fundamentals">
        <h2 className="text-sm font-bold text-slate-900">Company profile and fundamentals</h2>
        <p role="alert" className="mt-2 text-xs text-text-secondary">
          {error?.includes('No NSE stock') ? `No company data found for ${symbol}.` : 'Company data is unavailable right now.'}
        </p>
      </section>
    )
  }

  const r = data.ratios
  const stats: [string, string][] = [
    ['Market cap', crore(r.marketCap)],
    ['P/E', num(r.pe)],
    ['Industry P/E', num(r.industryPe)],
    ['P/B', num(r.pb)],
    ['EPS', r.eps === null ? '—' : `₹${num(r.eps)}`],
    ['ROE', r.roe === null ? '—' : `${num(r.roe)}%`],
    ['Dividend yield', r.dividendYield === null ? '—' : `${num(r.dividendYield)}%`],
    ['Beta', num(r.beta)],
    ['52-week high', r.high52w === null ? '—' : `₹${num(r.high52w)}`],
    ['52-week low', r.low52w === null ? '—' : `₹${num(r.low52w)}`],
  ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className={`${CARD} p-6`} aria-label="Company profile">
        <h2 className="mb-1 text-sm font-bold text-slate-900">{data.name ?? symbol}</h2>
        <div className="mb-4 flex flex-wrap gap-2 text-[11px] font-semibold">
          {[data.sector, data.industry, data.marketCapLabel, data.risk].filter(Boolean).map((t) => (
            <span key={t} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{t}</span>
          ))}
        </div>
        {data.description && <p className="text-sm leading-relaxed text-slate-700">{data.description}</p>}
        {data.isin && <p className="mt-4 text-xs text-slate-500">ISIN {data.isin}</p>}
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-200 pt-4 sm:grid-cols-3">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{k}</dt>
              <dd className="text-sm font-bold text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={`${CARD} p-6`} aria-label="Quarterly results">
        <h2 className="mb-4 text-sm font-bold text-slate-900">Quarterly results</h2>
        {data.quarters.length === 0 ? (
          <p className="text-xs text-text-secondary">Quarterly results are not available for this company.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Last four reported quarters, amounts in INR crore</caption>
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th scope="col" className="py-2 pr-4">Quarter</th>
                  <th scope="col" className="py-2 pr-4 text-right">Revenue</th>
                  <th scope="col" className="py-2 pr-4 text-right">Operating profit</th>
                  <th scope="col" className="py-2 pr-4 text-right">Net income</th>
                  <th scope="col" className="py-2 text-right">EPS</th>
                </tr>
              </thead>
              <tbody>
                {data.quarters.map((q) => (
                  <tr key={q.period} className="border-b border-slate-100 last:border-0">
                    <th scope="row" className="py-2 pr-4 text-left font-semibold text-slate-900">{q.period}</th>
                    <td className="py-2 pr-4 text-right tabular-nums">{num(q.revenue, 0)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{num(q.operatingProfit, 0)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{num(q.netIncome, 0)}</td>
                    <td className="py-2 text-right tabular-nums">{num(q.eps)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-500">Amounts in ₹ crore. Source: Tickertape.</p>
          </div>
        )}
      </section>
    </div>
  )
}
