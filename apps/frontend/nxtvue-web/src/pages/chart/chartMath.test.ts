import { describe, expect, it } from 'vitest'
import { buildPack, confluence, pack, rsiA, sma, tradePlan, viewLength, volumeProfile, wallClock, type Bar, type RawCandle } from './chartMath'
import { periodLabel, periodReturn, stampLabel } from './chartFormat'

import { renderChart, type Layers } from './chartSvg'

// Deterministic synthetic candles purely for exercising the maths (never shown in the UI).
function series(n: number, drift = 0.3): RawCandle[] {
  const out: RawCandle[] = []
  let p = 100
  for (let i = 0; i < n; i++) {
    const o = p
    p = p + drift + Math.sin(i / 3) * 2
    const d = new Date(Date.UTC(2024, 0, 1 + i))
    out.push({ time: d.toISOString().slice(0, 10), open: o, high: Math.max(o, p) + 1, low: Math.min(o, p) - 1, close: p, volume: 1000 + (i % 7) * 100 })
  }
  return out
}

describe('indicators', () => {
  it('sma is null until the window fills', () => {
    expect(sma([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3])
  })
  it('rsi is 100 on a monotonic rise', () => {
    const c = Array.from({ length: 30 }, (_, i) => i + 1)
    expect(rsiA(c)[29]).toBeGreaterThan(99)
  })
})

describe('pack and panels', () => {
  const A = buildPack(series(300), 'UTC', 'A')!
  it('builds aligned series', () => {
    expect(A.n).toBe(300)
    expect(A.s200[299]).not.toBeNull()
    expect(A.hist).toHaveLength(300)
  })
  it('refuses too few bars', () => {
    expect(buildPack(series(10), 'UTC', 'A')).toBeNull()
  })
  it('confluence score is 0..100', () => {
    const S = confluence(A)
    expect(S.sc).toBeGreaterThanOrEqual(0)
    expect(S.sc).toBeLessThanOrEqual(100)
  })
  it('trade plan has ordered ladder', () => {
    const p = tradePlan(A, 400, 90)
    expect(p.tg).toHaveLength(3)
    expect(p.rk).toBeGreaterThan(0)
    if (p.long) expect(p.tg[0]).toBeGreaterThan(p.en)
    else expect(p.tg[0]).toBeLessThan(p.en)
  })
  it('volume profile has one POC', () => {
    const vp = volumeProfile(A, 120)
    expect(vp.bins.filter((b) => b.poc)).toHaveLength(1)
    expect(vp.vaLow).toBeLessThanOrEqual(vp.poc)
  })
  it('viewLength clamps to available bars', () => {
    expect(viewLength('1Y', A)).toBe(252)
    expect(viewLength('All', A)).toBe(300)
  })
})

describe('renderChart', () => {
  const A = pack(
    series(120).map((c): Bar => ({ o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume })),
    series(120).map((c) => new Date(`${c.time}T00:00:00Z`)),
    'A',
  )
  const layers: Layers = { ob: true, fvg: true, sr: true, s20: true, s50: true, s200: true, vol: true, rsi: true, macd: true }
  const base = { A, N: 60, layers, width: 900, height: 640, hi: null, lo: null, fmt: (p: number) => p.toFixed(2) }

  it('renders candles, price tag and crosshair group', () => {
    const g = renderChart({ ...base, style: 'candle' })
    expect(g.svg).toContain('id="xl"')
    expect(g.svg).toContain('RSI 14')
    expect(g.viewBox.startsWith('0 0 900')).toBe(true)
  })

  it('line style draws one closing-price path and its fill, candle style draws bodies', () => {
    const line = renderChart({ ...base, style: 'line' })
    const candle = renderChart({ ...base, style: 'candle' })
    expect(line.svg).toContain('id="agr"')
    expect(candle.svg).not.toContain('id="agr"')
    expect(candle.svg.length).toBeGreaterThan(line.svg.length)
  })

  it('has crosshair price and time labels and a dot for the line style', () => {
    const g = renderChart({ ...base, style: 'line' })
    for (const id of ['xl', 'yl', 'xd', 'xb', 'xt', 'yb', 'yt']) expect(g.svg).toContain(`id="${id}"`)
    expect(g.mx).toBeGreaterThan(g.mn)
  })
})

describe('chart header helpers', () => {
  it('periodReturn is the percent move and null when it cannot be computed', () => {
    expect(periodReturn(100, 102.79)).toBeCloseTo(2.79, 2)
    expect(periodReturn(200, 100)).toBeCloseTo(-50, 5)
    expect(periodReturn(0, 100)).toBeNull()
    expect(periodReturn(null, 100)).toBeNull()
  })

  it('periodLabel reads the timeframe back, All as all time', () => {
    expect(periodLabel('1W')).toBe('1W')
    expect(periodLabel('All')).toBe('all time')
  })

  it("stampLabel matches the index pop-up, e.g. 13 Nov '26 10:30", () => {
    const d = new Date(Date.UTC(2026, 10, 13, 10, 30))
    expect(stampLabel(d, true)).toBe("13 Nov '26 10:30")
    expect(stampLabel(d, false)).toBe("13 Nov '26")
  })
})

describe('wallClock', () => {
  it('maps epoch seconds into exchange wall time', () => {
    const d = wallClock(Date.UTC(2026, 10, 5, 14, 30) / 1000, 'America/New_York')
    expect(d.getUTCHours()).toBe(9)
    expect(d.getUTCMinutes()).toBe(30)
  })
})
