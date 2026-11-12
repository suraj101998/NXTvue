import React from 'react'
import { BarChart, DataTable, GlassCard, KpiCard, Note } from './reportUi'
import {
  buildChart, buildLadder, cleanLines, parseHolders, parseKeyValueRows, parseReturnKpis, parseScenarios,
  parseTableSection, parseTechnicals, parseValuation, parseVerdict, parseVisibility,
  toParagraphs,
} from './reportParser'
import type { ChartData, Para, SectionKind } from './reportParser'

const ink = { color: 'var(--ink)', fontWeight: 500 } as const

/* ─── Paragraph helpers ─────────────────────────────────────────────────────── */
function Paragraph({ p }: { p: Para }) {
  return (
    <p>
      {p.label && <b style={ink}>{p.label}:</b>}{p.label ? ' ' : ''}{p.text}
    </p>
  )
}

/** Notes (accent-bordered) built from commentary paragraphs. */
function Notes({ paras }: { paras: Para[] }) {
  return (
    <>
      {paras.map((p, i) => (
        <Note key={i}>{p.label && <b>{p.label}: </b>}{p.text}</Note>
      ))}
    </>
  )
}

/** Plain-prose fallback used whenever a section cannot be structured. */
export function ProseCard({ content }: { content: string }) {
  const paras = toParagraphs(cleanLines(content), 'label')
  return (
    <GlassCard reveal className="card sect-prose">
      {paras.map((p, i) => <Paragraph key={i} p={p} />)}
    </GlassCard>
  )
}

function DotList({ items, bad = false }: { items: Para[]; bad?: boolean }) {
  return (
    <ul className={`dots${bad ? ' bad' : ''}`}>
      {items.map((p, i) => (
        <li key={i}>{p.label && <b style={ink}>{p.label}. </b>}{p.text}</li>
      ))}
    </ul>
  )
}

const lead = (paras: Para[]) => {
  const i = paras.findIndex((p) => !p.label)
  return i === 0 ? { intro: paras[0], rest: paras.slice(1) } : { intro: undefined, rest: paras }
}

/* ─── 01 Business ───────────────────────────────────────────────────────────── */
function Business({ content }: { content: string }) {
  const paras = toParagraphs(cleanLines(content), 'label')
  const { intro, rest } = lead(paras)
  const portfolio = rest.find((p) => /portfolio|product/i.test(p.label ?? ''))
  const tags = portfolio
    ? portfolio.text.replace(/^.*?spans\s+/i, '').replace(/\(([^)]*)\)/g, ', $1,').split(/,|\band\b/).map((t) => t.replace(/^\W+|\W+$/g, '').trim()).filter((t) => t.length > 2 && t.length < 48)
    : []
  return (
    <GlassCard reveal className="card">
      {intro && <p>{intro.text}</p>}
      {tags.length >= 3 && <div className="tags">{tags.slice(0, 8).map((t) => <span key={t}>{t}</span>)}</div>}
      {rest.filter((p) => p !== portfolio).map((p, i) => <p key={i} style={{ marginTop: 18 }}>{p.label && <b>{p.label}:</b>}{p.label ? ' ' : ''}{p.text}</p>)}
    </GlassCard>
  )
}

/* ─── 02 / 03 Financial + balance sheet ─────────────────────────────────────── */
function Financials({ content, kind }: { content: string; kind: 'financials' | 'balance' }) {
  const { tables, paras } = parseTableSection(content)
  if (!tables.length) {
    const kv = kind === 'balance' ? parseKeyValueRows(content) : { rows: [], paras: [] as Para[] }
    if (!kv.rows.length) return <ProseCard content={content} />
    const { intro: kvIntro, rest: kvRest } = lead(kv.paras)
    const key = kv.rows.filter((r) => /^(?:net (?:debt|cash)|total debt|current ratio|debt[ -/]?(?:to[ -])?equity|cash)/i.test(r.label)).slice(0, 4)
    return (
      <>
        {kvIntro && <Note style={{ margin: '0 0 22px' }}>{kvIntro.text}</Note>}
        {key.length > 0 && <div className="kpis">{key.map((r, i) => <KpiCard key={r.label} label={r.label} value={r.value} cls={/net cash/i.test(r.label) ? 'g' : /net debt/i.test(r.label) && i === 0 ? 'w' : undefined} />)}</div>}
        <GlassCard reveal className="tbl" style={{ marginTop: 14 }}>
          <table>
            <thead><tr><th>Item</th><th>Value</th><th>Context</th></tr></thead>
            <tbody>{kv.rows.map((r, i) => <tr key={i}><td>{r.label}</td><td className={i < 3 ? 'hl' : undefined}>{r.value}</td><td>{r.context}</td></tr>)}</tbody>
          </table>
        </GlassCard>
        <Notes paras={kvRest} />
      </>
    )
  }
  const { intro, rest } = lead(paras)
  const kpis = kind === 'financials' ? parseReturnKpis(content) : []
  // First matching row, trying each pattern in priority order across every table in the section.
  const pick = (...rxs: RegExp[]) => {
    for (const rx of rxs) for (const tb of tables) { const c = buildChart(tb, (l) => rx.test(l)); if (c) return c }
    return null
  }
  const chartKey = (c: ChartData | null) => c?.title
  const REV = [/total revenue|^revenue|^sales\b|^net sales/i]
  const main = kind === 'financials' ? pick(...REV) : pick(/net debt/i, /^borrowings|^total debt|^debt\b/i, /^total assets/i, /^reserves/i)
  const rest2 = kind === 'financials'
    ? [pick(/operating margin|op\.? margin|^opm\b/i), pick(/free cash flow|^fcf\b/i, /^net (?:profit|income)\b/i, /operating (?:profit|income)/i)]
    : [pick(/debt to equity|debt-to-equity/i, /^operating cash flow|cash from operating/i, /^cash flow from operations/i), pick(/cash (?:&|and) cash eq|^cash\b/i, /free cash flow|^fcf\b/i, /^net cash flow/i)]
  const pair = rest2.filter((c, i, arr) => c && chartKey(c) !== chartKey(main) && arr.findIndex((d) => chartKey(d) === chartKey(c)) === i)
  return (
    <>
      {intro && <Note style={{ margin: '0 0 22px' }}>{intro.text}</Note>}
      {main && <BarChart chart={main} />}
      {pair.length > 0 && (
        <div className="two" style={{ marginTop: 14 }}>
          {pair.map((c, i) => c && <BarChart key={i} chart={c} small />)}
        </div>
      )}
      {tables.map((tb, i) => <DataTable key={i} table={tb} head={kind === 'balance' ? 'Item' : 'Metric'} />)}
      {kpis.length > 0 && (
        <div className="kpis">{kpis.map((k) => <KpiCard key={k.label} label={k.label} value={k.value} cls={k.cls} />)}</div>
      )}
      <Notes paras={rest} />
    </>
  )
}

/* ─── 04 Orders ─────────────────────────────────────────────────────────────── */
function Orders({ content }: { content: string }) {
  const { paras, kpis } = parseVisibility(content)
  const { intro, rest } = lead(paras)
  const first = paras[0]
  const note = intro ?? (first && /reported|source/i.test(first.label ?? '') ? first : undefined)
  const tone = ['g', undefined, 'w', undefined] as const
  const tail = rest.filter((p) => p !== note && !kpis.some((k) => k.label === p.label) && !/available/i.test(p.label ?? ''))
  return (
    <>
      {note && <Note style={{ margin: '0 0 22px' }}>{note.label ? `${note.text}` : note.text}</Note>}
      {kpis.length > 0 && <div className="kpis">{kpis.map((k, i) => <KpiCard key={k.label} label={k.label} value={k.value} cls={tone[i]} />)}</div>}
      <Notes paras={tail} />
    </>
  )
}

/* ─── 05 Holders ────────────────────────────────────────────────────────────── */
const fmtShares = (n: number) => (n ? ` · ${n >= 1e6 ? `${(n / 1e6).toFixed(2)}M sh` : `${n.toLocaleString('en-US')} sh`}` : '')
const fmtChg = (c: number | null, pp = false) => (c === null ? '' : ` · ${c < 0 ? '−' : '+'}${Math.abs(c).toFixed(2)}${pp ? ' pp' : '%'}`)

function Holders({ content }: { content: string }) {
  const { stats, holders, paras, range } = parseHolders(content)
  if (!stats.length && !holders.length) return <ProseCard content={content} />
  const max = Math.max(...holders.map((h) => h.pct), 0.0001)
  const { intro, rest } = lead(paras)
  return (
    <>
      {intro && <Note style={{ margin: '0 0 22px' }}>{intro.text}</Note>}
      {stats.length > 0 && (
        <div className="kpis">
          {stats.map((s, i) => <KpiCard key={s.label} label={s.label} value={s.value} cls={i === 1 ? 'w' : undefined} />)}
        </div>
      )}
      {holders.length > 0 && (
        <GlassCard reveal className="card" style={{ marginTop: 14 }}>
          <h3>{range ? `Shareholding · ${range}` : 'Top institutional holders'}</h3>
          {holders.map((h) => (
            <div className="hold" key={h.name}>
              <div>{h.name}</div>
              <span className={h.change === null ? undefined : h.pp ? (h.change > 0 ? 'pos' : h.change < 0 ? 'neg' : undefined) : h.change >= 10 ? 'pos' : undefined}>{h.pct}%{fmtShares(h.shares)}{fmtChg(h.change, h.pp)}</span>
              <div className="bt"><i style={{ width: `${Math.max((h.pct / max) * 100, 3)}%` }} /></div>
            </div>
          ))}
        </GlassCard>
      )}
      <Notes paras={rest} />
    </>
  )
}

/* ─── 06 Valuation ──────────────────────────────────────────────────────────── */
const pos = (v: number, lo: number, hi: number) => `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))}%`
const money = (c: string, n: number) => `${c}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`

function Valuation({ content }: { content: string }) {
  const v = parseValuation(content)
  if (!v.rows.length) return <ProseCard content={content} />
  const { price, week, targets: t, cur } = v
  const usd = (n: number) => money(cur, n)
  const hasTargets = t.low !== undefined && t.high !== undefined && t.avg !== undefined && price !== undefined
  const lowest = hasTargets && t.low! > price!
  return (
    <>
      {v.intro[0] && <Note style={{ margin: '0 0 22px' }}>{v.intro[0].text}</Note>}
      <GlassCard reveal className="tbl">
        <table>
          <thead><tr><th>Metric</th><th>Value</th><th>Context</th></tr></thead>
          <tbody>
            {v.rows.map((r, i) => (
              <tr key={i}>
                <td>{r.label}</td>
                <td className={i < 2 || /forward|peg/i.test(r.label) ? 'hl' : undefined}>{r.value}</td>
                <td>{r.context}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      {(week || hasTargets) && (
        <div className="two" style={{ marginTop: 14 }}>
          {week && price !== undefined && (
            <GlassCard reveal className="card">
              <h3>52-week range</h3>
              <div className="rg">
                <div className="seg" style={{ left: 0, right: 0 }} />
                <i style={{ left: 0 }}><u>{usd(week.low)}</u></i>
                <i style={{ left: '100%' }}><u>{usd(week.high)}</u></i>
                <i className="now" style={{ left: pos(price, week.low, week.high) }}><b>{usd(price)}</b></i>
              </div>
              <p>Price sits {Math.round(((price - week.low) / (week.high - week.low)) * 100)}% of the way up its range, {Math.abs((price / week.high - 1) * 100).toFixed(1)}% {price < week.high ? 'under' : 'at'} the high.</p>
            </GlassCard>
          )}
          {hasTargets && (() => {
            const lo = Math.min(price!, t.low!)
            const hi = Math.max(t.high!, price!)
            return (
              <GlassCard reveal className="card">
                <h3>Analyst target range</h3>
                <div className="rg">
                  <div className="seg" style={{ left: pos(t.low!, lo, hi), right: `${100 - parseFloat(pos(t.high!, lo, hi))}%` }} />
                  <i className="now" style={{ left: pos(price!, lo, hi) }}><b>{cur}{Math.round(price!)}</b></i>
                  <i style={{ left: pos(t.low!, lo, hi) }}><u>{cur}{Math.round(t.low!)} low</u></i>
                  <i className="avg" style={{ left: pos(t.avg!, lo, hi) }}><b>{cur}{Math.round(t.avg!)} avg</b></i>
                  <i style={{ left: pos(t.high!, lo, hi) }}><u>{cur}{Math.round(t.high!)} high</u></i>
                </div>
                <p>{lowest ? `Even the lowest of ${t.count ?? 'all'} targets sits above the current price.` : `Targets span ${usd(t.low!)} to ${usd(t.high!)}.`}</p>
              </GlassCard>
            )
          })()}
        </div>
      )}

      {v.consensus[0] && (
        <GlassCard reveal className="card" style={{ marginTop: 14 }}>
          <span className="lab" style={{ marginBottom: 10, display: 'block', textTransform: 'uppercase' }}>
            {(v.consensus[0].label ?? 'Analyst consensus')}{t.rating ? ` · ${t.rating}` : ''}
          </span>
          <p>{v.consensus[0].text}</p>
        </GlassCard>
      )}
    </>
  )
}

/* ─── 07 Scenarios ──────────────────────────────────────────────────────────── */
const dash = (s: string) => s.replace(/-/g, '–')

function Targets({ content }: { content: string }) {
  const { intro, scenarios } = parseScenarios(content)
  if (!scenarios.length) return <ProseCard content={content} />
  const name = { bear: 'Bear case', base: 'Base case', bull: 'Bull case' } as const
  return (
    <>
      {intro.length > 0 && <Note style={{ margin: '0 0 22px' }}>{intro.map((p) => `${p.label ? `${p.label}: ` : ''}${p.text}`).join(' ')}</Note>}
      <div className="sc3">
        {scenarios.map((s) => (
          <GlassCard reveal key={s.kind} className={`card${s.kind === 'base' ? '' : ` ${s.kind}`}`}>
            <span className="who lab">{name[s.kind]}</span>
            {s.price && (
              <b className="big">
                {s.cur ?? '$'}{s.price[0].toLocaleString('en-US')}
                {s.price[1] !== s.price[0] && <> – {s.cur ?? '$'}{s.price[1].toLocaleString('en-US')}</>}
              </b>
            )}
            {s.ret && <span className="rt" style={s.kind === 'base' ? { color: 'var(--acc)' } : undefined}>{s.ret.replace(/-/g, '−')}</span>}
            <p>
              {s.eps && <>EPS {dash(s.eps)}{s.mult ? ` at ${dash(s.mult)}` : ''}. </>}
              {s.desc}
            </p>
          </GlassCard>
        ))}
      </div>
    </>
  )
}

/* ─── 08 Growth / 09 Risks / 10-11 triggers ─────────────────────────────────── */
function Growth({ content }: { content: string }) {
  const paras = toParagraphs(cleanLines(content), 'label')
  if (!paras.some((p) => p.label)) return <ProseCard content={content} />
  return (
    <div className="two">
      {paras.map((p, i) => (
        <GlassCard reveal key={i} className="card"><h3>{p.label ?? 'Insight'}</h3><p>{p.text}</p></GlassCard>
      ))}
    </div>
  )
}

export function Bullets({ content, bad, labelled = false, bare = false }: { content: string; bad: boolean; labelled?: boolean; bare?: boolean }) {
  const items = toParagraphs(cleanLines(content), labelled ? 'label' : 'sentence')
  if (!items.length) return null
  const list = <DotList items={items} bad={bad} />
  return bare ? list : <GlassCard reveal className="card">{list}</GlassCard>
}

/* ─── 12 Technicals ─────────────────────────────────────────────────────────── */
function Technicals({ content, price, targetZone }: { content: string; price?: number; targetZone?: string }) {
  const t = parseTechnicals(content)
  const ladder = buildLadder(t.levels, price, targetZone)
  if (!t.kpis.length && !ladder.length && !t.rsi) return <ProseCard content={content} />
  const tagFor = { res: 'Resistance', sup: 'Support', now: 'Now', target: 'Target' } as const
  const near = t.rest.find((p) => /near-term/i.test(p.label ?? ''))
  const view = t.rest.find((p) => /likely direction/i.test(p.label ?? ''))
  const body = t.rest.filter((p) => p !== near && !/^(detected patterns|technical indicator summary)$/i.test(p.label ?? ''))
  const note = [t.trend && `${t.trend.label}: ${t.trend.text}`, view && `${view.label}: ${view.text}`].filter(Boolean).join(' ')
  return (
    <>
      {note && <Note style={{ margin: '0 0 22px' }}>{note}</Note>}
      {ladder.length > 0 && (
        <GlassCard reveal className="ladder">
          {ladder.map((l, i) => (
            <div key={i} className={`lv${l.kind === 'res' ? ' res' : l.kind === 'sup' ? ' sup' : l.kind === 'now' ? ' now' : ''}`}>
              <span className="p">{l.text}</span>
              <span className="d">{l.desc}</span>
              <span className="t" style={l.kind === 'target' ? { color: 'var(--acc)' } : undefined}>{tagFor[l.kind]}</span>
            </div>
          ))}
        </GlassCard>
      )}
      {t.rsi && (
        <GlassCard reveal className="rsi">
          <span className="lab">RSI · {t.rsi.value}{t.rsi.state ? ` · ${t.rsi.state.toLowerCase()}` : ''}</span>
          <div className="track"><div className="dot" style={{ left: `calc(${Math.min(100, Math.max(0, t.rsi.value))}% - 10px)` }} /></div>
          <div className="sc"><span>0</span><span>30</span><span>70</span><span>100</span></div>
        </GlassCard>
      )}
      {t.kpis.length > 0 && (
        <div className="kpis" style={{ marginTop: 14 }}>
          {t.kpis.map((k, i) => <KpiCard key={i} label={k.sub} value={k.value} cls={k.cls} />)}
        </div>
      )}
      <Notes paras={body.filter((p) => !/^(overall trend|likely direction|key support|key resistance)/i.test(p.label ?? '') && !/^(macd|rsi|on-balance|bollinger|moving average)/i.test(p.label ?? ''))} />
    </>
  )
}

/* ─── 13 Verdict ────────────────────────────────────────────────────────────── */
function Verdict({ content }: { content: string }) {
  const v = parseVerdict(content)
  if (!v.stances.length && !v.best) return <ProseCard content={content} />
  return (
    <>
      {v.intro && <Note style={{ margin: '0 0 24px' }}>{v.intro}</Note>}
      {v.stances.length > 0 && (
        <div className="stance">
          {v.stances.map((s) => (
            <GlassCard reveal key={s.who} className="card">
              <span className="who">{s.who}</span>
              <h4>{s.headline}</h4>
              {s.action && <span className="act">{s.action}</span>}
              {s.body && <p>{s.body}</p>}
            </GlassCard>
          ))}
        </div>
      )}
      {v.best && (
        <GlassCard reveal className="best">
          <span className="lab">Best overall judgement</span>
          <h3>{v.best.title}</h3>
          {v.best.sub && <p>{v.best.sub}</p>}
        </GlassCard>
      )}
    </>
  )
}

/* ─── Dispatcher ────────────────────────────────────────────────────────────── */
export function SectionBody({ kind, content, price, targetZone }: { kind: SectionKind; content: string; price?: number; targetZone?: string }): React.ReactElement {
  switch (kind) {
    case 'business': return <Business content={content} />
    case 'financials':
    case 'balance': return <Financials content={content} kind={kind} />
    case 'orders': return <Orders content={content} />
    case 'holders': return <Holders content={content} />
    case 'valuation': return <Valuation content={content} />
    case 'targets': return <Targets content={content} />
    case 'growth': return <Growth content={content} />
    case 'risks': return <Bullets content={content} bad labelled />
    case 'bullish': return <Bullets content={content} bad={false} />
    case 'bearish': return <Bullets content={content} bad />
    case 'levels': return <Technicals content={content} price={price} targetZone={targetZone} />
    case 'verdict': return <Verdict content={content} />
    default: return <ProseCard content={content} />
  }
}
