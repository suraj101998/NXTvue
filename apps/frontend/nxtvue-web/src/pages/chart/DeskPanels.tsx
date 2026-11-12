import type { CSSProperties, ReactNode } from 'react'
import type { Polled } from '@/hooks/usePolled'
import type { Congress, Earnings, EntryState, MarketClock, NewsFeed, NseDisclosures, Scan, Setups, TimeMachine, TradeDesk } from '@/api/desk'
import { EXCHANGE, ago, big, dash, type DeskMarket } from './chartFormat'

type Css = CSSProperties & Record<`--${string}`, string | number>
const st = (v: Css): CSSProperties => v

export function Head({ title, sub, children }: { title: string; sub: ReactNode; children?: ReactNode }) {
  return (
    <>
      <h3>{title}</h3>
      <div className="sub">{sub}</div>
      {children}
    </>
  )
}

/** One-line state for a polled resource that has no data yet. */
export function Waiting({ p, what }: { p: Polled<unknown>; what: string }) {
  if (p.loading) return <div className="empty">Loading {what}…</div>
  return <div className="empty">{what} unavailable{p.error ? `: ${p.error}` : ''}</div>
}

/** The exchange a desk panel reads: its name, clock zone and (for the sizing rows) currency sign. */

const tone = (x: number | null | undefined) => (x == null ? '' : x >= 0 ? 'up' : 'dn')
const pct = (x: number | null | undefined, d = 1) => (x == null ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}%`)

// ─── Clock + entry timer (trader-alerts, trader-entry) ───────────────────────

export function EntryPanel({ clock, trade, symbol, market }: { clock: Polled<MarketClock>; trade: Polled<TradeDesk>; symbol: string; market: DeskMarket }) {
  const e: EntryState | undefined = trade.data?.entry
  const c = trade.data?.clock ?? clock.data
  const ex = EXCHANGE[market]
  const col = e?.status === 'triggered' ? 'u' : e?.status === 'expired' ? 'd' : 'a'
  return (
    <div className="pn">
      <Head title="Entry timer" sub={`Opening-range breakout watch on ${symbol}, 5-minute bars (trader-entry)`}>
        <div className="tags" style={{ marginTop: 0, marginBottom: 12 }}>
          {c && <span className={`tg ${c.open ? 'u' : 'd'}`}>{ex.name} {c.open ? 'open' : 'closed'}</span>}
          {c && <span className="tg">{c.now_new_york} {ex.tz}</span>}
          {e && <span className={`tg ${col}`}>{e.status}</span>}
        </div>
      </Head>
      {!c ? <Waiting p={clock} what="market clock" /> : null}
      {c && (
        <div className="note" style={{ marginTop: 0 }}>
          {c.reason}
          {c.early_close ? ` · early close ${c.early_close}` : ''}
          {!c.open && c.next_open ? ` · next open ${c.next_open}` : ''}
        </div>
      )}
      {e ? (
        <>
          <div className="dg">
            <div>
              <span className="lb">Range high</span>
              <b>{dash(e.opening_range?.high)}</b>
            </div>
            <div>
              <span className="lb">Range low</span>
              <b>{dash(e.opening_range?.low)}</b>
            </div>
            <div>
              <span className="lb">Last close</span>
              <b>{dash(e.last?.close)}</b>
            </div>
            <div>
              <span className="lb">Vs level</span>
              <b className={tone(e.last?.vs_level_pct)}>{pct(e.last?.vs_level_pct, 2)}</b>
            </div>
            <div>
              <span className="lb">Window</span>
              <b>
                {e.no_entries_before ?? '—'}–{e.no_entries_after ?? '—'}
              </b>
            </div>
            <div>
              <span className="lb">Trigger</span>
              <b className={e.trigger ? 'up' : ''}>{e.trigger ? `${e.trigger.price} @ ${e.trigger.time}` : 'none yet'}</b>
            </div>
          </div>
          <div className="note">{e.reason}</div>
        </>
      ) : (
        trade.data === null && <Waiting p={trade} what="entry status" />
      )}
    </div>
  )
}

// ─── Exit plan, sizing, risk, alerts (trader-exit/budget/risk/alerts/broker) ─

export function PlanPanel({ trade, hasBudget, market, cu }: { trade: Polled<TradeDesk>; hasBudget: boolean; market: DeskMarket; cu: string }) {
  const t = trade.data
  const p = t?.plan
  const z = t?.sizing
  const r = t?.risk?.results[0]
  return (
    <div className="pn">
      <Head title="Exit plan, size and risk check" sub="Stop and target (trader-exit), whole-share sizing (trader-budget), limits check (trader-risk), alerts (trader-alerts)" />
      {!t ? (
        <Waiting p={trade} what="trade plan" />
      ) : !p ? (
        <div className="empty">{t.plan_error ?? 'No plan yet.'}</div>
      ) : (
        <>
          <div className="lad">
            <div style={st({ '--c': 'var(--good)' })}>
              <span>Target</span>
              <b>{p.target}</b>
              <em>{p.target_label}</em>
            </div>
            <div style={st({ '--c': 'var(--acc)' })}>
              <span>Entry</span>
              <b>{p.entry}</b>
              <em>{p.entry_basis}</em>
            </div>
            <div style={st({ '--c': 'var(--bad)' })}>
              <span>Stop</span>
              <b>{p.stop}</b>
              <em>{p.stop_label}</em>
            </div>
          </div>
          <div className="dg">
            <div>
              <span className="lb">Risk / share</span>
              <b>{p.risk_per_share}</b>
            </div>
            <div>
              <span className="lb">Reward : risk</span>
              <b>{p.reward_risk}R</b>
            </div>
            <div>
              <span className="lb">Flat by</span>
              <b>{p.flat_by} {EXCHANGE[market].tz}</b>
            </div>
          </div>
          {p.warnings.map((w) => (
            <div key={w} className="note">
              {w}
            </div>
          ))}
          {z ? (
            <>
              <div className="dg">
                <div>
                  <span className="lb">Shares</span>
                  <b>{z.qty ?? '—'}</b>
                </div>
                <div>
                  <span className="lb">Cost</span>
                  <b>{z.cost == null ? '—' : `${cu}${z.cost.toLocaleString(market === 'india' ? 'en-IN' : 'en-US')}`}</b>
                </div>
                <div>
                  <span className="lb">Max loss</span>
                  <b>{z.max_loss == null ? '—' : `${cu}${z.max_loss.toLocaleString(market === 'india' ? 'en-IN' : 'en-US')}`}</b>
                </div>
              </div>
              <div className="note">{z.refusal ?? `Bound by ${z.bound_by}. ${z.limits.filter((l) => l.binds).map((l) => l.how).join(' ')}`}</div>
            </>
          ) : (
            <div className="note">{hasBudget ? 'Sizing unavailable.' : 'Enter your capital in the trade-plan calculator to size this trade against your limits.'}</div>
          )}
          {r && (
            <div className="tags" style={{ marginTop: 12 }}>
              <span className={`tg ${r.verdict === 'PASS' ? 'u' : 'd'}`}>Risk {r.verdict}</span>
              {r.reasons.map((x) => (
                <span key={x} className="tg d">
                  {x}
                </span>
              ))}
              {r.warnings.map((x) => (
                <span key={x} className="tg">
                  {x}
                </span>
              ))}
            </div>
          )}
          {t.order && (
            <div className="ticket">
              {t.order.side.toUpperCase()} {t.order.qty} {t.order.symbol} · {t.order.type} · bracket
              <br />
              take-profit {t.order.take_profit_limit_price} · stop-loss {t.order.stop_loss_stop_price}
              <br />
              <span style={{ color: 'var(--mute)' }}>Preview only. Nothing is sent to a broker from this page.</span>
            </div>
          )}
          {t.alerts && t.alerts.rules.length > 0 && (
            <div className="dl">
              {t.alerts.rules.map((a) => (
                <p key={a.id}>
                  <b>{a.type}</b> {a.price ?? ''} · {a.note}
                </p>
              ))}
              {t.alerts.rings.map((a) => (
                <p key={a.id} className="dn">
                  Ringing: {a.message}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Time machine (trader-timemachine) ───────────────────────────────────────

export function TimeMachinePanel({ tm }: { tm: Polled<TimeMachine> }) {
  const d = tm.data
  const bins = d?.mc.hist.bins ?? []
  const mx = Math.max(1, ...bins)
  return (
    <div className="pn">
      <Head title="Time machine" sub={d ? `${d.mc.replays.toLocaleString('en-US')} replays from ${d.mc.pool_sessions} sessions (${d.mc.pool_from} to ${d.mc.pool_to})` : 'Monte Carlo replay of the plan (trader-timemachine)'} />
      {!d ? (
        <Waiting p={tm} what="time machine" />
      ) : (
        <>
          <div className="dg">
            <div>
              <span className="lb">Target first</span>
              <b className="up">{(d.mc.p_target * 100).toFixed(1)}%</b>
            </div>
            <div>
              <span className="lb">Stop first</span>
              <b className="dn">{(d.mc.p_stop * 100).toFixed(1)}%</b>
            </div>
            <div>
              <span className="lb">Neither</span>
              <b>{(d.mc.p_neither * 100).toFixed(1)}%</b>
            </div>
            <div>
              <span className="lb">Green at close</span>
              <b>{(d.mc.p_green * 100).toFixed(0)}%</b>
            </div>
            <div>
              <span className="lb">Median close</span>
              <b>{d.mc.median_close}</b>
            </div>
            <div>
              <span className="lb">Average R</span>
              <b className={tone(d.mc.avg_R)}>{d.mc.avg_R.toFixed(2)}</b>
            </div>
          </div>
          <div className="hb" aria-hidden="true">
            {bins.map((b, i) => (
              <i key={i} style={{ height: `${(b / mx) * 100}%` }} />
            ))}
          </div>
          <div className="note" style={{ marginTop: 4 }}>
            Close distribution {d.mc.hist.lo} to {d.mc.hist.hi} (5th to 95th percentile {d.mc.p5_close} to {d.mc.p95_close}).
          </div>
          {d.history && (
            <div className="note">
              History: the same rule fired on {d.history.triggered} of {d.history.sessions} sessions. Target {d.history.target}, stop {d.history.stop}, closed flat {d.history.close}. Average {d.history.avg_R.toFixed(2)}R.
            </div>
          )}
          <div className="dl">
            <p>
              <b>{d.verdict}</b>
            </p>
            {[...d.verdict_notes, ...d.warnings].map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── News (trader-news) ──────────────────────────────────────────────────────

export function NewsPanel({ news, symbol }: { news: Polled<NewsFeed>; symbol: string }) {
  const d = news.data
  const now = news.updatedAt?.getTime() ?? 0
  if (d && !d.items.length) return null
  if (!d && !news.loading) return null
  return (
    <div className="pn">
      <Head title="News monitor" sub={`Headlines${d?.sec_enabled ? ', SEC 8-K filings' : ''} and price move for ${symbol} (trader-news)`}>
        {d?.moves.map((m) => (
          <div key={m.ticker} className="tags" style={{ marginTop: 0, marginBottom: 6 }}>
            <span className={`tg ${m.pct >= 0 ? 'u' : 'd'}`}>
              {m.ticker} {pct(m.pct, 2)} vs prev close {m.prev_close}
            </span>
          </div>
        ))}
      </Head>
      {!d ? (
        <Waiting p={news} what="news" />
      ) : d.items.length ? (
        <div className="nws scr">
          {d.items.slice(0, 12).map((n) => (
            <a key={n.id} href={n.link} target="_blank" rel="noreferrer">
              {n.title}
              <small>
                <span>{n.source}</span>
                <span>{now ? ago(n.time, now) : ''}</span>
                {n.tags.map((t) => (
                  <span key={t} className="tg a" style={{ padding: '1px 6px' }}>
                    {t}
                  </span>
                ))}
              </small>
            </a>
          ))}
        </div>
      ) : (
        <div className="empty">No recent headlines.</div>
      )}
      {d?.errors.map((e) => (
        <div key={e} className="note">
          {e}
        </div>
      ))}
    </div>
  )
}

// ─── Earnings analyst (trader-analyst) ───────────────────────────────────────

export function EarningsPanel({ er, cur }: { er: Polled<Earnings>; cur: string }) {
  const d = er.data
  if ((!d && !er.loading) || (d && !d.rows.length)) return null
  return (
    <div className="pn">
      <Head title="Earnings analyst" sub={d ? `What changed in the latest reported quarters · ${d.source}` : 'Reported numbers (trader-analyst)'} />
      {!d ? (
        <Waiting p={er} what="earnings" />
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Quarter</th>
                <th>Revenue</th>
                <th>Net inc.</th>
                <th>EPS</th>
                <th>Net margin</th>
                <th>Rev YoY</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.slice(0, 5).map((r) => (
                <tr key={r.end}>
                  <td>{r.end}</td>
                  <td>
                    {cur}
                    {big(r.revenue)}
                  </td>
                  <td>
                    {cur}
                    {big(r.net_income)}
                  </td>
                  <td>{dash(r.eps_diluted)}</td>
                  <td>{dash(r.net_margin, 1, '%')}</td>
                  <td className={tone(r.revenue_yoy)}>{pct(r.revenue_yoy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="dl">
            {d.changes.map((c) => (
              <p key={c}>{c}</p>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Scanner (trader-scanner) ────────────────────────────────────────────────

export function SetupsPanel({ setups, scan, onOpen, market }: { setups: Polled<Setups>; scan: Polled<Scan>; onOpen: (sym: string) => void; market: DeskMarket }) {
  const s = setups.data
  const sc = scan.data
  return (
    <div className="pn">
      <Head title="Chart scanner" sub="Daily-close setups for this symbol, then the market-wide scan (trader-scanner)">
        <div className="tags" style={{ marginTop: 0, marginBottom: 10 }}>
          {s ? (
            s.setups.length ? (
              s.setups.map((k) => (
                <span key={k} className="tg a">
                  {s.labels[k] ?? k}
                </span>
              ))
            ) : (
              <span className="tg">no setup on {s.close_date}</span>
            )
          ) : (
            <span className="tg">{setups.loading ? 'scanning…' : 'unavailable'}</span>
          )}
        </div>
      </Head>
      {s && (
        <div className="dg" style={{ marginTop: 0 }}>
          <div>
            <span className="lb">RSI 14</span>
            <b>{dash(s.numbers.rsi, 1)}</b>
          </div>
          <div>
            <span className="lb">20-day high</span>
            <b>{dash(s.numbers.high20)}</b>
          </div>
          <div>
            <span className="lb">20-day avg</span>
            <b>{dash(s.numbers.ma20)}</b>
          </div>
        </div>
      )}
      <div className="lb" style={{ margin: '14px 0 6px' }}>
        {sc ? (sc.state === 'ready' ? `Market scan · ${sc.counts?.scanned ?? 0} liquid stocks · ${sc.counts?.hits ?? 0} setups · close ${sc.as_of}` : sc.state === 'running' ? `Market scan running ${sc.progress[0] ?? 0}/${sc.progress[1] ?? '?'}` : 'Market scan failed') : 'Market scan'}
      </div>
      {sc && sc.hits.length ? (
        <div className="scr" style={{ maxHeight: 220 }}>
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Setup</th>
                <th>Price</th>
                <th>RSI</th>
              </tr>
            </thead>
            <tbody>
              {sc.hits.map((h) => (
                <tr key={h.symbol}>
                  <td>
                    <a href={`/chart/${encodeURIComponent(h.symbol)}?market=${market}`} onClick={(e) => { e.preventDefault(); onOpen(h.symbol) }} className="tk0">
                      {h.symbol}
                    </a>
                  </td>
                  <td>{h.setups.map((k) => s?.labels[k] ?? k.replace(/_/g, ' ')).join(', ')}</td>
                  <td>{h.price}</td>
                  <td>{dash(h.rsi, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">{sc?.error ?? (sc?.state === 'running' ? `Scanning the ${market === 'india' ? 'NSE' : 'US'} universe, this takes a minute.` : 'No scan results yet.')}</div>
      )}
    </div>
  )
}

// ─── NSE disclosures: India's counterpart to SEC filings and Congress trades ─

const num = (x: number | null | undefined) => (x == null ? '—' : x.toLocaleString('en-IN'))
const inr = (x: number | null | undefined) => (x == null ? '—' : `₹${x.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`)

/** Drop repeated filings and the boilerplate that only restates the subject, so each row says something. */
const announcements = (list: NseDisclosures['announcements']) => {
  const seen = new Set<string>()
  return list
    .filter((a) => {
      const k = `${a.time}|${a.subject}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .map((a) => ({ ...a, text: a.text && !/^.{0,80}has informed the Exchange about/i.test(a.text) ? a.text : null }))
}
const shortTime = (t: string | null) => (t ?? '').replace(/^(\d\d)-(\w{3})-\d{4} (\d\d:\d\d):\d\d$/, '$1 $2 $3')

export function DisclosuresPanel({ dc, symbol }: { dc: Polled<NseDisclosures>; symbol: string }) {
  const d = dc.data
  if ((!d && !dc.loading) || (d && !d.announcements.length && !d.insider.length && !d.deals.length)) return null
  return (
    <div className="pn">
      <Head
        title="NSE disclosures"
        sub={`Corporate announcements, SEBI insider trades and bulk, block and short deals for ${symbol}, straight from NSE`}
      >
        {d && (
          <div className="tags" style={{ marginTop: 0, marginBottom: 8 }}>
            <span className="tg a">{d.announcements.length} announcements</span>
            <span className="tg">{d.insider.length} insider trades</span>
            <span className={`tg ${d.deals.length ? 'a' : ''}`}>{d.deals.length} deals{d.deals_as_on ? ` · ${d.deals_as_on}` : ''}</span>
          </div>
        )}
      </Head>
      {!d ? (
        <Waiting p={dc} what="NSE disclosures" />
      ) : (
        <>
          <div className="lb" style={{ margin: '6px 0' }}>Latest announcements</div>
          {d.announcements.length ? (
            <div className="an scr" style={{ maxHeight: 300 }}>
              {announcements(d.announcements).map((a) => (
                <div key={`${a.time}-${a.subject}`} className="ar">
                  <span className="ad">{shortTime(a.time)}</span>
                  <div className="ab" title={a.text ?? undefined}>
                    <b>{a.subject ?? 'Announcement'}</b>
                    {a.text && <span>{a.text}</span>}
                  </div>
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer">
                      filing
                    </a>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">No announcements.</div>
          )}
          <div className="lb" style={{ margin: '14px 0 6px' }}>Insider trades (SEBI PIT)</div>
          {d.insider.length ? (
            <div className="scr" style={{ maxHeight: 220 }}>
              <table>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Category</th>
                    <th>Trade</th>
                    <th>Shares</th>
                    <th>Value</th>
                    <th>Filed</th>
                  </tr>
                </thead>
                <tbody>
                  {d.insider.map((t, i) => (
                    <tr key={`${t.date}-${i}`}>
                      <td>
                        {t.url ? (
                          <a href={t.url} target="_blank" rel="noreferrer">
                            {t.person}
                          </a>
                        ) : (
                          t.person
                        )}
                      </td>
                      <td>{t.category}</td>
                      <td className={t.type === 'Buy' ? 'up' : t.type === 'Sell' ? 'dn' : ''}>{t.type}</td>
                      <td>{num(t.shares)}</td>
                      <td>{inr(t.value)}</td>
                      <td>{t.date?.slice(0, 11)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">No insider trades on file.</div>
          )}
          <div className="lb" style={{ margin: '14px 0 6px' }}>Bulk, block and short deals</div>
          {d.deals.length ? (
            <div className="scr" style={{ maxHeight: 160 }}>
              <table>
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Client</th>
                    <th>Side</th>
                    <th>Qty</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {d.deals.map((t, i) => (
                    <tr key={`${t.kind}-${i}`}>
                      <td>{t.kind}</td>
                      <td>{t.client ?? '—'}</td>
                      <td className={t.side === 'BUY' ? 'up' : t.side === 'SELL' ? 'dn' : ''}>{t.side ?? '—'}</td>
                      <td>{num(t.qty)}</td>
                      <td>{inr(t.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">No bulk, block or short deals reported for {symbol} in the latest NSE snapshot.</div>
          )}
          {d.errors.map((e) => (
            <div key={e} className="note">
              {e}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ─── Congress trades (trader-pelosi) ─────────────────────────────────────────

export function CongressPanel({ cg, symbol, onOpen }: { cg: Polled<Congress>; symbol: string; onOpen: (sym: string) => void }) {
  const d = cg.data
  const rows = d ? [...d.pelosi.trades, ...d.trades].filter((t, i, a) => a.findIndex((x) => x.url === t.url && x.text === t.text && x.date === t.date) === i) : []
  const mine = rows.filter((t) => t.ticker === symbol)
  const list = (mine.length ? mine : rows).slice(0, 12)
  return (
    <div className="pn">
      <Head title="Congress trades" sub={d ? `STOCK Act disclosures from the House Clerk · ${d.filings_scanned} filings scanned (trader-pelosi)` : 'House Periodic Transaction Reports (trader-pelosi)'}>
        {d && mine.length > 0 && (
          <div className="tags" style={{ marginTop: 0, marginBottom: 8 }}>
            <span className="tg a">{mine.length} trade{mine.length > 1 ? 's' : ''} in {symbol}</span>
          </div>
        )}
      </Head>
      {!d ? (
        <Waiting p={cg} what="congress trades" />
      ) : list.length ? (
        <div className="scr">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Stock</th>
                <th>Trade</th>
                <th>Amount</th>
                <th>Days</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t, i) => (
                <tr key={`${t.url}-${i}`}>
                  <td>
                    <a href={t.url} target="_blank" rel="noreferrer">
                      {t.member.replace('Hon. ', '')}
                    </a>
                  </td>
                  <td>
                    {t.ticker ? (
                      <a href={`/chart/${t.ticker}?market=us`} onClick={(e) => { e.preventDefault(); onOpen(t.ticker as string) }} className="tk0">
                        {t.ticker}
                      </a>
                    ) : (
                      t.asset.slice(0, 18)
                    )}
                  </td>
                  <td className={t.type_name.startsWith('purchase') ? 'up' : t.type_name.startsWith('sale') ? 'dn' : ''}>{t.type_name}</td>
                  <td>{t.amount}</td>
                  <td className={t.late ? 'dn' : ''}>{t.days_to_disclose < 0 ? '0' : t.days_to_disclose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">No disclosed trades in the window.</div>
      )}
      {d && <div className="note">{d.note}</div>}
    </div>
  )
}
