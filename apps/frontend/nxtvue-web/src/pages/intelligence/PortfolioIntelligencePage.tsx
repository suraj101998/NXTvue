import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Metric, MetricGroup } from '@/components/ui/Metric'
import { AIInsight } from '@/components/ui/AIInsight'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { ReportTable } from '@/components/charts/ChartContainer'
import { cn } from '@/utils/cn'
import { ArrowRight, TrendingUp, TrendingDown, Target, Zap, Shield, PieChart, BarChart3, Link as LinkIcon, RefreshCw, Download } from 'lucide-react'

const intelligenceData = {
  healthScore: 82,
  healthLabel: 'Well Diversified',
  diversification: {
    score: 78,
    assets: 24,
    assetClasses: 4,
    sectors: 7,
    geographies: 3,
  },
  risk: {
    portfolioVolatility: '14.2%',
    sharpe: '1.34',
    sortino: '1.87',
    var95: '-2.1%',
    cvar95: '-3.4%',
    maxDrawdown: '-12.8%',
    currentDrawdown: '-3.2%',
    beta: '0.94',
    alpha: '4.2%',
    trackingError: '3.8%',
    calmar: '0.92',
    ulcerIndex: '4.1%',
  },
  concentration: {
    top5: '42%',
    top10: '68%',
    hhi: 0.18,
    largestPosition: { symbol: 'RELIANCE', weight: '13.3%' },
  },
  sectorConcentration: [
    { sector: 'Financial Services', weight: '28.5%', benchmark: '22.1%', deviation: '+6.4%' },
    { sector: 'Oil & Gas', weight: '18.2%', benchmark: '12.5%', deviation: '+5.7%' },
    { sector: 'Information Technology', weight: '15.3%', benchmark: '14.8%', deviation: '+0.5%' },
    { sector: 'Consumer Goods', weight: '12.1%', benchmark: '10.2%', deviation: '+1.9%' },
    { sector: 'Pharmaceuticals', weight: '8.7%', benchmark: '5.8%', deviation: '+2.9%' },
    { sector: 'Automobile', weight: '6.4%', benchmark: '5.2%', deviation: '+1.2%' },
    { sector: 'Others', weight: '10.8%', benchmark: '29.4%', deviation: '-18.6%' },
  ],
  currencyExposure: [
    { currency: 'INR', weight: '92%', hedged: '0%' },
    { currency: 'USD', weight: '5%', hedged: '0%' },
    { currency: 'EUR', weight: '2%', hedged: '0%' },
    { currency: 'Others', weight: '1%', hedged: '0%' },
  ],
  etfOverlap: [
    { fund1: 'HDFC Top 100', fund2: 'ICICI Pru Bluechip', overlap: '67%', sharedHoldings: 34 },
    { fund1: 'HDFC Top 100', fund2: 'Nippon India Large Cap', overlap: '52%', sharedHoldings: 28 },
    { fund1: 'Parag Parikh Flexi', fund2: 'UTI Flexi Cap', overlap: '41%', sharedHoldings: 22 },
  ],
  correlationMatrix: {
    assets: ['RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'BAJFINANCE', 'HDFCAMC', 'PARAGPAR', 'GOVT10Y'],
    matrix: [
      [1.00, 0.34, 0.67, 0.71, 0.58, 0.62, 0.55, -0.12],
      [0.34, 1.00, 0.28, 0.31, 0.25, 0.45, 0.38, -0.08],
      [0.67, 0.28, 1.00, 0.82, 0.55, 0.58, 0.51, -0.15],
      [0.71, 0.31, 0.82, 1.00, 0.61, 0.62, 0.55, -0.18],
      [0.58, 0.25, 0.55, 0.61, 1.00, 0.48, 0.42, -0.10],
      [0.62, 0.45, 0.58, 0.62, 0.48, 1.00, 0.78, -0.05],
      [0.55, 0.38, 0.51, 0.55, 0.42, 0.78, 1.00, -0.03],
      [-0.12, -0.08, -0.15, -0.18, -0.10, -0.05, -0.03, 1.00],
    ]
  },
  rebalancing: [
    { action: 'Reduce', asset: 'RELIANCE', current: '13.3%', target: '10.0%', reason: 'Position size exceeds 10% threshold' },
    { action: 'Increase', asset: 'Fixed Income', current: '8.0%', target: '15.0%', reason: 'Underweight vs strategic allocation' },
    { action: 'Increase', asset: 'International Equity', current: '0%', target: '10.0%', reason: 'No international diversification' },
    { action: 'Rebalance', asset: 'Financial Services', current: '28.5%', target: '22.0%', reason: 'Sector concentration above benchmark +6.4%' },
  ],
  drawdownPeriods: [
    { period: 'Mar 2020 (COVID)', peak: '₹2.15 Cr', trough: '₹1.48 Cr', drawdown: '-31.2%', recoveryDays: 156 },
    { period: 'Jun 2022 (Rate Hikes)', peak: '₹2.42 Cr', trough: '₹2.08 Cr', drawdown: '-14.0%', recoveryDays: 98 },
    { period: 'Current', peak: '₹2.56 Cr', trough: '₹2.48 Cr', drawdown: '-3.2%', recoveryDays: 'Ongoing' },
  ]
}

export function PortfolioIntelligencePage() {
  const [activeTab, setActiveTab] = useState<'health' | 'risk' | 'diversification' | 'correlation' | 'rebalancing' | 'drawdown'>('health')

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Hero Section */}
      <section className="relative min-h-[50vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary" />
        <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgNDAwIDQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJub2lzZUZpbHRlciI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuOSIgbnVtT2N0YXZlcz0iNCIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNub2lzZUZpbHRlcikiLz48L3N2Zz4=')]" />

        <div className="relative z-10 px-6 lg:px-8 max-w-[1400px] mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Badge variant="blue" className="mb-4">Portfolio Intelligence</Badge>
            <h1 className="font-heading font-medium leading-tight text-text-primary mb-6" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', letterSpacing: '-0.03em' }}>
              Portfolio<br />Intelligence
            </h1>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              How healthy, diversified, and resilient is your portfolio? Deep quantitative analysis
              of risk, concentration, correlation, and rebalancing insights.
            </p>
          </motion.div>

          {/* Portfolio Health Score */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-2xl mx-auto"
          >
            <Card variant="premium" padding="xl" className="text-center">
              <div className="mb-6">
                <p className="text-caption text-text-muted uppercase tracking-widest font-semibold mb-2">Portfolio Health</p>
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="relative">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="54"
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="8"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="54"
                        fill="none"
                        stroke="url(#gradient)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${intelligenceData.healthScore / 100 * 339.3} 339.3`}
                        className="transition-all duration-1000"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#22c55e" />
                          <stop offset="100%" stopColor="#38bdf8" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div>
                        <p className="font-heading text-5xl font-bold text-text-primary">{intelligenceData.healthScore}</p>
                        <p className="text-text-secondary text-sm">/ 100</p>
                      </div>
                    </div>
                  </div>
                </div>
                <Badge variant="green" size="lg" className="mb-4">{intelligenceData.healthLabel}</Badge>
                <p className="text-text-secondary max-w-md mx-auto">
                  Your portfolio is reasonably diversified, but technology exposure has increased.
                  Financial Services 28.5% • Oil & Gas 18.2% • IT 15.3%
                </p>
                <Button variant="outline" className="mt-6 gap-2" asChild>
                  <a href="#diversification">Explore Intelligence <ArrowRight className="w-4 h-4" /></a>
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Main Intelligence Content */}
      <main className="px-6 lg:px-8 pb-16">
        <div className="max-w-[1400px] mx-auto space-y-12">
          {/* Navigation */}
          <motion.nav
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-wrap gap-2 mb-8"
          >
            {[
              { id: 'health', label: 'Health Score', icon: Shield },
              { id: 'risk', label: 'Risk Analysis', icon: Target },
              { id: 'diversification', label: 'Diversification', icon: PieChart },
              { id: 'correlation', label: 'Correlation', icon: LinkIcon },
              { id: 'rebalancing', label: 'Rebalancing', icon: RefreshCw },
              { id: 'drawdown', label: 'Drawdown', icon: TrendingDown },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  activeTab === id
                    ? 'bg-blue-400/20 border border-blue-400/30 text-blue-400'
                    : 'bg-bg-glass border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-card-hover'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </motion.nav>

          {/* Content Panels */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {activeTab === 'health' && (
              <div>
                  {/* Health Overview */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="grid lg:grid-cols-3 gap-6"
                  >
                    <Card variant="strong" padding="lg">
                      <h3 className="font-heading text-lg font-semibold text-text-primary mb-4">Diversification Score</h3>
                      <MetricGroup columns={1}>
                        <Metric value={`${intelligenceData.diversification.score}/100`} label="Overall Score" size="lg" />
                        <Metric value={intelligenceData.diversification.assets} label="Total Holdings" size="md" />
                        <Metric value={intelligenceData.diversification.assetClasses} label="Asset Classes" size="md" />
                        <Metric value={intelligenceData.diversification.sectors} label="Sectors" size="md" />
                        <Metric value={intelligenceData.diversification.geographies} label="Geographies" size="md" />
                      </MetricGroup>
                    </Card>

                    <Card variant="strong" padding="lg">
                      <h3 className="font-heading text-lg font-semibold text-text-primary mb-4">Concentration Risk</h3>
                      <MetricGroup columns={1}>
                        <Metric value={intelligenceData.concentration.top5} label="Top 5 Holdings" size="lg" suffix="%" />
                        <Metric value={intelligenceData.concentration.top10} label="Top 10 Holdings" size="md" suffix="%" />
                        <Metric value={intelligenceData.concentration.hhi.toFixed(3)} label="HHI Index" size="md" />
                        <Metric value={intelligenceData.concentration.largestPosition.weight} label="Largest Position" size="md" suffix="%" changeType="negative" />
                        <p className="text-sm text-text-muted mt-2">{intelligenceData.concentration.largestPosition.symbol}</p>
                      </MetricGroup>
                    </Card>

                    <Card variant="strong" padding="lg">
                      <h3 className="font-heading text-lg font-semibold text-text-primary mb-4">Key Risk Metrics</h3>
                      <MetricGroup columns={2} gap="sm">
                        <Metric value={intelligenceData.risk.portfolioVolatility} label="Volatility" size="md" suffix="%" />
                        <Metric value={intelligenceData.risk.sharpe} label="Sharpe Ratio" size="md" />
                        <Metric value={intelligenceData.risk.sortino} label="Sortino Ratio" size="md" />
                        <Metric value={intelligenceData.risk.maxDrawdown} label="Max Drawdown" size="md" suffix="%" changeType="negative" />
                        <Metric value={intelligenceData.risk.beta} label="Beta" size="md" />
                        <Metric value={intelligenceData.risk.alpha} label="Alpha" size="md" suffix="%" changeType="positive" />
                      </MetricGroup>
                    </Card>
                  </motion.div>

                  {/* AI Insights */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="space-y-4"
                  >
                    <AIInsight type="insight" title="Portfolio Health Assessment">
                      Your portfolio scores 82/100 on health. Diversification is good across asset classes (4) and sectors (7), but concentration in Financial Services (28.5%) and Oil & Gas (18.2%) creates sector-specific risk. The HHI of 0.18 indicates moderate concentration.
                    </AIInsight>

                    <AIInsight type="recommendation" title="Priority Actions">
                      <ol className="list-decimal pl-5 space-y-2 text-white/70">
                        <li>Reduce RELIANCE from 13.3% to 10% (exceeds single-stock threshold)</li>
                        <li>Increase Fixed Income allocation from 8% to 15% for stability</li>
                        <li>Add 10% International Equity exposure (currently 0%)</li>
                        <li>Hedge USD exposure (5% unhedged) if rupee depreciation expected</li>
                      </ol>
                    </AIInsight>
                  </motion.div>
                </div>
              )}

              {activeTab === 'risk' && (
                <div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="grid lg:grid-cols-4 gap-4 mb-8"
                  >
                    {[
                      { label: 'Volatility', value: intelligenceData.risk.portfolioVolatility, suffix: '%' },
                      { label: 'Sharpe', value: intelligenceData.risk.sharpe },
                      { label: 'Sortino', value: intelligenceData.risk.sortino },
                      { label: 'VaR 95%', value: intelligenceData.risk.var95, suffix: '%' },
                      { label: 'CVaR 95%', value: intelligenceData.risk.cvar95, suffix: '%' },
                      { label: 'Max DD', value: intelligenceData.risk.maxDrawdown, suffix: '%', changeType: 'negative' as const },
                      { label: 'Current DD', value: intelligenceData.risk.currentDrawdown, suffix: '%', changeType: 'negative' as const },
                      { label: 'Beta', value: intelligenceData.risk.beta },
                      { label: 'Alpha', value: intelligenceData.risk.alpha, suffix: '%', changeType: 'positive' as const },
                      { label: 'Tracking Error', value: intelligenceData.risk.trackingError, suffix: '%' },
                      { label: 'Calmar', value: intelligenceData.risk.calmar },
                      { label: 'Ulcer Index', value: intelligenceData.risk.ulcerIndex, suffix: '%' },
                    ].map((metric) => (
                      <Card key={metric.label} variant="default" padding="md" className="text-center">
                        <p className="text-caption text-text-muted uppercase tracking-wider mb-1">{metric.label}</p>
                        <p className={cn('font-heading text-2xl font-bold', metric.changeType === 'positive' ? 'text-green-400' : metric.changeType === 'negative' ? 'text-red-400' : 'text-text-primary')}>
                          {metric.value}{metric.suffix || ''}
                        </p>
                      </Card>
                    ))}
                  </motion.div>

                  <Card variant="strong" padding="lg">
                    <h3 className="font-heading text-lg font-semibold text-text-primary mb-6">Risk Decomposition</h3>
                    <ReportTable
                      headers={['Risk Factor', 'Contribution', 'Portfolio %', 'Benchmark %', 'Active Risk']}
                      rows={[
                        ['Market Risk (Beta)', '68%', '0.94', '1.00', '-6%'],
                        ['Sector Risk', '18%', '28.5% FinSvc', '22.1% FinSvc', '+6.4%'],
                        ['Stock Specific', '14%', '-', '-', '-'],
                        ['Currency Risk', 'Minimal', '5% USD', '0%', 'Unhedged'],
                      ]}
                    />
                  </Card>
                </div>
              )}

              {activeTab === 'diversification' && (
                <div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="grid lg:grid-cols-2 gap-6"
                  >
                    <Card variant="strong" padding="lg">
                      <h3 className="font-heading text-lg font-semibold text-text-primary mb-6">Sector Concentration vs Benchmark</h3>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {intelligenceData.sectorConcentration.map((sector) => (
                          <div key={sector.sector} className="p-3 bg-bg-glass rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-blue-400" />
                                <span className="font-medium text-text-primary">{sector.sector}</span>
                              </div>
                              <div className="flex gap-4 text-sm">
                                <span className="text-text-primary font-semibold">{sector.weight}</span>
                                <span className="text-text-muted">Bench: {sector.benchmark}</span>
                              </div>
                            </div>
                            <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-400 rounded-full transition-all duration-500"
                                style={{ width: sector.weight }}
                              />
                            </div>
                            <div className="flex justify-between text-xs mt-1">
                              <span className={cn('font-medium', sector.deviation.startsWith('+') ? 'text-red-400' : 'text-green-400')}>
                                Deviation: {sector.deviation}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card variant="strong" padding="lg">
                      <h3 className="font-heading text-lg font-semibold text-text-primary mb-6">Currency Exposure</h3>
                      <div className="space-y-3">
                        {intelligenceData.currencyExposure.map((curr) => (
                          <div key={curr.currency} className="flex items-center justify-between gap-4 p-3 bg-bg-glass rounded-xl">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center text-sm font-medium">{curr.currency}</div>
                              <div>
                                <p className="font-medium text-text-primary">{curr.currency}</p>
                                <p className="text-sm text-text-muted">Portfolio weight: {curr.weight}</p>
                              </div>
                            </div>
                            <Badge variant={curr.hedged === '0%' ? 'amber' : 'green'} size="sm">
                              {curr.hedged === '0%' ? 'Unhedged' : 'Hedged'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                      <AIInsight type="alert" title="Currency Risk" className="mt-4">
                        5% USD exposure is unhedged. INR depreciation would boost returns but adds volatility. Consider hedging if you have low risk tolerance.
                      </AIInsight>
                    </Card>
                  </motion.div>

                  <Card variant="strong" padding="lg">
                    <h3 className="font-heading text-lg font-semibold text-text-primary mb-6">ETF Overlap Analysis</h3>
                    <div className="overflow-x-auto">
                      <ReportTable
                        headers={['Fund 1', 'Fund 2', 'Overlap %', 'Shared Holdings', 'Action']}
                        rows={intelligenceData.etfOverlap.map(e => [
                          e.fund1,
                          e.fund2,
                          <span className={cn('font-mono font-medium', parseInt(e.overlap) > 60 ? 'text-red-400' : parseInt(e.overlap) > 40 ? 'text-amber-400' : 'text-green-400')}>{e.overlap}</span>,
                          e.sharedHoldings.toString(),
                          <Button variant="ghost" size="sm">Analyze</Button>
                        ])}
                      />
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === 'correlation' && (
                <div>
                  <Card variant="strong" padding="lg">
                    <h3 className="font-heading text-lg font-semibold text-text-primary mb-6">Correlation Matrix</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="px-4 py-3 font-heading font-medium text-white/90 tracking-wider sticky left-0 bg-bg-primary z-10"></th>
                            {intelligenceData.correlationMatrix.assets.map((asset) => (
                              <th key={asset} className="px-4 py-3 font-heading font-medium text-white/90 tracking-wider text-center">{asset}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {intelligenceData.correlationMatrix.matrix.map((row, i) => (
                            <tr key={i} className="border-b border-white/5">
                              <td className="px-4 py-3 font-medium text-white/80 sticky left-0 bg-bg-primary z-10">{intelligenceData.correlationMatrix.assets[i]}</td>
                              {row.map((val, j) => (
                                <td key={j} className="px-4 py-3 text-center">
                                  <span className={cn(
                                    'font-mono',
                                    val > 0.7 ? 'text-red-400' : val > 0.5 ? 'text-amber-400' : val > 0.3 ? 'text-yellow-400' : val > 0 ? 'text-green-400' : 'text-blue-400'
                                  )}>
                                    {val.toFixed(2)}
                                  </span>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <AIInsight type="insight" title="Correlation Insights" className="mt-4">
                      High correlation (0.82) between HDFCBANK and ICICIBANK creates concentration risk within Financial Services. RELIANCE shows moderate correlation (0.67) with banks. Government bonds (-0.12 to -0.18) provide true diversification benefit. Mutual funds (HDFCAMC, PARAGPAR) at 0.78 correlation suggests significant overlap.
                    </AIInsight>
                  </Card>
                </div>
              )}

{activeTab === 'rebalancing' && (
                <div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-4"
                  >
                    {intelligenceData.rebalancing.map((action, i) => (
                      <Card key={i} variant="strong" padding="lg" className={cn('border-l-4', action.action === 'Reduce' && 'border-red-400', action.action === 'Increase' && 'border-green-400', action.action === 'Rebalance' && 'border-blue-400')}>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <Badge variant={
                              action.action === 'Reduce' ? 'red' :
                              action.action === 'Increase' ? 'green' : 'blue'
                            } size="md">{action.action}</Badge>
                            <div>
                              <p className="font-heading font-semibold text-text-primary">{action.asset}</p>
                              <p className="text-sm text-text-muted">{action.reason}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <p className="text-caption text-text-muted">Current</p>
                              <p className="font-heading text-xl font-bold text-text-primary">{action.current}</p>
                            </div>
                            <ArrowRight className="w-6 h-6 text-text-muted" />
                            <div className="text-center">
                              <p className="text-caption text-text-muted">Target</p>
                              <p className="font-heading text-xl font-bold text-blue-400">{action.target}</p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </motion.div>

                  <Card variant="strong" padding="lg" className="mt-8">
                    <div className="flex items-center justify-between">
                      <h3 className="font-heading text-lg font-semibold text-text-primary">Estimated Impact</h3>
                      <Button variant="primary" className="gap-2">
                        <Download className="w-4 h-4" />
                        Generate Rebalancing Report
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                      <Metric value="-1.2%" label="Expected Volatility Reduction" size="md" suffix="%" changeType="positive" />
                      <Metric value="+0.3%" label="Expected Return Improvement" size="md" suffix="%" changeType="positive" />
                      <Metric value="₹2.1L" label="Estimated Transaction Cost" size="md" prefix="₹" />
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === 'drawdown' && (
                <div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                  >
                    <Card variant="strong" padding="lg">
                      <h3 className="font-heading text-lg font-semibold text-text-primary mb-6">Historical Drawdown Periods</h3>
                      <div className="overflow-x-auto">
                        <ReportTable
                          headers={['Period', 'Peak Value', 'Trough Value', 'Drawdown', 'Recovery (days)']}
                          rows={intelligenceData.drawdownPeriods.map(d => [
                            d.period,
                            d.peak,
                            d.trough,
                            <span className="font-mono font-medium text-red-400">{d.drawdown}</span>,
                            d.recoveryDays.toString(),
                          ])}
                        />
                      </div>
                    </Card>

                    <Card variant="strong" padding="lg">
                      <h3 className="font-heading text-lg font-semibold text-text-primary mb-6">Drawdown Analytics</h3>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <Metric value="-31.2%" label="Maximum Drawdown" size="md" suffix="%" changeType="negative" />
                        <Metric value="156" label="Longest Recovery (days)" size="md" />
                        <Metric value="102" label="Average Recovery (days)" size="md" />
                        <Metric value="-3.2%" label="Current Drawdown" size="md" suffix="%" changeType="negative" />
                      </div>
                      <AIInsight type="insight" title="Drawdown Resilience">
                        Portfolio has experienced three major drawdowns since inception. The COVID drawdown (-31.2%) was the deepest but recovered in 156 days. Current drawdown of -3.2% is well within normal range. The bond allocation (8%) provided meaningful downside protection during 2022 rate hike cycle.
                      </AIInsight>
                    </Card>
                  </motion.div>
                </div>
              )}
          </motion.div>

          {/* Action Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap gap-4 pt-8 border-t border-border-subtle"
          >
            <Button variant="primary" className="gap-2">
              <Download className="w-4 h-4" />
              Generate Full Intelligence Report
            </Button>
            <Button variant="secondary">Schedule Monthly Review</Button>
            <Button variant="outline">Export Data</Button>
            <Button variant="ghost">
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh Analysis
            </Button>
          </motion.div>
        </div>
      </main>
    </div>
  )
}