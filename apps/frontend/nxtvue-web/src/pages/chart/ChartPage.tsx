import { useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { NativeChart } from '@/components/charts/NativeChart'
import { TvWidget } from '@/components/charts/TvWidget'
import { TvFinancials } from '@/components/charts/TvFinancials'
import { IndiaFundamentals } from '@/components/charts/IndiaFundamentals'
import { useQuote, useTechnicals, useTvSymbol, type LoadState, type Quote } from '@/hooks/useMarketData'
import type { Technicals } from '@/api/market'
import { formatCompact, formatMoney } from '@/utils/format'
import { chartPath, normalizeMarket, resolveSymbol, type ResolvedSymbol } from '@/utils/resolveSymbol'

const DEFAULT_SYMBOL = { india: 'RELIANCE', us: 'NVDA' } as const
const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-sm'

export function ChartPage() {
  const { symbol: routeSymbol } = useParams<{ symbol: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // The URL is the single source of truth: back/forward and deep links always agree with the page.
  const tab = normalizeMarket(searchParams.get('market'))
  const activeSymbol = routeSymbol ?? DEFAULT_SYMBOL[tab]
  const resolved = resolveSymbol(activeSymbol, tab)

  // "Use native chart" is the fallback when a TradingView widget cannot render a symbol.
  const forceNative = searchParams.get('engine') === 'native' && !!resolved.history
  const engine = forceNative ? 'native' : resolved.engine

  const quote = useQuote(resolved)
  const analysisPath = `/analysis/${encodeURIComponent(resolved.symbol)}?market=${resolved.market === 'us' ? 'us' : 'india'}`
  const canAnalyse = resolved.market !== 'global'

  const switchMarket = (next: 'india' | 'us') => {
    if (next !== tab || resolved.market === 'global') navigate(chartPath(DEFAULT_SYMBOL[next], next))
  }

  const setEngine = (value: 'native' | 'tv') => {
    const next = new URLSearchParams(searchParams)
    if (value === 'native') next.set('engine', 'native')
    else next.delete('engine')
    setSearchParams(next)
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className={`${CARD} flex flex-col justify-between gap-6 p-6 lg:flex-row lg:items-center`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">{resolved.displayName}</h1>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
              {engine === 'tv' ? 'Live chart' : 'Native chart'}
            </span>
            <StatusPill quote={quote} hasHistory={!!resolved.history} />
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            {engine === 'tv' ? 'US data is delayed.' : 'Daily and intraday candles. May be delayed.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Market" className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(['india', 'us'] as const).map((m) => {
              const active = resolved.market === m
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={active}
                  onClick={() => switchMarket(m)}
                  className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                    active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m === 'india' ? 'India (NSE/BSE)' : 'US markets'}
                </button>
              )
            })}
          </div>

          <SearchBar key={activeSymbol} initial={activeSymbol} market={tab} />

          {canAnalyse && (
            <button
              type="button"
              onClick={() => navigate(analysisPath)}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
            >
              AI research memo
            </button>
          )}
        </div>
      </header>

      <QuoteStrip quote={quote} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <section className={`${CARD} p-5 lg:col-span-3`} aria-label="Price chart">
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4">
            <span className="text-sm font-bold text-slate-900">Price chart</span>
            {resolved.history && (
              <button
                type="button"
                onClick={() => setEngine(engine === 'native' ? 'tv' : 'native')}
                className="text-xs font-semibold text-blue-700 transition hover:text-blue-900"
                hidden={resolved.engine === 'native'}
              >
                {engine === 'native' ? 'Switch to live chart' : 'Switch to native chart'}
              </button>
            )}
          </div>

          <ChartCanvas resolved={resolved} engine={engine} onUseNative={() => setEngine('native')} />
        </section>

        <aside className="space-y-6">
          <section className={`${CARD} p-6`} aria-label="Technical signal">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Technical signal</h2>
            <TechnicalsPanel resolved={resolved} engine={engine} />
          </section>
        </aside>
      </div>

      <FundamentalsSection resolved={resolved} />
    </div>
  )
}

// ─── Company profile and fundamentals ────────────────────────────────────────

function FundamentalsSection({ resolved }: { resolved: ResolvedSymbol }) {
  const tv = useTvSymbol(resolved)
  if (resolved.market === 'india') {
    // TradingView's profile and financials widgets do not serve NSE, so Indian symbols use our own data.
    return <IndiaFundamentals key={resolved.symbol} symbol={resolved.symbol} />
  }
  if (tv.status === 'idle') {
    return (
      <section className={`${CARD} p-6`} aria-label="Company profile and fundamentals">
        <h2 className="text-sm font-bold text-slate-900">Company profile and fundamentals</h2>
        <p className="mt-2 text-xs text-text-secondary">
          Company profile and fundamentals are not available for {resolved.displayName}.
        </p>
      </section>
    )
  }
  if (tv.status !== 'ready') {
    return (
      <section className={`${CARD} p-6`} aria-label="Company profile and fundamentals">
        <p role="status" className="text-xs text-text-secondary">
          {tv.status === 'not_found' || tv.status === 'error' ? 'Company data is unavailable for this symbol.' : 'Loading company data…'}
        </p>
      </section>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className={`${CARD} p-5`} aria-label="Company profile">
        <h2 className="mb-4 border-b border-slate-200 pb-4 text-sm font-bold text-slate-900">Company profile</h2>
        <TvWidget key={tv.data} widget="company-profile" symbol={tv.data} theme="light" height={480} />
      </section>
      <section className={`${CARD} p-5`} aria-label="Fundamental data">
        <h2 className="mb-4 border-b border-slate-200 pb-4 text-sm font-bold text-slate-900">Fundamental data</h2>
        <TvFinancials symbol={tv.data} height={480} />
      </section>
    </div>
  )
}

// ─── Header pieces ────────────────────────────────────────────────────────────

function SearchBar({ initial, market }: { initial: string; market: 'india' | 'us' }) {
  const navigate = useNavigate()
  const [value, setValue] = useState(initial)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = value.trim().toUpperCase()
    if (next) navigate(chartPath(next, market))
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2" role="search">
      <div className="relative">
        <label htmlFor="chart-symbol" className="sr-only">
          Ticker symbol
        </label>
        <input
          id="chart-symbol"
          name="symbol"
          type="text"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="GVT&D, NVDA, NYSE:JPM"
          className="w-52 rounded-xl border border-slate-300 bg-white py-2.5 px-3.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 md:w-64"
        />
      </div>
      <button
        type="submit"
        className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-700 active:scale-95"
      >
        Load chart
      </button>
    </form>
  )
}

function StatusPill({ quote, hasHistory }: { quote: LoadState<Quote>; hasHistory: boolean }) {
  let tone = 'border-slate-300 bg-slate-100 text-slate-600'
  let text = 'Chart widget'
  if (hasHistory) {
    switch (quote.status) {
      case 'loading':
      case 'idle':
        text = 'Loading data'
        break
      case 'ready':
        tone = 'border-emerald-200 bg-emerald-50 text-emerald-700'
        text = `Data as of ${quote.data.asOf}`
        break
      case 'not_found':
        tone = 'border-red-200 bg-red-50 text-red-700'
        text = 'Symbol not found'
        break
      case 'error':
        tone = 'border-amber-200 bg-amber-50 text-amber-700'
        text = 'Data unavailable'
        break
    }
  }
  return (
    <span role="status" className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      {text}
    </span>
  )
}

function Stat({ label, value, sub, children }: { label: string; value?: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className={`${CARD} p-4`}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</span>
      <div className="mt-1 text-xl font-bold text-slate-900">{value ?? children}</div>
      {sub && <div className="mt-0.5 text-[11px] text-text-secondary">{sub}</div>}
    </div>
  )
}

function QuoteStrip({ quote }: { quote: LoadState<Quote> }) {
  if (quote.status === 'idle') return null
  if (quote.status !== 'ready') {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-busy={quote.status === 'loading'}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${CARD} h-[88px] ${quote.status === 'loading' ? 'motion-safe:animate-pulse' : ''}`} />
        ))}
      </div>
    )
  }
  const q = quote.data
  const up = q.change >= 0
  const money = (n: number) => formatMoney(n, q.currency)
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Stat label="Last close" sub={`Daily close, ${q.asOf}`}>
        <span className="flex flex-wrap items-baseline gap-2">
          {money(q.price)}
          <span className={`flex items-center text-xs font-semibold ${up ? 'text-emerald-600' : 'text-red-600'}`}>
            <span aria-hidden="true">{up ? '▲' : '▼'}&nbsp;</span>
            <span className="sr-only">{up ? 'Up' : 'Down'}</span>
            {up ? '+' : ''}
            {q.changePct.toFixed(2)}%
          </span>
        </span>
      </Stat>
      <Stat label="Last session range" value={`${money(q.sessionLow)} – ${money(q.sessionHigh)}`} sub="Low to high of the last daily bar" />
      <Stat label="52-week range" value={`${money(q.low52w)} – ${money(q.high52w)}`} sub="From the last 1Y of daily candles" />
      <Stat label="Last session volume" value={formatCompact(q.sessionVolume)} sub="Shares traded in the last daily bar" />
    </div>
  )
}

// ─── Chart ────────────────────────────────────────────────────────────────────

function ChartCanvas({
  resolved,
  engine,
  onUseNative,
}: {
  resolved: ResolvedSymbol
  engine: 'tv' | 'native'
  onUseNative: () => void
}) {
  const tv = useTvSymbol(resolved)

  if (engine === 'native' && resolved.history) {
    return <NativeChart key={`${resolved.history.market}:${resolved.history.symbol}`} symbol={resolved.history.symbol} market={resolved.history.market} />
  }

  if (tv.status === 'loading' || tv.status === 'idle') {
    return <div role="status" className="flex h-[560px] items-center justify-center text-sm text-text-secondary">Resolving {resolved.symbol}…</div>
  }

  if (tv.status === 'not_found' || tv.status === 'error') {
    return (
      <div role="alert" className="flex h-[560px] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-semibold text-slate-900">
          {tv.status === 'not_found' ? `No listing found for ${resolved.symbol}` : 'Could not look up this symbol'}
        </p>
        <p className="max-w-sm text-xs text-text-secondary">{tv.message}</p>
        {resolved.history && <NativeButton onClick={onUseNative} />}
      </div>
    )
  }

  return (
    <div className="h-[560px] overflow-hidden rounded-xl">
      <TvWidget
        key={tv.data}
        widget="advanced-chart"
        symbol={tv.data}
        theme="light"
        height={560}
        options={{ allow_symbol_change: true, studies: ['STD;RSI', 'STD;MACD'] }}
        fallback={<TvFallback onUseNative={resolved.history ? onUseNative : undefined} />}
      />
    </div>
  )
}

function NativeButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700">
      Open native chart
    </button>
  )
}

function TvFallback({ onUseNative }: { onUseNative?: () => void }) {
  return (
    <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-semibold text-slate-900">The chart could not be loaded</p>
      <p className="max-w-sm text-xs text-text-secondary">
        The widget failed to load or does not support this symbol (NSE symbols are not available in embedded chart widgets).
      </p>
      {onUseNative && <NativeButton onClick={onUseNative} />}
    </div>
  )
}

// ─── Technicals ───────────────────────────────────────────────────────────────

const SIGNAL_TONE: Record<Technicals['signal'], string> = {
  'Strong Buy': 'text-emerald-600',
  Buy: 'text-emerald-600',
  Neutral: 'text-slate-600',
  Sell: 'text-red-600',
  'Strong Sell': 'text-red-600',
}

function TechnicalsPanel({ resolved, engine }: { resolved: ResolvedSymbol; engine: 'tv' | 'native' }) {
  const tv = useTvSymbol(resolved)
  const tech = useTechnicals(engine === 'native' ? resolved : { ...resolved, history: undefined })

  if (engine === 'tv') {
    if (tv.status !== 'ready') {
      return <p className="text-xs text-text-secondary">{tv.status === 'not_found' ? 'No technical data for this symbol.' : 'Loading…'}</p>
    }
    return (
      <div className="h-[360px] overflow-hidden rounded-xl">
        <TvWidget key={tv.data} widget="technical-analysis" symbol={tv.data} theme="light" height={360} />
      </div>
    )
  }

  if (tech.status === 'loading' || tech.status === 'idle') {
    return <div className="h-40 rounded-xl bg-slate-50 motion-safe:animate-pulse" aria-busy="true" />
  }
  if (tech.status !== 'ready') {
    return (
      <p role="alert" className="text-xs text-text-secondary">
        {tech.status === 'not_found' ? tech.message : 'Technical signal is unavailable right now.'}
      </p>
    )
  }

  const t = tech.data
  const pos = ((t.score + 1) / 2) * 100
  const fmt = (n: number | null) => (n === null ? 'n/a' : formatMoney(n, t.currency))
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className={`text-2xl font-extrabold ${SIGNAL_TONE[t.signal]}`}>{t.signal}</div>
        <div className="relative mx-auto mt-3 h-1.5 w-full rounded-full bg-gradient-to-r from-red-500 via-slate-500 to-emerald-500">
          <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow" style={{ left: `${pos}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-text-muted">
          <span>Sell</span>
          <span>Buy</span>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-200 pt-4 text-xs">
        <Row label="RSI (14)" value={t.rsi14.toFixed(1)} />
        <Row label="MACD histogram" value={t.macd_histogram.toFixed(2)} />
        <Row label="SMA 20" value={fmt(t.sma20)} />
        <Row label="SMA 50" value={fmt(t.sma50)} />
        <Row label="SMA 200" value={fmt(t.sma200)} />
        <Row label="Last close" value={fmt(t.price)} />
      </dl>
      <p className="text-[11px] leading-relaxed text-text-muted">
        Rule-based score from daily closes ({t.candles_used} candles): RSI, MACD and moving averages. Not investment advice.
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] text-text-muted">{label}</dt>
      <dd className="font-bold text-slate-900">{value}</dd>
    </div>
  )
}
