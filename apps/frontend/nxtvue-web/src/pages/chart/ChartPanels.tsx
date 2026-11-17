import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { clamp, TIMEFRAMES, tradePlan, viewLength, volumeProfile, type Pack, type TF } from './chartMath'
import { LAYER_DEFS, renderChart, type LayerKey, type Layers } from './chartSvg'
import { fmtVol, periodLabel, periodReturn, signed, stampLabel } from './chartFormat'
import { CandleIcon, LineIcon } from '@/components/charts/ChartStyleIcons'
import type { ChartStyle } from '@/components/charts/useChartStyle'

type Css = CSSProperties & Record<`--${string}`, string | number>
const st = (v: Css): CSSProperties => v

export interface Snap {
  o: number
  h: number
  l: number
  c: number
  v: number
  pc: number
  hi: number | null
  lo: number | null
  note: string
}

interface Fmt {
  cu: string
  F: (p: number) => string
  loc: string
}

// ─── Header ──────────────────────────────────────────────────────────────────

export function PriceBlock({ s, fmt }: { s: Snap; fmt: Fmt }) {
  const { F, cu } = fmt
  const df = s.c - s.pc
  const up = df >= 0
  const ch = s.pc ? (s.c / s.pc - 1) * 100 : 0
  const gp = s.pc ? (s.o / s.pc - 1) * 100 : 0
  const gc = up ? 'var(--good)' : 'var(--bad)'
  const pt = (x: number) => clamp(((x - s.l) / (s.h - s.l || 1)) * 100, 0, 100)
  return (
    <div className="hr2">
      <div className="pr">
        <span className="cu">{cu}</span>
        <span>{F(s.c)}</span>
        <span className={`chg ${up ? 'u' : 'd'}`}>
          {up ? '▲ +' : '▼ −'}
          {F(Math.abs(df))}
          <b>
            {up ? '+' : '−'}
            {Math.abs(ch).toFixed(2)}%
          </b>
        </span>
      </div>
      <div className="qt">
        <div>
          <span>Previous close</span>
          <b>{F(s.pc)}</b>
        </div>
        <div>
          <span>Open</span>
          <b>{F(s.o)}</b>
          <em className={gp >= 0 ? 'up' : 'dn'}>
            {gp >= 0 ? '▲' : '▼'} {Math.abs(gp).toFixed(2)}% gap
          </em>
        </div>
        <div>
          <span>Day range</span>
          <b>
            {F(s.l)}
            <i>–</i>
            {F(s.h)}
          </b>
          <div className="tr" style={st({ '--c': gc })}>
            <u style={{ left: `${Math.min(pt(s.o), pt(s.c))}%`, width: `${Math.max(1.5, Math.abs(pt(s.c) - pt(s.o)))}%` }} />
            <i className="pdot o" style={{ left: `${pt(s.o)}%` }} />
            <i className="pdot" style={{ left: `${pt(s.c)}%` }} />
          </div>
          <small>
            <span style={{ margin: 0, display: 'inline' }}>
              <i className="dot2 o" style={st({ '--c': gc })} />
              Open
            </span>
            <span style={{ margin: 0, display: 'inline' }}>
              <i className="dot2" style={st({ '--c': gc })} />
              Close
            </span>
          </small>
        </div>
      </div>
    </div>
  )
}

export function Kpis({ s, A, fmt }: { s: Snap; A: Pack | null; fmt: Fmt }) {
  const { F, cu } = fmt
  const ch = s.pc ? (s.c / s.pc - 1) * 100 : 0
  const pos = (x: number, l: number, h: number) => clamp(((x - l) / (h - l || 1)) * 100, 0, 100).toFixed(0)
  const n = A?.n ?? 0
  const ak = A?.atr[n - 1] ?? null
  const vma = A?.vma[n - 1] ?? null
  const rv = vma ? s.v / vma : null
  const hi = s.hi ?? s.h
  const lo = s.lo ?? s.l
  const K = [
    { l: 'Last close', v: `${cu}${F(s.c)}`, e: `${ch >= 0 ? '▲ +' : '▼ '}${ch.toFixed(2)}%`, ec: ch >= 0 ? 'up' : 'dn', p: pos(s.c, s.pc * 0.97, s.pc * 1.03), sm: s.note },
    { l: 'Session range', v: `${cu}${F(s.l)} – ${F(s.h)}`, e: '', ec: '', p: pos(s.c, s.l, s.h), sm: `Price sits at ${pos(s.c, s.l, s.h)}% of the day’s range` },
    {
      l: '52-week range',
      v: `${cu}${F(lo)} – ${F(hi)}`,
      e: '',
      ec: '',
      p: pos(s.c, lo, hi),
      sm: `${((s.c / hi - 1) * 100).toFixed(1)}% from 52W high${ak ? ` · ATR ${((ak / s.c) * 100).toFixed(2)}%` : ''}`,
    },
    {
      l: 'Session volume',
      v: fmtVol(s.v),
      e: rv ? `${rv.toFixed(2)}× avg` : '',
      ec: rv && rv > 1.2 ? 'up' : '',
      p: rv ? clamp(rv * 50, 0, 100).toFixed(0) : '0',
      sm: vma ? `vs 20-day average ${fmtVol(vma)}` : 'Shares traded today',
    },
  ]
  return (
    <section className="kp">
      {K.map((k, i) => (
        <div key={k.l} className="pn k pop" style={{ animationDelay: `${i * 0.06}s` }}>
          <div className="lb">{k.l}</div>
          <div className="v">
            {k.v}
            {k.e && <em className={k.ec}>{k.e}</em>}
          </div>
          <div className="rb">
            <i style={{ left: `calc(${k.p}% - 1px)` }} />
          </div>
          <small>{k.sm}</small>
        </div>
      ))}
    </section>
  )
}

// ─── Chart ───────────────────────────────────────────────────────────────────

/** The live figures shown above the chart: price, today's move. Falls back to the last bar when absent. */
export interface Headline {
  price: number
  change: number
  changePct: number
}

interface ChartProps {
  view: Pack | null
  tf: TF
  onTf: (t: TF) => void
  layers: Layers
  /** Omit to hide the indicator toggles (the dashboard pop-up shows price only). */
  onLayer?: (k: LayerKey) => void
  chartStyle: ChartStyle
  onChartStyle: (s: ChartStyle) => void
  headline?: Headline | null
  /** Heading of the panel; null hides it. */
  title?: ReactNode
  hi: number | null
  lo: number | null
  fmt: Fmt
  status: ReactNode
}

export function ChartPanel({ view, tf, onTf, layers, onLayer, chartStyle, onChartStyle, headline, title = 'Price chart', hi, lo, fmt, status }: ChartProps) {
  const wrap = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hover, setHover] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    let t: ReturnType<typeof setTimeout> | undefined
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    read()
    const ro = new ResizeObserver(() => {
      clearTimeout(t)
      t = setTimeout(read, 60)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      clearTimeout(t)
    }
  }, [])

  const N = view ? viewLength(tf, view) : 0
  const geo = useMemo(
    () => (view && N ? renderChart({ A: view, N, layers, style: chartStyle, width: size.w, height: size.h, hi, lo, fmt: fmt.F }) : null),
    [view, N, layers, chartStyle, size.w, size.h, hi, lo, fmt.F],
  )

  const idx = view ? (hover == null ? view.n - 1 : clamp(hover, 0, view.n - 1)) : 0
  const e = view?.a[idx]
  const intraday = view?.k === 'I5' || view?.k === 'I30'
  const stamp = view ? stampLabel(view.dt[idx], intraday) : ''

  // The template writes the per-pane header values and the crosshair straight into the SVG nodes.
  useEffect(() => {
    if (!view || !svg.current || !e) return
    const root = svg.current
    const set = (id: string, x: string) => {
      const el = root.querySelector(`#${id}`)
      if (el) el.textContent = x
    }
    set('hvv', `${fmtVol(e.v)}${view.vma[idx] ? `  ·  avg ${fmtVol(view.vma[idx] as number)}` : ''}`)
    set('hrv', view.rsi[idx] == null ? '—' : (view.rsi[idx] as number).toFixed(1))
    set('hmv', `${view.hist[idx] >= 0 ? '+' : '−'}${Math.abs(view.hist[idx]).toFixed(2)}`)
    const g = root.querySelector<SVGGElement>('#xh')
    if (!g || !geo) return
    if (hover == null) {
      g.style.display = 'none'
      return
    }
    const attrs = (id: string, a: Record<string, number | string>) => {
      const el = root.querySelector(`#${id}`)
      if (el) for (const [k, v] of Object.entries(a)) el.setAttribute(k, String(v))
    }
    const x = (idx - geo.s) * geo.w + geo.w / 2
    const y = geo.top + ((geo.mx - e.c) / (geo.mx - geo.mn || 1)) * geo.ph
    const price = fmt.F(e.c)
    const lw = stamp.length * 6.2 + 18
    const lx = clamp(x - lw / 2, 0, geo.pw - lw)
    g.style.display = ''
    attrs('xl', { x1: x, x2: x })
    attrs('yl', { y1: y, y2: y })
    attrs('xd', { cx: x, cy: y })
    root.querySelector<SVGElement>('#xd')?.style.setProperty('display', chartStyle === 'line' ? '' : 'none')
    attrs('xb', { x: lx, width: lw })
    attrs('xt', { x: lx + lw / 2 })
    set('xt', stamp)
    attrs('yb', { y: y - 9 })
    attrs('yt', { y: y + 3.5 })
    set('yt', price)
  }, [view, idx, hover, geo, e, stamp, chartStyle, fmt])

  const onMove = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (!geo || !view) return
    const r = ev.currentTarget.getBoundingClientRect()
    const vbw = parseFloat(geo.viewBox.split(' ')[2])
    const x = ((ev.clientX - r.left) / r.width) * vbw
    if (x > geo.pw || x < 0) return
    setHover(clamp(geo.s + Math.floor(x / geo.w), geo.s, view.n - 1))
  }

  // Return over the chosen window: from the close before its first bar (its open if there is none).
  const s0 = view && N ? view.n - N : 0
  const lastBar = view?.a[view.n - 1]
  const base = view ? (s0 > 0 ? view.a[s0 - 1].c : view.a[s0].o) : null
  const pr = periodReturn(base, lastBar?.c)
  const today = headline ?? (lastBar && view && view.n > 1 ? { price: lastBar.c, change: lastBar.c - view.a[view.n - 2].c, changePct: (lastBar.c / view.a[view.n - 2].c - 1) * 100 } : null)

  const pv = view && idx ? view.a[idx - 1].c : e?.o
  const chg = e && pv ? (e.c / pv - 1) * 100 : 0
  const q = (x: number | null | undefined) => (x == null ? '—' : fmt.F(x))
  const smaOn = layers.s20 || layers.s50 || layers.s200

  return (
    <div className="pn ch">
      <div className="tl">
        {title ? <h3 style={{ margin: 0 }}>{title}</h3> : null}
        <span className="sp" />
        <div className="rg seg">
          {TIMEFRAMES.map((t) => (
            <button key={t} type="button" className={t === tf ? 'on' : ''} aria-pressed={t === tf} onClick={() => onTf(t)}>
              {t}
            </button>
          ))}
          <span className="dv" aria-hidden="true" />
          <button type="button" className={`cs${chartStyle === 'candle' ? ' on' : ''}`} aria-pressed={chartStyle === 'candle'} title="Candlesticks" onClick={() => onChartStyle('candle')}>
            <CandleIcon />
            <span className="sr-only">Candlesticks</span>
          </button>
          <button type="button" className={`cs${chartStyle === 'line' ? ' on' : ''}`} aria-pressed={chartStyle === 'line'} title="Line" onClick={() => onChartStyle('line')}>
            <LineIcon />
            <span className="sr-only">Line</span>
          </button>
        </div>
      </div>
      <div className="ro">
        {e && view ? (
          <>
            {today && (
              <div className="sm">
                <b className="bp">{fmt.F(today.price)}</b>
                <span className={`tc ${today.change >= 0 ? 'up' : 'dn'}`}>
                  {today.change >= 0 ? '+' : '−'}
                  {fmt.F(Math.abs(today.change))} ({today.changePct >= 0 ? '+' : '−'}
                  {Math.abs(today.changePct).toFixed(2)}%) today
                </span>
                {pr !== null && (
                  <span className={`pc ${pr >= 0 ? 'up' : 'dn'}`}>
                    {signed(pr)}% over {periodLabel(tf)}
                  </span>
                )}
              </div>
            )}
            {chartStyle === 'candle' && (
              <div className="r1">
                <b>{stamp}</b>
                <span>
                  <em>O</em>
                  {q(e.o)}
                </span>
                <span>
                  <em>H</em>
                  {q(e.h)}
                </span>
                <span>
                  <em>L</em>
                  {q(e.l)}
                </span>
                <span>
                  <em>C</em>
                  {q(e.c)}
                </span>
                <span className={chg >= 0 ? 'up' : 'dn'}>
                  {chg >= 0 ? '+' : '−'}
                  {Math.abs(chg).toFixed(2)}%
                </span>
              </div>
            )}
            {smaOn && (
              <div className="r2">
                {(
                  [
                    ['SMA 20', 's20', 'var(--s20)'],
                    ['SMA 50', 's50', 'var(--s50)'],
                    ['SMA 200', 's200', 'var(--s200)'],
                  ] as const
                ).map(([l, k, c]) => (
                  <span key={k}>
                    <i style={st({ '--c': c })} />
                    {l}
                    <b>{q(view[k][idx])}</b>
                  </span>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
      <div className="sw" ref={wrap}>
        {geo ? (
          <svg
            id="sv"
            ref={svg}
            viewBox={geo.viewBox}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            dangerouslySetInnerHTML={{ __html: geo.svg }}
          />
        ) : (
          <div className="empty" style={{ padding: 24 }} role="status">
            {status}
          </div>
        )}
      </div>
      {onLayer && (
        <div className="tfb">
          <div className="tl" style={{ margin: 0, justifyContent: 'center' }}>
            {[0, 1, 2].map((g) => (
              <div key={g} className="grp">
                {LAYER_DEFS.filter((l) => l.group === g).map((l) => (
                  <span
                    key={l.key}
                    className={`ck${layers[l.key] ? ' on' : ''}`}
                    role="checkbox"
                    aria-checked={layers[l.key]}
                    tabIndex={0}
                    style={st({ '--c': l.color })}
                    onClick={() => onLayer(l.key)}
                    onKeyDown={(ev) => {
                      if (ev.key === ' ' || ev.key === 'Enter') {
                        ev.preventDefault()
                        onLayer(l.key)
                      }
                    }}
                  >
                    <i />
                    {l.label}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Side rail ───────────────────────────────────────────────────────────────

const FN = { t: 'Trend', m: 'Momentum', s: 'Short-term', v: 'Volume flow', o: 'OB structure' } as const

export function SideRail({
  A,
  hi,
  lo,
  fmt,
  capital,
  onCapital,
  risk,
  onRisk,
}: {
  A: Pack
  hi: number | null
  lo: number | null
  fmt: Fmt
  capital: string
  onCapital: (v: string) => void
  risk: string
  onRisk: (v: string) => void
}) {
  const { F, cu, loc } = fmt
  const S = useMemo(() => tradePlan(A, hi, lo), [A, hi, lo])
  const SS = S.S
  const col = SS.sc >= 56 ? 'var(--good)' : SS.sc >= 44 ? 'var(--acc2)' : 'var(--bad)'
  const C = 2 * Math.PI * 46
  const rr = (t: number) => `${(Math.abs(t - S.en) / S.rk).toFixed(1)}R`
  const cap = parseFloat(capital)
  const rk = parseFloat(risk)
  const qty = cap > 0 && rk > 0 && S.rk > 0 ? Math.floor((cap * rk) / 100 / S.rk) : null
  return (
    <aside className="rl">
      <div className="pn">
        <div className="lb" style={{ marginBottom: 12 }}>
          Confluence engine
        </div>
        <div className="ring">
          <svg viewBox="0 0 112 112">
            <circle cx="56" cy="56" r="46" fill="none" stroke="var(--line)" strokeWidth="9" />
            <circle
              cx="56"
              cy="56"
              r="46"
              fill="none"
              stroke={col}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${(C * SS.sc) / 100} ${C}`}
              transform="rotate(-90 56 56)"
              style={{ animation: 'nxc-rg 1.4s both' }}
            />
            <text x="56" y="62" textAnchor="middle" style={{ font: '600 26px var(--mono)', fill: 'var(--ink)' }}>
              {SS.sc}
            </text>
          </svg>
          <div>
            <div className="vd" style={{ color: col }}>
              {SS.v}
            </div>
            <p>{S.long ? 'Long bias' : 'Short bias'} · flips at 50</p>
          </div>
        </div>
        <div className="fc">
          {(Object.keys(FN) as (keyof typeof FN)[]).map((k) => {
            const q = SS.f[k]
            return (
              <div key={k}>
                <span>{FN[k]}</span>
                <i style={st({ '--w': `${q}%`, '--cc': q >= 56 ? 'var(--good)' : q >= 44 ? 'var(--acc2)' : 'var(--bad)' })} />
                <b style={{ color: 'var(--ink)' }}>{q}</b>
              </div>
            )
          })}
        </div>
      </div>
      <div className="pn">
        <div className="lb">Trade plan · {S.long ? 'long' : 'short'} setup</div>
        <div className="lad">
          {[...S.tg]
            .map((t, i) => ({ t, i }))
            .reverse()
            .map(({ t, i }) => (
              <div key={`t${i}`} style={st({ '--c': 'var(--good)' })}>
                <span>Target {i + 1}</span>
                <b>
                  {cu}
                  {F(t)}
                </b>
                <em>{rr(t)}</em>
              </div>
            ))}
          <div style={st({ '--c': 'var(--acc)' })}>
            <span>Entry {S.ob ? `(at ${S.long ? 'bull' : 'bear'} OB)` : '(market)'}</span>
            <b>
              {cu}
              {F(S.en)}
            </b>
            <em>—</em>
          </div>
          <div style={st({ '--c': 'var(--bad)' })}>
            <span>Stop</span>
            <b>
              {cu}
              {F(S.sp)}
            </b>
            <em>−1R</em>
          </div>
        </div>
        <div className="cal">
          <label>
            Capital
            <input type="number" min="0" value={capital} placeholder="enter amount" onChange={(e) => onCapital(e.target.value)} />
          </label>
          <label>
            Risk %
            <input type="number" min="0" step=".25" value={risk} onChange={(e) => onRisk(e.target.value)} />
          </label>
        </div>
        <div className="res">
          <div>
            <span className="lb">Qty</span>
            <b>{qty == null ? '—' : qty.toLocaleString(loc)}</b>
          </div>
          <div>
            <span className="lb">Exposure</span>
            <b>{qty == null ? '—' : `${cu}${Math.round(qty * S.en).toLocaleString(loc)}`}</b>
          </div>
          <div>
            <span className="lb">Risk</span>
            <b>{qty == null ? '—' : `${cu}${Math.round(qty * S.rk).toLocaleString(loc)}`}</b>
          </div>
        </div>
        <div className="note">
          R = reward ÷ risk if that target is hit; it is not a probability. Targets use detected levels; if fewer than three exist, the rest are projected at fixed R multiples. Stop = order-block edge, or 1.5× ATR for
          market entries. Rule-based output, not investment advice.
        </div>
      </div>
    </aside>
  )
}

// ─── Row of three ────────────────────────────────────────────────────────────

export function ObScanner({ A, fmt }: { A: Pack; fmt: Fmt }) {
  const { F } = fmt
  const c = A.a[A.n - 1].c
  const ob = A.ob
    .filter((z) => !z.mit)
    .sort((x, y) => Math.abs(c - (x.top + x.bot) / 2) - Math.abs(c - (y.top + y.bot) / 2))
    .slice(0, 6)
  return (
    <div className="pn">
      <h3>Order block scanner</h3>
      <div className="sub">
        Last opposite candle before a ≥1.1× ATR move within 3 bars. Strength = move size ÷ ATR (higher = more forceful). Tested ×n = separate times price re-entered the zone without closing through it. Mitigated zones are
        dropped.
      </div>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Zone</th>
            <th>Dist.</th>
            <th>Strength</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {ob.length ? (
            ob.map((z) => {
              const dd = ((z.top + z.bot) / 2 / c - 1) * 100
              return (
                <tr key={z.i}>
                  <td>
                    <span className={`tg ${z.t === 'b' ? 'u' : 'd'}`}>{z.t === 'b' ? 'Bull' : 'Bear'}</span>
                  </td>
                  <td>
                    {F(z.bot)} – {F(z.top)}
                  </td>
                  <td className={dd >= 0 ? 'up' : 'dn'}>
                    {dd >= 0 ? '+' : ''}
                    {dd.toFixed(1)}%
                  </td>
                  <td>
                    <span className="sb">
                      <i style={{ width: `${z.str}%` }} />
                    </span>{' '}
                    {z.str}
                  </td>
                  <td>{z.te ? `Tested ×${z.te}` : 'Fresh'}</td>
                </tr>
              )
            })
          ) : (
            <tr>
              <td colSpan={5}>No unmitigated blocks in range</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export function VolumeProfilePanel({ view, tf, fmt }: { view: Pack | null; tf: TF; fmt: Fmt }) {
  const vp = useMemo(() => (view ? volumeProfile(view, viewLength(tf, view)) : null), [view, tf])
  if (!vp) {
    return (
      <div className="pn">
        <h3>Volume profile</h3>
        <div className="empty">Loading candles…</div>
      </div>
    )
  }
  const { F } = fmt
  const R0 = (x: number) => (vp.span < 30 ? F(x) : F(x).replace(/\.\d+$/, ''))
  return (
    <div className="pn">
      <h3>Volume profile</h3>
      <div className="sub">
        POC{' '}
        <b className="mono" style={{ color: 'var(--acc2)' }}>
          {F(vp.poc)}
        </b>{' '}
        · value area {R0(vp.vaLow)} – {R0(vp.vaHigh)} · outlined = price
      </div>
      <div className="vp">
        {[...vp.bins]
          .map((b, i) => ({ b, i }))
          .reverse()
          .map(({ b, i }, k) => (
            <div key={i} className={`${b.poc ? 'poc ' : b.va ? 'va ' : ''}${b.cur ? 'cur' : ''}`}>
              <span>{R0(b.mid)}</span>
              <i style={st({ '--w': `${b.w}%`, animationDelay: `${k * 0.03}s` })} />
            </div>
          ))}
      </div>
    </div>
  )
}

export function MaMatrix({ A, fmt }: { A: Pack; fmt: Fmt }) {
  const { F } = fmt
  const n = A.n
  const c = A.a[n - 1].c
  const rows = (
    [
      ['SMA 20', 's20', 'var(--s20)'],
      ['SMA 50', 's50', 'var(--s50)'],
      ['SMA 200', 's200', 'var(--s200)'],
    ] as const
  ).map(([label, k, color]) => {
    const v = A[k][n - 1]
    const p = A[k][n - 6]
    return { label, color, v, dd: v ? (c / v - 1) * 100 : null, sl: v && p ? v / p - 1 : null }
  })
  const s50 = A.s50[n - 1]
  const s200 = A.s200[n - 1]
  let cross = 0
  for (let i = n - 1; i > 200; i--) {
    const a = A.s50[i]
    const b = A.s200[i]
    const a0 = A.s50[i - 1]
    const b0 = A.s200[i - 1]
    if (a != null && b != null && a0 != null && b0 != null && a > b !== a0 > b0) {
      cross = i
      break
    }
  }
  const above = s50 != null && s200 != null && s50 > s200
  const rsi = A.rsi[n - 1]
  return (
    <div className="pn">
      <h3>Moving-average matrix</h3>
      <div className="sub">Distance, slope and cross state</div>
      <table>
        <thead>
          <tr>
            <th>MA</th>
            <th>Value</th>
            <th>Dist.</th>
            <th>Slope</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td style={{ color: r.color }}>● {r.label}</td>
              <td>{r.v == null ? '—' : F(r.v)}</td>
              <td className={r.dd == null ? '' : r.dd >= 0 ? 'up' : 'dn'}>{r.dd == null ? '—' : `${r.dd >= 0 ? '+' : ''}${r.dd.toFixed(1)}%`}</td>
              <td className={r.sl == null ? '' : r.sl >= 0 ? 'up' : 'dn'}>{r.sl == null ? '—' : r.sl >= 0 ? '▲' : '▼'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="tags" style={{ marginTop: 12 }}>
        {s50 != null && s200 != null && <span className={`tg ${above ? 'u' : 'd'}`}>{above ? '50 above 200' : '50 below 200'}</span>}
        {cross > 0 && (
          <span className="tg">
            {above ? 'Golden' : 'Death'} cross {n - 1 - cross} bars ago
          </span>
        )}
        {rsi != null && (
          <span className="tg">
            RSI {rsi.toFixed(1)} · {rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral'}
          </span>
        )}
        <span className="tg">MACD hist {signed(A.hist[n - 1]).replace('+', '')}</span>
      </div>
    </div>
  )
}
