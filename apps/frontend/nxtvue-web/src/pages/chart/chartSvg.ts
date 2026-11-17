/** SVG string renderer for the charts terminal: a typed port of the reference template's `chart()`. */
import { axisLabel, levels, type Pack } from './chartMath'
import type { ChartStyle } from '@/components/charts/useChartStyle'

export type LayerKey = 'ob' | 'fvg' | 'sr' | 's20' | 's50' | 's200' | 'vol' | 'rsi' | 'macd'
export type Layers = Record<LayerKey, boolean>

export const LAYER_DEFS: { key: LayerKey; label: string; color: string; group: 0 | 1 | 2 }[] = [
  { key: 'ob', label: 'Order blocks', color: 'var(--ob-u)', group: 0 },
  { key: 'fvg', label: 'FVG', color: 'var(--fvg-u)', group: 0 },
  { key: 'sr', label: 'S/R', color: '#7d8796', group: 0 },
  { key: 's20', label: 'SMA 20', color: 'var(--s20)', group: 1 },
  { key: 's50', label: 'SMA 50', color: 'var(--s50)', group: 1 },
  { key: 's200', label: 'SMA 200', color: 'var(--s200)', group: 1 },
  { key: 'vol', label: 'Volume', color: 'var(--good)', group: 2 },
  { key: 'rsi', label: 'RSI', color: 'var(--rsi)', group: 2 },
  { key: 'macd', label: 'MACD', color: 'var(--macd)', group: 2 },
]

export interface ChartInput {
  A: Pack
  N: number
  layers: Layers
  /** 'line' draws the closes as a filled line, 'candle' draws candlesticks. */
  style: ChartStyle
  width: number
  height: number
  hi: number | null
  lo: number | null
  fmt: (p: number) => string
}

export interface ChartGeometry {
  svg: string
  viewBox: string
  /** top of the price pane, its height and the price range it spans (to turn a pointer y into a price and back) */
  top: number
  ph: number
  mn: number
  mx: number
  /** y of the time axis, where the crosshair time label sits */
  axisY: number
  /** index of the first visible bar */
  s: number
  /** pixel width of one bar */
  w: number
  /** plot width, excluding the price axis */
  pw: number
  height: number
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function renderChart(inp: ChartInput): ChartGeometry {
  const { A, N, layers: LY, fmt: F } = inp
  const a = A.a
  const n = A.n
  const s = n - N
  const v = a.slice(s)
  const VW = Math.max(340, inp.width || 960)
  const VH = Math.max(320, inp.height || 680)
  const tg = VW >= 700
  // The extra right-hand room only holds the zone/level tags, so skip it when none can show.
  const G = tg && (LY.ob || LY.fvg || LY.sr) ? 150 : 84
  const W = VW - G
  const w = W / N
  const cw = Math.max(1.5, w * 0.62)
  let mn = Math.min(...v.map((e) => e.l))
  let mx = Math.max(...v.map((e) => e.h))
  const pd = (mx - mn) * 0.06 || mx * 0.01
  mn -= pd
  mx += pd
  const HH = 22
  const PV = 58
  const PR = 66
  const PM = 66
  const fx = (LY.vol ? HH + PV + 12 : 0) + (LY.rsi ? HH + PR + 12 : 0) + (LY.macd ? HH + PM + 12 : 0)
  const PH = Math.max(200, VH - 8 - 16 - fx - 32)
  const Y = (p: number) => 8 + ((mx - p) / (mx - mn)) * PH
  const X = (i: number) => (i - s) * w + w / 2
  const nd = mx - mn < 20
  let o = ''
  let y = 8 + PH + 16
  let vy = 0
  let ry = 0
  let my = 0
  if (LY.vol) {
    vy = y + HH
    y = vy + PV + 12
  }
  if (LY.rsi) {
    ry = y + HH
    y = ry + PR + 12
  }
  if (LY.macd) {
    my = y + HH
    y = my + PM + 12
  }
  const AY = y - 6
  const H = Math.max(VH, AY + 28)

  for (let i = 0; i <= 5; i++) {
    const p = mn + ((mx - mn) * i) / 5
    o += `<line x1="0" x2="${W}" y1="${Y(p)}" y2="${Y(p)}" stroke="var(--line)" opacity=".7"/><text x="${W + 6}" y="${Y(p) + 3}">${nd ? F(p) : F(p).replace(/\.\d+$/, '')}</text>`
  }
  o += `<line x1="0" x2="${W}" y1="${AY}" y2="${AY}" stroke="var(--line)"/>`
  v.forEach((_, i) => {
    const t = axisLabel(A, s + i, N)
    if (t)
      o += `<line x1="${X(s + i)}" x2="${X(s + i)}" y1="${AY}" y2="${AY + 5}" stroke="var(--mute)" opacity=".6"/><text x="${X(s + i) + 4}" y="${AY + 17}">${esc(t)}</text>`
  })

  const lc = a[n - 1].c
  // The window's direction colours the line, its fill and the last-price marker.
  const cc = lc >= v[0].o ? 'var(--good)' : 'var(--bad)'
  const tgs: { y: number; t: string; c: string; sr?: boolean }[] = []
  const near = (z: { top: number; bot: number }) => Math.abs((z.top + z.bot) / 2 - lc)
  const zone = (z: { i: number; top: number; bot: number }, c: string, txt: string, dash: string, cls: string, ttl: string) => {
    const x0 = Math.max(0, X(Math.max(z.i, s)) - w / 2)
    const yt = Y(Math.min(z.top, mx))
    const yb = Y(Math.max(z.bot, mn))
    const zh = Math.max(3, yb - yt)
    o += `<g class="fi ${cls}"><title>${esc(ttl)}</title><rect x="${x0}" y="${yt}" width="${W - x0}" height="${zh}" fill="${c}" opacity=".3" stroke="${c}" stroke-width="1.4" stroke-dasharray="${dash}"/><rect x="${x0}" y="${yt}" width="3.5" height="${zh}" rx="1.5" fill="${c}"/></g>`
    tgs.push({ y: (yt + yb) / 2, t: txt, c })
  }
  if (LY.ob)
    A.ob
      .filter((z) => !z.mit && z.bot < mx && z.top > mn)
      .sort((p, q) => near(p) - near(q))
      .slice(0, 4)
      .forEach((z) =>
        zone(
          z,
          z.t === 'b' ? 'var(--ob-u)' : 'var(--ob-d)',
          `${z.t === 'b' ? 'Bull' : 'Bear'} OB ${z.str}`,
          '4 3',
          'ob',
          `${z.t === 'b' ? 'Bull' : 'Bear'} order block · strength ${z.str} · ${z.te ? `tested ×${z.te}` : 'fresh'} · ${F(z.bot)} – ${F(z.top)}`,
        ),
      )
  if (LY.fvg)
    A.fv
      .filter((z) => z.bot < mx && z.top > mn)
      .sort((p, q) => near(p) - near(q))
      .slice(0, 3)
      .forEach((z) =>
        zone(z, z.t === 'b' ? 'var(--fvg-u)' : 'var(--fvg-d)', `${z.t === 'b' ? 'Bull' : 'Bear'} FVG`, '2 3', 'fvg', `${z.t === 'b' ? 'Bull' : 'Bear'} fair value gap · ${F(z.bot)} – ${F(z.top)}`),
      )
  if (LY.sr)
    levels(A, inp.hi, inp.lo)
      .filter((q) => q.p > mn && q.p < mx)
      .slice(0, 4)
      .forEach((q) => {
        const yy = Y(q.p)
        o += `<line x1="0" x2="${W}" y1="${yy}" y2="${yy}" stroke="${q.p > lc ? 'var(--ob-d)' : 'var(--ob-u)'}" stroke-width="1.3" stroke-dasharray="3 5" stroke-linecap="round" opacity=".85"/>`
        tgs.push({ y: yy, t: `${q.n} ${F(q.p)}`, c: 'var(--mute)', sr: true })
      })

  if (inp.style === 'line') {
    const pts = v.map((e, i) => `${X(s + i).toFixed(1)} ${Y(e.c).toFixed(1)}`)
    const base = 8 + PH
    o += `<defs><linearGradient id="agr" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:${cc};stop-opacity:.35"/><stop offset="1" style="stop-color:${cc};stop-opacity:0"/></linearGradient></defs>`
    o += `<path d="M${X(s).toFixed(1)} ${base}L${pts.join('L')}L${X(n - 1).toFixed(1)} ${base}Z" fill="url(#agr)"/>`
    o += `<path d="M${pts.join('L')}" fill="none" stroke="${cc}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
  } else {
    v.forEach((e, i) => {
      const c = e.c >= e.o ? 'var(--good)' : 'var(--bad)'
      const x = X(s + i)
      o += `<line x1="${x}" x2="${x}" y1="${Y(e.h)}" y2="${Y(e.l)}" stroke="${c}"/><rect x="${x - cw / 2}" y="${Y(Math.max(e.o, e.c))}" width="${cw}" height="${Math.max(1, Math.abs(Y(e.o) - Y(e.c)))}" fill="${c}"/>`
    })
  }

  const ln = (arr: (number | null)[], col: string, wd: number, yf: (q: number) => number) => {
    let q = ''
    for (let i = s; i < n; i++) {
      const val = arr[i]
      if (val != null) q += `${q ? 'L' : 'M'}${X(i).toFixed(1)} ${yf(val).toFixed(1)}`
    }
    return q ? `<path class="dr" pathLength="1" d="${q}" fill="none" stroke="${col}" stroke-width="${wd}"/>` : ''
  }
  // The moving averages share the price scale, so one outside the visible range must be cut off at the
  // edge of the price pane instead of running down into the volume pane.
  o += `<clipPath id="pclip"><rect x="0" y="0" width="${W}" height="${8 + PH}"/></clipPath><g clip-path="url(#pclip)">`
  ;([
    ['s20', 'var(--s20)'],
    ['s50', 'var(--s50)'],
    ['s200', 'var(--s200)'],
  ] as const).forEach(([k, col]) => {
    if (LY[k]) o += ln(A[k], col, k === 's200' ? 2.4 : 1.9, Y)
  })
  o += '</g>'

  if (tg) {
    const used = [Y(lc)]
    tgs.forEach((t) => {
      if (used.some((u) => Math.abs(u - t.y) < 16)) return
      used.push(t.y)
      const wd = t.t.length * 5.7 + 12
      o += t.sr
        ? `<rect x="${W + 76}" y="${t.y - 9}" width="${wd}" height="18" rx="5" fill="var(--bg)" opacity=".94"/><rect x="${W + 76}" y="${t.y - 9}" width="${wd}" height="18" rx="5" fill="${t.c}" opacity=".16" stroke="${t.c}" stroke-opacity=".7"/><text x="${W + 82}" y="${t.y + 3.5}" style="fill:var(--ink);font-size:10px;font-weight:700">${esc(t.t)}</text>`
        : `<rect x="${W + 76}" y="${t.y - 9}" width="${wd}" height="18" rx="9" fill="${t.c}"/><text x="${W + 82}" y="${t.y + 3.5}" style="fill:var(--zt);font-size:10px;font-weight:800;letter-spacing:.02em">${esc(t.t)}</text>`
    })
  }
  o += `<line x1="0" x2="${W}" y1="${Y(lc)}" y2="${Y(lc)}" stroke="${cc}" stroke-width="1.6" stroke-dasharray="1 4" stroke-linecap="round"/><rect x="${W + 2}" y="${Y(lc) - 9}" width="70" height="18" rx="4" fill="${cc}"/><text x="${W + 8}" y="${Y(lc) + 3.5}" style="fill:var(--zt);font-weight:600">${F(lc)}</text>`

  const HT = 'style="fill:var(--ink);font-weight:500"'
  const HV = 'dx="8" style="fill:var(--mute);font-weight:400"'
  if (LY.vol) {
    const vm = Math.max(...v.map((e) => e.v)) || 1
    o += `<text x="2" y="${vy - 8}" ${HT}>Volume<tspan id="hvv" ${HV}></tspan></text><rect x="${W - 112}" y="${vy - 17}" width="8" height="8" rx="2" fill="var(--acc2)"/><text x="${W - 100}" y="${vy - 9}">Spike &gt;1.8× avg</text>`
    v.forEach((e, i) => {
      const h = (e.v / vm) * PV
      const sp = e.v > 1.8 * (A.vma[s + i] || 1e18)
      o += `<rect x="${X(s + i) - cw / 2}" y="${vy + PV - h}" width="${cw}" height="${h}" fill="${sp ? 'var(--acc2)' : e.c >= e.o ? 'var(--good)' : 'var(--bad)'}" opacity="${sp ? 1 : 0.7}"/>`
    })
    o += ln(A.vma, 'var(--ink)', 1.2, (q) => vy + PV - (q / vm) * PV)
  }
  if (LY.rsi) {
    const Z = (r: number) => ry + PR * (1 - r / 100)
    o += `<text x="2" y="${ry - 8}" ${HT}>RSI 14<tspan id="hrv" ${HV}></tspan></text><rect x="0" y="${ry}" width="${W}" height="${PR}" fill="var(--pn2)" rx="6"/><rect x="0" y="${Z(70)}" width="${W}" height="${Z(30) - Z(70)}" fill="var(--acc)" opacity=".06"/><line x1="0" x2="${W}" y1="${Z(70)}" y2="${Z(70)}" stroke="var(--ob-d)" stroke-width="1.2" stroke-dasharray="3 4" opacity=".9"/><line x1="0" x2="${W}" y1="${Z(30)}" y2="${Z(30)}" stroke="var(--ob-u)" stroke-width="1.2" stroke-dasharray="3 4" opacity=".9"/><text x="${W + 6}" y="${Z(70) + 3}">70</text><text x="${W + 6}" y="${Z(30) + 3}">30</text>${ln(A.rsi, 'var(--rsi)', 2, Z)}`
  }
  if (LY.macd) {
    const hm = Math.max(...A.hist.slice(s).map(Math.abs), ...A.macd.slice(s).map(Math.abs)) || 1
    const M = (q: number) => my + PM / 2 - (q / hm) * (PM / 2 - 3)
    o += `<text x="2" y="${my - 8}" ${HT}>MACD 12 26 9<tspan id="hmv" ${HV}></tspan></text><rect x="${W - 150}" y="${my - 14}" width="10" height="3" rx="1.5" fill="var(--macd)"/><text x="${W - 136}" y="${my - 9}">MACD</text><rect x="${W - 80}" y="${my - 14}" width="10" height="3" rx="1.5" fill="var(--sig)"/><text x="${W - 66}" y="${my - 9}">Signal</text><rect x="0" y="${my}" width="${W}" height="${PM}" fill="var(--pn2)" rx="6"/><line x1="0" x2="${W}" y1="${my + PM / 2}" y2="${my + PM / 2}" stroke="var(--line)"/>`
    v.forEach((_, i) => {
      const q = A.hist[s + i]
      const yy = M(q)
      o += `<rect x="${X(s + i) - cw / 2}" y="${Math.min(yy, my + PM / 2)}" width="${cw}" height="${Math.abs(yy - my - PM / 2)}" fill="var(--${q >= 0 ? 'good' : 'bad'})" opacity=".55"/>`
    })
    o += ln(A.macd, 'var(--macd)', 1.8, M) + ln(A.sig, 'var(--sig)', 1.8, M)
  }
  // Crosshair: dashed lines, a dot on the line chart, and labels on both axes. ChartPanel moves them.
  const lab = 'fill:var(--ink)'
  const labText = 'fill:var(--bg);font-size:10px;font-weight:600'
  o += `<g id="xh" style="display:none;pointer-events:none"><line id="xl" y1="8" y2="${AY}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="5 4" opacity=".7"/><line id="yl" x1="0" x2="${W}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="5 4" opacity=".7"/><circle id="xd" r="4.5" fill="${cc}" stroke="var(--bg)" stroke-width="1.5" style="display:none"/><rect id="xb" y="${AY + 3}" height="18" rx="4" style="${lab}"/><text id="xt" y="${AY + 15.5}" text-anchor="middle" style="${labText}"></text><rect id="yb" x="${W + 2}" width="70" height="18" rx="4" style="${lab}"/><text id="yt" x="${W + 8}" style="${labText}"></text></g>`
  return { svg: o, viewBox: `0 0 ${VW} ${H}`, top: 8, ph: PH, mn, mx, axisY: AY, s, w, pw: W, height: H }
}
