import { memo, useEffect, useRef, useState } from 'react'

interface TvFinancialsProps {
  /** Full TradingView symbol, e.g. NASDAQ:AAPL */
  symbol: string
  height?: number
  className?: string
}

const EMBED_URL = 'https://www.tradingview-widget.com/embed-widget/financials/'

/**
 * Fundamental Data. TradingView ships this one as an iframe widget rather than a web component,
 * so it is embedded directly with the documented settings in the URL hash.
 */
export const TvFinancials = memo(function TvFinancials({ symbol, height = 600, className = '' }: TvFinancialsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')

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

  const settings = {
    colorTheme: 'light',
    displayMode: 'regular',
    isTransparent: true,
    largeChartUrl: '',
    symbol,
    width: '100%',
    height: '100%',
    locale: 'en',
  }
  const src = `${EMBED_URL}?locale=en#${encodeURIComponent(JSON.stringify(settings))}`

  return (
    <div ref={containerRef} className={`w-full overflow-hidden ${className}`} style={{ height }}>
      {visible && (
        <iframe
          key={symbol}
          title={`Fundamental data for ${symbol}`}
          src={src}
          className="h-full w-full border-0"
          loading="lazy"
        />
      )}
    </div>
  )
})
