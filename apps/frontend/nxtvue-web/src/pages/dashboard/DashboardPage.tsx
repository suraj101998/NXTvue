import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIndices } from '@/hooks/useIndices'
import { NxtVueChatbot } from '@/components/dashboard/NxtVueChatbot'
import { QuickStockSearchModal } from '@/components/dashboard/QuickStockSearchModal'
import { Reveal } from '@/components/motion/Reveal'
import { useParallax } from '@/hooks/useParallax'
import { MarketOverviewSection, USFlagIcon } from '@/components/dashboard/MarketOverviewSection'
import { GlobalMarketsSection } from '@/components/dashboard/GlobalMarketsSection'

export function DashboardPage() {
  const navigate = useNavigate()
  const { data: indicesData } = useIndices()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  // Hero depth: the video drifts a little slower than the page, the copy a little faster.
  const videoRef = useParallax<HTMLVideoElement>(0.1, { scale: 1.12, max: 900 })
  const copyRef = useParallax<HTMLDivElement>(-0.06, { max: 700 })

  // Card 1 Quick Stock Form State
  const [quickTicker, setQuickTicker] = useState('')
  const [quickMarket, setQuickMarket] = useState<'india' | 'us'>('india')
  const [quickYear, setQuickYear] = useState<number>(2026)

  const handleQuickAnalyzeSubmit = (e: FormEvent) => {
    e.preventDefault()
    const ticker = quickTicker.trim() || (quickMarket === 'india' ? 'RELIANCE' : 'NVDA')
    navigate(`/analysis?ticker=${ticker.toUpperCase()}&market=${quickMarket}&year=${quickYear}`)
  }

  const indianIndices = indicesData?.india || []
  const usIndices = indicesData?.us || []

  return (
    <>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee 22s linear infinite;
        }
        @keyframes backers-marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .backers-track {
          display: flex;
          width: max-content;
          animation: backers-marquee 30s linear infinite;
        }
      `}</style>
      
      <div className="flex flex-col bg-transparent min-h-screen">
        {/* Hero Section with Video */}
        <div className="flex flex-col overflow-hidden relative" style={{ height: 'calc(100vh - var(--nav-h))' }}>
          {/* Hero Content Box */}
          <main className="flex-1 px-6 pt-6 pb-6 flex items-end">
            <div className="dx-hero relative w-full rounded-[28px] overflow-hidden max-w-[88rem] mx-auto" style={{ height: 'calc(100vh - var(--nav-h) - 48px)' }}>
              <video 
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover dark:saturate-[1.15] dark:contrast-[1.05]"
                autoPlay 
                muted 
                loop 
                playsInline
                src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_161253_c72b1869-400f-45ed-ac0c-52f68c2ed5bd.mp4"
              />
              {/* Dark mode: keep the video bright and only shade the left (text) side and the bottom edge. */}
              <div className="absolute inset-0 hidden dark:block bg-gradient-to-r from-[#070a1c]/85 via-[#0a1030]/45 to-transparent" aria-hidden="true" />
              <div className="absolute inset-0 hidden dark:block bg-gradient-to-t from-[#070a1c]/55 via-transparent to-transparent" aria-hidden="true" />
              
              <div ref={copyRef} className="relative z-10 flex flex-col items-start justify-start h-full p-12 pt-24">
                <h1 
                  className="text-black dark:text-white text-5xl md:text-7xl font-medium leading-[1.02] max-w-2xl mb-5"
                  style={{ letterSpacing: '-0.045em' }}
                >
                  Let Your Wealth<br /><span className="dx-serif">Works</span>
                </h1>
                <p 
                  className="text-black/70 dark:text-white/75 text-base md:text-lg max-w-md mb-8 leading-relaxed font-normal"
                >
                  An automated, reward-powered digital dollar built for native passive earnings and effortless connection into DeFi.
                </p>
                
                <button
                  onClick={() => navigate('/portfolio')}
                  className="inline-flex items-center gap-3 bg-black text-white dark:bg-white dark:text-black text-base md:text-lg font-medium px-8 py-3 rounded-full dx-btn hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-200 cursor-pointer group"
                >
                  Analyze Your Portfolio
                </button>

                {/* Marquee ticker track */}
                <div
                  className="mt-24 w-full max-w-md overflow-hidden relative"
                  style={{
                    maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
                    WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)'
                  }}
                >
                  <div className="marquee-track">
                    {[1, 2].map((loopIndex) => (
                      <div key={loopIndex} className="flex items-center">
                        <span className="mx-7 shrink-0 text-black/60 dark:text-white/60 whitespace-nowrap" style={{ fontFamily: 'Georgia, serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '15px' }}>BSE</span>
                        <span className="mx-7 shrink-0 text-black/60 dark:text-white/60 whitespace-nowrap uppercase" style={{ fontFamily: 'Arial, sans-serif', fontWeight: 900, letterSpacing: '0.08em', fontSize: '13px' }}>NSE</span>
                        <span className="mx-7 shrink-0 text-black/60 dark:text-white/60 whitespace-nowrap italic" style={{ fontFamily: '"Trebuchet MS", sans-serif', fontWeight: 600, letterSpacing: '0.01em', fontSize: '15px' }}>BondScanner</span>
                        <span className="mx-7 shrink-0 text-black/60 dark:text-white/60 whitespace-nowrap uppercase" style={{ fontFamily: '"Courier New", monospace', fontWeight: 700, letterSpacing: '0.12em', fontSize: '13px' }}>INDMoney</span>
                        <span className="mx-7 shrink-0 text-black/60 dark:text-white/60 whitespace-nowrap" style={{ fontFamily: 'Palatino, "Book Antiqua", serif', fontWeight: 400, letterSpacing: '-0.01em', fontSize: '16px' }}>Groww</span>
                        <span className="mx-7 shrink-0 text-black/60 dark:text-white/60 whitespace-nowrap" style={{ fontFamily: 'Impact, "Arial Narrow", sans-serif', fontWeight: 400, letterSpacing: '0.04em', fontSize: '14px' }}>Screener</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* Section 2: Meet Agent NxtVue */}
        <section className="bg-transparent px-6 py-24">
          <div className="max-w-[88rem] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16 items-start">
              <Reveal>
                <div className="dx-eyebrow"><i className="on" />Your market copilot</div>
                <h2 className="dx-h2 mb-8">
                  Meet Agent <em>NxtVue.</em>
                </h2>
                <button
                  onClick={() => navigate('/portfolio?tab=watchlist')}
                  className="inline-flex items-center gap-3 bg-black text-white dark:bg-white dark:text-black text-base font-medium px-8 py-3 rounded-full dx-btn hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-200 cursor-pointer group"
                >
                  View Your Watchlist
                </button>
              </Reveal>
              <Reveal delay={120}>
                <p className="text-black/70 dark:text-[#aab3da] text-2xl md:text-[28px] leading-[1.5] font-normal" style={{ letterSpacing: '-0.015em' }}>
                  Agent NxtVue tracks your Indian and US holdings, watches the markets and explains what moved, so you can decide with the full picture.
                </p>
              </Reveal>
            </div>

            {/* 4 Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Interactive Analyze Your Stock Form with Zoom on Hover */}
              <Reveal
                className="dx-card dx-glass col-span-1 sm:col-span-2 p-7 min-h-[420px] flex flex-col justify-between overflow-hidden group"
              >
                <div
                  className="absolute inset-0 w-full h-full group-hover:scale-110 transition-transform duration-700 ease-out"
                  style={{
                    backgroundImage: 'url("https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260423_164207_f243351d-ed59-48ec-83a0-a5e996bdbe3c.png&w=1280&q=85")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
                <div className="absolute inset-0 hidden dark:block bg-gradient-to-tr from-[#070a1c]/80 via-[#0a1030]/35 to-transparent" aria-hidden="true" />
                <div className="relative z-10">
                  <span className="text-xs font-bold uppercase tracking-wider text-black/60 dark:text-white/70 bg-white/70 dark:bg-white/10 px-2.5 py-1 rounded-full backdrop-blur-sm">
                    Stock Analysis Engine
                  </span>
                  <h3
                    className="text-black dark:text-white text-2xl font-medium leading-snug mt-2 mb-1"
                    style={{ letterSpacing: '-0.02em' }}
                  >
                    Analyze Your Stock
                  </h3>
                  <p className="text-black/70 dark:text-white/75 text-xs font-medium max-w-sm mb-3">
                    Enter any ticker from NSE/BSE or US markets for institutional valuation & risk metrics.
                  </p>
                </div>

                {/* Vertical Compact Form Inputs on Card (Reduced Half-Width & Height) */}
                <form onSubmit={handleQuickAnalyzeSubmit} className="relative z-10 flex flex-col gap-1.5 max-w-[300px] w-full">
                  {/* 1. Ticker Input */}
                  <div>
                    <input
                      type="text"
                      value={quickTicker}
                      onChange={(e) => setQuickTicker(e.target.value)}
                      placeholder="Ticker (RELIANCE, NVDA)..."
                      className="w-full bg-white/95 dark:bg-[#0d1330]/90 backdrop-blur-md border border-black/10 dark:border-white/15 rounded-lg px-2.5 py-1.5 text-[14px] font-semibold text-black dark:text-white placeholder:text-black/60 dark:placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white shadow-sm"
                    />
                  </div>

                  {/* 2. Market Dropdown */}
                  <div>
                    <select
                      aria-label="Market"
                      value={quickMarket}
                      onChange={(e) => setQuickMarket(e.target.value as 'india' | 'us')}
                      className="w-full bg-white/95 dark:bg-[#0d1330]/90 backdrop-blur-md border border-black/10 dark:border-white/15 rounded-lg px-2 py-1.5 text-[14px] font-semibold text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white cursor-pointer shadow-sm"
                    >
                      <option value="india">🇮🇳 India (NSE/BSE)</option>
                      <option value="us">🇺🇸 US (NYSE/NASDAQ)</option>
                    </select>
                  </div>

                  {/* 3. Duration Dropdown */}
                  <div>
                    <select
                      aria-label="Projection horizon"
                      value={quickYear}
                      onChange={(e) => setQuickYear(Number(e.target.value))}
                      className="w-full bg-white/95 dark:bg-[#0d1330]/90 backdrop-blur-md border border-black/10 dark:border-white/15 rounded-lg px-2 py-1.5 text-[14px] font-semibold text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white cursor-pointer shadow-sm"
                    >
                      <option value={2026}>1 Year (2026)</option>
                      <option value={2027}>2 Years (2027)</option>
                      <option value={2028}>3 Years (2028)</option>
                      <option value={2030}>5 Years (2030)</option>
                    </select>
                  </div>

                  {/* 4. Action Buttons (View Live Chart & Analyze) */}
                  <div className="flex gap-2 pt-1.5 w-full">
                    <button
                      type="button"
                      onClick={() => {
                        const ticker = quickTicker.trim() || (quickMarket === 'india' ? 'RELIANCE' : 'NVDA')
                        navigate(`/chart/${encodeURIComponent(ticker.toUpperCase())}?market=${quickMarket}`)
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-black text-white dark:bg-white dark:text-black text-[12px] font-semibold px-3 py-2 rounded-full hover:bg-yellow-600 active:scale-[0.98] transition-all duration-200 shadow-md cursor-pointer"
                    >
                      <span>View Chart</span>
                    </button>
                    <button
                      type="submit"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-black text-white dark:bg-white dark:text-black text-[12px] font-semibold px-3 py-2 rounded-full hover:bg-emerald-600 active:scale-[0.98] transition-all duration-200 shadow-md cursor-pointer group/btn"
                    >
                      <span className="whitespace-nowrap">AI Report</span>
                    </button>
                  </div>
                </form>
              </Reveal>

              {/* Card 2: Indian Market Indices with Live Mini Chips */}
              <Reveal delay={90} className="dx-card ink tight min-h-[380px] flex flex-col text-white group">
                
                {/* Ultra-compact Minimal Header */}
                <div className="relative flex items-center justify-between mb-2.5 pb-2 border-b border-white/[0.08] shrink-0">
                  <div className="flex items-center gap-2">
                    {/* Modern Flag Representation with Drop Shadow */}
                    <div className="relative w-4 h-3 rounded-[2px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.4)] flex flex-col justify-between shrink-0">
                      <div className="bg-[#FF9933] h-[33.3%]"></div>
                      <div className="bg-[#FFFFFF] h-[33.3%] flex items-center justify-center relative">
                        <span className="absolute w-[2px] h-[2px] bg-[#000080] rounded-full"></span>
                      </div>
                      <div className="bg-[#128807] h-[33.3%]"></div>
                    </div>
                    <h3 className="text-[12px] font-semibold tracking-wide uppercase text-white/90">
                      India Indices
                    </h3>
                  </div>
                  {/* Ultra-Premium Live Indicator */}
                  <span className="flex items-center gap-1 text-[9px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.1)]">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                    Live
                  </span>
                </div>

                {/* Dynamic list of Indian live mini chips - Added max-h-[310px] here to force scrolling */}
                <div className="space-y-1.5 overflow-y-auto max-h-[310px] pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {indianIndices.length === 0 ? (
                    <div className="py-6 flex h-full items-center justify-center text-center text-xs text-white/40">
                      Loading Indian market feeds...
                    </div>
                  ) : (
                    indianIndices.map((idx) => {
                      const isPositive = (idx.positive ?? idx.change >= 0)
                      return (
                        <div
                          key={idx.name}
                          onClick={() => navigate(`/analysis?ticker=${idx.name.replace(/\s+/g, '')}&market=india`)}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.02] hover:bg-white/[0.06] hover:border-white/[0.05] transition-all duration-200 cursor-pointer group/item"
                        >
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium text-white/90 group-hover/item:text-white transition-colors leading-normal tracking-tight">
                              {idx.name}
                            </span>
                            <span className="text-[10px] text-white/60 group-hover/item:text-white/70 font-mono mt-0.5">
                              {idx.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5 ${
                              isPositive
                                ? 'bg-emerald-500/10 border border-emerald-500/10 text-emerald-400 shadow-[0_2px_8px_rgba(16,185,129,0.05)]'
                                : 'bg-rose-500/10 border border-rose-500/10 text-rose-300 shadow-[0_2px_8px_rgba(244,63,94,0.05)]'
                            }`}
                          >
                            {isPositive ? '+' : ''}{idx.changePct.toFixed(2)}%
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </Reveal>

              {/* Card 3: US Market Indices with Live Mini Chips */}
              <Reveal delay={180} className="dx-card ink tight min-h-[380px] flex flex-col text-white group">
                
                {/* Ultra-compact Minimal Header */}
                <div className="relative flex items-center justify-between mb-2.5 pb-2 border-b border-white/[0.08] shrink-0">
                  <div className="flex items-center gap-2">
                    <USFlagIcon className="w-4 h-3 rounded-[2px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.4)] shrink-0" />
                    <h3 className="text-[12px] font-semibold tracking-wide uppercase text-white/90">
                      US Indices
                    </h3>
                  </div>
                  {/* Ultra-Premium Live Indicator */}
                  <span className="flex items-center gap-1 text-[9px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.1)]">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                    Live
                  </span>
                </div>

                {/* Dynamic list of US live mini chips */}
                <div className="space-y-1.5 overflow-y-auto max-h-[310px] pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {usIndices.length === 0 ? (
                    <div className="py-6 flex h-full items-center justify-center text-center text-xs text-white/40">
                      Loading US market feeds...
                    </div>
                  ) : (
                    usIndices.map((idx) => {
                      const isPositive = (idx.positive ?? idx.change >= 0)
                      return (
                        <div
                          key={idx.name}
                          onClick={() => navigate(`/analysis?ticker=${idx.name.replace(/\s+/g, '')}&market=us`)}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.02] hover:bg-white/[0.06] hover:border-white/[0.05] transition-all duration-200 cursor-pointer group/item"
                        >
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium text-white/90 group-hover/item:text-white transition-colors leading-normal tracking-tight">
                              {idx.name}
                            </span>
                            <span className="text-[10px] text-white/60 group-hover/item:text-white/70 font-mono mt-0.5">
                              {idx.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5 ${
                              isPositive
                                ? 'bg-emerald-500/10 border border-emerald-500/10 text-emerald-400 shadow-[0_2px_8px_rgba(16,185,129,0.05)]'
                                : 'bg-rose-500/10 border border-rose-500/10 text-rose-300 shadow-[0_2px_8px_rgba(244,63,94,0.05)]'
                            }`}
                          >
                            {isPositive ? '+' : ''}{idx.changePct.toFixed(2)}%
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Section 3: Backers & Partners Marquee */}
        <section className="bg-transparent px-6 py-8 overflow-hidden">
          <Reveal className="max-w-[88rem] mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 items-center border-y border-black/5 dark:border-[#a5b4fc]/15 py-8">
            <div className="col-span-1">
              <p className="dx-sub !mb-0 !leading-[1.7]" style={{ whiteSpace: 'pre-line' }}>
                Powered by trusted{'\n'}market data sources.
              </p>
            </div>
            <div
              className="col-span-1 md:col-span-3 overflow-hidden relative"
              style={{
                maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
                WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)'
              }}
            >
              <div className="backers-track">
                {[1, 2].map((loopIndex) => (
                  <div key={loopIndex} className="flex items-center">
                    <span className="mx-10 shrink-0 text-black/65 dark:text-white/65 whitespace-nowrap" style={{ fontFamily: '"Times New Roman", serif', fontWeight: 400, letterSpacing: '0.02em', fontSize: '14px' }}>BSE</span>
                    <span className="mx-10 shrink-0 text-black/65 dark:text-white/65 whitespace-nowrap uppercase" style={{ fontFamily: '"Arial Black", sans-serif', fontWeight: 900, letterSpacing: '0.08em', fontSize: '16px' }}>NSE</span>
                    <span className="mx-10 shrink-0 text-black/65 dark:text-white/65 whitespace-nowrap" style={{ fontFamily: 'Impact, sans-serif', fontWeight: 700, letterSpacing: '0.05em', fontSize: '18px' }}>IndMoney</span>
                    <span className="mx-10 shrink-0 text-black/65 dark:text-white/65 whitespace-nowrap" style={{ fontFamily: 'Georgia, serif', fontWeight: 600, letterSpacing: '-0.02em', fontSize: '17px' }}>Groww</span>
                    <span className="mx-10 shrink-0 text-black/65 dark:text-white/65 whitespace-nowrap" style={{ fontFamily: 'Helvetica, sans-serif', fontWeight: 700, letterSpacing: '-0.01em', fontSize: '15px' }}>Yahoo Finance</span>
                    <span className="mx-10 shrink-0 text-black/65 dark:text-white/65 whitespace-nowrap uppercase" style={{ fontFamily: 'Verdana, sans-serif', fontWeight: 700, letterSpacing: '0.06em', fontSize: '14px' }}>Screener</span>
                    <span className="mx-10 shrink-0 text-black/65 dark:text-white/65 whitespace-nowrap" style={{ fontFamily: '"Courier New", monospace', fontWeight: 700, letterSpacing: '0.18em', fontSize: '14px' }}>BondScanner</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* Section 4: Live Market Overview Section (Transformed from Use Modes) */}
        <MarketOverviewSection />

        {/* Section 5: TradingView world map + economic map */}
        <GlobalMarketsSection />

        {/* AI Chatbot Floating Component */}
        <NxtVueChatbot />

        {/* Quick Stock Search Modal */}
        <QuickStockSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />
      </div>
    </>
  )
}
