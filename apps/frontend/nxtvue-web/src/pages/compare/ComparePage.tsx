import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Metric, MetricGroup } from '@/components/ui/Metric'
import { AIInsight } from '@/components/ui/AIInsight'
import { ReportTable } from '@/components/charts/ChartContainer'
import { EmptyStateWithAction } from '@/components/feedback/EmptyState'
import { cn } from '@/utils/cn'
import { Plus, TrendingUp, TrendingDown, Target, BarChart3, Zap, Search, X, Download } from 'lucide-react'

const availableAssets = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', type: 'Equity', price: '2,745.30', change: '+1.84%', nxtvueScore: 84 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', type: 'Equity', price: '4,120.50', change: '+0.52%', nxtvueScore: 89 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', type: 'Equity', price: '1,680.25', change: '-0.24%', nxtvueScore: 87 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', type: 'Equity', price: '1,120.75', change: '+0.89%', nxtvueScore: 85 },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance', type: 'Equity', price: '7,245.00', change: '+2.10%', nxtvueScore: 82 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', type: 'Equity', price: '985.30', change: '-1.20%', nxtvueScore: 78 },
  { symbol: 'SUNPHARMA', name: 'Sun Pharma', type: 'Equity', price: '1,680.50', change: '+0.45%', nxtvueScore: 81 },
  { symbol: 'INFY', name: 'Infosys', type: 'Equity', price: '1,720.25', change: '+0.15%', nxtvueScore: 86 },
]

const comparisonData = {
  metrics: [
    { name: 'Current Price', reliance: '₹2,745', tcs: '₹4,121', hdfc: '₹1,680' },
    { name: '1Y Return', reliance: '+28.4%', tcs: '+15.2%', hdfc: '+22.1%' },
    { name: '3Y CAGR', reliance: '+18.7%', tcs: '+14.3%', hdfc: '+16.8%' },
    { name: 'P/E Ratio', reliance: '28.5x', tcs: '31.2x', hdfc: '20.8x' },
    { name: 'P/B Ratio', reliance: '2.1x', tcs: '14.8x', hdfc: '2.8x' },
    { name: 'ROE', reliance: '14.2%', tcs: '48.5%', hdfc: '17.2%' },
    { name: 'ROCE', reliance: '12.8%', tcs: '52.1%', hdfc: '16.5%' },
    { name: 'Debt/Equity', reliance: '0.42', tcs: '0.05', hdfc: 'N/A' },
    { name: 'Sharpe Ratio', reliance: '1.24', tcs: '1.45', hdfc: '1.18' },
    { name: 'Max Drawdown', reliance: '-21.3%', tcs: '-18.7%', hdfc: '-15.2%' },
    { name: 'Volatility (Ann.)', reliance: '18.4%', tcs: '16.2%', hdfc: '14.8%' },
    { name: 'Beta vs NIFTY', reliance: '1.08', tcs: '0.85', hdfc: '0.92' },
    { name: 'NXTvue Score', reliance: '84/100', tcs: '89/100', hdfc: '87/100' },
    { name: 'Risk Score', reliance: '45/100', tcs: '28/100', hdfc: '32/100' },
  ],
  scenarios: [
    { name: 'Bear Case', reliance: '₹2,350 (-14.4%)', tcs: '₹3,650 (-11.4%)', hdfc: '₹1,520 (-9.5%)' },
    { name: 'Base Case', reliance: '₹2,850 (+3.8%)', tcs: '₹4,250 (+3.1%)', hdfc: '₹1,780 (+6.0%)' },
    { name: 'Bull Case', reliance: '₹3,200 (+16.6%)', tcs: '₹4,650 (+12.9%)', hdfc: '₹1,950 (+16.0%)' },
  ]
}

export function ComparePage() {
  const [selectedAssets, setSelectedAssets] = useState<string[]>(['RELIANCE', 'TCS', 'HDFCBANK'])
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const filteredAssets = availableAssets.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedData = selectedAssets.map(s => availableAssets.find(a => a.symbol === s)).filter(Boolean)

  const toggleAsset = (symbol: string) => {
    setSelectedAssets(prev =>
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : prev.length < 4
        ? [...prev, symbol]
        : prev
    )
  }

  const getMetricColor = (value: string, metric: string) => {
    if (metric.includes('Return') || metric.includes('CAGR') || metric.includes('ROE') || metric.includes('ROCE') || metric.includes('Sharpe') || metric.includes('NXTvue')) {
      return value.startsWith('+') || value.startsWith('8') || value.startsWith('9') ? 'text-green-400' : 'text-red-400'
    }
    if (metric.includes('Drawdown') || metric.includes('Volatility') || metric.includes('Risk') || metric.includes('Debt') || metric.includes('Beta')) {
      const num = parseFloat(value.replace(/[%,x]/g, ''))
      return num > 20 || num > 1.2 ? 'text-red-400' : num > 10 || num > 1 ? 'text-amber-400' : 'text-green-400'
    }
    if (metric.includes('P/E') || metric.includes('P/B')) {
      const num = parseFloat(value.replace(/[x]/g, ''))
      return num > 30 ? 'text-red-400' : num > 20 ? 'text-amber-400' : 'text-green-400'
    }
    return 'text-white'
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary" />
        <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgNDAwIDQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJub2lzZUZpbHRlciI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuOSIgbnVtT2N0YXZlcz0iNCIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNub2lzZUZpbHRlcikiLz48L3N2Zz4=')]" />
        
        <div className="relative z-10 px-6 lg:px-8 max-w-[1400px] mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Badge variant="blue" className="mb-4">Compare Investments</Badge>
            <h1 className="font-heading font-medium leading-tight text-text-primary mb-6" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', letterSpacing: '-0.03em' }}>
              Side-by-Side<br />Investment Analysis
            </h1>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Select up to 4 investments to compare performance, risk, valuation, and quantitative metrics.
              NXTvue highlights key differences and provides comparative insights.
            </p>
          </motion.div>

          {/* Asset Selection */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-4xl mx-auto"
          >
            <div className="glass-card-strong p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-lg font-semibold text-text-primary">Selected Assets ({selectedAssets.length}/4)</h2>
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className="btn-secondary text-sm gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Asset
                </button>
              </div>

              <div className="flex flex-wrap gap-3 mb-4">
                {selectedAssets.map((symbol) => {
                  const asset = availableAssets.find(a => a.symbol === symbol)
                  if (!asset) return null
                  return (
                    <div key={symbol} className="flex items-center gap-2 px-4 py-2 bg-bg-glass rounded-full border border-border-subtle">
                      <span className="font-medium text-text-primary">{asset.symbol}</span>
                      <span className="text-text-secondary text-sm">{asset.name}</span>
                      <button
                        onClick={() => toggleAsset(symbol)}
                        className="p-1 text-text-muted hover:text-red-400 transition-colors"
                        aria-label={`Remove ${asset.symbol}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
                {selectedAssets.length < 4 && (
                  <button
                    onClick={() => setShowSearch(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-400/10 border border-blue-400/30 rounded-full text-blue-400 text-sm font-medium hover:bg-blue-400/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Another
                  </button>
                )}
              </div>

              {showSearch && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4"
                >
                  <div className="relative mb-3">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                    <input
                      type="text"
                      placeholder="Search assets to add..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-12 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-400"
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {filteredAssets.filter(a => !selectedAssets.includes(a.symbol)).map((asset) => (
                      <button
                        key={asset.symbol}
                        onClick={() => { toggleAsset(asset.symbol); setSearchQuery(''); setShowSearch(false); }}
                        className="flex items-center justify-between p-3 bg-bg-glass border border-border-subtle rounded-xl hover:bg-bg-card-hover hover:border-border-emphasis transition-colors text-left"
                      >
                        <div>
                          <p className="font-medium text-text-primary">{asset.symbol}</p>
                          <p className="text-sm text-text-secondary">{asset.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={asset.change.startsWith('+') ? 'green' : 'red'} size="sm">{asset.change}</Badge>
                          <Badge variant="blue" size="sm">{asset.nxtvueScore}</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Comparison Content */}
      {selectedAssets.length >= 2 && (
        <main className="px-6 lg:px-8 pb-16">
          <div className="max-w-[1400px] mx-auto space-y-12">
            {/* Summary Comparison */}
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              <h2 className="font-heading text-2xl font-semibold text-text-primary">Summary Comparison</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {selectedAssets.map((symbol) => {
                  const asset = availableAssets.find(a => a.symbol === symbol)
                  if (!asset) return null
                  return (
                    <motion.div
                      key={symbol}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4 }}
                      className="glass-card-strong p-6 relative"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-caption text-text-muted uppercase tracking-wider">{asset.type}</p>
                          <h3 className="font-heading text-xl font-bold text-text-primary">{asset.symbol}</h3>
                          <p className="text-text-secondary text-sm">{asset.name}</p>
                        </div>
                        <Badge variant="blue" size="md">{asset.nxtvueScore}/100</Badge>
                      </div>
                      <MetricGroup columns={2} gap="sm">
                        <Metric value={asset.price} label="Price" prefix="₹" size="md" />
                        <Metric value={asset.change} label="1D Change" size="md" changeType={asset.change.startsWith('+') ? 'positive' : 'negative'} />
                        <Metric value={`${asset.nxtvueScore}/100`} label="NXTvue Score" size="md" />
                        <Metric value={`${asset.nxtvueScore > 85 ? 'Low' : asset.nxtvueScore > 75 ? 'Moderate' : 'High'}`} label="Risk" size="md" />
                      </MetricGroup>
                      <Button variant="outline" className="w-full mt-4" asChild>
                        <a href={`/analysis/${asset.symbol}`}>View Analysis</a>
                      </Button>
                    </motion.div>
                  )
                })}
              </div>
            </motion.section>

            {/* NXTvue Comparative Insight */}
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <AIInsight type="insight" title="NXTvue Comparative Insight">
                <div className="space-y-3">
                  <p>Reliance (84) offers the highest growth potential with new energy optionality, but carries higher concentration risk (45). TCS (89) provides superior quality metrics with exceptional ROE (48.5%) and lower risk (28), though at a premium valuation. HDFC Bank (87) balances quality and valuation with strong retail franchise.</p>
                  <p className="font-medium">Key Differentiator:</p>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>Reliance: Conglomerate optionality, highest beta (1.08)</li>
                    <li>TCS: Quality compounder, lowest risk, highest ROE</li>
                    <li>HDFC: Financial sector proxy, moderate beta (0.92)</li>
                  </ul>
                  <Button variant="outline" size="sm" className="mt-2">Explore Underlying Metrics →</Button>
                </div>
              </AIInsight>
            </motion.section>

            {/* Detailed Metrics Comparison */}
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading text-2xl font-semibold text-text-primary">Detailed Metrics</h2>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm">Performance</Button>
                  <Button variant="ghost" size="sm">Risk</Button>
                  <Button variant="ghost" size="sm">Valuation</Button>
                  <Button variant="ghost" size="sm">Quantitative</Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <ReportTable
                  headers={['Metric', ...selectedAssets.map(s => availableAssets.find(a => a.symbol === s)?.symbol || s)]}
                  rows={comparisonData.metrics.map(m => [
                    m.name,
                    ...selectedAssets.map(s => m[s.toLowerCase() as keyof typeof m] || '-')
                  ])}
                />
              </div>
            </motion.section>

            {/* Scenario Comparison */}
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <h2 className="font-heading text-2xl font-semibold text-text-primary mb-6">Scenario Analysis</h2>
              <div className="overflow-x-auto">
                <ReportTable
                  headers={['Scenario', ...selectedAssets.map(s => availableAssets.find(a => a.symbol === s)?.symbol || s)]}
                  rows={comparisonData.scenarios.map(s => [
                    s.name,
                    ...selectedAssets.map(a => s[a.toLowerCase() as keyof typeof s] || '-')
                  ])}
                />
              </div>
            </motion.section>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-wrap gap-4"
            >
              <Button variant="primary" className="gap-2">
                <Download className="w-4 h-4" />
                Generate Comparison Report
              </Button>
              <Button variant="secondary">Save Comparison</Button>
              <Button variant="outline">Share</Button>
            </motion.div>
          </div>
        </main>
      )}

      {selectedAssets.length < 2 && (
        <main className="px-6 lg:px-8 pb-16">
          <div className="max-w-[1400px] mx-auto">
            <EmptyStateWithAction
              variant="compare"
              actionLabel="Browse Investments"
              actionOnClick={() => setShowSearch(true)}
            />
          </div>
        </main>
      )}
    </div>
  )
}