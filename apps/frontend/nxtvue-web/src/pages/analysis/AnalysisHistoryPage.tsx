import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ChevronLeft, ChevronRight, Filter, X, Search } from 'lucide-react'
import { useAnalysisHistory } from '@/hooks/useAnalysisHistory'
import { Link } from 'react-router-dom'
import { SkeletonTable } from '@/components/feedback/LoadingSkeleton'
import { EmptyState } from '@/components/feedback/EmptyState'

const analysisTypeOptions = [
  { value: '', label: 'All Types' },
  { value: 'stock', label: 'Stock Analysis' },
  { value: 'compare', label: 'Comparison' },
  { value: 'portfolio', label: 'Portfolio Analysis' },
] as const

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
] as const

export function AnalysisHistoryPage() {
  const { items, loading, total, page, pageSize, goToPage, refresh } = useAnalysisHistory(10)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredItems = items.filter(item => {
    const matchesType = !typeFilter || item.analysis_type === typeFilter
    const matchesStatus = !statusFilter || item.status === statusFilter
    const matchesSearch = !searchQuery ||
      item.ticker.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesType && matchesStatus && matchesSearch
  })

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Hero Section */}
      <section className="relative min-h-[40vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary" />
        
        <div className="relative z-10 px-6 lg:px-8 max-w-[1400px] mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Badge variant="blue" className="mb-4">Analysis History</Badge>
            <h1 className="font-heading font-medium leading-tight text-text-primary mb-6" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', letterSpacing: '-0.03em' }}>
              Your Analysis<br />History
            </h1>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Review all your past stock analyses, comparisons, and portfolio reviews
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <main className="px-6 lg:px-8 pb-16">
        <div className="max-w-[1400px] mx-auto space-y-8">
          
          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="glass-card-strong p-6"
          >
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex flex-wrap gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search tickers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64 lg:w-80 pl-10 pr-4 py-2.5 bg-bg-glass border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
                  />
                </div>

                {/* Type Filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-4 py-2.5 bg-bg-glass border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
                >
                  {analysisTypeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 bg-bg-glass border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
                >
                  {statusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {/* Clear Filters */}
                {(typeFilter || statusFilter || searchQuery) && (
                  <Button variant="ghost" size="sm" onClick={() => { setTypeFilter(''); setStatusFilter(''); setSearchQuery('') }}>
                    <X className="w-4 h-4 mr-1" /> Clear
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-4 text-text-secondary text-sm">
                <span>{filteredItems.length} of {total} analyses</span>
                <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                  <Filter className="w-4 h-4 mr-1" /> Refresh
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Results */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {loading && filteredItems.length === 0 && (
              <SkeletonTable rows={5} columns={4} />
            )}

            {!loading && filteredItems.length === 0 && (
              <EmptyState
                variant="history"
                action={
                  <Button variant="primary" asChild>
                    <Link to="/analysis">
                      <Search className="w-4 h-4 mr-2" /> Run Analysis
                    </Link>
                  </Button>
                }
              />
            )}

            {!loading && filteredItems.length > 0 && (
              <div className="glass-card-strong divide-y divide-border-subtle">
                {filteredItems.map((analysis) => (
                  <Link
                    key={analysis.id}
                    to={`/analysis/${analysis.ticker}:${analysis.market}`}
                    className="flex items-center justify-between p-5 hover:bg-bg-glass transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400/20 to-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <Badge variant={analysis.analysis_type === 'stock' ? 'blue' : analysis.analysis_type === 'compare' ? 'indigo' : 'green'} size="sm">
                          {analysis.analysis_type === 'stock' ? 'Stock' : analysis.analysis_type === 'compare' ? 'Compare' : 'Portfolio'}
                        </Badge>
                      </div>
                      <div className="min-w-0">
                        <p className="font-heading font-semibold text-text-primary truncate">{analysis.ticker}</p>
                        <p className="text-sm text-text-muted flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs bg-bg-tertiary rounded">{analysis.market === 'us' ? 'US' : 'India'}</span>
                          <span>•</span>
                          <span>{new Date(analysis.created_at).toLocaleDateString()}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={analysis.status === 'completed' ? 'green' : 'red'} size="sm">
                        {analysis.status}
                      </Badge>
                      <Badge variant="blue" size="sm">{analysis.projection_year}</Badge>
                      <ChevronRight className="w-5 h-5 text-text-muted" />
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {total > pageSize && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center gap-2 mt-6"
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-4 text-text-secondary">
                  Page {page} of {Math.ceil(total / pageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= Math.ceil(total / pageSize)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  )
}