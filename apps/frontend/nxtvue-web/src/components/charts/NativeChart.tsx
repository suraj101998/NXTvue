import { useEffect, useRef, useState } from 'react'
import {
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { fetchHistory, MarketApiError, type Candle, type Interval } from '@/api/market'
import { rsi as computeRsi, sma as computeSma } from '@/utils/indicators'
import type { HistoryMarket } from '@/utils/resolveSymbol'

interface Timeframe {
  label: string
  interval: Interval
  range: string
}

const TIMEFRAMES: Timeframe[] = [
  { label: '1D', interval: '5m', range: '1d' },
  { label: '5D', interval: '15m', range: '5d' },
  { label: '1M', interval: '60m', range: '1mo' },
  { label: '6M', interval: '1d', range: '6mo' },
  { label: '1Y', interval: '1d', range: '1y' },
  { label: '2Y', interval: '1d', range: '2y' },
  { label: '5Y', interval: '1wk', range: '5y' },
]
// 2Y of daily candles so the 200-day average has a visible history.
const DEFAULT_TIMEFRAME = '2Y'

interface NativeChartProps {
  symbol: string
  market: HistoryMarket
  height?: number
  className?: string
  /** Called with the failure reason so the page header can reflect real status. */
  onStatus?: (status: 'loading' | 'ready' | 'not_found' | 'error') => void
}

const THEME = {
  background: '#ffffff',
  text: '#475569',
  grid: 'rgba(15,23,42,0.06)',
  border: 'rgba(15,23,42,0.14)',
  up: '#059669',
  down: '#dc2626',
  sma20: '#2563eb',
  sma50: '#d97706',
  sma200: '#7c3aed',
  rsi: '#7c3aed',
}

const toTime = (t: Candle['time']): Time => (typeof t === 'number' ? (t as UTCTimestamp) : (t as Time))

function toLine(times: Candle['time'][], values: (number | null)[]) {
  const out: { time: Time; value: number }[] = []
  values.forEach((v, i) => {
    if (v !== null) out.push({ time: toTime(times[i]), value: v })
  })
  return out
}

export function NativeChart({ symbol, market, height = 520, className = '', onStatus }: NativeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const statusRef = useRef(onStatus)
  useEffect(() => {
    statusRef.current = onStatus
  })

  const [tf, setTf] = useState(DEFAULT_TIMEFRAME)
  const [showSma, setShowSma] = useState(true)
  const [showRsi, setShowRsi] = useState(true)
  const [state, setState] = useState<{ phase: 'loading' | 'ready' | 'not_found' | 'error'; message?: string }>({
    phase: 'loading',
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    let userAdjusted = false
    let resizeObserver: ResizeObserver | undefined
    const markAdjusted = () => {
      userAdjusted = true
    }
    container.addEventListener('wheel', markAdjusted, { passive: true })
    container.addEventListener('pointerdown', markAdjusted)
    const timeframe = TIMEFRAMES.find((t) => t.label === tf) ?? TIMEFRAMES[5]
    const intraday = timeframe.interval.endsWith('m')

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: THEME.background },
        textColor: THEME.text,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        panes: { separatorColor: THEME.border },
      },
      grid: { vertLines: { color: THEME.grid }, horzLines: { color: THEME.grid } },
      crosshair: { mode: 0 },
      timeScale: { borderColor: THEME.border, timeVisible: intraday },
      rightPriceScale: { borderColor: THEME.border },
      autoSize: true, // the chart observes its container; no manual resize handler needed
    })
    chartRef.current = chart

    setState({ phase: 'loading' })
    statusRef.current?.('loading')

    fetchHistory(symbol, market, timeframe.interval, timeframe.range)
      .then((res) => {
        if (cancelled) return
        const candles = res.candles
        const times = candles.map((c) => c.time)
        const closes = candles.map((c) => c.close)

        const price = chart.addSeries(CandlestickSeries, {
          upColor: THEME.up,
          downColor: THEME.down,
          wickUpColor: THEME.up,
          wickDownColor: THEME.down,
          borderVisible: false,
        })
        price.setData(candles.map((c) => ({ time: toTime(c.time), open: c.open, high: c.high, low: c.low, close: c.close })))

        // Volume as an overlay on its own scale, squeezed into the bottom of the price pane
        const volume = chart.addSeries(HistogramSeries, {
          priceScaleId: 'volume',
          priceFormat: { type: 'volume' },
          lastValueVisible: false,
          priceLineVisible: false,
        })
        volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
        volume.setData(
          candles.map((c) => ({
            time: toTime(c.time),
            value: c.volume,
            color: c.close >= c.open ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)',
          })),
        )

        if (showSma) {
          chart
            .addSeries(LineSeries, { color: THEME.sma20, lineWidth: 1, lastValueVisible: false, priceLineVisible: false, title: 'SMA 20' })
            .setData(toLine(times, computeSma(closes, 20)))
          chart
            .addSeries(LineSeries, { color: THEME.sma50, lineWidth: 1, lastValueVisible: false, priceLineVisible: false, title: 'SMA 50' })
            .setData(toLine(times, computeSma(closes, 50)))
          chart
            .addSeries(LineSeries, { color: THEME.sma200, lineWidth: 2, lastValueVisible: false, priceLineVisible: false, title: 'SMA 200' })
            .setData(toLine(times, computeSma(closes, 200)))
        }

        if (showRsi) {
          const rsiSeries = chart.addSeries(
            LineSeries,
            { color: THEME.rsi, lineWidth: 1, priceLineVisible: false, title: 'RSI 14' },
            1,
          )
          rsiSeries.setData(toLine(times, computeRsi(closes, 14)))
          rsiSeries.createPriceLine({ price: 70, color: THEME.down, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' })
          rsiSeries.createPriceLine({ price: 30, color: THEME.up, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' })
          chart.panes()[1]?.setStretchFactor(0.3)
        }

        // autoSize resizes the chart after layout settles, which leaves a fit computed at the old
        // width. Refit after every container resize until the user zooms or pans themselves.
        const timeScale = chart.timeScale()
        timeScale.fitContent()
        resizeObserver = new ResizeObserver(() => {
          if (userAdjusted) return
          requestAnimationFrame(() => {
            if (!cancelled && !userAdjusted) timeScale.fitContent()
          })
        })
        resizeObserver.observe(container)
        setState({ phase: 'ready' })
        statusRef.current?.('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const notFound = err instanceof MarketApiError && (err.status === 404 || err.status === 422)
        const phase = notFound ? 'not_found' : 'error'
        setState({ phase, message: err instanceof Error ? err.message : 'Failed to load chart data' })
        statusRef.current?.(phase)
      })

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      container.removeEventListener('wheel', markAdjusted)
      container.removeEventListener('pointerdown', markAdjusted)
      chart.remove()
      chartRef.current = null
    }
  }, [symbol, market, tf, showSma, showRsi])

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Chart timeframe" className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.label}
              type="button"
              aria-pressed={tf === t.label}
              onClick={() => setTf(t.label)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                tf === t.label ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" name="show-sma" checked={showSma} onChange={(e) => setShowSma(e.target.checked)} />
            SMA 20/50/200
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" name="show-rsi" checked={showRsi} onChange={(e) => setShowRsi(e.target.checked)} />
            RSI 14
          </label>
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200" style={{ height }}>
        <div ref={containerRef} className="h-full w-full" />
        {state.phase === 'loading' && (
          <div
            role="status"
            className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-sm font-semibold text-blue-700"
          >
            <span className="mr-3 h-2.5 w-2.5 rounded-full bg-blue-600 motion-safe:animate-ping" />
            Loading {symbol}…
          </div>
        )}
        {(state.phase === 'not_found' || state.phase === 'error') && (
          <div role="alert" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-white/95 p-6 text-center">
            <p className="text-sm font-semibold text-slate-900">
              {state.phase === 'not_found' ? `No data for ${symbol}` : 'Could not load chart data'}
            </p>
            <p className="text-xs text-slate-500">{state.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
