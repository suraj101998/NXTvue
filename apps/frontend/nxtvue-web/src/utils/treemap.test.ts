import { describe, expect, it } from 'vitest'
import { squarify, tileColor } from './treemap'

const items = [6, 6, 4, 3, 2, 2, 1].map((value, i) => ({ item: `s${i}`, value }))

describe('squarify', () => {
  it('tiles the box exactly: total area equals w*h', () => {
    const rects = squarify(items, 600, 400)
    const area = rects.reduce((a, r) => a + r.w * r.h, 0)
    expect(area).toBeCloseTo(600 * 400, 3)
  })

  it('gives each tile an area proportional to its value', () => {
    const rects = squarify(items, 600, 400)
    const total = items.reduce((a, i) => a + i.value, 0)
    for (const r of rects) {
      const v = items.find((i) => i.item === r.item)!.value
      expect(r.w * r.h).toBeCloseTo((v / total) * 600 * 400, 3)
    }
  })

  it('keeps every tile inside the box and never overlapping', () => {
    const rects = squarify(items, 600, 400)
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-9)
      expect(r.y).toBeGreaterThanOrEqual(-1e-9)
      expect(r.x + r.w).toBeLessThanOrEqual(600 + 1e-6)
      expect(r.y + r.h).toBeLessThanOrEqual(400 + 1e-6)
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]
        const b = rects[j]
        const overlapW = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        const overlapH = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        expect(overlapW > 1e-6 && overlapH > 1e-6).toBe(false)
      }
    }
  })

  it('places the largest value first', () => {
    expect(squarify([{ item: 'a', value: 1 }, { item: 'b', value: 9 }], 100, 100)[0].item).toBe('b')
  })

  it('drops zero, negative and non-finite values', () => {
    const rects = squarify(
      [{ item: 'a', value: 5 }, { item: 'z', value: 0 }, { item: 'n', value: -3 }, { item: 'x', value: NaN }],
      100,
      100,
    )
    expect(rects.map((r) => r.item)).toEqual(['a'])
    expect(rects[0].w * rects[0].h).toBeCloseTo(10000)
  })

  it('returns nothing for empty input or an empty box', () => {
    expect(squarify([], 100, 100)).toEqual([])
    expect(squarify(items, 0, 100)).toEqual([])
  })

  it('handles a single item', () => {
    expect(squarify([{ item: 'a', value: 3 }], 80, 50)).toEqual([{ item: 'a', x: 0, y: 0, w: 80, h: 50 }])
  })
})

describe('tileColor', () => {
  it('is green for gains, red for losses, grey for flat or unknown', () => {
    expect(tileColor(2)).toMatch(/^rgb\(\d+, \d+, \d+\)$/)
    const [, gr, gg] = tileColor(2).match(/rgb\((\d+), (\d+)/) ?? []
    const [, rr, rg] = tileColor(-2).match(/rgb\((\d+), (\d+)/) ?? []
    expect(Number(gg)).toBeGreaterThan(Number(gr))
    expect(Number(rr)).toBeGreaterThan(Number(rg))
    expect(tileColor(0)).toBe('#4b5563')
    expect(tileColor(null)).toBe('#6b7280')
  })

  it('saturates beyond 3 percent', () => {
    expect(tileColor(3)).toBe(tileColor(9))
  })
})
