import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { ReportTable } from '@/components/charts/ChartContainer'
import { cn } from '@/utils/cn'
import { Download, RefreshCw, FileText, ExternalLink, CheckCircle2 } from 'lucide-react'
import { FileUploadInput } from '@/components/forms/FileUploadInput'
import { AnalysisProgress } from '@/components/analysis/AnalysisProgress'
import { ReportViewer } from '@/components/analysis/ReportViewer'
import { usePortfolio } from '@/hooks/usePortfolio'
import { formatCurrency, formatPercent } from '@/hooks/usePortfolioHoldings'
import { SkeletonTable } from '@/components/feedback/LoadingSkeleton'
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

type PortfolioTab = 'overview' | 'holdings' | 'watchlist' | 'allocation' | 'ai-analysis'
const PORTFOLIO_TABS: PortfolioTab[] = ['overview', 'holdings', 'watchlist', 'allocation', 'ai-analysis']

export function PortfolioPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<PortfolioTab>(
    PORTFOLIO_TABS.includes(tabParam as PortfolioTab) ? (tabParam as PortfolioTab) : 'overview',
  )
  const [holdingsTab, setHoldingsTab] = useState<'stocks' | 'mf' | 'bonds' | 'fd'>('stocks')
  const [watchlistMarketFilter, setWatchlistMarketFilter] = useState<'all' | 'us' | 'india'>('all')
  const [portfolioYear, setPortfolioYear] = useState(2026)

  // Live INDmoney data
  const { snapshot, holdings, loading: holdingsLoading, retrying, retryAttempt, error: holdingsError, refresh: refreshAll } = useIndMoneyPortfolio()
  const { watchlists, loading: watchlistLoading, error: watchlistError, refresh: refreshWatchlist } = useIndMoneyWatchlist()

  // AI analysis hook
  const { status: pfStatus, message: pfMessage, progress: pfProgress, result: pfResult, error: pfError, runWithFile, runDefault, reset: resetPortfolio } = usePortfolio()

  // ── Derived summary from snapshot ──────────────────────────────────────────
  const totalValue    = snapshot?.total_current_value ?? 0
  const totalInvested = snapshot?.total_invested ?? 0
  const totalNetworth = snapshot?.total_networth ?? 0
  const totalPnl      = totalValue - totalInvested
  const totalPnlPct   = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
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
        {/* ── Hero banner (always visible) ─────────────────────────────── */}
        <section className="relative h-[40vh] min-h-[360px] overflow-hidden">
          <video
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_183428_ab5e672a-f608-4dcb-b319-f3e040f02e2d.mp4"
          />
          <div className="absolute inset-0 bg-white/70 pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg-primary to-transparent pointer-events-none" />

          <div className="relative z-10 h-full px-6 lg:px-8 max-w-[1400px] mx-auto flex flex-col justify-end pb-10 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6"
            >
              <div>
                <Badge variant="blue" className="mb-3">Live from INDmoney</Badge>
                <h1 className="font-heading font-bold leading-tight text-text-primary" style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)', letterSpacing: '-0.03em' }}>
                  Your Wealth At a Glance
                </h1>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" asChild>
                  <a href="/analysis">Analyze Investment</a>
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

            {/* Metric chips */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3"
            >
              {[
                { label: 'Total Portfolio Value', value: formatCurrency(totalValue),    sub: '' },
                { label: 'Net Worth',             value: formatCurrency(totalNetworth), sub: '' },
                { label: 'Overall P&L',           value: formatCurrency(totalPnl),      sub: formatPercent(totalPnlPct), positive: totalPnl >= 0, negative: totalPnl < 0 },
                { label: "Today's Change",        value: formatCurrency(todayChange),   sub: '', positive: todayChange >= 0, negative: todayChange < 0 },
              ].map((m) => (
                <div key={m.label} className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm backdrop-blur-xl px-5 py-4">
                  <p className="text-caption text-text-muted uppercase tracking-wider mb-1">{m.label}</p>
                  <p className={cn('font-heading text-3xl font-bold', m.positive ? 'text-green-600' : m.negative ? 'text-red-600' : 'text-text-primary')}>
                    {holdingsLoading ? '…' : m.value}
                  </p>
                  {m.sub && !holdingsLoading && (
                    <p className={cn('text-xs mt-0.5', m.positive ? 'text-green-600' : 'text-red-600')}>{m.sub}</p>
                  )}
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Content ──────────────────────────────────────────────────── */}
        <div className="relative">
            <main className="pb-16 px-6 lg:px-8">
              <div className="max-w-[1400px] mx-auto space-y-8">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <Tabs defaultValue="overview" value={activeTab} onChange={(val) => setActiveTab(val as PortfolioTab)}>
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
                        <Card variant="strong" padding="lg" className="border border-red-400/30">
                          <p className="text-red-600 font-medium">Failed to load INDmoney data</p>
                          <p className="text-text-secondary text-sm mt-1">{holdingsError.userMessage}</p>
                          <Button variant="outline" size="sm" className="mt-3" onClick={refreshAll}>Retry</Button>
                        </Card>
                      )}

                      {/* Row 1: metric cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                          { label: 'Total Assets', value: formatCurrency(totalValue), sub: '' },
                          { label: 'Invested',     value: formatCurrency(totalInvested), sub: '' },
                          { label: 'P&L',          value: formatCurrency(totalPnl), sub: formatPercent(totalPnlPct), positive: totalPnl >= 0, negative: totalPnl < 0 },
                        ].map((m) => (
                          <Card key={m.label} variant="strong" padding="lg">
                            <p className="text-caption text-text-muted uppercase tracking-wider mb-2">{m.label}</p>
                            <p className={cn('font-heading text-3xl font-bold', m.positive ? 'text-green-600' : m.negative ? 'text-red-600' : 'text-text-primary')}>
                              {holdingsLoading ? '…' : m.value}
                            </p>
                            {m.sub && !holdingsLoading && (
                              <p className={cn('text-sm mt-1', m.positive ? 'text-green-600' : 'text-red-600')}>{m.sub}</p>
                            )}
                          </Card>
                        ))}
                      </div>

                      {/* Row 2: Asset Allocation (60%) + Liabilities (40%) */}
                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <Card variant="strong" padding="lg" className="lg:col-span-3">
                          <h3 className="font-heading font-bold text-lg text-text-primary mb-4">Asset Type Allocation</h3>
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
                                    <p className={cn('text-xs', a.pnl >= 0 ? 'text-green-600' : 'text-red-600')}>
                                      {a.pnl >= 0 ? '+' : ''}{formatCurrency(a.pnl)} ({a.pnlPct >= 0 ? '+' : ''}{a.pnlPct.toFixed(2)}%)
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </Card>

                        <Card variant="strong" padding="lg" className="lg:col-span-2">
                          <h3 className="font-heading font-bold text-lg text-text-primary mb-4">Liabilities</h3>
                          {snapshot && (
                            <div className="space-y-3">
                              <div className="p-3 rounded-xl bg-red-400/5 border border-red-400/20">
                                <p className="text-caption text-text-muted uppercase tracking-wider mb-1">Total Liabilities</p>
                                <p className="font-heading text-3xl font-bold text-red-600">{formatCurrency(snapshot.liabilities.total)}</p>
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
                                  <p className="font-semibold text-red-600">{formatCurrency(c.total_due)}</p>
                                  {c.due_date && <p className="text-xs text-text-muted">Due {c.due_date}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </Card>
                      </div>

                      {/* Row 3: Asset Class Breakdown */}
                      <Card variant="strong" padding="lg">
                        <h3 className="font-heading font-bold text-lg text-text-primary mb-4">Asset Class Breakdown</h3>
                        {holdingsLoading ? <SkeletonTable rows={5} columns={3} /> : (
                          <div className="grid md:grid-cols-2 gap-3">
                            {assetClassRows.map((a) => (
                              <div key={a.assetclass_l2} className="flex items-center justify-between p-3 rounded-xl bg-bg-glass">
                                <div>
                                  <p className="font-medium text-text-primary text-sm">{a.assetclass_l2}</p>
                                  <p className="text-xs text-text-muted">Invested {formatCurrency(a.invested_value)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-text-primary text-sm">{formatCurrency(a.current_value)}</p>
                                  <p className={cn('text-xs', a.return_ >= 0 ? 'text-green-600' : 'text-red-600')}>
                                    {a.return_ >= 0 ? '+' : ''}{a.return_percentage.toFixed(2)}%
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
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
                            {{ stocks: 'Stocks', mf: 'Mutual Funds', bonds: 'Bonds', fd: 'Fixed Deposits' }[t]}
                          </button>
                        ))}
                      </div>

                      {holdingsError && (
                        <div className="p-4 border border-red-400/30 rounded-xl">
                          <p className="text-red-600 font-medium">{holdingsError.userMessage}</p>
                          <Button variant="outline" size="sm" className="mt-2" onClick={refreshAll}>Retry</Button>
                        </div>
                      )}

                      {retrying && !holdingsLoading && (
                        <div className="p-3 border border-blue-400/20 rounded-xl bg-blue-400/5 flex items-center gap-3">
                          <RefreshCw className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
                          <p className="text-blue-600 text-sm">
                            INDmoney rate limit — retrying in a moment… (attempt {retryAttempt}/{5})
                          </p>
                        </div>
                      )}

                      {holdingsLoading && <SkeletonTable rows={6} columns={7} />}

                      {/* Indian Stocks */}
                      {!holdingsLoading && holdingsTab === 'stocks' && (
                        <Card variant="strong" padding="lg">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            {[
                              { label: 'Total Value',   value: formatCurrency(holdings?.ind_stocks.asset_summary.total_value ?? 0) },
                              { label: 'Invested',      value: formatCurrency(holdings?.ind_stocks.asset_summary.invested ?? 0) },
                              { label: "Today's P&L",   value: formatCurrency(holdings?.ind_stocks.asset_summary.one_day_change ?? 0), colored: true, val: holdings?.ind_stocks.asset_summary.one_day_change ?? 0 },
                              { label: 'Holdings',      value: String(stockRows.length) },
                            ].map((m) => (
                              <Card key={m.label} variant="default" padding="sm">
                                <p className="text-caption text-text-muted uppercase tracking-wider mb-1">{m.label}</p>
                                <p className={cn('font-heading text-lg font-bold', m.colored ? (m.val! >= 0 ? 'text-green-600' : 'text-red-600') : 'text-text-primary')}>{m.value}</p>
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
                                <span className={cn('font-mono text-sm', h.pnl >= 0 ? 'text-green-600' : 'text-red-600')}>{h.pnl >= 0 ? '+' : ''}{formatCurrency(h.pnl)}</span>,
                                <span className={cn('font-mono text-sm', h.pnlPct >= 0 ? 'text-green-600' : 'text-red-600')}>{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%</span>,
                                <span className={cn('font-mono text-sm', h.oneDay >= 0 ? 'text-green-600' : 'text-red-600')}>{h.oneDay >= 0 ? '+' : ''}{formatCurrency(h.oneDay)}</span>,
                                <span className="text-text-muted text-xs">{h.broker}</span>,
                              ])}
                            />
                          </div>
                        </Card>
                      )}

                      {/* Mutual Funds */}
                      {!holdingsLoading && holdingsTab === 'mf' && (
                        <Card variant="strong" padding="lg">
                          {holdings?.mutual_funds.fetch_error && (
                            <div className="p-3 border border-yellow-400/30 rounded-xl bg-yellow-400/5 flex items-center justify-between">
                              <p className="text-yellow-600 text-sm">Data temporarily unavailable — retrying…</p>
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
                                <p className={cn('font-heading text-lg font-bold', m.colored ? (m.val! >= 0 ? 'text-green-600' : 'text-red-600') : 'text-text-primary')}>{m.value}</p>
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
                                <span className={cn('font-mono text-sm', h.pnl >= 0 ? 'text-green-600' : 'text-red-600')}>{h.pnl >= 0 ? '+' : ''}{formatCurrency(h.pnl)}</span>,
                                <span className={cn('font-mono text-sm', h.pnlPct >= 0 ? 'text-green-600' : 'text-red-600')}>{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%</span>,
                                <span className={cn('font-mono text-sm', h.oneDay >= 0 ? 'text-green-600' : 'text-red-600')}>{h.oneDay >= 0 ? '+' : ''}{formatCurrency(h.oneDay)}</span>,
                              ])}
                            />
                          </div>
                        </Card>
                      )}

                      {/* Bonds */}
                      {!holdingsLoading && holdingsTab === 'bonds' && (
                        <Card variant="strong" padding="lg">
                          {holdings?.bonds.fetch_error && (
                            <div className="p-3 border border-yellow-400/30 rounded-xl bg-yellow-400/5 flex items-center justify-between">
                              <p className="text-yellow-600 text-sm">Data temporarily unavailable — retrying…</p>
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
                                <p className={cn('font-heading text-lg font-bold', m.colored ? (m.val! >= 0 ? 'text-green-600' : 'text-red-600') : 'text-text-primary')}>{m.value}</p>
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
                                <span className={cn('font-mono text-sm', h.pnl >= 0 ? 'text-green-600' : 'text-red-600')}>{h.pnl >= 0 ? '+' : ''}{formatCurrency(h.pnl)}</span>,
                                <span className={cn('font-mono text-sm', h.pnlPct >= 0 ? 'text-green-600' : 'text-red-600')}>{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%</span>,
                              ])}
                            />
                          </div>
                        </Card>
                      )}

                      {/* Fixed Deposits */}
                      {!holdingsLoading && holdingsTab === 'fd' && (
                        <Card variant="strong" padding="lg">
                          {holdings?.fd.fetch_error && (
                            <div className="p-3 border border-yellow-400/30 rounded-xl bg-yellow-400/5 flex items-center justify-between">
                              <p className="text-yellow-600 text-sm">Data temporarily unavailable — retrying…</p>
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
                                <p className={cn('font-heading text-lg font-bold', m.colored ? 'text-green-600' : 'text-text-primary')}>{m.value}</p>
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
                                <span className="text-green-600 font-mono text-sm">+{h.interest}</span>,
                                <span className="text-green-600 font-mono text-sm">+{h.interestPct.toFixed(2)}%</span>,
                              ])}
                            />
                          </div>
                        </Card>
                      )}
                    </TabsContent>

                    {/* ── WATCHLIST TAB ─────────────────────────────────────── */}
                    <TabsContent value="watchlist" className="space-y-6">
                      {/* Premium Header Bar with Live Market Filters */}
                      <Card variant="strong" padding="lg" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-heading font-bold text-xl text-text-primary">Watchlist Intelligence</h3>
                              <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.1)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                Live Sync
                              </span>
                            </div>
                            <p className="text-xs text-text-muted mt-0.5">
                              Segmented by market geography with institutional AI report generation
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Segmented Market Filter */}
                          <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                            <button
                              onClick={() => setWatchlistMarketFilter('all')}
                              className={cn(
                                'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                                watchlistMarketFilter === 'all'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-text-muted hover:text-text-primary'
                              )}
                            >
                              All Assets
                            </button>
                            <button
                              onClick={() => setWatchlistMarketFilter('us')}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                                watchlistMarketFilter === 'us'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-text-muted hover:text-text-primary'
                              )}
                            >
                              <span>🇺🇸</span> US Stocks
                            </button>
                            <button
                              onClick={() => setWatchlistMarketFilter('india')}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                                watchlistMarketFilter === 'india'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-text-muted hover:text-text-primary'
                              )}
                            >
                              <span>🇮🇳</span> Indian Stocks
                            </button>
                          </div>

                          <Button variant="ghost" size="sm" onClick={refreshWatchlist} disabled={watchlistLoading} className="rounded-xl border border-slate-200">
                            <RefreshCw className={cn('w-4 h-4', watchlistLoading ? 'animate-spin' : '')} />
                          </Button>
                        </div>
                      </Card>

                      {watchlistError && (
                        <div className="p-4 border border-red-400/30 bg-red-500/5 rounded-2xl">
                          <p className="text-red-600 font-medium">{watchlistError.userMessage}</p>
                        </div>
                      )}

                      {watchlistLoading && <SkeletonTable rows={4} columns={3} />}

                      {!watchlistLoading && watchlists.map((wl) => {
                        const filteredStocks = wl.stocks.filter((s) => {
                          if (watchlistMarketFilter === 'all') return true
                          return s.market === watchlistMarketFilter
                        })

                        if (filteredStocks.length === 0) return null

                        const usCount = wl.stocks.filter((s) => s.market === 'us').length
                        const inCount = wl.stocks.filter((s) => s.market === 'india').length

                        return (
                          <div
                            key={wl.watchlist_id}
                            className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group transition-all duration-300"
                          >
                            {/* Decorative ambient glow */}
                            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200 relative z-10">
                              <div className="flex items-center gap-3">
                                <h4 className="font-heading text-lg font-bold text-slate-900 tracking-tight">{wl.name}</h4>
                                <span className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-full">
                                  {filteredStocks.length} Assets
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl">
                                  <span>🇺🇸</span> {usCount} US
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl">
                                  <span>🇮🇳</span> {inCount} India
                                </span>
                              </div>
                            </div>

                            {/* Responsive High-Conviction Stock Cards Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 relative z-10">
                              {filteredStocks.map((s, idx) => {
                                const isIndia = s.market === 'india'
                                const ticker = s.ticker || ''
                                const hasReport = s.has_report || false

                                return (
                                  <div
                                    key={`${ticker}-${idx}`}
                                    className="flex flex-col justify-between p-3.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-100 border-slate-300 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 group/card"
                                  >
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm shadow-sm">{isIndia ? '🇮🇳' : '🇺🇸'}</span>
                                        <div>
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-heading font-bold text-sm text-slate-900 group-hover/card:text-blue-600 transition-colors">
                                              {ticker}
                                            </span>
                                          </div>
                                          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                                            {isIndia ? 'NSE / BSE' : 'NASDAQ / NYSE'}
                                          </span>
                                        </div>
                                      </div>

                                      {hasReport ? (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                          <CheckCircle2 className="w-2.5 h-2.5" />
                                          Report Ready
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                                          Watch
                                        </span>
                                      )}
                                    </div>

                                    {/* Action Footers */}
                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                                      {hasReport ? (
                                        <>
                                          <button
                                            onClick={() => navigate(`/analysis?ticker=${ticker}&market=${s.market}`)}
                                            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 text-xs font-semibold py-1.5 px-3 rounded-xl border border-emerald-500/30 transition-all cursor-pointer shadow-sm active:scale-95"
                                          >
                                            <FileText className="w-3.5 h-3.5" />
                                            View Report
                                          </button>
                                          <a
                                            href={`/api/v1/reports/${ticker}.pdf`}
                                            target="_blank"
                                            rel="noreferrer"
                                            title="Open Original PDF"
                                            className="p-1.5 rounded-xl bg-slate-50 hover:bg-emerald-500/20 text-slate-600 hover:text-emerald-600 border border-slate-200 transition-all cursor-pointer"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </a>
                                        </>
                                      ) : (
                                        <button
                                          onClick={() => navigate(`/analysis?ticker=${ticker}&market=${s.market}&generate=true`)}
                                          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 text-xs font-semibold py-1.5 px-3 rounded-xl border border-blue-500/30 transition-all cursor-pointer shadow-sm active:scale-95 group/btn"
                                        >
                                          Generate Report
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </TabsContent>

                    {/* ── ALLOCATION TAB ────────────────────────────────────── */}
                    <TabsContent value="allocation" className="space-y-6">
                      <div className="grid lg:grid-cols-2 gap-6">
                        <Card variant="strong" padding="lg">
                          <h3 className="font-heading font-bold text-lg text-text-primary mb-4">By Asset Type</h3>
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
                                  <p className={cn('text-xs', a.pnl >= 0 ? 'text-green-600' : 'text-red-600')}>
                                    {a.pnl >= 0 ? '+' : ''}{a.pnlPct.toFixed(2)}% · {a.pct.toFixed(1)}% of portfolio
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>

                        <Card variant="strong" padding="lg">
                          <h3 className="font-heading font-bold text-lg text-text-primary mb-4">Market Cap Split (Stocks)</h3>
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
                      <Card variant="strong" padding="lg" className="space-y-4">
                        <div>
                          <h3 className="font-heading font-bold text-lg text-text-primary">AI Portfolio Analysis</h3>
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
                            <p className="text-red-600 font-medium mb-2">Analysis failed</p>
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
                      </Card>
                    </TabsContent>
                  </Tabs>
                </motion.div>
              </div>
            </main>
        </div>
    </div>
  )
}