export interface TreemapInput<T> {
  item: T
  /** Must be > 0. Non-positive values are dropped. */
  value: number
}

export interface TreemapRect<T> {
  item: T
  x: number
  y: number
  w: number
  h: number
}

/** Worst aspect ratio of a row of areas laid along a side of length `side`. */
function worst(row: number[], side: number): number {
  const sum = row.reduce((a, b) => a + b, 0)
  const max = Math.max(...row)
  const min = Math.min(...row)
  const s2 = side * side
  return Math.max((s2 * max) / (sum * sum), (sum * sum) / (s2 * min))
}

/**
 * Squarified treemap (Bruls, Huizing, van Wijk). Lays `items` out inside a w x h box so each
 * rectangle's area is proportional to its value, with tiles kept close to square.
 * Largest values come first. Rectangles tile the box exactly.
 */
export function squarify<T>(inputs: TreemapInput<T>[], w: number, h: number): TreemapRect<T>[] {
  const items = inputs.filter((i) => i.value > 0 && Number.isFinite(i.value)).sort((a, b) => b.value - a.value)
  const total = items.reduce((a, i) => a + i.value, 0)
  if (!items.length || total <= 0 || w <= 0 || h <= 0) return []

  const scale = (w * h) / total
  const areas = items.map((i) => i.value * scale)
  const out: TreemapRect<T>[] = []

  let x = 0
  let y = 0
  let rw = w
  let rh = h
  let start = 0

  while (start < items.length) {
    const side = Math.min(rw, rh)
    let end = start + 1
    while (end < items.length && worst(areas.slice(start, end + 1), side) <= worst(areas.slice(start, end), side)) {
      end++
    }
    const row = areas.slice(start, end)
    const rowSum = row.reduce((a, b) => a + b, 0)
    const thickness = rowSum / side
    const horizontal = rw >= rh // row runs down the left edge when the box is wide
    let offset = 0
    for (let i = 0; i < row.length; i++) {
      const length = row[i] / thickness
      out.push(
        horizontal
          ? { item: items[start + i].item, x, y: y + offset, w: thickness, h: length }
          : { item: items[start + i].item, x: x + offset, y, w: length, h: thickness },
      )
      offset += length
    }
    if (horizontal) {
      x += thickness
      rw -= thickness
    } else {
      y += thickness
      rh -= thickness
    }
    start = end
  }
  return out
}

/** Red to grey to green. Saturates at +/-3% so ordinary days still show contrast. */
export function tileColor(changePct: number | null): string {
  if (changePct === null || !Number.isFinite(changePct)) return '#6b7280'
  if (changePct === 0) return '#4b5563'
  const t = Math.min(Math.abs(changePct) / 3, 1)
  const [r, g, b] = changePct > 0 ? [22, 163, 74] : [220, 38, 38]
  const grey = 75
  const mix = (c: number) => Math.round(grey + (c - grey) * (0.35 + 0.65 * t))
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}
