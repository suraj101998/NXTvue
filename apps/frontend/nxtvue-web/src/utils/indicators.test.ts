import { describe, expect, it } from 'vitest'
import { rsi, sma } from './indicators'
import { formatMoney } from './format'

describe('sma', () => {
  it('returns null until the window is full, then the rolling mean', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4])
  })
  it('handles period larger than the data', () => {
    expect(sma([1, 2], 5)).toEqual([null, null])
  })
})

describe('rsi', () => {
  it('is null before the period and 100 on a pure uptrend', () => {
    const up = Array.from({ length: 30 }, (_, i) => 100 + i)
    const out = rsi(up, 14)
    expect(out[13]).toBeNull()
    expect(out[14]).toBe(100)
    expect(out[29]).toBe(100)
  })
  it('is near 0 on a pure downtrend', () => {
    const down = Array.from({ length: 30 }, (_, i) => 200 - i)
    expect(rsi(down, 14)[29]).toBeLessThan(1)
  })
  it('stays within 0..100 on noisy data', () => {
    const noisy = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i) * 5 + (i % 7))
    for (const v of rsi(noisy, 14)) if (v !== null) expect(v >= 0 && v <= 100).toBe(true)
  })
  it('returns all null when data is too short', () => {
    expect(rsi([1, 2, 3], 14)).toEqual([null, null, null])
  })
})

describe('formatMoney', () => {
  it('uses the currency, not a hard-coded rupee', () => {
    expect(formatMoney(218.35, 'USD')).toBe('$218.35')
    expect(formatMoney(1196.2, 'INR')).toContain('₹')
    expect(formatMoney(1196.2, 'INR')).toContain('1,196.2')
  })
  it('falls back to a plain number without a currency', () => {
    expect(formatMoney(1234.5)).toBe('1,234.5')
  })
  it('survives an invalid currency code', () => {
    expect(formatMoney(5, 'NOPE!')).toContain('5')
  })
})
