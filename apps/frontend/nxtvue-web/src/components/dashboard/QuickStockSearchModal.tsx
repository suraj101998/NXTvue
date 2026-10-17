import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, TrendingUp, ArrowRight, Loader2 } from 'lucide-react'
import { useSearch } from '@/hooks/useSearch'

interface QuickStockSearchModalProps {
  isOpen: boolean
  onClose: () => void
}

const POPULAR_TICKERS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', market: 'india', change: '+1.24%' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', market: 'india', change: '+0.62%' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', market: 'india', change: '+0.85%' },
  { symbol: 'INFY', name: 'Infosys Limited', market: 'india', change: '+1.45%' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', market: 'us', change: '+2.80%' },
  { symbol: 'AAPL', name: 'Apple Inc.', market: 'us', change: '+0.45%' },
]

export function QuickStockSearchModal({ isOpen, onClose }: QuickStockSearchModalProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { results, loading, search, clear } = useSearch()

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      clear()
    }
  }, [isOpen, clear])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        search(query.trim())
      } else {
        clear()
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, search, clear])

  if (!isOpen) return null

  const handleSelectTicker = (ticker: string, market: string = 'india') => {
    onClose()
    navigate(`/analysis?ticker=${ticker.toUpperCase()}&market=${market.toLowerCase()}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && query.trim()) {
      if (results.length > 0) {
        handleSelectTicker(results[0].ticker, results[0].market || 'india')
      } else {
        handleSelectTicker(query.trim())
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-black/10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="p-4 border-b border-black/5 flex items-center gap-3">
          <Search className="w-5 h-5 text-black/40 ml-2" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search any stock or ETF (e.g. RELIANCE, TCS, AAPL, NVDA)..."
            className="flex-1 text-base text-black placeholder-black/40 bg-transparent outline-none font-medium"
          />
          {loading && <Loader2 className="w-5 h-5 text-black/40 animate-spin" />}
          {query && (
            <button
              onClick={() => {
                setQuery('')
                clear()
              }}
              className="p-1 rounded-full text-black/40 hover:text-black"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-black/60 hover:text-black bg-black/5 rounded-full"
          >
            ESC
          </button>
        </div>

        {/* Results / Suggestions Body */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {query.trim().length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-black/40 uppercase tracking-wider px-3 mb-2">
                Matching Assets
              </p>
              {loading && results.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-black/40">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <p className="text-sm">Searching real-time markets...</p>
                </div>
              ) : results.length === 0 ? (
                <div className="py-12 text-center text-black/50 text-sm">
                  No assets found matching "{query}". Press Enter to analyze anyway.
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {results.map((item) => (
                    <div
                      key={`${item.market}-${item.ticker}`}
                      onClick={() => handleSelectTicker(item.ticker, item.market)}
                      className="group flex items-center justify-between p-3 rounded-2xl hover:bg-[#F5F5F5] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center font-bold text-xs text-black group-hover:bg-black group-hover:text-white transition-colors">
                          {item.ticker.slice(0, 4)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-black">{item.ticker}</span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-black/5 text-black/60">
                              {item.market || 'NSE'}
                            </span>
                          </div>
                          <p className="text-xs text-black/60 line-clamp-1">{item.name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {item.price !== undefined && (
                          <div className="text-right">
                            <p className="font-semibold text-sm text-black">
                              {item.market === 'us' ? '$' : '₹'}{item.price.toLocaleString()}
                            </p>
                            {item.change_pct !== undefined && (
                              <p className={`text-xs font-medium ${item.change_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {item.change_pct >= 0 ? '+' : ''}{item.change_pct.toFixed(2)}%
                              </p>
                            )}
                          </div>
                        )}
                        <ArrowRight className="w-4 h-4 text-black/30 group-hover:text-black group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-black/40 uppercase tracking-wider px-3 mb-2">
                Popular Stocks
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {POPULAR_TICKERS.map((stock) => (
                  <div
                    key={stock.symbol}
                    onClick={() => handleSelectTicker(stock.symbol, stock.market)}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#F9F9F9] hover:bg-black hover:text-white cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-black/5 group-hover:bg-white/10 flex items-center justify-center font-bold text-xs text-black group-hover:text-white">
                        <TrendingUp className="w-4 h-4 text-black group-hover:text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-black group-hover:text-white">{stock.symbol}</p>
                        <p className="text-xs text-black/50 group-hover:text-white/60">{stock.name}</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-green-600 group-hover:text-green-400">
                      {stock.change}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-[#F9F9F9] border-t border-black/5 flex items-center justify-between text-xs text-black/50 px-6">
          <span>Supported: NSE, BSE, US Equities & ETFs</span>
          <span>Press Enter to select</span>
        </div>
      </div>
    </div>
  )
}
