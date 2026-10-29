import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { Star } from 'lucide-react'

export interface SearchResultItem {
  ticker: string
  name: string
  market?: string
  type: string
  price?: number
  change_pct?: number
}

function tickerToPath(symbol: string, market?: string): string {
  const m = market ? market.toLowerCase() : 'india'
  return `/analysis?ticker=${symbol.toUpperCase()}&market=${m}`
}

interface SearchResultsProps {
  searchQuery: string
  searchResults: SearchResultItem[]
  searchLoading: boolean
  isInWatchlist: (ticker: string) => boolean
  addToWatchlist: (ticker: string, name: string) => void
  removeFromWatchlist: (ticker: string) => void
  onResultClick: (ticker: string) => void
  onClose: () => void
  showSearchResults: boolean
}

export function SearchResults({
  searchQuery,
  searchResults,
  searchLoading,
  isInWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  onResultClick,
  onClose,
  showSearchResults,
}: SearchResultsProps) {
  if (!showSearchResults) return null

  const resultsContent = searchLoading ? (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400" />
    </div>
  ) : searchResults.length === 0 ? (
    <div className="p-8 text-center text-text-muted">
      No assets found matching "{searchQuery}"
    </div>
  ) : (
    searchResults.map((result) => {
      const inWatchlist = isInWatchlist(result.ticker)
      const currencySymbol = result.market === 'us' ? '$' : '₹'

      return (
        <div
          key={`${result.market}-${result.ticker}`}
          className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors border-b border-border-subtle/50 last:border-0"
        >
          <Link
            to={tickerToPath(result.ticker, result.market)}
            className="flex-1 min-w-0 pr-3"
            onClick={() => {
              onResultClick(result.ticker)
              onClose()
            }}
          >
            <div className="truncate">
              <p className="font-medium text-text-primary truncate">{result.name}</p>
              <div className="text-xs text-text-muted flex items-center gap-2 mt-0.5">
                <span className="px-1.5 py-0.5 text-[10px] uppercase font-semibold bg-slate-100 text-text-secondary rounded">
                  {result.market === 'us' ? 'US' : 'India'}
                </span>
                <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/10 text-blue-600 rounded">
                  {result.type}
                </span>
                <span className="font-mono text-text-secondary">{result.ticker}</span>
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3 shrink-0">
            {result.price !== undefined && result.price !== null && (
              <div className="text-right">
                <p className="font-heading font-semibold text-text-primary text-sm">
                  {currencySymbol}{result.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {result.change_pct !== undefined && result.change_pct !== null && (
                  <p className={cn('text-xs font-mono', result.change_pct >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {result.change_pct >= 0 ? '+' : ''}{result.change_pct.toFixed(2)}%
                  </p>
                )}
              </div>
            )}
            <button
              type="button"
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (inWatchlist) {
                  removeFromWatchlist(result.ticker)
                } else {
                  addToWatchlist(result.ticker, result.name)
                }
              }}
              aria-label={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
              title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              {inWatchlist ? (
                <Star className="w-4 h-4 fill-amber-400 text-amber-600" />
              ) : (
                <Star className="w-4 h-4 text-text-muted hover:text-amber-600" />
              )}
            </button>
          </div>
        </div>
      )
    })
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="absolute top-full left-0 right-0 mt-2 bg-[rgba(6,11,25,0.95)] backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden z-[400]"
    >
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
        <p className="text-xs text-text-muted">
          Showing results for <span className="text-text-primary font-medium">"{searchQuery}"</span>
        </p>
        <span className="text-[11px] text-text-muted">Press ESC or click outside</span>
      </div>
      <div className="max-h-96 overflow-y-auto divide-y divide-slate-200">
        {resultsContent}
      </div>
    </motion.div>
  )
}