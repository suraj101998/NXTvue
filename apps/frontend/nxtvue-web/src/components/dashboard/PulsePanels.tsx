import type { ReactNode } from 'react'
import { SECTOR_HEATMAP, type IndiaPulse, type Mover } from '@/api/india'
import type { UsPulse } from '@/api/us'
import type { Polled } from '@/hooks/usePolled'
import { Reveal } from '@/components/motion/Reveal'


const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`)
const tone = (v: number | null | undefined) => (v === null || v === undefined ? 'text-black/60 dark:text-white/60 dark:text-white/60' : v >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')
const num = (locale: string) => (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : v.toLocaleString(locale, { maximumFractionDigits: 2 })
const inr = num('en-IN')
const usd = num('en-US')

function Card({ label, title, children, delay = 0 }: { label: string; title: string; children: ReactNode; delay?: number }) {
  return (
    <Reveal as="article" delay={delay} className="dx-card dx-glass" aria-label={label}>
      <h3 className="dx-title">{title}</h3>
      {children}
    </Reveal>
  )
}

function MoversList({ title, rows, prefix, fmt }: { title: string; rows: Mover[]; prefix: string; fmt: (v: number | null) => string }) {
  return (
    <div>
      <h4 className="dx-sub">{title}</h4>
      <ul className="space-y-0.5">
        {rows.map((m) => (
          <li key={m.symbol} className="dx-row flex items-center justify-between text-sm">
            <span className="font-semibold text-black dark:text-white">{m.symbol}</span>
            <span className="tabular-nums text-black/70 dark:text-white/70">{prefix}{fmt(m.price)}</span>
            <span className={`w-16 text-right font-bold tabular-nums ${tone(m.changePct)}`}>{pct(m.changePct)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Breadth({ advances, declines, unchanged, label }: { advances: number; declines: number; unchanged: number; label: string }) {
  const total = Math.max(1, advances + declines + unchanged)
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-semibold">
        <span className="text-emerald-700 dark:text-emerald-400">{advances} advancing</span>
        <span className="text-red-700 dark:text-red-400">{declines} declining</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/15" role="img" aria-label={`${label}: ${advances} advancing, ${declines} declining`}>
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${(advances / total) * 100}%` }} />
        <div className="ml-auto bg-gradient-to-l from-rose-500 to-rose-400" style={{ width: `${(declines / total) * 100}%` }} />
      </div>
    </div>
  )
}

interface SectorRow {
  key: string
  label: string
  changePct: number | null
  /** Smaller text under the name, e.g. advancing/declining counts. */
  hint?: string
}

/** Sector bars. A row with a heatmap behind it is a button; the open one is highlighted. */
function SectorList({
  rows,
  openable,
  active,
  onPick,
}: {
  rows: SectorRow[]
  openable: (key: string) => boolean
  active: string | null
  onPick: (key: string, label: string) => void
}) {
  const shown = rows.filter((r) => r.changePct !== null).sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
  if (shown.length === 0) return <p className="text-xs text-black/60 dark:text-white/60">Sector data unavailable.</p>
  const max = Math.max(...shown.map((r) => Math.abs(r.changePct ?? 0)), 0.5)
  return (
    <>
      <ul className="space-y-1">
        {shown.map((r) => {
          const can = openable(r.key)
          const on = active === r.key
          const body = (
            <>
              <div className="mb-0.5 flex justify-between font-semibold text-black dark:text-white">
                <span>{r.label}</span>
                <span className={`tabular-nums ${tone(r.changePct)}`}>{pct(r.changePct)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10">
                <div
                  className={`h-full rounded-full ${(r.changePct ?? 0) >= 0 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-rose-600 to-rose-400'} transition-[width] duration-700`}
                  style={{ width: `${(Math.abs(r.changePct ?? 0) / max) * 100}%` }}
                />
              </div>
              {r.hint && <div className="dx-note mt-0.5 !text-[10px]">{r.hint}</div>}
            </>
          )
          return (
            <li key={r.key}>
              {can ? (
                <button
                  type="button"
                  onClick={() => onPick(r.key, r.label)}
                  aria-pressed={on}
                  title={`Show ${r.label} stocks as a heatmap`}
                  className={`block w-full cursor-pointer rounded-lg px-2 py-1.5 text-left text-xs transition-all duration-300 hover:bg-black/5 dark:hover:bg-indigo-400/10 hover:translate-x-0.5 ${on ? 'bg-black/5 dark:bg-indigo-400/15 ring-1 ring-black dark:ring-indigo-300/60' : ''}`}
                >
                  {body}
                </button>
              ) : (
                <div className="px-2 py-1 text-xs" title="No stock list is published for this index">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
      <p className="dx-note mt-3 !text-[11px]">Click a sector to see its stocks as a heatmap.</p>
    </>
  )
}

export interface PanelProps<T> {
  pulse: Polled<T>
  /** Key of the sector whose heatmap is open. */
  activeSector: string | null
  onPickSector: (key: string, label: string) => void
}

function Unavailable({ what, error }: { what: string; error: string | null }) {
  return <p role="alert" className="text-sm text-red-700 dark:text-red-400">{what} is unavailable right now{error ? `: ${error}` : ''}.</p>
}

function Loading({ what, hint }: { what: string; hint?: string }) {
  return (
    <p role="status" className="text-sm text-black/60 dark:text-white/60">
      Loading {what}…{hint ? ` ${hint}` : ''}
    </p>
  )
}

const SECTOR_NAMES = new Set(Object.keys(SECTOR_HEATMAP))

export function IndiaPulsePanel({ pulse, activeSector, onPickSector }: PanelProps<IndiaPulse>) {
  const { data, loading, error } = pulse
  if (loading) return <Loading what="India market pulse" />
  if (!data) return <Unavailable what="India market pulse" error={error} />

  const nifty = data.indices?.find((i) => i.name === 'NIFTY 50')
  const vix = data.vix
  const sectors: SectorRow[] = (data.indices ?? [])
    .filter((i) => SECTOR_NAMES.has(i.name))
    .map((i) => ({ key: i.name, label: i.name.replace('NIFTY ', ''), changePct: i.changePct }))

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <Card label="India VIX and breadth" title="Volatility and breadth" delay={0}>
        {vix ? (
          <div className="mb-4">
            <div className="dx-sub">India VIX</div>
            <div className="flex items-baseline gap-3">
              <span className="dx-kpi">{inr(vix.last)}</span>
              <span className={`text-sm font-bold ${tone(vix.changePct)}`}>{pct(vix.changePct)}</span>
            </div>
            {vix.low52w !== null && vix.high52w !== null && (
              <div className="dx-note mt-1.5">52-week {inr(vix.low52w)} to {inr(vix.high52w)}</div>
            )}
          </div>
        ) : (
          <p className="mb-4 text-xs text-black/60 dark:text-white/60">India VIX unavailable.</p>
        )}
        {nifty && nifty.advances !== null && nifty.declines !== null ? (
          <div>
            <Breadth advances={nifty.advances} declines={nifty.declines} unchanged={nifty.unchanged ?? 0} label="NIFTY 50" />
            <div className="dx-note mt-2.5">
              NIFTY 50 P/E {nifty.pe ? inr(nifty.pe) : '—'} · P/B {nifty.pb ? inr(nifty.pb) : '—'}
            </div>
          </div>
        ) : (
          <p className="text-xs text-black/60 dark:text-white/60">Breadth unavailable.</p>
        )}
      </Card>

      <Card label="Top gainers and losers" title="NIFTY 50 movers" delay={90}>
        {data.gainers && data.losers ? (
          <div className="space-y-5">
            <MoversList title="Top gainers" rows={data.gainers.rows} prefix="₹" fmt={inr} />
            <MoversList title="Top losers" rows={data.losers.rows} prefix="₹" fmt={inr} />
          </div>
        ) : (
          <p className="text-xs text-black/60 dark:text-white/60">Movers unavailable.</p>
        )}
      </Card>

      <Card label="FII and DII activity" title="FII / DII cash flows" delay={180}>
        {data.fiiDii && data.fiiDii.length > 0 ? (
          <>
            <ul className="space-y-3">
              {data.fiiDii.map((f) => (
                <li key={f.category} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-black dark:text-white">{f.category}</span>
                    <span className={`font-bold tabular-nums whitespace-nowrap ${tone(f.net)}`}>
                      {f.net !== null && f.net >= 0 ? '+' : ''}₹{inr(f.net)} cr
                    </span>
                  </div>
                  <div className="dx-note mt-0.5 tabular-nums">Buy ₹{inr(f.buy)} · Sell ₹{inr(f.sell)}</div>
                </li>
              ))}
            </ul>
            <p className="dx-note mt-4">Provisional, {data.fiiDii[0].date}. Amounts in ₹ crore.</p>
          </>
        ) : (
          <p className="text-xs text-black/60 dark:text-white/60">FII/DII data unavailable.</p>
        )}
      </Card>

      <Card label="Sector indices today" title="Sectors today" delay={270}>
        <SectorList rows={sectors} openable={(k) => k in SECTOR_HEATMAP} active={activeSector} onPick={onPickSector} />
      </Card>
    </div>
  )
}

export function UsPulsePanel({ pulse, activeSector, onPickSector }: PanelProps<UsPulse>) {
  const { data, loading, error } = pulse
  if (loading) return <Loading what="US market pulse" hint="The first load can take about 15 seconds." />
  if (!data) return <Unavailable what="US market pulse" error={error} />

  const vix = data.vix
  const sectors: SectorRow[] = data.sectors.map((s) => ({
    key: s.name,
    label: s.name,
    changePct: s.changePct,
    hint: `${s.etf} · ${s.advances} up, ${s.declines} down`,
  }))

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <Card label="VIX and breadth" title="Volatility and breadth" delay={0}>
        {vix ? (
          <div className="mb-4">
            <div className="dx-sub">VIX</div>
            <div className="flex items-baseline gap-3">
              <span className="dx-kpi">{usd(vix.last)}</span>
              <span className={`text-sm font-bold ${tone(vix.changePct)}`}>{pct(vix.changePct)}</span>
            </div>
            {vix.low52w !== null && vix.high52w !== null && (
              <div className="dx-note mt-1.5">52-week {usd(vix.low52w)} to {usd(vix.high52w)}</div>
            )}
          </div>
        ) : (
          <p className="mb-4 text-xs text-black/60 dark:text-white/60">VIX unavailable.</p>
        )}
        <Breadth advances={data.breadth.advances} declines={data.breadth.declines} unchanged={data.breadth.unchanged} label="S&P 500" />
        <div className="dx-note mt-2.5">S&P 500, {data.breadth.count} stocks</div>
      </Card>

      <Card label="Top gainers and losers" title="S&P 500 movers" delay={90}>
        <div className="space-y-5">
          <MoversList title="Top gainers" rows={data.gainers} prefix="$" fmt={usd} />
          <MoversList title="Top losers" rows={data.losers} prefix="$" fmt={usd} />
        </div>
      </Card>

      <Card label="Rates, dollar and commodities" title="Rates, dollar and commodities" delay={180}>
        {data.macro.length > 0 ? (
          <>
            <ul className="space-y-3">
              {data.macro.map((m) => (
                <li key={m.name} className="dx-row flex items-center justify-between text-sm">
                  <span className="font-semibold text-black dark:text-white">{m.name}</span>
                  <span className="tabular-nums text-black/70 dark:text-white/70">{usd(m.last)}</span>
                  <span className={`w-16 text-right font-bold tabular-nums ${tone(m.changePct)}`}>{pct(m.changePct)}</span>
                </li>
              ))}
            </ul>
            <p className="dx-note mt-4">
              The US has no free daily FII/DII style flow report. These show where money is moving instead.
            </p>
          </>
        ) : (
          <p className="text-xs text-black/60 dark:text-white/60">Macro data unavailable.</p>
        )}
      </Card>

      <Card label="Sector performance today" title="Sectors today" delay={270}>
        <SectorList rows={sectors} openable={() => true} active={activeSector} onPick={onPickSector} />
      </Card>
    </div>
  )
}
