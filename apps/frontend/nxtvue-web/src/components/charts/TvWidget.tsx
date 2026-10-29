import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { chartPath } from '@/utils/resolveSymbol'

export type TvWidgetName =
  | 'advanced-chart'
  | 'ticker-tape'
  | 'heatmap'
  | 'screener'
  | 'technical-analysis'
  | 'economic-calendar'
  | 'news-feed'
  | 'mini-chart'
  | 'world-market-summary'
  | 'economic-map'
  | 'company-profile'

export interface TvWidgetProps {
  widget: TvWidgetName
  symbol?: string
  interval?: string
  theme?: 'dark' | 'light'
  className?: string
  height?: number | string
  /** Widget attributes. Arrays and objects are JSON-encoded; `true` becomes a bare attribute; null/false are skipped. */
  options?: Record<string, unknown>
  /** Overrides the default in-app navigation when a symbol inside the widget is clicked. */
  onSymbolSelect?: (symbol: string) => void
  /** Shown instead of the widget if its script fails to load or the element never registers. */
  fallback?: ReactNode
}

const BASE = 'https://widgets.tradingview-widget.com/w/en'
const LOAD_TIMEOUT_MS = 15_000

// Theme tokens documented by TradingView (closed shadow roots allow only these CSS variables).
const THEME_TOKENS: Record<'dark' | 'light', Record<string, string>> = {
  dark: {
    '--tv-widget-positive-color': '#22c55e',
    '--tv-widget-negative-color': '#ef4444',
    '--tv-widget-accent-color': '#38bdf8',
  },
  light: {
    '--tv-widget-positive-color': '#059669',
    '--tv-widget-negative-color': '#dc2626',
    '--tv-widget-accent-color': '#4f46e5',
  },
}

const scriptLoads = new Map<string, Promise<void>>()

/** Injects each widget script once and resolves when it has run (or rejects on network error). */
function loadScript(widget: TvWidgetName): Promise<void> {
  const src = `${BASE}/tv-${widget}.js`
  const cached = scriptLoads.get(src)
  if (cached) return cached
  const p = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.type = 'module'
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => {
      scriptLoads.delete(src) // allow a later retry
      script.remove()
      reject(new Error(`Failed to load ${src}`))
    }
    document.head.appendChild(script)
  })
  scriptLoads.set(src, p)
  return p
}

function applyAttributes(el: HTMLElement, attrs: Record<string, unknown>) {
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue
    if (value === true) el.setAttribute(name, '')
    else if (typeof value === 'object') el.setAttribute(name, JSON.stringify(value))
    else el.setAttribute(name, String(value))
  }
}

function DefaultFallback({ widget }: { widget: TvWidgetName }) {
  return (
    <div role="alert" className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
      <AlertTriangle className="h-6 w-6 text-amber-500" aria-hidden="true" />
      <p className="text-sm font-semibold">TradingView {widget.replace('-', ' ')} is unavailable</p>
      <p className="text-xs opacity-70">The widget could not be loaded. Check your connection and try again.</p>
    </div>
  )
}

export const TvWidget = memo(function TvWidget({
  widget,
  symbol,
  interval = 'D',
  theme = 'light',
  className = '',
  height = '100%',
  options,
  onSymbolSelect,
  fallback,
}: TvWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // React never renders children into mountRef, so imperative DOM changes cannot conflict with it.
  const mountRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  // Without IntersectionObserver there is nothing to wait for, so start visible.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')
  const [failed, setFailed] = useState(false)

  // Keep the latest callbacks without re-creating the element.
  const handlers = useRef({ onSymbolSelect, navigate })
  useEffect(() => {
    handlers.current = { onSymbolSelect, navigate }
  })

  // Lazy mount: do nothing until the container approaches the viewport.
  useEffect(() => {
    const node = containerRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [])

  const optionsKey = JSON.stringify(options ?? {})

  useEffect(() => {
    const container = containerRef.current
    const mount = mountRef.current
    if (!container || !mount || !visible) return
    let disposed = false
    let element: HTMLElement | null = null
    setFailed(false)

    let timer = 0
    const timeout = new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS)
    })
    Promise.race([
      loadScript(widget).then(() => customElements.whenDefined(`tv-${widget}`)),
      timeout,
    ])
      .finally(() => window.clearTimeout(timer))
      .then(() => {
        if (disposed) return
        element = document.createElement(`tv-${widget}`)
        applyAttributes(element, {
          theme,
          autosize: true,
          symbol,
          interval: widget === 'advanced-chart' ? interval : undefined,
          ...(JSON.parse(optionsKey) as Record<string, unknown>),
        })
        for (const [k, v] of Object.entries(THEME_TOKENS[theme])) element.style.setProperty(k, v)
        mount.replaceChildren(element)
      })
      .catch(() => {
        if (!disposed) setFailed(true)
      })

    // tv-link-open bubbles from the widget. Keep navigation inside the SPA.
    const onLinkOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { context?: { symbol?: string }; symbol?: string } | undefined
      const clicked = detail?.context?.symbol ?? detail?.symbol
      if (!clicked) return
      e.preventDefault()
      const { onSymbolSelect: select, navigate: go } = handlers.current
      if (select) select(clicked)
      else go(chartPath(clicked))
    }
    container.addEventListener('tv-link-open', onLinkOpen)

    return () => {
      disposed = true
      window.clearTimeout(timer)
      container.removeEventListener('tv-link-open', onLinkOpen)
      element?.remove()
    }
  }, [visible, widget, symbol, interval, theme, optionsKey])

  return (
    <div
      ref={containerRef}
      className={`tradingview-widget-container w-full overflow-hidden ${className}`}
      style={{ height }}
    >
      <div ref={mountRef} className="h-full w-full" hidden={failed} />
      {failed ? (fallback ?? <DefaultFallback widget={widget} />) : null}
    </div>
  )
})
