/**
 * Pure maths for the charts terminal: indicators, order blocks, fair value gaps, confluence score,
 * trade plan and volume profile. A direct, typed port of the reference
 * template's functions. Nothing in here fetches or invents data: it only works on the candles it is given.
 */

export interface Bar {
  o: number
  h: number
  l: number
  c: number
  v: number
}
export type Kind = 'A' | 'W' | 'M' | 'I5' | 'I30'
export type TF = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'All'
type Num = number | null

export interface OrderBlock {
  i: number
  t: 'b' | 's'
  top: number
  bot: number
  str: number
  te: number
  mit: boolean
}
export interface Fvg {
  i: number
  t: 'b' | 's'
  top: number
  bot: number
  fil: boolean
}
export interface Pack {
  a: Bar[]
  n: number
  dt: Date[]
  k: Kind
  s20: Num[]
  s50: Num[]
  s200: Num[]
  rsi: Num[]
  atr: Num[]
  vma: Num[]
  macd: number[]
  sig: number[]
  hist: number[]
  ob: OrderBlock[]
  fv: Fvg[]
  sh: number[]
  sl: number[]
}

export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))

// ─── Indicators ──────────────────────────────────────────────────────────────

export function sma(a: number[], n: number): Num[] {
  const o: Num[] = []
  let s = 0
  for (let i = 0; i < a.length; i++) {
    s += a[i]
    if (i >= n) s -= a[i - n]
    o.push(i >= n - 1 ? s / n : null)
  }
  return o
}

export function ema(a: number[], n: number): number[] {
  const k = 2 / (n + 1)
  const o = [a[0]]
  for (let i = 1; i < a.length; i++) o.push(a[i] * k + o[i - 1] * (1 - k))
  return o
}

export function rsiA(c: number[]): Num[] {
  const o: Num[] = [null]
  let g = 0
  let l = 0
  for (let i = 1; i < c.length; i++) {
    const d = c[i] - c[i - 1]
    if (i <= 14) {
      g += Math.max(d, 0) / 14
      l += Math.max(-d, 0) / 14
      o.push(i === 14 ? 100 - 100 / (1 + g / (l || 1e-9)) : null)
    } else {
      g = (g * 13 + Math.max(d, 0)) / 14
      l = (l * 13 + Math.max(-d, 0)) / 14
      o.push(100 - 100 / (1 + g / (l || 1e-9)))
    }
  }
  return o
}

export function atrA(a: Bar[]): Num[] {
  const o: Num[] = []
  let p = 0
  a.forEach((e, i) => {
    const t = i ? Math.max(e.h - e.l, Math.abs(e.h - a[i - 1].c), Math.abs(e.l - a[i - 1].c)) : e.h - e.l
    p = i < 14 ? (p * i + t) / (i + 1) : (p * 13 + t) / 14
    o.push(i >= 13 ? p : null)
  })
  return o
}

/** Builds every series and structure the panels and the chart read. Needs at least 5 bars. */
export function pack(a: Bar[], dt: Date[], kind: Kind): Pack {
  const n = a.length
  const c = a.map((e) => e.c)
  const atr = atrA(a)
  const e12 = ema(c, 12)
  const e26 = ema(c, 26)
  const macd = e12.map((v, i) => v - e26[i])
  const sig = ema(macd, 9)
  const hist = macd.map((v, i) => v - sig[i])

  const ob: OrderBlock[] = []
  for (let i = 20; i < n - 3; i++) {
    const e = a[i]
    const at = atr[i]
    if (!at) continue
    const mv = a[i + 3].c - e.c
    const t = e.c < e.o && mv > 1.1 * at ? 'b' : e.c > e.o && mv < -1.1 * at ? 's' : null
    if (!t) continue
    const prev = ob[ob.length - 1]
    if (prev && prev.t === t && i - prev.i < 6) continue
    const z: OrderBlock = {
      i,
      t,
      top: Math.max(e.o, e.c),
      bot: Math.min(e.o, e.c),
      str: clamp(Math.round((Math.abs(mv) / at) * 22), 10, 99),
      te: 0,
      mit: false,
    }
    let ins = false
    for (let j = i + 4; j < n; j++) {
      if (t === 'b' ? a[j].c < z.bot : a[j].c > z.top) {
        z.mit = true
        break
      }
      const ht = t === 'b' ? a[j].l <= z.top : a[j].h >= z.bot
      if (ht && !ins) z.te++
      ins = ht
    }
    ob.push(z)
  }

  const fv: Fvg[] = []
  for (let i = 2; i < n; i++) {
    const at2 = atr[i] ?? atr[13]
    if (!at2) continue
    const p0 = a[i - 2]
    const q0 = a[i]
    const t2 = q0.l > p0.h ? 'b' : q0.h < p0.l ? 's' : null
    if (!t2) continue
    const top = t2 === 'b' ? q0.l : p0.l
    const bot = t2 === 'b' ? p0.h : q0.h
    if (top - bot < 0.2 * at2) continue
    const g: Fvg = { i: i - 1, t: t2, top, bot, fil: false }
    for (let j = i + 1; j < n; j++) {
      if (t2 === 'b') {
        if (a[j].l <= g.bot) {
          g.fil = true
          break
        }
        if (a[j].l < g.top) g.top = a[j].l
      } else {
        if (a[j].h >= g.top) {
          g.fil = true
          break
        }
        if (a[j].h > g.bot) g.bot = a[j].h
      }
    }
    if (!g.fil) fv.push(g)
  }

  const sh: number[] = []
  const sl: number[] = []
  for (let i = Math.max(4, n - 250); i < n - 4; i++) {
    let hh = true
    let ll = true
    for (let j = i - 4; j <= i + 4; j++) {
      if (a[j].h > a[i].h) hh = false
      if (a[j].l < a[i].l) ll = false
    }
    if (hh) sh.push(a[i].h)
    if (ll) sl.push(a[i].l)
  }

  return {
    a,
    n,
    dt,
    k: kind,
    s20: sma(c, 20),
    s50: sma(c, 50),
    s200: sma(c, 200),
    rsi: rsiA(c),
    atr,
    vma: sma(
      a.map((e) => e.v),
      20,
    ),
    macd,
    sig,
    hist,
    ob,
    fv,
    sh,
    sl,
  }
}

// ─── Candle conversion ───────────────────────────────────────────────────────

export interface RawCandle {
  time: string | number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const fmtCache = new Map<string, Intl.DateTimeFormat>()

/** Epoch seconds -> a Date whose UTC fields hold the exchange's wall-clock time. */
export function wallClock(sec: number, tz: string): Date {
  let f = fmtCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    })
    fmtCache.set(tz, f)
  }
  const get: Record<string, number> = {}
  for (const p of f.formatToParts(new Date(sec * 1000))) if (p.type !== 'literal') get[p.type] = Number(p.value)
  return new Date(Date.UTC(get.year, get.month - 1, get.day, get.hour % 24, get.minute))
}

export function toSeries(candles: RawCandle[], tz: string): { bars: Bar[]; dt: Date[] } {
  const bars: Bar[] = []
  const dt: Date[] = []
  for (const c of candles) {
    if (![c.open, c.high, c.low, c.close].every(Number.isFinite)) continue
    bars.push({ o: c.open, h: c.high, l: c.low, c: c.close, v: Number.isFinite(c.volume) ? c.volume : 0 })
    dt.push(typeof c.time === 'number' ? wallClock(c.time, tz) : new Date(`${c.time.slice(0, 10)}T00:00:00Z`))
  }
  return { bars, dt }
}

export function buildPack(candles: RawCandle[], tz: string, kind: Kind): Pack | null {
  const { bars, dt } = toSeries(candles, tz)
  return bars.length >= 30 ? pack(bars, dt, kind) : null
}

// ─── Timeframes ──────────────────────────────────────────────────────────────

export const TIMEFRAMES: TF[] = ['1D', '1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'All']
export const TFS: Record<TF, [Kind, number]> = {
  '1D': ['I5', 0],
  '1W': ['I30', 0],
  '1M': ['A', 21],
  '3M': ['A', 63],
  '6M': ['A', 126],
  '1Y': ['A', 252],
  '3Y': ['W', 156],
  '5Y': ['W', 260],
  All: ['M', 0],
}
/** Which backend history call feeds each candle kind. */
export const KIND_SOURCE: Record<Kind, { interval: '5m' | '30m' | '1d' | '1wk' | '1mo'; range: string }> = {
  A: { interval: '1d', range: '5y' },
  W: { interval: '1wk', range: 'max' },
  M: { interval: '1mo', range: 'max' },
  I5: { interval: '5m', range: '5d' },
  I30: { interval: '30m', range: '1mo' },
}

function barsInLastDays(A: Pick<Pack, 'n' | 'dt'>, days: number): number {
  const seen = new Set<number>()
  let count = 0
  for (let i = A.n - 1; i >= 0; i--) {
    const d = Math.floor(A.dt[i].getTime() / 864e5)
    if (!seen.has(d)) {
      if (seen.size === days) break
      seen.add(d)
    }
    count++
  }
  return count
}

/** How many bars of `A` the timeframe shows. */
export function viewLength(tf: TF, A: Pick<Pack, 'n' | 'dt'>): number {
  const [kind, n0] = TFS[tf]
  let N = n0
  if (kind === 'I5') N = barsInLastDays(A, 1)
  if (kind === 'I30') N = barsInLastDays(A, 5)
  return !N || N > A.n ? A.n : N
}

// ─── Labels ──────────────────────────────────────────────────────────────────

const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function axisLabel(A: Pack, i: number, N: number): string {
  const p = A.dt[i]
  const q = A.dt[i - 1]
  const k = A.k
  if (!q) return ''
  const h = p.getUTCHours()
  const m = p.getUTCMonth()
  const mc = m !== q.getUTCMonth()
  const yr = m === 0 ? ` ’${String(p.getUTCFullYear()).slice(2)}` : ''
  if (k === 'I5') return p.getUTCMinutes() === 0 && q.getUTCHours() !== h ? `${`0${h}`.slice(-2)}:00` : ''
  if (k === 'I30') return p.getUTCDate() !== q.getUTCDate() ? `${DN[p.getUTCDay()]} ${p.getUTCDate()}` : ''
  if (k === 'M') return p.getUTCFullYear() !== q.getUTCFullYear() ? `${p.getUTCFullYear()}` : ''
  if (k === 'W') return mc && m % 3 === 0 ? MN[m] + yr : ''
  if (N <= 30) return p.getUTCDay() < q.getUTCDay() ? `${p.getUTCDate()} ${MN[m]}` : ''
  return mc ? MN[m] + yr : ''
}

// ─── Levels, confluence and trade plan ───────────────────────────────────────

export interface Level {
  p: number
  n: string
}

/** Nearest swing resistance/support plus the 52-week high and low. */
export function levels(A: Pack, hi: number | null, lo: number | null): Level[] {
  const c = A.a[A.n - 1].c
  const o: Level[] = []
  const add = (p: number | null, n: string) => {
    if (p == null || !Number.isFinite(p)) return
    if (!o.some((q) => Math.abs(q.p - p) / p < 0.008)) o.push({ p, n })
  }
  A.sh
    .filter((p) => p > c)
    .sort((x, y) => x - y)
    .slice(0, 2)
    .forEach((p) => add(p, 'R'))
  A.sl
    .filter((p) => p < c)
    .sort((x, y) => y - x)
    .slice(0, 2)
    .forEach((p) => add(p, 'S'))
  add(hi, '52W H')
  add(lo, '52W L')
  return o
}

export interface Confluence {
  f: { t: number; m: number; s: number; v: number; o: number }
  sc: number
  v: string
}

export function confluence(A: Pack): Confluence {
  const a = A.a
  const n = A.n
  const c = a[n - 1].c
  const at = A.atr[n - 1] ?? c * 0.01
  const s20 = A.s20[n - 1] ?? c
  const s50 = A.s50[n - 1] ?? c
  const s200 = A.s200[n - 1]
  const f = { t: 0, m: 0, s: 0, v: 0, o: 0 }
  f.t = 50 + (s200 ? (c > s200 ? 20 : -20) : 0) + (s50 > (s200 ?? 0) ? 15 : -15) + (c > s50 ? 15 : -15)
  f.m = clamp((A.rsi[n - 1] ?? 50) + (A.hist[n - 1] > 0 ? 10 : -10), 0, 100)
  f.s = 50 + (c > s20 ? 25 : -25) + (s20 > s50 ? 25 : -25)
  let u = 0
  let dn = 0
  a.slice(-10).forEach((e) => {
    if (e.c >= e.o) u += e.v
    else dn += e.v
  })
  f.v = u + dn ? (u / (u + dn)) * 100 : 50
  let dB = 10
  let dR = 10
  A.ob.forEach((z) => {
    if (z.mit) return
    if (z.t === 'b' && z.top <= c) dB = Math.min(dB, (c - z.top) / at)
    if (z.t === 's' && z.bot >= c) dR = Math.min(dR, (z.bot - c) / at)
  })
  f.o = 50 + ((dR - dB) / (dR + dB + 1e-9)) * 45
  for (const k of Object.keys(f) as (keyof typeof f)[]) f[k] = clamp(Math.round(f[k]), 0, 100)
  const sc = Math.round(f.t * 0.3 + f.m * 0.25 + f.s * 0.15 + f.v * 0.15 + f.o * 0.15)
  return { f, sc, v: sc >= 68 ? 'Strong buy' : sc >= 56 ? 'Buy' : sc >= 44 ? 'Neutral' : sc >= 32 ? 'Sell' : 'Strong sell' }
}

export interface TradePlan {
  S: Confluence
  long: boolean
  en: number
  sp: number
  rk: number
  tg: number[]
  ob: OrderBlock | null
}

export function tradePlan(A: Pack, hi: number | null, lo: number | null): TradePlan {
  const n = A.n
  const c = A.a[n - 1].c
  const at = A.atr[n - 1] ?? c * 0.01
  const S = confluence(A)
  const long = S.sc >= 50
  const L = levels(A, hi, lo)
  let obs: OrderBlock | null =
    A.ob
      .filter((z) => !z.mit && (long ? z.t === 'b' && z.top <= c * 1.002 : z.t === 's' && z.bot >= c * 0.998))
      .sort((x, y) => (long ? y.top - x.top : x.bot - y.bot))[0] ?? null
  let en: number
  let sp: number
  if (obs && Math.abs(c - (long ? obs.top : obs.bot)) / at <= 2.5) {
    en = long ? obs.top : obs.bot
    sp = long ? obs.bot - 0.5 * at : obs.top + 0.5 * at
  } else {
    obs = null
    en = c
    sp = long ? c - 1.5 * at : c + 1.5 * at
  }
  const rk = Math.abs(en - sp)
  const tg = L.filter((q) => (long ? q.p > en + rk : q.p < en - rk))
    .map((q) => q.p)
    .sort((x, y) => (long ? x - y : y - x))
    .slice(0, 3)
  ;[1.5, 2.5, 4].forEach((m) => {
    if (tg.length >= 3) return
    const t = long ? en + m * rk : en - m * rk
    const last = tg[tg.length - 1]
    if (last == null || (long ? t > last : t < last)) tg.push(t)
  })
  while (tg.length < 3) tg.push(tg[tg.length - 1] + (long ? 1 : -1) * rk)
  return { S, long, en, sp, rk, tg: tg.slice(0, 3), ob: obs }
}

// ─── Volume profile ──────────────────────────────────────────────────────────

export interface VolumeProfile {
  bins: { mid: number; w: number; poc: boolean; va: boolean; cur: boolean }[]
  poc: number
  vaLow: number
  vaHigh: number
  span: number
}

export function volumeProfile(A: Pack, N: number): VolumeProfile {
  const v = A.a.slice(-N)
  const B = 20
  const mn = Math.min(...v.map((e) => e.l))
  const mx = Math.max(...v.map((e) => e.h))
  const st = (mx - mn) / B || 1
  const b: number[] = Array.from({ length: B }, () => 0)
  v.forEach((e) => {
    b[Math.min(B - 1, Math.floor(((e.h + e.l + e.c) / 3 - mn) / st))] += e.v
  })
  const tot = b.reduce((x, y) => x + y, 0)
  const poc = b.indexOf(Math.max(...b))
  let lo = poc
  let hi = poc
  let acc = b[poc]
  while (acc < tot * 0.7 && (lo > 0 || hi < B - 1)) {
    const dn = lo > 0 ? b[lo - 1] : -1
    const up = hi < B - 1 ? b[hi + 1] : -1
    if (up >= dn) {
      hi++
      acc += b[hi]
    } else {
      lo--
      acc += b[lo]
    }
  }
  const c = A.a[A.n - 1].c
  const ci = Math.min(B - 1, Math.max(0, Math.floor((c - mn) / st)))
  const mxb = Math.max(...b) || 1
  const bins = b.map((x, i) => ({ mid: mn + st * (i + 0.5), w: (x / mxb) * 100, poc: i === poc, va: i >= lo && i <= hi && i !== poc, cur: i === ci }))
  return { bins, poc: mn + st * (poc + 0.5), vaLow: mn + st * lo, vaHigh: mn + st * (hi + 1), span: mx - mn }
}
