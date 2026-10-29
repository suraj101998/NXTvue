/** Pure indicator maths used by NativeChart. `null` marks bars without enough history. */

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

/** Wilder's RSI (same smoothing as the backend). */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (values.length <= period) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1]
    if (d >= 0) gain += d
    else loss -= d
  }
  gain /= period
  loss /= period
  out[period] = toRsi(gain, loss)
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1]
    gain = (gain * (period - 1) + (d > 0 ? d : 0)) / period
    loss = (loss * (period - 1) + (d < 0 ? -d : 0)) / period
    out[i] = toRsi(gain, loss)
  }
  return out
}

function toRsi(gain: number, loss: number): number {
  if (loss === 0) return 100
  return 100 - 100 / (1 + gain / loss)
}
