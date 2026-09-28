import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Metric, MetricGroup } from '@/components/ui/Metric'
import { AIInsight } from '@/components/ui/AIInsight'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { ReportTable } from '@/components/charts/ChartContainer'
import { cn } from '@/utils/cn'
import { ArrowRight, TrendingUp, TrendingDown, BarChart3, PieChart, Target, Zap, RefreshCw, Download, Search, Plus } from 'lucide-react'

const portfolioData = {
  totalValue: '₹2.48 Cr',
  investedValue: '₹1.95 Cr',
  pnl: '₹0.53 Cr',
  pnlPercent: '+27.2%',
  xirr: '18.4%',
  dayChange: '+₹1.24L (+0.5%)',
  holdings: [
    { symbol: 'RELIANCE', name: 'Reliance Industries', type: 'Equity', qty: 120, avgPrice: '2,450', currentPrice: '2,745', value: '₹3.29L', pnl: '+12.0%', weight: '13.3%' },
    { symbol: 'TCS', name: 'TCS', type: 'Equity', qty: 45, avgPrice: '3,680', currentPrice: '4,121', value: '₹1.85L', pnl: '+12.0%', weight: '7.5%' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank', type: 'Equity', qty: 180, avgPrice: '1,520', currentPrice: '1,680', value: '₹3.02L', pnl: '+10.5%', weight: '12.2%' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank', type: 'Equity', qty: 200, avgPrice: '980', currentPrice: '1,121', value: '₹2.24L', pnl: '+14.4%', weight: '9.0%' },
    { symbol: 'BAJFINANCE', name: 'Bajaj Finance', type: 'Equity', qty: 25, avgPrice: '6,200', currentPrice: '7,245', value: '₹1.81L', pnl: '+16.8%', weight: '7.3%' },
    { symbol: 'HDFCAMC', name: 'HDFC Top 100 Fund', type: 'Mutual Fund', qty: 8500, avgPrice: '580', currentPrice: '680', value: '₹57.8L', pnl: '+17.2%', weight: '2.3%' },
    { symbol: 'PARAGPAR', name: 'Parag Parikh Flexi Cap', type: 'Mutual Fund', qty: 12000, avgPrice: '420', currentPrice: '510', value: '₹61.2L', pnl: '+21.4%', weight: '2.5%' },
    { symbol: 'GOVT10Y', name: '10Y G-Sec Bond', type: 'Fixed Income', qty: 50, avgPrice: '10,200', currentPrice: '10,150', value: '₹5.07L', pnl: '-0.5%', weight: '2.0%' },
  ],
  allocation: [
    { name: 'Equities', value: '62%', color: 'bg-blue-400', amount: '₹1.54 Cr' },
    { name: 'Mutual Funds', value: '28%', color: 'bg-indigo-400', amount: '₹69.5 L' },
    { name: 'Fixed Income', value: '8%', color: 'bg-green-400', amount: '₹19.8 L' },
    { name: 'Cash & Equivalents', value: '2%', color: 'bg-amber-400', amount: '₹4.9 L' },
  ],
  sectorAllocation: [
    { sector: 'Financial Services', weight: '28.5%', color: 'bg-blue-400' },
    { sector: 'Oil & Gas', weight: '18.2%', color: 'bg-amber-400' },
    { sector: 'Information Technology', weight: '15.3%', color: 'bg-indigo-400' },
    { sector: 'Consumer Goods', weight: '12.1%', color: 'bg-green-400' },
    { sector: 'Pharmaceuticals', weight: '8.7%', color: 'bg-purple-400' },
    { sector: 'Automobile', weight: '6.4%', color: 'bg-pink-400' },
    { sector: 'Others', weight: '10.8%', color: 'bg-gray-400' },
  ],
  performance: [
    { period: '1D', portfolio: '+0.5%', benchmark: '+0.4%', excess: '+0.1%' },
    { period: '1W', portfolio: '+2.1%', benchmark: '+1.8%', excess: '+0.3%' },
    { period: '1M', portfolio: '+5.8%', benchmark: '+4.2%', excess: '+1.6%' },
    { period: '3M', portfolio: '+12.4%', benchmark: '+9.8%', excess: '+2.6%' },
    { period: '6M', portfolio: '+18.7%', benchmark: '+14.5%', excess: '+4.2%' },
    { period: '1Y', portfolio: '+27.2%', benchmark: '+21.3%', excess: '+5.9%' },
    { period: '3Y', portfolio: '+48.5%', benchmark: '+38.2%', excess: '+10.3%' },
    { period: '5Y', portfolio: '+112.3%', benchmark: '+85.7%', excess: '+26.6%' },
  ]
}

export function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'holdings' | 'performance' | 'allocation'>('overview')
  const [showVideo, setShowVideo] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowVideo(false)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  const handleVideoEnded = () => {
    setShowVideo(false)
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Video Hero Section */}
      <AnimatePresence mode="wait">
        {showVideo && (
          <motion.section
            key="video-hero"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
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
                <Badge variant="blue" className="mb-4">Portfolio Overview</Badge>
                <h1 className="font-heading font-bold leading-tight text-text-primary mb-6" style={{ fontSize: 'clamp(3rem, 6vw, 5rem)', letterSpacing: '-0.03em' }}>
                  Your Wealth<br />At a Glance
                </h1>
                <p className="text-text-secondary text-lg max-w-2xl mx-auto mb-8">
                  Total portfolio value: <strong className="text-text-primary">₹2.48 Cr</strong> • Today: <strong className="text-green-400">+₹1.24L (+0.5%)</strong>
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
            key="portfolio-content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative min-h-screen"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-bg-primary/60 to-bg-primary/80" />

            {/* Portfolio Content */}
            <main className="pb-16 px-6 lg:px-8">
              <div className="max-w-[1400px] mx-auto space-y-8">
                {/* Portfolio Header */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6"
                >
                  <div>
                    <h2 className="font-heading text-3xl font-semibold text-text-primary">Portfolio Overview</h2>
                    <p className="text-text-secondary mt-1">{portfolioData.dayChange}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="primary" asChild>
                      <a href="/analysis">Analyze Investment</a>
                    </Button>
                    <Button variant="secondary" asChild>
                      <a href="/portfolio/intelligence">View Intelligence</a>
                    </Button>
                    <Button variant="outline">Add Holding</Button>
                    <Button variant="ghost">
                      <Download className="w-4 h-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </motion.div>

                {/* Key Metrics */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                  <MetricGroup columns={1}>
                    <Metric value={portfolioData.totalValue} label="Total Value" size="lg" prefix="₹" />
                    <Metric value={portfolioData.investedValue} label="Invested" size="lg" prefix="₹" />
                    <Metric value={portfolioData.pnl} label="P&L" change={portfolioData.pnlPercent} changeType="positive" size="lg" prefix="₹" />
                    <Metric value={portfolioData.xirr} label="XIRR" size="lg" suffix="%" />
                  </MetricGroup>
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
                      <TabsTrigger value="allocation">Allocation</TabsTrigger>
                      <TabsTrigger value="performance">Performance</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6">
                      {/* Asset Allocation */}
                      <div className="grid lg:grid-cols-2 gap-6">
                        <Card variant="strong" padding="lg">
                          <h3 className="font-heading text-lg font-semibold text-text-primary mb-6">Asset Allocation</h3>
                          <div className="space-y-4">
                            {portfolioData.allocation.map((asset) => (
                              <div key={asset.name} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-3 h-3 rounded-full ${asset.color}`} />
                                  <div>
                                    <p className="font-medium text-text-primary">{asset.name}</p>
                                    <p className="text-sm text-text-muted">{asset.value}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-heading font-bold text-text-primary">{asset.amount}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-6 pt-6 border-t border-border-subtle">
                            <p className="text-sm text-text-muted">Equities dominate at 62%. Consider diversifying into fixed income for risk reduction.</p>
                          </div>
                        </Card>

                        <Card variant="strong" padding="lg">
                          <h3 className="font-heading text-lg font-semibold text-text-primary mb-6">Sector Allocation</h3>
                          <div className="space-y-3 max-h-64 overflow-y-auto">
                            {portfolioData.sectorAllocation.map((sector) => (
                              <div key={sector.sector} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-3 h-3 rounded-full ${sector.color} flex-shrink-0`} />
                                  <p className="font-medium text-text-primary truncate">{sector.sector}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="w-32 h-2 bg-bg-tertiary rounded-full overflow-hidden flex-shrink-0">
                                    <div
                                      className={`h-full ${sector.color} rounded-full transition-all duration-500`}
                                      style={{ width: sector.weight }}
                                    />
                                  </div>
                                  <span className="font-heading font-semibold text-text-primary w-16 text-right">{sector.weight}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <AIInsight type="insight" title="Concentration Alert" className="mt-4">
                            Technology exposure at 42% (Financial Services + IT). Consider reducing concentration for better diversification.
                          </AIInsight>
                        </Card>
                      </div>

                      {/* Quick Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card variant="default" padding="md">
                          <p className="text-caption text-text-muted uppercase tracking-wider mb-1">Total Holdings</p>
                          <p className="font-heading text-2xl font-bold text-text-primary">{portfolioData.holdings.length}</p>
                        </Card>
                        <Card variant="default" padding="md">
                          <p className="text-caption text-text-muted uppercase tracking-wider mb-1">Asset Classes</p>
                          <p className="font-heading text-2xl font-bold text-text-primary">4</p>
                        </Card>
                        <Card variant="default" padding="md">
                          <p className="text-caption text-text-muted uppercase tracking-wider mb-1">Sectors</p>
                          <p className="font-heading text-2xl font-bold text-text-primary">7</p>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="holdings" className="space-y-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-heading text-lg font-semibold text-text-primary">All Holdings</h3>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">Add Holding</Button>
                          <Button variant="ghost" size="sm"><Search className="w-4 h-4 mr-1" /> Search</Button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <ReportTable
                          headers={['Asset', 'Type', 'Qty', 'Avg Price', 'Current', 'Value', 'P&L', 'Weight', '']}
                          rows={portfolioData.holdings.map(h => [
                            <div>
                              <p className="font-medium text-text-primary">{h.symbol}</p>
                              <p className="text-sm text-text-muted">{h.name}</p>
                            </div>,
                            <Badge variant="blue" size="sm">{h.type}</Badge>,
                            h.qty.toLocaleString(),
                            `₹${h.avgPrice}`,
                            `₹${h.currentPrice}`,
                            h.value,
                            <span className={cn('font-mono font-medium', h.pnl.startsWith('+') ? 'text-green-400' : 'text-red-400')}>{h.pnl}</span>,
                            h.weight,
                            <Button variant="ghost" size="sm" className="p-1"><ArrowRight className="w-4 h-4" /></Button>
                          ])}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="allocation" className="space-y-6">
                      <div className="grid lg:grid-cols-2 gap-6">
                        <Card variant="strong" padding="lg">
                          <h3 className="font-heading text-lg font-semibold text-text-primary mb-6">Asset Class Breakdown</h3>
                          <div className="space-y-4">
                            {portfolioData.allocation.map((asset) => (
                              <div key={asset.name} className="flex items-center justify-between gap-4 p-3 bg-bg-glass rounded-xl">
                                <div className="flex items-center gap-3">
                                  <div className={`w-4 h-4 rounded-full ${asset.color}`} />
                                  <div>
                                    <p className="font-medium text-text-primary">{asset.name}</p>
                                    <p className="text-sm text-text-muted">{asset.amount}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-heading font-bold text-text-primary">{asset.value}</p>
                                  <div className="w-32 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${asset.color} rounded-full`}
                                      style={{ width: asset.value }}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>

                        <Card variant="strong" padding="lg">
                          <h3 className="font-heading text-lg font-semibold text-text-primary mb-6">Geographic Exposure</h3>
                          <div className="space-y-3">
                            {[
                              { name: 'India', weight: '92%', color: 'bg-blue-400' },
                              { name: 'US', weight: '5%', color: 'bg-indigo-400' },
                              { name: 'Global/Other', weight: '3%', color: 'bg-green-400' },
                            ].map((geo) => (
                              <div key={geo.name} className="flex items-center justify-between gap-4 p-3 bg-bg-glass rounded-xl">
                                <div className="flex items-center gap-3">
                                  <div className={`w-4 h-4 rounded-full ${geo.color}`} />
                                  <p className="font-medium text-text-primary">{geo.name}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-heading font-bold text-text-primary">{geo.weight}</p>
                                  <div className="w-32 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                                    <div className={`h-full ${geo.color} rounded-full`} style={{ width: geo.weight }} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="performance" className="space-y-6">
                      <Card variant="strong" padding="lg">
                        <h3 className="font-heading text-lg font-semibold text-text-primary mb-6">Performance vs Benchmark (NIFTY 50)</h3>
                        <div className="overflow-x-auto">
                          <ReportTable
                            headers={['Period', 'Portfolio', 'Benchmark (NIFTY 50)', 'Excess Return']}
                            rows={portfolioData.performance.map(p => [
                              p.period,
                              <span className={cn('font-mono font-medium', p.portfolio.startsWith('+') ? 'text-green-400' : 'text-red-400')}>{p.portfolio}</span>,
                              <span className={cn('font-mono', p.benchmark.startsWith('+') ? 'text-green-400' : 'text-red-400')}>{p.benchmark}</span>,
                              <span className={cn('font-mono font-medium', p.excess.startsWith('+') ? 'text-green-400' : 'text-red-400')}>{p.excess}</span>,
                            ])}
                          />
                        </div>
                        <AIInsight type="insight" title="Performance Attribution" className="mt-4">
                          Portfolio has outperformed NIFTY 50 by +5.9% over 1Y driven by strong stock selection in Financial Services (HDFC Bank, ICICI Bank) and Consumer sectors. Mutual fund allocation added +2.1% alpha. Fixed income drag minimal at -0.3%.
                        </AIInsight>
                      </Card>

                      <div className="grid md:grid-cols-2 gap-4">
                        <Card variant="default" padding="lg">
                          <h3 className="font-heading text-lg font-semibold text-text-primary mb-4">Risk Metrics</h3>
                          <MetricGroup columns={2} gap="sm">
                            <Metric value="14.2%" label="Portfolio Volatility" size="md" suffix="%" />
                            <Metric value="1.34" label="Sharpe Ratio" size="md" />
                            <Metric value="-12.8%" label="Max Drawdown" size="md" suffix="%" changeType="negative" />
                            <Metric value="0.94" label="Beta vs NIFTY" size="md" />
                          </MetricGroup>
                        </Card>
                        <Card variant="default" padding="lg">
                          <h3 className="font-heading text-lg font-semibold text-text-primary mb-4">Rolling Returns (3Y)</h3>
                          <MetricGroup columns={2} gap="sm">
                            <Metric value="18.4%" label="Average" size="md" suffix="%" />
                            <Metric value="24.1%" label="Best 1Y" size="md" suffix="%" changeType="positive" />
                            <Metric value="11.2%" label="Worst 1Y" size="md" suffix="%" />
                            <Metric value="0.78" label="Hit Ratio" size="md" />
                          </MetricGroup>
                        </Card>
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
          exit={{ opacity: 0, scale: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-6 right-6 z-40"
        >
          <Button variant="primary" className="w-14 h-14 rounded-full p-0" asChild>
            <a href="/portfolio/intelligence" className="flex items-center justify-center w-full h-full">
              <BarChart3 className="w-6 h-6" />
            </a>
          </Button>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}