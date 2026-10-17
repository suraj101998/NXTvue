import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Metric, MetricGroup } from '@/components/ui/Metric'
import { AIInsight } from '@/components/ui/AIInsight'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { ReportTable } from '@/components/charts/ChartContainer'
import { cn } from '@/utils/cn'
import { ArrowRight, BarChart3, Download, Search, RefreshCw } from 'lucide-react'
import { FileUploadInput } from '@/components/forms/FileUploadInput'
import { AnalysisProgress } from '@/components/analysis/AnalysisProgress'
import { ReportViewer } from '@/components/analysis/ReportViewer'
import { usePortfolio } from '@/hooks/usePortfolio'
import { formatCurrency, formatPercent } from '@/hooks/usePortfolioHoldings'
import { SkeletonTable } from '@/components/feedback/LoadingSkeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useIndMoneyPortfolio } from '@/hooks/useIndMoneyPortfolio'
import { useIndMoneyWatchlist } from '@/hooks/useIndMoneyWatchlist'

// Asset-type colour map
const ASSET_COLORS: Record<string, string> = {
  MF: 'bg-blue-400',
  EPF: 'bg-violet-400',
  GOLD: 'bg-yellow-400',
  STOCK: 'bg-green-400',
  PRIVATE_EQUITY: 'bg-pink-400',
  BOND: 'bg-slate-400',
  FD: 'bg-cyan-400',
  SA: 'bg-sky-400',
  SILVER: 'bg-gray-300',
  CRYPTO: 'bg-orange-400',
}

export function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'holdings' | 'watchlist' | 'allocation' | 'ai-analysis'>('overview')
  const [showVideo, setShowVideo] = useState(true)
  const [holdingsTab, setHoldingsTab] = useState<'stocks' | 'mf' | 'bonds' | 'fd'>('stocks')
  const [portfolioYear, setPortfolioYear] = useState(2026)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Live INDmoney data
  const { snapshot, holdings, loading: holdingsLoading, retrying, retryAttempt, error: holdingsError, refresh: refreshAll } = useIndMoneyPortfolio()
  const { watchlists, loading: watchlistLoading, error: watchlistError, refresh: refreshWatchlist } = useIndMoneyWatchlist()

  // AI analysis hook
  const { status: pfStatus, message: pfMessage, progress: pfProgress, result: pfResult, error: pfError, runWithFile, runDefault, reset: resetPortfolio } = usePortfolio()

  useEffect(() => {
    const timer = setTimeout(() => setShowVideo(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  const handleVideoEnded = () => setShowVideo(false)

  // ── Derived summary from snapshot ──────────────────────────────────────────
  const totalValue    = snapshot?.total_current_value ?? 0
  const totalInvested = snapshot?.total_invested ?? 0
  const totalNetworth = snapshot?.total_networth ?? 0
  const totalPnl      = totalValue - totalInvested
  const totalPnlPct   = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
  const liabilities   = snapshot?.liabilities?.total ?? 0
  const todayChange   =
    (holdings?.ind_stocks.asset_summary.one_day_change ?? 0) +
    (holdings?.mutual_funds.asset_summary.one_day_change ?? 0)

  // ── Asset allocation rows from snapshot.investments ────────────────────────
  const allocationRows = (snapshot?.investments ?? [])
    .filter((i) => i.current_value > 0)
    .sort((a, b) => b.current_value - a.current_value)
    .map((i) => ({
      name: i.asset_type,
      current: i.current_value,
      invested: i.invested_value,
      pnl: i.return_,
      pnlPct: i.return_percentage,
      pct: i.progress_value_percentage,
      color: ASSET_COLORS[i.asset_type] ?? 'bg-indigo-400',
    }))

  // ── Asset class rows from snapshot.assets ──────────────────────────────────
  const assetClassRows = (snapshot?.assets ?? [])
    .filter((a) => a.current_value > 0)
    .sort((a, b) => b.current_value - a.current_value)

  // ── Holdings tables ────────────────────────────────────────────────────────
  const stockRows = (holdings?.ind_stocks.holdings ?? []).map((h) => ({
    name: h.investment,
    units: h.total_units ?? '—',
    unitPrice: h.unit_price != null ? `₹${h.unit_price.toLocaleString('en-IN')}` : '—',
    invested: formatCurrency(h.invested_amount),
    current: formatCurrency(h.market_value),
    pnl: h.total_pnl,
    pnlPct: h.pnl_per,
    oneDay: h.one_day_change,
    oneDayPct: h.one_day_change_percentage,
    broker: h.broker ?? '—',
  }))

  const mfRows = (holdings?.mutual_funds.holdings ?? []).map((h) => ({
    name: h.investment,
    units: h.total_units != null ? h.total_units.toLocaleString('en-IN') : '—',
    nav: h.unit_price != null ? `₹${h.unit_price.toFixed(3)}` : '—',
    invested: formatCurrency(h.invested_amount),
    current: formatCurrency(h.market_value),
    pnl: h.total_pnl,
    pnlPct: h.pnl_per,
    oneDay: h.one_day_change,
    oneDayPct: h.one_day_change_percentage,
  }))

  const bondRows = (holdings?.bonds.holdings ?? []).map((h) => ({
    name: h.investment,
    isin: h.investment_code ?? '—',
    units: h.total_units ?? '—',
    unitPrice: h.unit_price != null ? `₹${h.unit_price.toLocaleString('en-IN')}` : '—',
    invested: formatCurrency(h.invested_amount),
    current: formatCurrency(h.market_value),
    pnl: h.total_pnl,
    pnlPct: h.pnl_per,
  }))

  const fdRows = (holdings?.fd.holdings ?? []).map((h) => ({
    name: h.investment,
    invested: formatCurrency(h.invested_amount),
    current: formatCurrency(h.market_value),
    interest: formatCurrency(h.total_pnl),
    interestPct: h.pnl_per,
  }))

  return (
    <div className="min-h-screen bg-bg-primary">
        {showVideo && (
          <motion.section
            key="video-hero"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            className="relative min-h-screen flex items-center justify-center overflow-hidden"
          >
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover opacity-30"
              autoPlay
              muted
              playsInline
              onEnded={handleVideoEnded}
              src="https://strvid.nyc3.cdn.digitaloceanspaces.com/cloudinary/portfolio_hero_bg_zuhahj.webm"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/20 to-transparent" />

            <div className="relative z-10 px-6 lg:px-8 max-w-[1400px] mx-auto w-full">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="text-center"
              >
                <Badge variant="blue" className="mb-4">Live from INDmoney</Badge>
                <h1 className="font-heading font-bold leading-tight text-text-primary mb-6" style={{ fontSize: 'clamp(3rem, 6vw, 5rem)', letterSpacing: '-0.03em' }}>
                  Your Wealth<br />At a Glance
                </h1>
                <p className="text-text-secondary text-lg max-w-2xl mx-auto mb-8">
                  {holdingsLoading
                    ? 'Loading live data from INDmoney…'
                    : <>Total portfolio: <strong className="text-text-primary">{formatCurrency(totalValue)}</strong> • Net worth: <strong className="text-blue-400">{formatCurrency(totalNetworth)}</strong></>
                  }
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button variant="primary" size="lg" className="gap-2">
                    View Holdings
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                  <Button variant="secondary" size="lg" asChild>
                    <a href="/portfolio/intelligence">View Intelligence</a>
                  </Button>
                </div>
              </motion.div>

              {/* Scroll Indicator */}
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2"
              >
                <div className="w-6 h-10 border-2 border-white/40 rounded-full flex justify-center pt-1">
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce" />
                </div>
              </motion.div>
            </div>
          </motion.section>
        )}

        {!showVideo && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative min-h-screen"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-bg-primary/60 to-bg-primary/80 pointer-events-none" />

            {/* Portfolio Content */}
            <main className="pb-16 px-6 lg:px-8">
              <div className="max-w-[1400px] mx-auto space-y-8">
                {/* Header */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6"
                >
                  <div>
                    <h2 className="font-heading text-3xl font-semibold text-text-primary">Portfolio Overview</h2>
                    <p className="text-text-secondary mt-1">
                      {holdingsLoading ? 'Fetching live data…' : `P&L: ${formatCurrency(totalPnl)} (${formatPercent(totalPnlPct)})`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="primary" asChild>
                      <a href="/analysis">Analyze Investment</a>
                    </Button>
                    <Button variant="secondary" asChild>
                      <a href="/portfolio/intelligence">View Intelligence</a>
                    </Button>
                    <Button variant="ghost">
                      <Download className="w-4 h-4 mr-1" />
                      Export
                    </Button>
                    <Button variant="ghost" onClick={refreshAll} disabled={holdingsLoading}>
                      <RefreshCw className={cn('w-4 h-4 mr-1', holdingsLoading ? 'animate-spin' : '')} />
                      Refresh
                    </Button>
                  </div>
                </motion.div>

                {/* Key Metrics — live from INDmoney */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
                >
                  {[
                    { label: 'Total Assets',   value: formatCurrency(totalValue),    sub: '' },
                    { label: 'Total Invested',  value: formatCurrency(totalInvested), sub: '' },
                    { label: 'Overall P&L',     value: formatCurrency(totalPnl),      sub: formatPercent(totalPnlPct), positive: totalPnl >= 0 },
                    { label: 'Net Worth',       value: formatCurrency(totalNetworth), sub: '' },
                    { label: 'Liabilities',     value: formatCurrency(liabilities),   sub: '', negative: true },
                    { label: "Today's Change",  value: formatCurrency(todayChange),   sub: '', positive: todayChange >= 0, negative: todayChange < 0 },
                  ].map((m) => (
                    <Card key={m.label} variant="default" padding="md">
                      <p className="text-caption text-text-muted uppercase tracking-wider mb-1">{m.label}</p>
                      <p className={cn('font-heading text-xl font-bold', m.positive ? 'text-green-400' : m.negative ? 'text-red-400' : 'text-text-primary')}>
                        {holdingsLoading ? '…' : m.value}
                      </p>
                      {m.sub && (
                        <p className={cn('text-xs mt-0.5', m.positive ? 'text-green-400' : 'text-text-muted')}>{m.sub}</p>
                      )}
                    </Card>
                  ))}
                </motion.div>

                {/* Tabs */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <Tabs defaultValue="overview" value={activeTab} onChange={(val) => setActiveTab(val as any)}>
                    <TabsList className="w-full mb-6">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="holdings">Holdings</TabsTrigger>
                      <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
                      <TabsTrigger value="allocation">Allocation</TabsTrigger>
                      <TabsTrigger value="ai-analysis">AI Analysis</TabsTrigger>
                    </TabsList>

                    {/* ── OVERVIEW TAB ───────────────────────────────────────── */}
                    <TabsContent value="overview" className="space-y-6">
                      {holdingsError && (
                        <div className="p-4 border border-red-400/30 rounded-xl bg-red-400/5">
                          <p className="text-red-400 font-medium">Failed to load INDmoney data</p>
                          <p className="text-text-secondary text-sm mt-1">{holdingsError.userMessage}</p>
                          <Button variant="outline" size="sm" className="mt-3" onClick={refreshAll}>Retry</Button>
                        </div>
                      )}

                      <div className="grid lg:grid-cols-2 gap-6">
                        {/* Asset Type Allocation */}
                        <Card variant="strong" padding="lg">
                          <h3 className="font-heading text-lg font-semibold text-text-primary mb-4">Asset Type Allocation</h3>
                          {holdingsLoading ? <SkeletonTable rows={5} columns={3} /> : (
                            <div className="space-y-3">
                              {allocationRows.map((a) => (
                                <div key={a.name} className="flex items-center gap-3">
                                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${a.color}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                      <p className="font-medium text-text-primary text-sm">{a.name}</p>
                                      <span className="text-xs text-text-muted">{a.pct.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-bg-tertiary rounded-full">
                                      <div className={`h-full ${a.color} rounded-full`} style={{ width: `${a.pct}%` }} />
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-semibold text-text-primary">{formatCurrency(a.current)}</p>
                                    <p className={cn('text-xs', a.pnl >= 0 ? 'text-green-400' : 'text-red-400')}>
                                      {a.pnl >= 0 ? '+' : ''}{formatCurrency(a.pnl)} ({a.pnlPct >= 0 ? '+' : ''}{a.pnlPct.toFixed(2)}%)
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </Card>

                        {/* Asset Class Breakdown */}
                        <Card variant="strong" padding="lg">
                          <h3 className="font-heading text-lg font-semibold text-text-primary mb-4">Asset Class Breakdown</h3>
                          {holdingsLoading ? <SkeletonTable rows={5} columns={3} /> : (
                            <div className="space-y-3">
                              {assetClassRows.map((a) => (
                                <div key={a.assetclass_l2} className="flex items-center justify-between p-2 rounded-lg bg-bg-glass">
                                  <div>
                                    <p className="font-medium text-text-primary text-sm">{a.assetclass_l2}</p>
                                    <p className="text-xs text-text-muted">Invested {formatCurrency(a.invested_value)}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-text-primary text-sm">{formatCurrency(a.current_value)}</p>
                                    <p className={cn('text-xs', a.return_ >= 0 ? 'text-green-400' : 'text-red-400')}>
                                      {a.return_ >= 0 ? '+' : ''}{a.return_percentage.toFixed(2)}%
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </Card>
                      </div>

                      {/* Liabilities */}
                      {snapshot && (
                        <Card variant="strong" padding="lg">
                          <h3 className="font-heading text-lg font-semibold text-text-primary mb-4">Liabilities</h3>
                          <div className="grid md:grid-cols-3 gap-4">
                            <div className="p-3 rounded-xl bg-red-400/5 border border-red-400/20">
                              <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Total Liabilities</p>
                              <p className="font-heading text-xl font-bold text-red-400">{formatCurrency(snapshot.liabilities.total)}</p>
                            </div>
                            {snapshot.liabilities.loans.filter(l => l.current_balance > 0).map((l) => (
                              <div key={l.lender} className="p-3 rounded-xl bg-bg-glass">
                                <p className="text-xs text-text-muted mb-1">{l.lender}</p>
                                <p className="font-semibold text-text-primary">{formatCurrency(l.current_balance)}</p>
                                <p className="text-xs text-text-muted">{l.loan_type}</p>
                              </div>
                            ))}
                            {snapshot.liabilities.credit_cards.filter(c => c.total_due > 0).map((c) => (
                              <div key={c.name} className="p-3 rounded-xl bg-bg-glass">
                                <p className="text-xs text-text-muted mb-1">{c.name}</p>
                                <p className="font-semibold text-red-400">{formatCurrency(c.total_due)}</p>
                                {c.due_date && <p className="text-xs text-text-muted">Due {c.due_date}</p>}
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}
                    </TabsContent>

                    {/* ── HOLDINGS TAB ───────────────────────────────────────── */}
                    <TabsContent value="holdings" className="space-y-4">
                      {/* Sub-tabs */}
                      <div className="flex gap-2 flex-wrap">
                        {(['stocks', 'mf', 'bonds', 'fd'] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setHoldingsTab(t)}
                            className={cn(
                              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                              holdingsTab === t ? 'bg-blue-500 text-white' : 'bg-bg-tertiary text-text-muted hover:text-text-primary',
                            )}
                          >
                            {{ stocks: '🇮🇳 Stocks', mf: '📈 Mutual Funds', bonds: '🔗 Bonds', fd: '🏧 Fixed Deposits' }[t]}
                          </button>
                        ))}
                      </div>

                      {holdingsError && (
                        <div className="p-4 border border-red-400/30 rounded-xl">
                          <p className="text-red-400 font-medium">{holdingsError.userMessage}</p>
                          <Button variant="outline" size="sm" className="mt-2" onClick={refreshAll}>Retry</Button>
                        </div>
                      )}

                      {retrying && !holdingsLoading && (
                        <div className="p-3 border border-blue-400/20 rounded-xl bg-blue-400/5 flex items-center gap-3">
                          <RefreshCw className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
                          <p className="text-blue-300 text-sm">
                            INDmoney rate limit — retrying in a moment… (attempt {retryAttempt}/{5})
                          </p>
                        </div>
                      )}

                      {holdingsLoading && <SkeletonTable rows={6} columns={7} />}

                      {/* Indian Stocks */}
                      {!holdingsLoading && holdingsTab === 'stocks' && (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            {[
                              { label: 'Total Value',   value: formatCurrency(holdings?.ind_stocks.asset_summary.total_value ?? 0) },
                              { label: 'Invested',      value: formatCurrency(holdings?.ind_stocks.asset_summary.invested ?? 0) },
                              { label: "Today's P&L",   value: formatCurrency(holdings?.ind_stocks.asset_summary.one_day_change ?? 0), colored: true, val: holdings?.ind_stocks.asset_summary.one_day_change ?? 0 },
                              { label: 'Holdings',      value: String(stockRows.length) },
                            ].map((m) => (
                              <Card key={m.label} variant="default" padding="sm">
                                <p className="text-caption text-text-muted uppercase tracking-wider mb-1">{m.label}</p>
                                <p className={cn('font-heading text-lg font-bold', m.colored ? (m.val! >= 0 ? 'text-green-400' : 'text-red-400') : 'text-text-primary')}>{m.value}</p>
                              </Card>
                            ))}
                          </div>
                          <div className="overflow-x-auto">
                            <ReportTable
                              headers={['Stock', 'Units', 'Unit Price', 'Invested', 'Current', 'P&L', 'P&L %', '1D Change', 'Broker']}
                              rows={stockRows.map((h) => [
                                <p className="font-medium text-text-primary text-sm">{h.name}</p>,
                                String(h.units),
                                h.unitPrice,
                                h.invested,
                                h.current,
                                <span className={cn('font-mono text-sm', h.pnl >= 0 ? 'text-green-400' : 'text-red-400')}>{h.pnl >= 0 ? '+' : ''}{formatCurrency(h.pnl)}</span>,
                                <span className={cn('font-mono text-sm', h.pnlPct >= 0 ? 'text-green-400' : 'text-red-400')}>{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%</span>,
                                <span className={cn('font-mono text-sm', h.oneDay >= 0 ? 'text-green-400' : 'text-red-400')}>{h.oneDay >= 0 ? '+' : ''}{formatCurrency(h.oneDay)}</span>,
                                <span className="text-text-muted text-xs">{h.broker}</span>,
                              ])}
                            />
                          </div>
                        </>
                      )}

                      {/* Mutual Funds */}
                      {!holdingsLoading && holdingsTab === 'mf' && (
                        <>
                          {holdings?.mutual_funds.fetch_error && (
                            <div className="p-3 border border-yellow-400/30 rounded-xl bg-yellow-400/5 flex items-center justify-between">
                              <p className="text-yellow-400 text-sm">Data temporarily unavailable — retrying…</p>
                              <Button variant="outline" size="sm" onClick={refreshAll}>Retry Now</Button>
                            </div>
                          )}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            {[
                              { label: 'Total Value',  value: formatCurrency(holdings?.mutual_funds.asset_summary.total_value ?? 0) },
                              { label: 'Invested',     value: formatCurrency(holdings?.mutual_funds.asset_summary.invested ?? 0) },
                              { label: 'Total P&L',    value: formatCurrency((holdings?.mutual_funds.asset_summary.total_value ?? 0) - (holdings?.mutual_funds.asset_summary.invested ?? 0)), colored: true, val: (holdings?.mutual_funds.asset_summary.total_value ?? 0) - (holdings?.mutual_funds.asset_summary.invested ?? 0) },
                              { label: "Today's Move", value: formatCurrency(holdings?.mutual_funds.asset_summary.one_day_change ?? 0), colored: true, val: holdings?.mutual_funds.asset_summary.one_day_change ?? 0 },
                            ].map((m) => (
                              <Card key={m.label} variant="default" padding="sm">
                                <p className="text-caption text-text-muted uppercase tracking-wider mb-1">{m.label}</p>
                                <p className={cn('font-heading text-lg font-bold', m.colored ? (m.val! >= 0 ? 'text-green-400' : 'text-red-400') : 'text-text-primary')}>{m.value}</p>
                              </Card>
                            ))}
                          </div>
                          <div className="overflow-x-auto">
                            <ReportTable
                              headers={['Fund', 'Units', 'NAV', 'Invested', 'Current', 'P&L', 'P&L %', '1D']}
                              rows={mfRows.map((h) => [
                                <p className="font-medium text-text-primary text-sm max-w-xs truncate">{h.name}</p>,
                                h.units,
                                h.nav,
                                h.invested,
                                h.current,
                                <span className={cn('font-mono text-sm', h.pnl >= 0 ? 'text-green-400' : 'text-red-400')}>{h.pnl >= 0 ? '+' : ''}{formatCurrency(h.pnl)}</span>,
                                <span className={cn('font-mono text-sm', h.pnlPct >= 0 ? 'text-green-400' : 'text-red-400')}>{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%</span>,
                                <span className={cn('font-mono text-sm', h.oneDay >= 0 ? 'text-green-400' : 'text-red-400')}>{h.oneDay >= 0 ? '+' : ''}{formatCurrency(h.oneDay)}</span>,
                              ])}
                            />
                          </div>
                        </>
                      )}

                      {/* Bonds */}
                      {!holdingsLoading && holdingsTab === 'bonds' && (
                        <>
                          {holdings?.bonds.fetch_error && (
                            <div className="p-3 border border-yellow-400/30 rounded-xl bg-yellow-400/5 flex items-center justify-between">
                              <p className="text-yellow-400 text-sm">Data temporarily unavailable — retrying…</p>
                              <Button variant="outline" size="sm" onClick={refreshAll}>Retry Now</Button>
                            </div>
                          )}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                            {[
                              { label: 'Total Value', value: formatCurrency(holdings?.bonds.asset_summary.total_value ?? 0) },
                              { label: 'Invested',    value: formatCurrency(holdings?.bonds.asset_summary.invested ?? 0) },
                              { label: 'P&L',         value: formatCurrency((holdings?.bonds.asset_summary.total_value ?? 0) - (holdings?.bonds.asset_summary.invested ?? 0)), colored: true, val: (holdings?.bonds.asset_summary.total_value ?? 0) - (holdings?.bonds.asset_summary.invested ?? 0) },
                            ].map((m) => (
                              <Card key={m.label} variant="default" padding="sm">
                                <p className="text-caption text-text-muted uppercase tracking-wider mb-1">{m.label}</p>
                                <p className={cn('font-heading text-lg font-bold', m.colored ? (m.val! >= 0 ? 'text-green-400' : 'text-red-400') : 'text-text-primary')}>{m.value}</p>
                              </Card>
                            ))}
                          </div>
                          <div className="overflow-x-auto">
                            <ReportTable
                              headers={['Bond', 'ISIN', 'Units', 'Unit Price', 'Invested', 'Current', 'P&L', 'P&L %']}
                              rows={bondRows.map((h) => [
                                <p className="font-medium text-text-primary text-sm max-w-xs">{h.name}</p>,
                                <span className="text-text-muted text-xs font-mono">{h.isin}</span>,
                                String(h.units),
                                h.unitPrice,
                                h.invested,
                                h.current,
                                <span className={cn('font-mono text-sm', h.pnl >= 0 ? 'text-green-400' : 'text-red-400')}>{h.pnl >= 0 ? '+' : ''}{formatCurrency(h.pnl)}</span>,
                                <span className={cn('font-mono text-sm', h.pnlPct >= 0 ? 'text-green-400' : 'text-red-400')}>{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%</span>,
                              ])}
                            />
                          </div>
                        </>
                      )}

                      {/* Fixed Deposits */}
                      {!holdingsLoading && holdingsTab === 'fd' && (
                        <>
                          {holdings?.fd.fetch_error && (
                            <div className="p-3 border border-yellow-400/30 rounded-xl bg-yellow-400/5 flex items-center justify-between">
                              <p className="text-yellow-400 text-sm">Data temporarily unavailable — retrying…</p>
                              <Button variant="outline" size="sm" onClick={refreshAll}>Retry Now</Button>
                            </div>
                          )}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                            {[
                              { label: 'Total Value',      value: formatCurrency(holdings?.fd.asset_summary.total_value ?? 0) },
                              { label: 'Principal',        value: formatCurrency(holdings?.fd.asset_summary.invested ?? 0) },
                              { label: 'Interest Earned',  value: formatCurrency((holdings?.fd.asset_summary.total_value ?? 0) - (holdings?.fd.asset_summary.invested ?? 0)), colored: true, val: 1 },
                            ].map((m) => (
                              <Card key={m.label} variant="default" padding="sm">
                                <p className="text-caption text-text-muted uppercase tracking-wider mb-1">{m.label}</p>
                                <p className={cn('font-heading text-lg font-bold', m.colored ? 'text-green-400' : 'text-text-primary')}>{m.value}</p>
                              </Card>
                            ))}
                          </div>
                          <div className="overflow-x-auto">
                            <ReportTable
                              headers={['Name', 'Principal', 'Current Value', 'Interest Earned', 'Return %']}
                              rows={fdRows.map((h) => [
                                h.name,
                                h.invested,
                                h.current,
                                <span className="text-green-400 font-mono text-sm">+{h.interest}</span>,
                                <span className="text-green-400 font-mono text-sm">+{h.interestPct.toFixed(2)}%</span>,
                              ])}
                            />
                          </div>
                        </>
                      )}
                    </TabsContent>

                    {/* ── WATCHLIST TAB ─────────────────────────────────────── */}
                    <TabsContent value="watchlist" className="space-y-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-heading text-lg font-semibold text-text-primary">My Watchlists</h3>
                        <Button variant="ghost" size="sm" onClick={refreshWatchlist} disabled={watchlistLoading}>
                          <RefreshCw className={cn('w-4 h-4', watchlistLoading ? 'animate-spin' : '')} />
                        </Button>
                      </div>

                      {watchlistError && (
                        <div className="p-4 border border-red-400/30 rounded-xl">
                          <p className="text-red-400">{watchlistError.userMessage}</p>
                        </div>
                      )}

                      {watchlistLoading && <SkeletonTable rows={4} columns={3} />}

                      {!watchlistLoading && watchlists.map((wl) => (
                        <Card key={wl.watchlist_id} variant="strong" padding="lg">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-heading text-base font-semibold text-text-primary">{wl.name}</h4>
                            <Badge variant="blue" size="sm">{wl.stocks.length} stocks</Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {wl.stocks.map((s, idx) => (
                              <span
                                key={`${s.ticker}-${idx}`}
                                className="px-3 py-1 rounded-full text-sm font-medium bg-bg-glass border border-border-subtle text-text-primary hover:border-blue-400/50 transition-colors"
                              >
                                {s.ticker}
                              </span>
                            ))}
                          </div>
                        </Card>
                      ))}
                    </TabsContent>

                    {/* ── ALLOCATION TAB ────────────────────────────────────── */}
                    <TabsContent value="allocation" className="space-y-6">
                      <div className="grid lg:grid-cols-2 gap-6">
                        <Card variant="strong" padding="lg">
                          <h3 className="font-heading text-lg font-semibold text-text-primary mb-4">By Asset Type</h3>
                          <div className="space-y-3">
                            {allocationRows.map((a) => (
                              <div key={a.name} className="flex items-center justify-between gap-4 p-3 bg-bg-glass rounded-xl">
                                <div className="flex items-center gap-3">
                                  <div className={`w-4 h-4 rounded-full ${a.color}`} />
                                  <div>
                                    <p className="font-medium text-text-primary">{a.name}</p>
                                    <p className="text-xs text-text-muted">Invested {formatCurrency(a.invested)}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-text-primary">{formatCurrency(a.current)}</p>
                                  <p className={cn('text-xs', a.pnl >= 0 ? 'text-green-400' : 'text-red-400')}>
                                    {a.pnl >= 0 ? '+' : ''}{a.pnlPct.toFixed(2)}% · {a.pct.toFixed(1)}% of portfolio
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>

                        <Card variant="strong" padding="lg">
                          <h3 className="font-heading text-lg font-semibold text-text-primary mb-4">Market Cap Split (Stocks)</h3>
                          <div className="space-y-3">
                            {(snapshot?.market_cap ?? []).filter(m => m.current_value > 0).map((m) => (
                              <div key={m.market_cap} className="flex items-center justify-between p-3 bg-bg-glass rounded-xl">
                                <p className="font-medium text-text-primary">{m.market_cap}</p>
                                <div className="text-right">
                                  <p className="font-semibold text-text-primary">{formatCurrency(m.current_value)}</p>
                                  <p className="text-xs text-text-muted">{m.progress_value_percentage.toFixed(1)}% of stocks</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      </div>
                    </TabsContent>

                    {/* AI Portfolio Analysis Tab */}
                    <TabsContent value="ai-analysis" className="space-y-6">
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-heading text-lg font-semibold text-text-primary">AI Portfolio Analysis</h3>
                          <p className="text-text-secondary text-sm mt-1">Upload your holdings file (Excel/CSV) or use the default portfolio to get a full AI-generated analysis.</p>
                        </div>

                        {pfStatus === 'idle' && (
                          <div className="space-y-6">
                            {/* Year selector */}
                            <div className="flex items-center gap-3">
                              <label className="text-sm text-text-secondary">Projection year:</label>
                              <select
                                value={portfolioYear}
                                onChange={(e) => setPortfolioYear(Number(e.target.value))}
                                className="bg-bg-tertiary border border-border-subtle rounded-lg px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-blue-400"
                              >
                                <option value={2025}>2025</option>
                                <option value={2026}>2026</option>
                                <option value={2027}>2027</option>
                              </select>
                            </div>

                            {/* File upload */}
                            <FileUploadInput
                              onFile={(file) => runWithFile(file, portfolioYear)}
                              onUseDefault={() => runDefault(portfolioYear)}
                            />
                          </div>
                        )}

                        {(pfStatus === 'fetching' || pfStatus === 'analyzing') && (
                          <AnalysisProgress
                            status={pfStatus}
                            message={pfMessage}
                            progress={pfProgress}
                          />
                        )}

                        {pfStatus === 'error' && (
                          <div className="glass-card-strong p-6 border border-red-400/30 rounded-xl">
                            <p className="text-red-400 font-medium mb-2">Analysis failed</p>
                            <p className="text-text-secondary text-sm">{pfError?.userMessage || pfError?.message}</p>
                            <Button variant="outline" size="sm" className="mt-3" onClick={resetPortfolio}>
                              Try Again
                            </Button>
                          </div>
                        )}

                        {pfStatus === 'complete' && pfResult && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="font-heading text-xl font-semibold text-text-primary">Portfolio Report</h3>
                              <Button variant="ghost" size="sm" onClick={resetPortfolio}>New Analysis</Button>
                            </div>
                            <ReportViewer
                              finalMemo={pfResult.final_memo}
                            />
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </motion.div>
              </div>
            </main>
          </motion.section>
        )}

        {/* Floating Action Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-6 right-6 z-40"
        >
          <Button variant="primary" className="w-14 h-14 rounded-full p-0" asChild>
            <a href="/portfolio/intelligence" className="flex items-center justify-center w-full h-full">
              <BarChart3 className="w-6 h-6" />
            </a>
          </Button>
        </motion.div>
    </div>
  )
}

// Sector color mapping
const sectorColors: Record<string, string> = {
  'Financial Services': 'bg-blue-400',
  'Oil & Gas': 'bg-amber-400',
  'Information Technology': 'bg-indigo-400',
  'Consumer Goods': 'bg-green-400',
  'Pharmaceuticals': 'bg-purple-400',
  'Automobile': 'bg-pink-400',
  'Others': 'bg-gray-400',
}