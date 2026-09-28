/**
 * MarketOverview.tsx
 * ------------------
 * Displays live Indian + US market indices fetched from /api/indices.
 * Two tabs: 🇮🇳 India | 🇺🇸 US
 * Shows: index name, current value, absolute change, % change, sparkline direction icon.
 * Refreshes every 30 s via useIndices hook.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown, RefreshCw, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useIndices, type IndexQuote } from '@/hooks/useIndices'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(value: number): string {
  if (!value || isNaN(value)) return '—'
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + 'M'
  if (value >= 10_000)    return value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtChange(v: number): string {
  if (!v || isNaN(v)) return '—'
  return (v >= 0 ? '+' : '') + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(v: number): string {
  if (!v || isNaN(v)) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

function timeAgo(date: Date | null): string {
  if (!date) return '—'
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60)  return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

// ── Index card ────────────────────────────────────────────────────────────────

function IndexCard({ index, delay = 0 }: { index: IndexQuote; delay?: number }) {
  const pos = index.positive

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'relative p-4 rounded-xl border transition-colors',
        'bg-bg-glass border-border-subtle hover:border-border-default',
      )}
    >
      {/* Subtle glow strip on positive */}
      {pos && (
        <span className="absolute inset-x-0 top-0 h-[2px] rounded-t-xl bg-gradient-to-r from-transparent via-green-400/40 to-transparent" />
      )}
      {!pos && (
        <span className="absolute inset-x-0 top-0 h-[2px] rounded-t-xl bg-gradient-to-r from-transparent via-red-400/30 to-transparent" />
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[11px] text-text-muted uppercase tracking-wider font-semibold leading-tight line-clamp-2">
          {index.name}
        </p>
        <span className={cn(
          'shrink-0 p-1 rounded-lg',
          pos ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400',
        )}>
          {pos
            ? <TrendingUp className="w-3.5 h-3.5" />
            : <TrendingDown className="w-3.5 h-3.5" />
          }
        </span>
      </div>

      <p className="font-heading text-lg font-bold text-text-primary leading-none mb-1.5">
        {fmt(index.value)}
      </p>

      <div className="flex items-center gap-1.5">
        <span className={cn(
          'text-xs font-mono font-semibold',
          pos ? 'text-green-400' : 'text-red-400',
        )}>
          {fmtChange(index.change)}
        </span>
        <span className={cn(
          'text-xs font-mono px-1.5 py-0.5 rounded-md font-semibold',
          pos ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400',
        )}>
          {fmtPct(index.changePct)}
        </span>
      </div>
    </motion.div>
  )
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="p-4 rounded-xl border border-border-subtle bg-bg-glass animate-pulse space-y-2">
      <div className="h-3 w-2/3 rounded bg-bg-tertiary" />
      <div className="h-6 w-1/2 rounded bg-bg-tertiary" />
      <div className="h-3 w-1/3 rounded bg-bg-tertiary" />
    </div>
  )
}

// ── Tab button ────────────────────────────────────────────────────────────────

function Tab({
  label, flag, active, onClick, count,
}: {
  label: string; flag: string; active: boolean; onClick: () => void; count: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
        active
          ? 'bg-bg-glass border border-border-default text-text-primary shadow-sm'
          : 'text-text-muted hover:text-text-secondary hover:bg-bg-glass/50',
      )}
    >
      <span className="text-base leading-none">{flag}</span>
      <span>{label}</span>
      <span className={cn(
        'text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums',
        active ? 'bg-blue-400/20 text-blue-400' : 'bg-bg-tertiary text-text-muted',
      )}>
        {count}
      </span>
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

type MarketTab = 'india' | 'us'

export function MarketOverview() {
  const { data, loading, error, lastFetched, refresh } = useIndices()
  const [activeTab, setActiveTab] = useState<MarketTab>('india')

  const indiaIndices = data?.india ?? []
  const usIndices    = data?.us    ?? []
  const activeIndices = activeTab === 'india' ? indiaIndices : usIndices

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <h2 className="font-heading text-lg font-semibold text-text-primary">Market Overview</h2>
          {/* Live / stale badge */}
          {loading && !data && (
            <span className="badge-blue animate-pulse">Loading…</span>
          )}
          {!loading && !error && (
            <span className="badge-blue">Live</span>
          )}
          {error && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
              <AlertCircle className="w-3 h-3" /> Delayed
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Last updated */}
          {lastFetched && (
            <span className="flex items-center gap-1 text-[11px] text-text-muted">
              <Clock className="w-3 h-3" />
              Updated {timeAgo(lastFetched)}
            </span>
          )}
          {/* Manual refresh */}
          <button
            onClick={refresh}
            disabled={loading && !data}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-glass transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={cn('w-4 h-4', loading && data && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-5">
        <Tab label="India"  flag="🇮🇳" active={activeTab === 'india'} onClick={() => setActiveTab('india')} count={indiaIndices.length || _INDIA_COUNT} />
        <Tab label="US"     flag="🇺🇸" active={activeTab === 'us'}    onClick={() => setActiveTab('us')}    count={usIndices.length    || _US_COUNT} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-400/5 border border-amber-400/20 text-sm text-amber-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Could not reach the indices API. Showing cached / placeholder data. <button onClick={refresh} className="underline">Retry</button></span>
        </div>
      )}

      {/* Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: activeTab === 'india' ? -12 : 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: activeTab === 'india' ? 12 : -12 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
        >
          {loading && !data
            ? Array.from({ length: activeTab === 'india' ? _INDIA_COUNT : _US_COUNT }).map((_, i) => (
                <SkeletonCard key={i} />
              ))
            : activeIndices.map((idx, i) => (
                <IndexCard key={idx.name} index={idx} delay={i * 0.04} />
              ))
          }
        </motion.div>
      </AnimatePresence>

      {/* Data-source footnote */}
      {data && (
        <p className="mt-4 text-[10px] text-text-muted">
          India: NSE unofficial API (~1–2 s delay) · US: Yahoo Finance (~15–20 min delay)
          {activeTab === 'india' && '  ·  BSE indices via yfinance'}
        </p>
      )}
    </div>
  )
}

// Expected count for skeleton placeholders (India: 25 NSE + 1 SENSEX, US: 6)
const _INDIA_COUNT = 26
const _US_COUNT    = 6
