import { fetchIndiaPulse, type IndiaPulse, type Mover } from '@/api/india'
import { usePolled } from '@/hooks/usePolled'

const REFRESH_MS = 60_000
const CARD = 'rounded-3xl bg-white border border-black/5 shadow-sm p-6'

const pct = (v: number | null) => (v === null || v === undefined ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`)
const tone = (v: number | null) => (v === null ? 'text-black/60' : v >= 0 ? 'text-emerald-700' : 'text-red-700')
const inr = (v: number | null) => (v === null || v === undefined ? '—' : v.toLocaleString('en-IN', { maximumFractionDigits: 2 }))

function MoversList({ title, rows }: { title: string; rows: Mover[] }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-black/60">{title}</h4>
      <ul className="space-y-1.5">
        {rows.map((m) => (
          <li key={m.symbol} className="flex items-center justify-between text-sm">
            <span className="font-semibold text-black">{m.symbol}</span>
            <span className="tabular-nums text-black/70">₹{inr(m.price)}</span>
            <span className={`w-16 text-right font-bold tabular-nums ${tone(m.changePct)}`}>{pct(m.changePct)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Net flow in INR crore. Positive = buying. */
function FlowRow({ category, net, buy, sell }: { category: string; net: number | null; buy: number | null; sell: number | null }) {
  return (
    <li className="text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-black">{category}</span>
        <span className={`font-bold tabular-nums whitespace-nowrap ${tone(net)}`}>
          {net !== null && net >= 0 ? '+' : ''}₹{inr(net)} cr
        </span>
      </div>
      <div className="mt-0.5 text-xs text-black/60 tabular-nums">
        Buy ₹{inr(buy)} · Sell ₹{inr(sell)}
      </div>
    </li>
  )
}

export function IndiaPulseSection() {
  const { data, loading, error, updatedAt } = usePolled<IndiaPulse>('pulse', fetchIndiaPulse, REFRESH_MS)

  if (loading) {
    return (
      <section className="bg-[#F5F5F5] px-6 pb-16" aria-label="India market pulse">
        <div className="mx-auto max-w-[88rem]">
          <p role="status" className="text-sm text-black/60">Loading India market pulse…</p>
        </div>
      </section>
    )
  }
  if (!data) {
    return (
      <section className="bg-[#F5F5F5] px-6 pb-16" aria-label="India market pulse">
        <div className="mx-auto max-w-[88rem]">
          <p role="alert" className="text-sm text-red-700">India market pulse is unavailable right now{error ? `: ${error}` : ''}.</p>
        </div>
      </section>
    )
  }

  const nifty = data.indices?.find((i) => i.name === 'NIFTY 50')
  const open = data.status?.status === 'Open'
  const vix = data.vix

  return (
    <section className="bg-[#F5F5F5] px-6 pb-16" id="india-pulse" aria-labelledby="india-pulse-title">
      <div className="mx-auto max-w-[88rem]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="india-pulse-title" className="text-3xl font-medium tracking-tight text-black md:text-4xl" style={{ letterSpacing: '-0.04em' }}>
              India market pulse
            </h2>
            <p className="mt-1 text-sm text-black/70">NSE data. Updates every minute{open ? '' : ' (market is closed, figures are from the last session)'}.</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${open ? 'bg-emerald-50 text-emerald-700' : 'bg-black/5 text-black/70'}`}>
              <span className={`h-2 w-2 rounded-full ${open ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
              {data.status?.status ?? 'Status unknown'}
            </span>
            {updatedAt && <span className="text-black/60">{data.stale || error ? 'Last good data, ' : ''}updated {updatedAt.toLocaleTimeString()}</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <article className={CARD} aria-label="India VIX and breadth">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-black/60">Volatility and breadth</h3>
            {vix ? (
              <div className="mb-4">
                <div className="text-xs text-black/60">India VIX</div>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-3xl font-semibold text-black">{inr(vix.last)}</span>
                  <span className={`text-sm font-bold ${tone(vix.changePct)}`}>{pct(vix.changePct)}</span>
                </div>
                {vix.low52w !== null && vix.high52w !== null && (
                  <div className="mt-1 text-xs text-black/60">52-week {inr(vix.low52w)} to {inr(vix.high52w)}</div>
                )}
              </div>
            ) : (
              <p className="mb-4 text-xs text-black/60">India VIX unavailable.</p>
            )}
            {nifty && nifty.advances !== null && nifty.declines !== null ? (
              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold">
                  <span className="text-emerald-700">{nifty.advances} advancing</span>
                  <span className="text-red-700">{nifty.declines} declining</span>
                </div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-black/10" role="img" aria-label={`NIFTY 50: ${nifty.advances} advancing, ${nifty.declines} declining`}>
                  <div className="bg-emerald-500" style={{ width: `${(nifty.advances / Math.max(1, nifty.advances + nifty.declines + (nifty.unchanged ?? 0))) * 100}%` }} />
                  <div className="ml-auto bg-red-500" style={{ width: `${(nifty.declines / Math.max(1, nifty.advances + nifty.declines + (nifty.unchanged ?? 0))) * 100}%` }} />
                </div>
                <div className="mt-2 text-xs text-black/60">
                  NIFTY 50 P/E {nifty.pe ? inr(nifty.pe) : '—'} · P/B {nifty.pb ? inr(nifty.pb) : '—'}
                </div>
              </div>
            ) : (
              <p className="text-xs text-black/60">Breadth unavailable.</p>
            )}
          </article>

          <article className={CARD} aria-label="Top gainers and losers">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-black/60">NIFTY 50 movers</h3>
            {data.gainers && data.losers ? (
              <div className="space-y-5">
                <MoversList title="Top gainers" rows={data.gainers.rows} />
                <MoversList title="Top losers" rows={data.losers.rows} />
              </div>
            ) : (
              <p className="text-xs text-black/60">Movers unavailable.</p>
            )}
          </article>

          <article className={CARD} aria-label="FII and DII activity">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-black/60">FII / DII cash flows</h3>
            {data.fiiDii && data.fiiDii.length > 0 ? (
              <>
                <ul className="space-y-3">
                  {data.fiiDii.map((f) => (
                    <FlowRow key={f.category} category={f.category} net={f.net} buy={f.buy} sell={f.sell} />
                  ))}
                </ul>
                <p className="mt-3 text-xs text-black/60">Provisional, {data.fiiDii[0].date}. Amounts in ₹ crore.</p>
              </>
            ) : (
              <p className="text-xs text-black/60">FII/DII data unavailable.</p>
            )}
          </article>

          <article className={CARD} aria-label="Sector indices today">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-black/60">Sectors today</h3>
            <SectorList indices={data.indices} />
          </article>
        </div>
      </div>
    </section>
  )
}

const SECTOR_NAMES = new Set([
  'NIFTY BANK', 'NIFTY IT', 'NIFTY PHARMA', 'NIFTY AUTO', 'NIFTY FMCG', 'NIFTY METAL', 'NIFTY REALTY', 'NIFTY MEDIA',
  'NIFTY PSU BANK', 'NIFTY PRIVATE BANK', 'NIFTY FINANCIAL SERVICES', 'NIFTY OIL & GAS', 'NIFTY CONSUMER DURABLES',
  'NIFTY HEALTHCARE INDEX', 'NIFTY CHEMICALS', 'NIFTY CEMENT',
])

function SectorList({ indices }: { indices: IndiaPulse['indices'] }) {
  const rows = (indices ?? [])
    .filter((i) => SECTOR_NAMES.has(i.name) && i.changePct !== null)
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
  if (rows.length === 0) return <p className="text-xs text-black/60">Sector data unavailable.</p>
  const max = Math.max(...rows.map((r) => Math.abs(r.changePct ?? 0)), 0.5)
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.name} className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs">
          <div>
            <div className="mb-0.5 flex justify-between font-semibold text-black">
              <span>{r.name.replace('NIFTY ', '')}</span>
              <span className={`tabular-nums ${tone(r.changePct)}`}>{pct(r.changePct)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/5">
              <div
                className={`h-full rounded-full ${(r.changePct ?? 0) >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                style={{ width: `${(Math.abs(r.changePct ?? 0) / max) * 100}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
