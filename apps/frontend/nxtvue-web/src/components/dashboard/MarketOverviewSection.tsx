import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { chartPath } from '@/utils/resolveSymbol'
import { RefreshButton } from '@/components/layout/PageActions'
import { Reveal } from '@/components/motion/Reveal'
import { useIndices } from '@/hooks/useIndices'
import { usePolled } from '@/hooks/usePolled'
import { fetchIndiaHeatmap, fetchIndiaPulse, SECTOR_HEATMAP, type IndiaPulse } from '@/api/india'
import { fetchUsHeatmap, fetchUsPulse, type UsPulse } from '@/api/us'
import { StockHeatmap } from '@/components/dashboard/StockHeatmap'
import { IndiaPulsePanel, UsPulsePanel } from '@/components/dashboard/PulsePanels'

type Market = 'india' | 'us'

const PULSE_REFRESH_MS = 60_000

// Rich SVG Flag for India
export const IndiaFlagIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="8" fill="#FF9933" rx="2" />
    <rect y="8" width="36" height="8" fill="#FFFFFF" />
    <rect y="16" width="36" height="8" fill="#128807" rx="2" />
    {/* Ashoka Chakra */}
    <circle cx="18" cy="12" r="3.2" stroke="#000080" strokeWidth="0.8" fill="none" />
    <circle cx="18" cy="12" r="0.6" fill="#000080" />
    <path d="M18 9v6M15 12h6M15.8 9.8l4.4 4.4M15.8 14.2l4.4-4.4" stroke="#000080" strokeWidth="0.4" />
  </svg>
)

// Rich SVG Flag for United States
export const USFlagIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="24" rx="2" fill="#B22234" />
    <path d="M0 3.7h36v3.7H0zm0 7.4h36v3.7H0zm0 7.4h36v1.8H0z" fill="#FFFFFF" />
    <rect width="16" height="13" rx="1.5" fill="#3C3B6E" />
    {/* Mini stars representation */}
    <circle cx="4" cy="3.5" r="0.9" fill="#FFFFFF" />
    <circle cx="8" cy="3.5" r="0.9" fill="#FFFFFF" />
    <circle cx="12" cy="3.5" r="0.9" fill="#FFFFFF" />
    <circle cx="6" cy="6.5" r="0.9" fill="#FFFFFF" />
    <circle cx="10" cy="6.5" r="0.9" fill="#FFFFFF" />
    <circle cx="4" cy="9.5" r="0.9" fill="#FFFFFF" />
    <circle cx="8" cy="9.5" r="0.9" fill="#FFFFFF" />
    <circle cx="12" cy="9.5" r="0.9" fill="#FFFFFF" />
  </svg>
)

interface OpenSector {
  market: Market
  key: string
  label: string
}

export function MarketOverviewSection() {
  const navigate = useNavigate()
  const { data: indices, refresh: refreshIndices } = useIndices()
  const [market, setMarket] = useState<Market>('india')
  const [openSector, setOpenSector] = useState<OpenSector | null>(null)
  const [heatmapReload, setHeatmapReload] = useState(0)
  const heatmapRef = useRef<HTMLDivElement>(null)

  // Only the market on screen is polled. The US snapshot is heavy, so it stays idle until picked.
  const india = usePolled<IndiaPulse>(market === 'india' ? 'india-pulse' : null, fetchIndiaPulse, PULSE_REFRESH_MS)
  const us = usePolled<UsPulse>(market === 'us' ? 'us-pulse' : null, fetchUsPulse, PULSE_REFRESH_MS)
  const pulse = market === 'india' ? india : us

  const status = market === 'india' ? india.data?.status?.status : us.data?.status?.status
  const open = status === 'Open'
  const stale = pulse.data?.stale || (pulse.error !== null && pulse.data !== null)
  const benchmarks = (indices ? indices[market] : []).filter((i) => i.type === 'broad')

  const switchMarket = (next: Market) => {
    if (next === market) return
    setMarket(next)
    setOpenSector(null)
  }

  const refreshAll = () => {
    pulse.refresh()
    refreshIndices()
    setHeatmapReload((n) => n + 1)
  }

  // Clicking the open sector again closes its heatmap.
  const pickSector = (key: string, label: string) => {
    const same = openSector?.market === market && openSector.key === key
    setOpenSector(same ? null : { market, key, label })
    if (!same) requestAnimationFrame(() => heatmapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const activeKey = openSector?.market === market ? openSector.key : null
  const tab = (id: Market, flag: ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => switchMarket(id)}
      aria-pressed={market === id}
      className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
        market === id ? 'bg-black text-white dark:bg-white dark:text-[#0b1030] shadow-[0_6px_18px_-6px_rgba(99,102,241,.7)]' : 'text-black/70 hover:text-black dark:text-[#98a2c8] dark:hover:text-white'
      }`}
    >
      {flag}
      <span>{label}</span>
    </button>
  )

  return (
    <section className="bg-transparent px-6 py-28" id="market-overview" aria-labelledby="market-overview-title">
      <div className="max-w-[88rem] mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-10">
          <Reveal>
            <div className="dx-eyebrow">
              <i className={open ? 'on' : ''} />
              {status ? `${market === 'india' ? 'NSE' : 'US'} market ${status.toLowerCase()}` : 'Live Market Data Feed'}
            </div>
            <h2 id="market-overview-title" className="dx-h2">
              Market <em>Overview</em>
            </h2>
            <p className="dx-lead">
              {market === 'india'
                ? 'India VIX, breadth, movers, FII/DII flows and sectors from NSE. Pick a sector to see its stocks.'
                : 'VIX, S&P 500 breadth, movers, rates and sectors from Yahoo Finance. Pick a sector to see its stocks.'}
            </p>
          </Reveal>

          <Reveal delay={120} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="dx-seg">
              {tab('india', <IndiaFlagIcon className="w-5 h-3.5 shadow-sm rounded-sm" />, 'India (NSE & BSE)')}
              {tab('us', <USFlagIcon className="w-5 h-3.5 shadow-sm rounded-sm" />, 'US (NYSE & NASDAQ)')}
            </div>
            <RefreshButton onClick={refreshAll} loading={pulse.loading} title="Refresh market data" />
          </Reveal>
        </div>

        {/* Broad benchmarks only. Sector indices live in "Sectors today" below. */}
        {benchmarks.length > 0 && (
          <ul className="mb-6 flex flex-wrap gap-3" aria-label="Benchmark indices">
            {benchmarks.map((b) => (
              <li key={b.name} className="dx-chip">
                <span className="font-semibold text-black dark:text-white">{b.name}</span>
                <span className="font-mono tabular-nums text-black/70 dark:text-white/70">
                  {b.value.toLocaleString(market === 'india' ? 'en-IN' : 'en-US', { maximumFractionDigits: 2 })}
                </span>
                <span className={`font-bold tabular-nums ${b.positive ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                  {b.positive ? '+' : ''}
                  {b.changePct.toFixed(2)}%
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-black/55 dark:text-[#8793c0]">
          {pulse.updatedAt && (
            <span>
              {stale ? 'Last good data, ' : ''}updated {pulse.updatedAt.toLocaleTimeString()}
            </span>
          )}
          {status && !open && <span>Market is closed, figures are from the last session.</span>}
        </div>

        {market === 'india' ? (
          <IndiaPulsePanel pulse={india} activeSector={activeKey} onPickSector={pickSector} />
        ) : (
          <UsPulsePanel pulse={us} activeSector={activeKey} onPickSector={pickSector} />
        )}

        {openSector && openSector.market === market && (
          <div ref={heatmapRef} className="dx-card dx-glass flush mt-8" aria-label={`${openSector.label} heatmap`}>
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
              <h3 className="dx-title !mb-0">
                {market === 'india' ? 'NIFTY' : 'S&P 500'} {openSector.label} heatmap
              </h3>
              <button
                type="button"
                onClick={() => setOpenSector(null)}
                className="shrink-0 px-3 py-1.5 rounded-full border border-black/10 dark:border-white/20 text-xs font-semibold text-black dark:text-white dx-btn hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black cursor-pointer"
              >
                Close
              </button>
            </div>
            {market === 'india' ? (
              <StockHeatmap
                id={`india:${openSector.key}`}
                label={openSector.label}
                load={(signal) => fetchIndiaHeatmap(SECTOR_HEATMAP[openSector.key], signal)}
                refreshSignal={heatmapReload}
                onSelect={(symbol) => navigate(chartPath(symbol, 'india'))}
              />
            ) : (
              <StockHeatmap
                id={`us:${openSector.key}`}
                label={openSector.label}
                currency={{ symbol: '$', locale: 'en-US' }}
                load={(signal) => fetchUsHeatmap(openSector.key, signal)}
                refreshSignal={heatmapReload}
                onSelect={(symbol) => navigate(chartPath(symbol, 'us'))}
              />
            )}
          </div>
        )}
      </div>
    </section>
  )
}
