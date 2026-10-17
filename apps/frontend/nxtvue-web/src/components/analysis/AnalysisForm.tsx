import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'

export interface AnalysisFormProps {
  onSubmit: (ticker: string, market: string, year: number) => void
  loading?: boolean
  defaultTicker?: string
  defaultMarket?: string
  defaultYear?: number
}

export function AnalysisForm({
  onSubmit,
  loading = false,
  defaultTicker = '',
  defaultMarket = 'india',
  defaultYear = 2026,
}: AnalysisFormProps) {
  const [ticker, setTicker] = React.useState(defaultTicker)
  const [market, setMarket] = React.useState<'india' | 'us'>(
    (defaultMarket === 'us' ? 'us' : 'india') as 'india' | 'us',
  )
  const [year, setYear] = React.useState(defaultYear)

  // Sync when parent provides new defaults (e.g. from URL param)
  React.useEffect(() => { if (defaultTicker) setTicker(defaultTicker) }, [defaultTicker])
  React.useEffect(() => { setMarket(defaultMarket === 'us' ? 'us' : 'india') }, [defaultMarket])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const t = ticker.trim().toUpperCase()
    if (!t) return
    onSubmit(t, market, year)
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Ticker input */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            Ticker Symbol
          </label>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="e.g. MSFT, NETWEB, TCS"
            disabled={loading}
            className={cn(
              'w-full bg-bg-glass border border-border-default rounded-xl px-4 py-3',
              'text-text-primary placeholder:text-text-muted font-mono text-sm',
              'focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-150',
            )}
          />
        </div>

        {/* Market toggle */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            Market
          </label>
          <div className="flex rounded-xl border border-border-default overflow-hidden">
            {(['india', 'us'] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={loading}
                onClick={() => setMarket(m)}
                className={cn(
                  'px-5 py-3 text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
                  market === m
                    ? 'bg-gradient-to-r from-blue-400 to-indigo-500 text-white'
                    : 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-glass',
                )}
              >
                {m === 'india' ? '🇮🇳 India' : '🇺🇸 US'}
              </button>
            ))}
          </div>
        </div>

        {/* Year selector */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            Year
          </label>
          <div className="flex rounded-xl border border-border-default overflow-hidden">
            {[2025, 2026, 2027].map((y) => (
              <button
                key={y}
                type="button"
                disabled={loading}
                onClick={() => setYear(y)}
                className={cn(
                  'px-4 py-3 text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
                  year === y
                    ? 'bg-gradient-to-r from-blue-400 to-indigo-500 text-white'
                    : 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-glass',
                )}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="md"
        loading={loading}
        disabled={!ticker.trim() || loading}
        className="w-full sm:w-auto"
      >
        {loading ? 'Analysing…' : 'Run Analysis'}
      </Button>
    </form>
  )
}

// Need React in scope for JSX
import React from 'react'
