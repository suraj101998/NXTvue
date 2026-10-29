import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useIndices } from '@/hooks/useIndices'
import { NxtVueChatbot } from '@/components/dashboard/NxtVueChatbot'
import { QuickStockSearchModal } from '@/components/dashboard/QuickStockSearchModal'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { MarketOverviewSection, USFlagIcon } from '@/components/dashboard/MarketOverviewSection'
import { IndiaPulseSection } from '@/components/dashboard/IndiaPulseSection'
import { GlobalMarketsSection } from '@/components/dashboard/GlobalMarketsSection'

const LogoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M 128.005 191.173 C 128.448 156.208 156.93 128 192 128 L 192 64 L 128 64 C 128 99.346 99.346 128 64 128 L 64 192 L 128 192 Z M 192 256 L 64 256 C 28.654 256 0 227.346 0 192 L 0 64 L 64 64 L 64 0 L 192 0 C 227.346 0 256 28.654 256 64 L 256 192 L 192 192 Z" />
  </svg>
)

export function DashboardPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { data: indicesData } = useIndices()
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Card 1 Quick Stock Form State
  const [quickTicker, setQuickTicker] = useState('')
  const [quickMarket, setQuickMarket] = useState<'india' | 'us'>('india')
  const [quickYear, setQuickYear] = useState<number>(2026)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleQuickAnalyzeSubmit = (e: FormEvent) => {
    e.preventDefault()
    const ticker = quickTicker.trim() || (quickMarket === 'india' ? 'RELIANCE' : 'NVDA')
    navigate(`/analysis?ticker=${ticker.toUpperCase()}&market=${quickMarket}&year=${quickYear}`)
  }

  const navItems = [
    { label: 'Charts', path: '/chart' },
    { label: 'Analyze', path: '/analysis' },
    { label: 'My Portfolio', path: '/portfolio' },
    { label: 'About', path: '/about' },
  ]

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
      
      <div className="flex flex-col bg-[#F5F5F5] min-h-screen">
        {/* Hero Section with Video */}
        <div className="h-screen flex flex-col overflow-hidden relative">
          <nav className="absolute top-0 left-0 right-0 z-20 px-6 py-5">
            <div className="flex items-center justify-between max-w-[88rem] mx-auto">
              <Link to="/dashboard" className="flex items-center gap-2">
                <LogoIcon className="w-7 h-7 text-black" />
                <span className="text-2xl font-medium tracking-tight text-black">NxtVue</span>
              </Link>
              
              <div className="hidden md:flex items-center gap-8">
                {navItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.path}
                    className="text-base text-gray-700 hover:text-black font-medium transition-colors duration-200"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <NotificationBell />
                <button
                  onClick={() => navigate('/pricing')}
                  className="bg-black text-white text-base font-medium px-7 py-2.5 rounded-full hover:bg-emerald-600 active:scale-95 transition-all duration-200 cursor-pointer"
                >
                  See Plans
                </button>
                <button
                  onClick={handleLogout}
                  className="bg-black text-white text-base font-medium px-7 py-2.5 rounded-full hover:bg-red-600 active:scale-95 transition-all duration-200 cursor-pointer"
                >
                  Logout
                </button>
              </div>
            </div>
          </nav>

          {/* Hero Content Box */}
          <main className="flex-1 px-6 pt-20 pb-6 flex items-end">
            <div className="relative w-full rounded-2xl overflow-hidden max-w-[88rem] mx-auto" style={{ height: 'calc(100vh - 96px)' }}>
              <video 
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay 
                muted 
                loop 
                playsInline
                src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_161253_c72b1869-400f-45ed-ac0c-52f68c2ed5bd.mp4"
              />
              
              <div className="relative z-10 flex flex-col items-start justify-start h-full p-12 pt-36">
                <h1 
                  className="text-black text-5xl md:text-6xl font-medium leading-tight max-w-xl mb-4"
                  style={{ letterSpacing: '-0.04em' }}
                >
                  Let Your Wealth<br />Works
                </h1>
                <p 
                  className="text-black/70 text-base md:text-lg max-w-md mb-8 leading-relaxed font-normal"
                >
                  An automated, reward-powered digital dollar built for native passive earnings and effortless connection into DeFi.
                </p>
                
                <button
                  onClick={() => navigate('/portfolio')}
                  className="inline-flex items-center gap-3 bg-black text-white text-base md:text-lg font-medium px-8 py-3 rounded-full hover:bg-blue-800 transition-colors duration-200 cursor-pointer group"
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
                        <span className="mx-7 shrink-0 text-black/60 whitespace-nowrap" style={{ fontFamily: 'Georgia, serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '15px' }}>BSE</span>
                        <span className="mx-7 shrink-0 text-black/60 whitespace-nowrap uppercase" style={{ fontFamily: 'Arial, sans-serif', fontWeight: 900, letterSpacing: '0.08em', fontSize: '13px' }}>NSE</span>
                        <span className="mx-7 shrink-0 text-black/60 whitespace-nowrap italic" style={{ fontFamily: '"Trebuchet MS", sans-serif', fontWeight: 600, letterSpacing: '0.01em', fontSize: '15px' }}>BondScanner</span>
                        <span className="mx-7 shrink-0 text-black/60 whitespace-nowrap uppercase" style={{ fontFamily: '"Courier New", monospace', fontWeight: 700, letterSpacing: '0.12em', fontSize: '13px' }}>INDMoney</span>
                        <span className="mx-7 shrink-0 text-black/60 whitespace-nowrap" style={{ fontFamily: 'Palatino, "Book Antiqua", serif', fontWeight: 400, letterSpacing: '-0.01em', fontSize: '16px' }}>Groww</span>
                        <span className="mx-7 shrink-0 text-black/60 whitespace-nowrap" style={{ fontFamily: 'Impact, "Arial Narrow", sans-serif', fontWeight: 400, letterSpacing: '0.04em', fontSize: '14px' }}>Screener</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* Section 2: Meet Agent NxtVue */}
        <section className="bg-[#F5F5F5] px-6 py-24">
          <div className="max-w-[88rem] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16 items-start">
              <div>
                <h2 
                  className="text-black text-4xl md:text-5xl font-medium leading-tight mb-8"
                  style={{ letterSpacing: '-0.03em' }}
                >
                  Meet Agent NxtVue.
                </h2>
                <button
                  onClick={() => navigate('/portfolio?tab=watchlist')}
                  className="inline-flex items-center gap-3 bg-black text-white text-base font-medium px-8 py-3 rounded-full hover:bg-blue-800 transition-colors duration-200 cursor-pointer group"
                >
                  View Your Watchlist
                </button>
              </div>
              <div>
                <p className="text-black/70 text-2xl md:text-3xl leading-relaxed font-normal">
                  Agent NxtVue tracks your Indian and US holdings, watches the markets and explains what moved, so you can decide with the full picture.
                </p>
              </div>
            </div>

            {/* 4 Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Interactive Analyze Your Stock Form with Zoom on Hover */}
              <div
                className="col-span-1 sm:col-span-2 rounded-2xl p-7 min-h-[420px] flex flex-col justify-between relative overflow-hidden shadow-sm border border-black/5 group hover:scale-[1.02] hover:shadow-2xl transition-all duration-500 cursor-pointer"
              >
                <div
                  className="absolute inset-0 w-full h-full group-hover:scale-110 transition-transform duration-700 ease-out"
                  style={{
                    backgroundImage: 'url("https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260423_164207_f243351d-ed59-48ec-83a0-a5e996bdbe3c.png&w=1280&q=85")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
                <div className="relative z-10">
                  <span className="text-xs font-bold uppercase tracking-wider text-black/60 bg-white/70 px-2.5 py-1 rounded-full backdrop-blur-sm">
                    Stock Analysis Engine
                  </span>
                  <h3
                    className="text-black text-2xl font-medium leading-snug mt-2 mb-1"
                    style={{ letterSpacing: '-0.02em' }}
                  >
                    Analyze Your Stock
                  </h3>
                  <p className="text-black/70 text-xs font-medium max-w-sm mb-3">
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
                      className="w-full bg-white/95 backdrop-blur-md border border-black/10 rounded-lg px-2.5 py-1.5 text-[14px] font-semibold text-black placeholder:text-black/60 focus:outline-none focus:ring-2 focus:ring-black shadow-sm"
                    />
                  </div>

                  {/* 2. Market Dropdown */}
                  <div>
                    <select
                      aria-label="Market"
                      value={quickMarket}
                      onChange={(e) => setQuickMarket(e.target.value as 'india' | 'us')}
                      className="w-full bg-white/95 backdrop-blur-md border border-black/10 rounded-lg px-2 py-1.5 text-[14px] font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer shadow-sm"
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
                      className="w-full bg-white/95 backdrop-blur-md border border-black/10 rounded-lg px-2 py-1.5 text-[14px] font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer shadow-sm"
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
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-black text-white text-[12px] font-semibold px-3 py-2 rounded-full hover:bg-yellow-600 active:scale-[0.98] transition-all duration-200 shadow-md cursor-pointer"
                    >
                      <span>View Chart</span>
                    </button>
                    <button
                      type="submit"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-black text-white text-[12px] font-semibold px-3 py-2 rounded-full hover:bg-emerald-600 active:scale-[0.98] transition-all duration-200 shadow-md cursor-pointer group/btn"
                    >
                      <span className="whitespace-nowrap">AI Report</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Card 2: Indian Market Indices with Live Mini Chips */}
              <div className="bg-[#2B2644] rounded-2xl p-4 min-h-[380px] flex flex-col text-white shadow-sm border border-white/5 group hover:scale-[1.02] hover:shadow-2xl transition-all duration-300">
                
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
              </div>

              {/* Card 3: US Market Indices with Live Mini Chips */}
              <div className="bg-[#2B2644] rounded-2xl p-4 min-h-[380px] flex flex-col text-white shadow-sm border border-white/5 group hover:scale-[1.02] hover:shadow-2xl transition-all duration-300">
                
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
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Backers & Partners Marquee */}
        <section className="bg-[#F5F5F5] px-6 py-8 overflow-hidden">
          <div className="max-w-[88rem] mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 items-center border-y border-black/5 py-8">
            <div className="col-span-1">
              <p className="text-black/70 text-base leading-relaxed whitespace-pre-line font-medium">
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
                    <span className="mx-10 shrink-0 text-black/65 whitespace-nowrap" style={{ fontFamily: '"Times New Roman", serif', fontWeight: 400, letterSpacing: '0.02em', fontSize: '14px' }}>BSE</span>
                    <span className="mx-10 shrink-0 text-black/65 whitespace-nowrap uppercase" style={{ fontFamily: '"Arial Black", sans-serif', fontWeight: 900, letterSpacing: '0.08em', fontSize: '16px' }}>NSE</span>
                    <span className="mx-10 shrink-0 text-black/65 whitespace-nowrap" style={{ fontFamily: 'Impact, sans-serif', fontWeight: 700, letterSpacing: '0.05em', fontSize: '18px' }}>IndMoney</span>
                    <span className="mx-10 shrink-0 text-black/65 whitespace-nowrap" style={{ fontFamily: 'Georgia, serif', fontWeight: 600, letterSpacing: '-0.02em', fontSize: '17px' }}>Groww</span>
                    <span className="mx-10 shrink-0 text-black/65 whitespace-nowrap" style={{ fontFamily: 'Helvetica, sans-serif', fontWeight: 700, letterSpacing: '-0.01em', fontSize: '15px' }}>Yahoo Finance</span>
                    <span className="mx-10 shrink-0 text-black/65 whitespace-nowrap uppercase" style={{ fontFamily: 'Verdana, sans-serif', fontWeight: 700, letterSpacing: '0.06em', fontSize: '14px' }}>Screener</span>
                    <span className="mx-10 shrink-0 text-black/65 whitespace-nowrap" style={{ fontFamily: '"Courier New", monospace', fontWeight: 700, letterSpacing: '0.18em', fontSize: '14px' }}>BondScanner</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Live Market Overview Section (Transformed from Use Modes) */}
        <MarketOverviewSection />

        {/* Section 4b: NSE pulse (India VIX, breadth, movers, FII/DII, sectors) */}
        <IndiaPulseSection />

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
