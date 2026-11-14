import { useEffect, useMemo, useRef, useState } from 'react'
import type { IndiaHeatmap, IndiaStock } from '@/api/india'
import { usePolled } from '@/hooks/usePolled'
import { useTheme } from '@/hooks/useTheme'
import { squarify, tileColor } from '@/utils/treemap'

const REFRESH_MS = 30_000
const DEFAULT_W = 1000

/** Truncate to roughly fit `maxPx` at the 10px uppercase label size (about 7px per character). */
function fitLabel(text: string, maxPx: number): string {
  const max = Math.max(3, Math.floor(maxPx / 7))
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/** Company logo on a white disc. If the image fails to load the disc is dropped, not left empty. */
function TileLogo({ src, cx, cy, size }: { src: string; cx: number; cy: number; size: number }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  const r = size / 2
  const pad = Math.max(2, size * 0.14)
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#fff" />
      <image
        href={src}
        x={cx - r + pad}
        y={cy - r + pad}
        width={size - pad * 2}
        height={size - pad * 2}
        preserveAspectRatio="xMidYMid meet"
        onError={() => setFailed(true)}
      />
    </g>
  )
}

interface Props {
  /** Changing the id discards the old data and loads the new heatmap. */
  id: string
  load: (signal: AbortSignal) => Promise<IndiaHeatmap>
  label: string
  /** Price prefix and number locale of the market. */
  currency?: { symbol: string; locale: string }
  height?: number
  /** Bump this number to reload now instead of waiting for the next poll. */
  refreshSignal?: number
}

const INR = { symbol: '₹', locale: 'en-IN' }

export function StockHeatmap({ id, load, label, currency = INR, height = 560, refreshSignal = 0 }: Props) {
  const dark = useTheme().theme === 'dark'
  const { data, loading, error, updatedAt, refresh } = usePolled(`heatmap:${id}`, load, REFRESH_MS)
  useEffect(() => {
    if (refreshSignal) refresh()
  }, [refreshSignal, refresh])

  // Lay tiles out at the real pixel size so text is never stretched by SVG scaling.
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(DEFAULT_W)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [loading, data])

  const W = width
  const H = height

  const groups = useMemo(() => {
    if (!data) return []
    const bySector = new Map<string, IndiaStock[]>()
    for (const s of data.stocks) {
      const key = s.sector ?? 'Other'
      bySector.set(key, [...(bySector.get(key) ?? []), s])
    }
    const sectors = squarify(
      [...bySector].map(([sector, stocks]) => ({
        item: { sector, stocks },
        value: stocks.reduce((a, s) => a + (s.turnover ?? 0), 0),
      })),
      W,
      H,
    )
    return sectors.map((sec) => ({
      sector: sec.item.sector,
      x: sec.x,
      y: sec.y,
      w: sec.w,
      h: sec.h,
      tiles: squarify(
        sec.item.stocks.map((s) => ({ item: s, value: s.turnover ?? 0 })),
        sec.w,
        sec.h,
      ),
    }))
  }, [data, W, H])

  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center text-sm text-black/60 dark:text-white/60" style={{ height }}>
        Loading {label} heatmap…
      </div>
    )
  }
  if (!data) {
    return (
      <div role="alert" className="flex items-center justify-center px-6 text-center text-sm text-red-700 dark:text-red-400" style={{ height }}>
        {label} heatmap is unavailable right now{error ? `: ${error}` : ''}.
      </div>
    )
  }

  return (
    <div>
      <div ref={boxRef} className="relative w-full" style={{ height }}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block"
          role="img"
          aria-label={`${label} heatmap: ${data.count} stocks, tile size is traded value, colour is today's change`}
        >
          {groups.map((g) => (
            <g key={g.sector} transform={`translate(${g.x},${g.y})`}>
              {g.tiles.map((t) => {
                const s = t.item
                const showName = t.w > 52 && t.h > 26
                const showPct = t.w > 52 && t.h > 44
                // Shrink the ticker to fit the tile width (bold caps average ~0.68em per character).
                const nameSize = Math.max(8, Math.min(18, t.w / 7, (t.w - 8) / (s.symbol.length * 0.68)))
                // The logo goes above the ticker when the tile is big enough to hold all three lines.
                const logoSize = s.logo && showPct && t.w > 56 && t.h > 78 ? Math.min(36, t.w * 0.34, t.h * 0.3) : 0
                const pctSize = Math.max(9, Math.min(14, t.w / 9))
                const gap = logoSize ? 6 : 0
                const stack = logoSize + gap + nameSize + (showPct ? pctSize + 4 : 0)
                const top = (t.h - stack) / 2
                const nameY = top + logoSize + gap + nameSize * 0.85
                const pctY = nameY + pctSize + 4
                return (
                  <g key={s.symbol} transform={`translate(${t.x},${t.y})`}>
                    <title>
                      {`${s.name ?? s.symbol} (${s.symbol})\n${currency.symbol}${s.price.toLocaleString(currency.locale)}  ${
                        s.changePct === null ? '' : `${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`
                      }\n${s.sector ?? ''}`}
                    </title>
                    <rect width={t.w} height={t.h} fill={tileColor(s.changePct)} stroke={dark ? '#0e1330' : '#fff'} strokeWidth={1.5} />
                    {logoSize > 0 && s.logo && <TileLogo src={s.logo} cx={t.w / 2} cy={top + logoSize / 2} size={logoSize} />}
                    {showName && (
                      <text x={t.w / 2} y={showPct ? nameY : t.h / 2 + nameSize * 0.35} textAnchor="middle" fill="#fff" fontSize={nameSize} fontWeight={700}>
                        {s.symbol}
                      </text>
                    )}
                    {showPct && s.changePct !== null && (
                      <text x={t.w / 2} y={pctY} textAnchor="middle" fill="#fff" fillOpacity={0.9} fontSize={pctSize}>
                        {s.changePct >= 0 ? '+' : ''}
                        {s.changePct.toFixed(2)}%
                      </text>
                    )}
                  </g>
                )
              })}
              {g.w > 60 && g.h > 18 && (
                <text x={5} y={12} fill="#fff" fillOpacity={0.95} fontSize={10} fontWeight={700} style={{ textTransform: 'uppercase', paintOrder: 'stroke' }} stroke="rgba(0,0,0,0.45)" strokeWidth={2.5}>
                  {fitLabel(g.sector, g.w - 10)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <p className="px-6 py-3 text-xs text-black/60 dark:text-white/60">
        {data.count} stocks · tile size is traded value today · colour is the day's change
        {data.stale || error ? ' · showing the last good data, refresh failed' : ''}
        {updatedAt ? ` · updated ${updatedAt.toLocaleTimeString()}` : ''}
      </p>
    </div>
  )
}
