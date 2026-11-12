import { describe, expect, it } from 'vitest'
import { buildPack, confluence, pack, rsiA, sma, tradePlan, viewLength, volumeProfile, wallClock, type Bar, type RawCandle } from './chartMath'
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
  it('renders candles, price tag and crosshair group', () => {
    const A = pack(
      series(120).map((c): Bar => ({ o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume })),
      series(120).map((c) => new Date(`${c.time}T00:00:00Z`)),
      'A',
    )
    const layers: Layers = { ob: true, fvg: true, sr: true, s20: true, s50: true, s200: true, vol: true, rsi: true, macd: true }
    const g = renderChart({ A, N: 60, layers, width: 900, height: 640, hi: null, lo: null, fmt: (p) => p.toFixed(2) })
    expect(g.svg).toContain('id="xl"')
    expect(g.svg).toContain('RSI 14')
    expect(g.viewBox.startsWith('0 0 900')).toBe(true)
  })
})

describe('wallClock', () => {
  it('maps epoch seconds into exchange wall time', () => {
    const d = wallClock(Date.UTC(2026, 10, 5, 14, 30) / 1000, 'America/New_York')
    expect(d.getUTCHours()).toBe(9)
    expect(d.getUTCMinutes()).toBe(30)
  })
})
