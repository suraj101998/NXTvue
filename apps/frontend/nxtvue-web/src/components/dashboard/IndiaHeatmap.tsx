import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchIndiaHeatmap, type HeatmapIndex, type IndiaStock } from '@/api/india'
import { usePolled } from '@/hooks/usePolled'
import { squarify, tileColor } from '@/utils/treemap'

const REFRESH_MS = 30_000
const DEFAULT_W = 1000

/** Truncate to roughly fit `maxPx` at the 10px uppercase label size (about 7px per character). */
function fitLabel(text: string, maxPx: number): string {
  const max = Math.max(3, Math.floor(maxPx / 7))
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

interface Props {
  index: HeatmapIndex
  label: string
  height?: number
}

export function IndiaHeatmap({ index, label, height = 560 }: Props) {
  const { data, loading, error, updatedAt } = usePolled(
    `heatmap:${index}`,
    (signal) => fetchIndiaHeatmap(index, signal),
    REFRESH_MS,
  )

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
      <div role="status" className="flex items-center justify-center text-sm text-black/60" style={{ height }}>
        Loading {label} heatmap…
      </div>
    )
  }
  if (!data) {
    return (
      <div role="alert" className="flex items-center justify-center px-6 text-center text-sm text-red-700" style={{ height }}>
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
                return (
                  <g key={s.symbol} transform={`translate(${t.x},${t.y})`}>
                    <title>
                      {`${s.name ?? s.symbol} (${s.symbol})\n₹${s.price.toLocaleString('en-IN')}  ${
                        s.changePct === null ? '' : `${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`
                      }\n${s.sector ?? ''}`}
                    </title>
                    <rect width={t.w} height={t.h} fill={tileColor(s.changePct)} stroke="#fff" strokeWidth={1.5} />
                    {showName && (
                      <text x={t.w / 2} y={t.h / 2 - (showPct ? 4 : -4)} textAnchor="middle" fill="#fff" fontSize={Math.max(10, Math.min(18, t.w / 7))} fontWeight={700}>
                        {s.symbol.length * 8 > t.w ? s.symbol.slice(0, Math.floor(t.w / 9)) : s.symbol}
                      </text>
                    )}
                    {showPct && s.changePct !== null && (
                      <text x={t.w / 2} y={t.h / 2 + 14} textAnchor="middle" fill="#fff" fillOpacity={0.9} fontSize={Math.max(9, Math.min(14, t.w / 9))}>
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
      <p className="px-6 py-3 text-xs text-black/60">
        {data.count} stocks · tile size is traded value today · colour is the day's change
        {data.stale || error ? ' · showing the last good data, refresh failed' : ''}
        {updatedAt ? ` · updated ${updatedAt.toLocaleTimeString()}` : ''}
      </p>
    </div>
  )
}
