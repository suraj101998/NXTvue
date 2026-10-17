import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, RefreshCw, ArrowRight, Activity, Zap } from 'lucide-react'
import { useIndices, type IndexQuote } from '@/hooks/useIndices'

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

export function MarketOverviewSection() {
  const navigate = useNavigate()
  const { data, loading, refresh, lastFetched } = useIndices()
  const [selectedMarket, setSelectedMarket] = useState<'india' | 'us'>('india')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'broad' | 'sector' | 'volatility'>('all')

  const indicesList: IndexQuote[] = (data ? (selectedMarket === 'india' ? data.india : data.us) : []) || []

  const getIndexType = (name: string): 'broad' | 'sector' | 'volatility' => {
    const upper = name.toUpperCase()
    if (upper.includes('VIX') || upper.includes('VOLATILITY')) return 'volatility'
    if (
      upper.includes('BANK') ||
      upper.includes('IT') ||
      upper.includes('PHARMA') ||
      upper.includes('AUTO') ||
      upper.includes('FMCG') ||
      upper.includes('METAL') ||
      upper.includes('ENERGY') ||
      upper.includes('FINANCIAL') ||
      upper.includes('MEDIA') ||
      upper.includes('REALTY') ||
      upper.includes('TECH') ||
      upper.includes('HEALTH')
    ) {
      return 'sector'
    }
    return 'broad'
  }

  const filteredIndices = indicesList.filter((item) => {
    const itemType = getIndexType(item.name)
    if (categoryFilter === 'all') return true
    if (categoryFilter === 'broad') return itemType === 'broad'
    if (categoryFilter === 'sector') return itemType === 'sector'
    if (categoryFilter === 'volatility') return itemType === 'volatility'
    return true
  })

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const handleIndexClick = (indexName: string) => {
    // Map index name to ticker query
    const cleanTicker = indexName.replace(/\s+/g, '')
    navigate(`/analysis?ticker=${cleanTicker}&market=${selectedMarket}`)
  }

  return (
    <section className="bg-[#F5F5F5] px-6 py-24" id="market-overview">
      <div className="max-w-[88rem] mx-auto">
        {/* Top Header & Market Selectors */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-black/70 text-xs font-semibold uppercase tracking-wider mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Market Data Feed
            </div>
            <h2
              className="text-4xl md:text-5xl lg:text-6xl font-medium leading-none text-black tracking-tight mb-4"
              style={{ letterSpacing: '-0.04em' }}
            >
              Market Overview
            </h2>
            <p className="text-black/70 text-base md:text-lg max-w-xl leading-relaxed">
              Real-time institutional indices across Indian & US capital markets including NIFTY 50, Sensex, NIFTY Bank, NIFTY Pharma, S&P 500, and Russell 2000.
            </p>
          </div>

          {/* Action and Market Switchers */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            {/* Country Selector Tabs */}
            <div className="flex bg-black/5 p-1.5 rounded-full border border-black/5 shadow-inner">
              <button
                onClick={() => setSelectedMarket('india')}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
                  selectedMarket === 'india'
                    ? 'bg-black text-white shadow-md'
                    : 'text-black/70 hover:text-black'
                }`}
              >
                <IndiaFlagIcon className="w-5 h-3.5 shadow-sm rounded-sm" />
                <span>India (NSE & BSE)</span>
                {data?.india && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    selectedMarket === 'india' ? 'bg-white/20 text-white' : 'bg-black/10 text-black/70'
                  }`}>
                    {data.india.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setSelectedMarket('us')}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
                  selectedMarket === 'us'
                    ? 'bg-black text-white shadow-md'
                    : 'text-black/70 hover:text-black'
                }`}
              >
                <USFlagIcon className="w-5 h-3.5 shadow-sm rounded-sm" />
                <span>US (NYSE & NASDAQ)</span>
                {data?.us && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    selectedMarket === 'us' ? 'bg-white/20 text-white' : 'bg-black/10 text-black/70'
                  }`}>
                    {data.us.length}
                  </span>
                )}
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => refresh()}
              disabled={loading}
              title="Refresh live quotes"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white border border-black/10 text-black text-sm font-medium hover:bg-black hover:text-white transition-colors duration-200 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Sub-Filters: Broad, Sectors, Volatility */}
        <div className="flex items-center justify-between border-b border-black/10 pb-4 mb-8 overflow-x-auto gap-4">
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'All Indices' },
              { id: 'broad', label: 'Broad Benchmarks' },
              { id: 'sector', label: 'Sector Indices' },
              { id: 'volatility', label: 'Volatility' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id as any)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  categoryFilter === tab.id
                    ? 'bg-black text-white'
                    : 'bg-transparent text-black/60 hover:text-black hover:bg-black/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-black/50 font-medium whitespace-nowrap">
            {lastFetched ? `Updated ${lastFetched.toLocaleTimeString()}` : 'Live streaming'}
          </div>
        </div>

        {/* Indices Grid */}
        {loading && filteredIndices.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 h-40 animate-pulse border border-black/5 flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="h-4 bg-black/10 rounded w-24" />
                  <div className="h-4 bg-black/10 rounded w-12" />
                </div>
                <div className="h-8 bg-black/10 rounded w-32" />
                <div className="h-4 bg-black/10 rounded w-20" />
              </div>
            ))}
          </div>
        ) : filteredIndices.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-black/10">
            <Activity className="w-10 h-10 text-black/30 mx-auto mb-3" />
            <p className="text-black font-semibold text-lg">No indices in this category</p>
            <p className="text-black/60 text-sm mt-1">Select "All Indices" to view all available market feeds.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredIndices.map((item) => {
              const isPositive = item.positive ?? item.change >= 0
              const isNeutral = item.change === 0

              return (
                <div
                  key={item.name}
                  onClick={() => handleIndexClick(item.name)}
                  className="bg-white rounded-2xl p-6 border border-black/5 hover:border-black/20 hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer group relative overflow-hidden"
                >
                  {/* Subtle top indicator bar */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 transition-colors ${
                      isPositive ? 'bg-emerald-500' : isNeutral ? 'bg-neutral-300' : 'bg-red-500'
                    }`}
                  />

                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-black/40 block mb-0.5">
                        {item.source} • {getIndexType(item.name)}
                      </span>
                      <h3 className="text-black font-semibold text-base group-hover:text-black tracking-tight">
                        {item.name}
                      </h3>
                    </div>

                    <div
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        isPositive
                          ? 'bg-emerald-50 text-emerald-700'
                          : isNeutral
                          ? 'bg-neutral-100 text-neutral-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {isPositive ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isPositive ? '+' : ''}
                        {item.changePct.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Value and Change row */}
                  <div>
                    <div className="text-2xl font-semibold text-black tracking-tight mb-1 font-mono">
                      {formatNumber(item.value)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-black/60 font-medium">
                      <span>
                        {isPositive ? '+' : ''}
                        {formatNumber(item.change)} pts
                      </span>
                      <span className="text-black/30 group-hover:text-black group-hover:translate-x-0.5 transition-all flex items-center gap-1 font-semibold">
                        Analyze <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
