import { useEffect, useState } from 'react'
import { fetchHistory } from '@/api/market'
import { usePolled, type Polled } from '@/hooks/usePolled'
import { buildPack, KIND_SOURCE, type Kind, type Pack } from './chartMath'
import type { HistoryMarket } from '@/utils/resolveSymbol'

export const TZ: Record<HistoryMarket, string> = { india: 'Asia/Kolkata', us: 'America/New_York' }

const REFRESH_MS: Record<Kind, number> = { I5: 20_000, I30: 60_000, A: 30_000, W: 300_000, M: 300_000 }

/** Candles for one timeframe kind, rebuilt into indicator packs and refreshed while the tab is visible. */
export function usePack(h: { symbol: string; market: HistoryMarket } | undefined, kind: Kind | null): Polled<Pack> {
  const key = h && kind ? `pack:${h.market}:${h.symbol}:${kind}` : null
  return usePolled<Pack>(
    key,
    async () => {
      const src = KIND_SOURCE[kind as Kind]
      const res = await fetchHistory(h!.symbol, h!.market, src.interval, src.range)
      const pack = buildPack(res.candles, TZ[h!.market], kind as Kind)
      if (!pack) throw new Error(`Not enough ${src.interval} history for ${h!.symbol}`)
      return pack
    },
    kind ? REFRESH_MS[kind] : 60_000,
  )
}

/** Value that only follows `value` after it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}
