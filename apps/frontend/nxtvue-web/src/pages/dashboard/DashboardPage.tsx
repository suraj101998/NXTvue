import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Metric, MetricGroup } from '@/components/ui/Metric'
import { AIInsight } from '@/components/ui/AIInsight'
import { EmptyState } from '@/components/feedback/EmptyState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { MarketOverview } from '@/components/ui/MarketOverview'
import { cn } from '@/utils/cn'
import { ArrowRight, Sparkles, Bot, MessageCircle, X, Send, BarChart3, Zap, Target, Search } from 'lucide-react'

const recentAnalyses = [
  { asset: 'RELIANCE', type: 'Equity', date: '2 hours ago', insight: 'Bullish breakout confirmed' },
  { asset: 'TCS', type: 'Equity', date: '5 hours ago', insight: 'Valuation stretched, wait for pullback' },
  { asset: 'HDFCBANK', type: 'Equity', date: '1 day ago', insight: 'Strong fundamentals, accumulating' },
  { asset: 'ICICIBANK', type: 'Equity', date: '2 days ago', insight: 'Risk-adjusted return favorable' },
]

const opportunities = [
  { asset: 'BAJFINANCE', type: 'NBFC', reason: 'Oversold on technical indicators', score: 87 },
  { asset: 'TATAMOTORS', type: 'Auto', reason: 'EV pivot gaining momentum', score: 82 },
  { asset: 'SUNPHARMA', type: 'Pharma', reason: 'US generic pipeline expansion', score: 79 },
]

export function DashboardPage() {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
    { role: 'model', text: 'Good morning! Markets opened positive today. NIFTY 50 up 1.2%. Your portfolio technology allocation has increased to 42% — would you like me to analyze the concentration risk?' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMsg = input.trim()
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setInput('')
    setIsLoading(true)

    // Simulate AI response
    await new Promise(resolve => setTimeout(resolve, 1000))
    const responses = [
      'Based on current market data, your portfolio shows elevated technology concentration at 42%. Consider rebalancing towards financials and healthcare for better diversification.',
      'The NIFTY 50 is testing resistance at 24,900. A decisive break above could signal continuation toward 25,200. Watch for volume confirmation.',
      'RELIANCE has broken out of a 3-month consolidation. Volume supports the move. Target: 2,850. Stop: 2,650.',
      'Your SIP in HDFC Top 100 Fund is due tomorrow. The fund has outperformed its benchmark by 2.3% over 3 years.',
    ]
    setMessages(prev => [...prev, { role: 'model', text: responses[Math.floor(Math.random() * responses.length)] }])
    setIsLoading(false)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setShowSearchResults(query.length > 0)
  }

  const mockSearchResults = [
    { name: 'Reliance Industries', symbol: 'RELIANCE', type: 'Equity', price: '2,745.30', change: '+1.8%' },
    { name: 'TCS', symbol: 'TCS', type: 'Equity', price: '4,120.50', change: '+0.5%' },
    { name: 'HDFC Bank', symbol: 'HDFCBANK', type: 'Equity', price: '1,680.25', change: '-0.2%' },
    { name: 'ICICI Prudential', symbol: 'ICICIPRULI', type: 'Mutual Fund', price: '680.40', change: '+0.8%' },
  ].filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.symbol.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Hero Section with Video */}
      <section className="relative min-h-[90vh] flex items-end overflow-hidden">
        <video
          className="absolute inset-0 w-full h-full object-cover opacity-30"
          autoPlay
          muted
          loop
          playsInline
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_161253_c72b1869-400f-45ed-ac0c-52f68c2ed5bd.mp4"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/60 via-bg-primary/30 to-bg-primary/60" />

        <div className="relative z-10 w-full px-6 lg:px-12 xl:px-16 pb-16">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-16">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="font-heading font-medium leading-tight text-text-primary"
                  style={{ fontSize: 'clamp(3rem, 6vw, 5rem)', letterSpacing: '-0.04em' }}
                >
                  Good morning, Suraj.<br />Markets are moving.
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="text-text-secondary max-w-xl mt-4 text-lg"
                >
                  NXTvue has identified a few things worth your attention today.
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <Link to="/analysis" className="btn-primary w-full sm:w-auto justify-center gap-2">
                  <Search className="w-4 h-4" />
                  Analyze Investment
                </Link>
                <Link to="/portfolio" className="btn-secondary w-full sm:w-auto justify-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  View Portfolio
                </Link>
              </motion.div>
            </div>

            {/* Market Overview — live indices */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mb-8"
            >
              <MarketOverview />
            </motion.div>
          </div>
        </div>

        {/* Partners Marquee */}
        <div className="absolute bottom-0 left-0 right-0 px-6 lg:px-8 pb-8 overflow-hidden" style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}>
          <div className="flex animate-marquee-slow" style={{ animationDuration: '30s' }}>
            {['Fundamental Labs', 'KUCOIN', 'NGC', 'NxGen', 'Matter Labs', 'DEXTools', 'NGRAVE', 'Polychain'].map((name, i) => (
              <span key={i} className="mx-10 shrink-0 whitespace-nowrap text-text-secondary/50" style={{
                fontFamily: i === 1 ? '"Arial Black", sans-serif' : i === 2 ? 'Impact, sans-serif' : i === 3 ? 'Georgia, serif' : i === 4 ? 'Helvetica, sans-serif' : i === 5 ? 'Verdana, sans-serif' : i === 6 ? '"Courier New", monospace' : 'Palatino, serif',
                fontWeight: i === 1 || i === 2 || i === 6 ? 900 : i === 3 ? 600 : i === 4 || i === 7 ? 700 : 500,
                letterSpacing: i === 1 ? '0.08em' : i === 2 ? '0.05em' : i === 3 ? '-0.02em' : i === 6 ? '0.18em' : i === 5 ? '0.06em' : '0.03em',
                fontSize: i === 2 ? '18px' : i === 6 ? '14px' : '15px',
                textTransform: i === 1 || i === 5 ? 'uppercase' : 'none'
              }}>
                {name}
              </span>
            ))}
            {['Fundamental Labs', 'KUCOIN', 'NGC', 'NxGen', 'Matter Labs', 'DEXTools', 'NGRAVE', 'Polychain'].map((name, i) => (
              <span key={`${i}-dup`} className="mx-10 shrink-0 whitespace-nowrap text-text-secondary/50" aria-hidden="true" style={{
                fontFamily: i === 1 ? '"Arial Black", sans-serif' : i === 2 ? 'Impact, sans-serif' : i === 3 ? 'Georgia, serif' : i === 4 ? 'Helvetica, sans-serif' : i === 5 ? 'Verdana, sans-serif' : i === 6 ? '"Courier New", monospace' : 'Palatino, serif',
                fontWeight: i === 1 || i === 2 || i === 6 ? 900 : i === 3 ? 600 : i === 4 || i === 7 ? 700 : 500,
                letterSpacing: i === 1 ? '0.08em' : i === 2 ? '0.05em' : i === 3 ? '-0.02em' : i === 6 ? '0.18em' : i === 5 ? '0.06em' : '0.03em',
                fontSize: i === 2 ? '18px' : i === 6 ? '14px' : '15px',
                textTransform: i === 1 || i === 5 ? 'uppercase' : 'none'
              }}>
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="px-6 lg:px-12 xl:px-16 pb-16">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Investment Search / Explore */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-2xl font-semibold text-text-primary">Explore Investments</h2>
                <p className="text-text-secondary mt-1">Search stocks, ETFs, mutual funds, bonds, and fixed deposits</p>
              </div>
            </div>

            <div className="relative">
              <div className="glass-card-strong p-2">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="text"
                    placeholder="What do you want to understand? Search stocks, ETFs, funds, bonds..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => setShowSearchResults(true)}
                    onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                    className="w-full bg-transparent border-none px-12 py-4 text-lg text-text-primary placeholder-text-muted focus:outline-none font-sans"
                    autoComplete="off"
                  />
                </div>
              </div>

              {showSearchResults && searchQuery && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full left-0 right-0 mt-2 glass-card-strong rounded-xl shadow-xl border border-border-default overflow-hidden z-50"
                >
                  <div className="p-3 border-b border-border-subtle">
                    <p className="text-sm text-text-muted">Showing results for "{searchQuery}"</p>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {mockSearchResults.map((result) => (
                      <Link
                        key={result.symbol}
                        to={`/analysis/${result.symbol}`}
                        className="flex items-center justify-between px-4 py-3 hover:bg-bg-glass transition-colors border-b border-border-subtle last:border-0"
                        onClick={() => setShowSearchResults(false)}
                      >
                        <div>
                          <p className="font-medium text-text-primary">{result.name}</p>
                          <p className="text-sm text-text-muted flex items-center gap-2">
                            <span className="px-2 py-0.5 text-xs bg-bg-tertiary rounded">{result.type}</span>
                            <span className="text-text-secondary">{result.symbol}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-heading font-semibold text-text-primary">{result.price}</p>
                          <p className={cn('text-sm font-mono', result.change.startsWith('+') ? 'text-green-400' : 'text-red-400')}>
                            {result.change}
                          </p>
                        </div>
                      </Link>
                    ))}
                    {mockSearchResults.length === 0 && (
                      <div className="p-8 text-center text-text-muted">No results found</div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.section>

          {/* NXTvue AI Analyst */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="glass-card-strong overflow-hidden">
              <div className="p-6 border-b border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-400/10">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="font-heading text-lg font-semibold text-text-primary">NXTvue Analyst</h2>
                    <p className="text-text-secondary text-sm">AI-powered investment intelligence</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className={cn('p-2 rounded-lg transition-colors', isChatOpen ? 'bg-bg-glass text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-bg-glass')}
                >
                  {isChatOpen ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
                </button>
              </div>

              <div className="p-6 space-y-4">
                <AIInsight type="insight" title="Technology Concentration Risk">
                  Your portfolio technology allocation has increased to 42%, contributing more to portfolio-level volatility. Consider rebalancing towards financials (21%) and healthcare (12%) for improved diversification.
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/portfolio/intelligence">Explore Portfolio Intelligence</Link>
                    </Button>
                    <Button variant="ghost" size="sm">View Details</Button>
                  </div>
                </AIInsight>

                <AIInsight type="analysis" title="Market Regime Shift Detected">
                  NIFTY 50 has broken above the 200-day SMA with increasing volume. Historical data suggests 68% probability of continued upside over the next 3 months when this pattern occurs with RSI below 70.
                </AIInsight>

                <AIInsight type="recommendation" title="SIP Optimization Opportunity">
                  Your monthly SIP of ₹50,000 could be optimized. Redirecting ₹15,000 from large-cap to flexi-cap category may improve 3-year expected returns by ~1.2% annually based on current factor analysis.
                </AIInsight>
              </div>
            </div>
          </motion.section>

          {/* Recent Analysis & Opportunities */}
          <div className="grid lg:grid-cols-2 gap-8">
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-xl font-semibold text-text-primary">Recent Analysis</h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/analysis">View All</Link>
                </Button>
              </div>
              <div className="glass-card-strong divide-y divide-border-subtle">
                {recentAnalyses.map((analysis, i) => (
                  <Link key={analysis.asset} to={`/analysis/${analysis.asset}`} className="flex items-center justify-between p-4 hover:bg-bg-glass transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-heading font-semibold text-text-primary">{analysis.asset}</span>
                        <span className="px-2 py-0.5 text-xs bg-bg-tertiary rounded text-text-muted">{analysis.type}</span>
                      </div>
                      <p className="text-sm text-text-secondary">{analysis.insight}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-text-muted">{analysis.date}</p>
                      <ArrowRight className="w-5 h-5 text-text-muted mx-auto mt-1" />
                    </div>
                  </Link>
                ))}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-xl font-semibold text-text-primary">Investment Opportunities</h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/compare">Compare</Link>
                </Button>
              </div>
              <div className="glass-card-strong divide-y divide-border-subtle">
                {opportunities.map((opp, i) => (
                  <div key={opp.asset} className="flex items-center justify-between p-4 hover:bg-bg-glass transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400/20 to-indigo-500/20 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-heading font-semibold text-text-primary">{opp.asset}</p>
                        <p className="text-sm text-text-muted">{opp.type} • {opp.reason}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Target className="w-4 h-4 text-green-400" />
                        <span className="font-heading font-bold text-green-400">{opp.score}/100</span>
                      </div>
                      <p className="text-xs text-text-muted">NXTvue Score</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>
          </div>

          {/* Portfolio Snapshot */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-heading text-xl font-semibold text-text-primary">Portfolio Snapshot</h2>
                <p className="text-text-secondary">Total value: ₹2.48 Cr • Today: +₹1.24L (+0.5%)</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" asChild>
                  <Link to="/portfolio">View Portfolio</Link>
                </Button>
                <Button variant="primary" asChild>
                  <Link to="/portfolio/intelligence">View Intelligence</Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricGroup columns={1}>
                <Metric value="₹2.48 Cr" label="Total Value" change="+0.5%" changeType="positive" prefix="₹" />
                <Metric value="₹1.95 Cr" label="Invested" change="+27.2%" changeType="positive" prefix="₹" />
                <Metric value="₹0.53 Cr" label="P&L" change="+14.8%" changeType="positive" prefix="₹" />
                <Metric value="18.4%" label="XIRR" change="vs 12.1% NIFTY" changeType="positive" suffix="%" />
              </MetricGroup>
            </div>

            <div className="glass-card-strong p-6 mt-6">
              <h3 className="font-heading text-lg font-semibold text-text-primary mb-4">Asset Allocation</h3>
              <div className="flex flex-wrap gap-4">
                {[
                  { name: 'Equities', value: '62%', color: 'bg-blue-400' },
                  { name: 'Mutual Funds', value: '28%', color: 'bg-indigo-400' },
                  { name: 'Fixed Income', value: '8%', color: 'bg-green-400' },
                  { name: 'Cash', value: '2%', color: 'bg-amber-400' },
                ].map((asset) => (
                  <div key={asset.name} className="flex items-center gap-3 px-4 py-2 bg-bg-glass rounded-xl border border-border-subtle">
                    <div className={`w-3 h-3 rounded-full ${asset.color}`} />
                    <span className="font-medium text-text-primary">{asset.name}</span>
                    <span className="font-heading font-bold text-text-primary ml-auto">{asset.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        </div>
      </main>

      {/* NXTvue AI Chatbot */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <div className="w-[calc(100vw-3rem)] sm:w-[400px] h-[500px] max-h-[70vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-black/10">
              <div className="bg-black p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 p-2 rounded-full">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium text-sm">NXTvue AI</h3>
                    <p className="text-white/60 text-xs">Always here to help</p>
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="text-white/60 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 p-4 overflow-y-auto bg-[#F9F9F9] flex flex-col gap-4">
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'model' && (
                      <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center mr-2 shrink-0 mt-1">
                        <Bot className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className={cn(
                      'max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-black text-white rounded-tr-sm'
                        : 'bg-white border border-black/5 text-black/80 rounded-tl-sm shadow-sm'
                    )}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start items-end"
                  >
                    <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center mr-2 shrink-0">
                      <Bot className="w-3 h-3 text-white" />
                    </div>
                    <div className="bg-white border border-black/5 p-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-black/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-black/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-black/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSend} className="p-4 bg-white border-t border-black/5 flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your portfolio, markets, or investments..."
                  className="flex-1 bg-[#F5F5F5] rounded-full px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/10"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="bg-black text-white p-2.5 rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {!isChatOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-black rounded-full shadow-lg flex items-center justify-center hover:bg-gray-800 transition-transform hover:scale-105 active:scale-95"
            aria-label="Open NXTvue AI Assistant"
          >
            <MessageCircle className="w-6 h-6 text-white" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}