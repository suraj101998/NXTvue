import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  fetchClock,
  fetchCongress,
  fetchDisclosures,
  fetchEarnings,
  fetchLiveQuote,
  fetchNews,
  fetchScan,
  fetchSetups,
  fetchTape,
  fetchTimeMachine,
  fetchTrade,
  fetchUsFundamentals,
} from '@/api/desk'
import { fetchIndiaFundamentals } from '@/api/india'
import { usePolled } from '@/hooks/usePolled'
import { chartPath, normalizeMarket, resolveSymbol } from '@/utils/resolveSymbol'
import { TFS, type TF } from './chartMath'
import { LAYER_DEFS, type LayerKey, type Layers } from './chartSvg'
import { EXCHANGE, currencySign, exchangeLabel, localeFor, makeFmt } from './chartFormat'
import { useTheme } from '@/hooks/useTheme'
import { ChartPanel, Kpis, MaMatrix, ObScanner, PriceBlock, SideRail, VolumeProfilePanel, type Snap } from './ChartPanels'
import { CongressPanel, DisclosuresPanel, EarningsPanel, EntryPanel, NewsPanel, PlanPanel, SetupsPanel, TimeMachinePanel } from './DeskPanels'
import { IndiaFundamentalsPanels, UsFundamentalsPanels } from './Fundamentals'
import { useDebounced, usePack } from './useChartData'
import './chart.css'

const DEFAULT_SYMBOL = { india: 'RELIANCE', us: 'NVDA' } as const
const CAPITAL_KEY = 'nxtvue_chart_capital'
const RISK_KEY = 'nxtvue_chart_risk'
const ALL_ON = Object.fromEntries(LAYER_DEFS.map((l) => [l.key, true])) as Layers

const MIN = 60_000

export function ChartPage() {
  const { symbol: routeSymbol } = useParams<{ symbol: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // The URL is the single source of truth: back/forward and deep links always agree with the page.
  const tab = normalizeMarket(searchParams.get('market'))
  const activeSymbol = routeSymbol ?? DEFAULT_SYMBOL[tab]
  const resolved = resolveSymbol(activeSymbol, tab)
  const h = resolved.history
  const isUs = resolved.market === 'us'
  const isIndia = resolved.market === 'india'
  // The day-trade desk runs on both exchanges; "global" instruments (indices, FX, crypto) have no desk.
  const deskMarket = isIndia ? 'india' : 'us'
  const hasDesk = isUs || isIndia
  const sym = h?.symbol ?? resolved.symbol
  const mkt = h?.market ?? 'us'

  const { theme } = useTheme()

  const [tf, setTf] = useState<TF>('6M')
  const [layers, setLayers] = useState<Layers>(ALL_ON)
  const [capital, setCapital] = useState(() => localStorage.getItem(CAPITAL_KEY) ?? '')
  const [risk, setRisk] = useState(() => localStorage.getItem(RISK_KEY) ?? '1')
  useEffect(() => {
    localStorage.setItem(CAPITAL_KEY, capital)
    localStorage.setItem(RISK_KEY, risk)
  }, [capital, risk])
  const budget = useDebounced(parseFloat(capital) > 0 && hasDesk ? parseFloat(capital) : null, 700)

  // ── Live data ────────────────────────────────────────────────────────────
  const quote = usePolled(h ? `quote:${mkt}:${sym}` : null, (s) => fetchLiveQuote(sym, mkt, s), 5_000)
  const tape = usePolled('tape', fetchTape, 15_000)
  const viewKind = TFS[tf][0]
  const daily = usePack(h, 'A')
  const alt = usePack(h, viewKind === 'A' ? null : viewKind)
  const view = viewKind === 'A' ? daily.data : alt.data
  const fundKey = isUs ? `fu:${sym}` : isIndia ? `fi:${sym}` : null
  const usFund = usePolled(isUs ? fundKey : null, (s) => fetchUsFundamentals(sym, s), 10 * MIN)
  const inFund = usePolled(isIndia ? fundKey : null, (s) => fetchIndiaFundamentals(sym, s), 10 * MIN)

  const deskKey = (k: string) => (h && resolved.market !== 'global' ? `${k}:${mkt}:${sym}` : null)
  const dKey = (k: string, extra = '') => (hasDesk ? `${k}:${deskMarket}:${sym}${extra}` : null)
  const clock = usePolled(hasDesk ? `clock:${deskMarket}` : null, (s) => fetchClock(deskMarket, s), 15_000)
  const trade = usePolled(dKey('trade', `:${budget ?? ''}`), (s) => fetchTrade(sym, deskMarket, budget, s), 15_000)
  const tm = usePolled(dKey('tm'), (s) => fetchTimeMachine(sym, deskMarket, s), 2 * MIN)
  const companyName = usFund.data?.name ?? inFund.data?.name ?? null
  // NSE headlines come from a name search, so wait for the company name before the first request.
  const newsReady = !isIndia || inFund.data !== null || inFund.error !== null
  const news = usePolled(newsReady ? deskKey(isIndia ? `news:${companyName ?? ''}` : 'news') : null, (s) => fetchNews(sym, mkt, companyName, s), 2 * MIN)
  const earnings = usePolled(deskKey('earn'), (s) => fetchEarnings(sym, mkt, s), 10 * MIN)
  const setups = usePolled(deskKey('setups'), (s) => fetchSetups(sym, mkt, s), 5 * MIN)
  const scan = usePolled(hasDesk ? `scan:${deskMarket}` : null, (s) => fetchScan(deskMarket, s), 5 * MIN)
  const congress = usePolled(isUs ? 'congress' : null, fetchCongress, 10 * MIN)
  const disclosures = usePolled(isIndia ? `disc:${sym}` : null, (s) => fetchDisclosures(sym, s), 5 * MIN)

  // ── Header snapshot: the live quote, falling back to the last daily bar ───
  const A = daily.data
  const snap: Snap | null = useMemo(() => {
    const q = quote.data
    const last = A?.a[A.n - 1]
    const prev = A && A.n > 1 ? A.a[A.n - 2] : last
    const w52 = A ? A.a.slice(-252) : []
    const hi52 = q?.high52w ?? (w52.length ? Math.max(...w52.map((e) => e.h)) : null)
    const lo52 = q?.low52w ?? (w52.length ? Math.min(...w52.map((e) => e.l)) : null)
    if (q) {
      return {
        o: q.open ?? last?.o ?? q.price,
        h: q.high ?? last?.h ?? q.price,
        l: q.low ?? last?.l ?? q.price,
        c: q.price,
        v: q.volume ?? last?.v ?? 0,
        pc: q.prevClose ?? prev?.c ?? q.price,
        hi: hi52,
        lo: lo52,
        note: `Live quote · ${(quote.updatedAt ?? new Date()).toLocaleTimeString('en-GB')}`,
      }
    }
    if (last && prev && A) {
      return { ...last, pc: prev.c, hi: hi52, lo: lo52, note: `Daily close, ${A.dt[A.n - 1].toISOString().slice(0, 10)}` }
    }
    return null
  }, [quote.data, quote.updatedAt, A])

  const cur = quote.data?.currency ?? (isIndia ? 'INR' : 'USD')
  const fmt = useMemo(() => ({ cu: currencySign(cur), F: makeFmt(localeFor(cur)), loc: localeFor(cur) }), [cur])

  const switchMarket = (next: 'india' | 'us') => {
    if (next !== tab || resolved.market === 'global') navigate(chartPath(DEFAULT_SYMBOL[next], next))
  }
  const openUs = (s: string) => navigate(chartPath(s, 'us'))
  const openDesk = (s: string) => navigate(chartPath(s, deskMarket))

  const fund = usFund.data ?? inFund.data
  const exch = exchangeLabel(quote.data?.exchange)
  const subtitle = [companyName ?? (quote.data ? quote.data.yahoo_symbol : ''), exch].filter(Boolean).join(' · ')
  const tags: { t: string; c: string }[] = []
  if (fund?.sector) tags.push({ t: fund.sector, c: 'a' })
  if (fund?.industry) tags.push({ t: fund.industry, c: '' })
  if (inFund.data?.marketCapLabel) tags.push({ t: inFund.data.marketCapLabel, c: '' })

  const noData = !h
    ? 'No price history is available for this instrument.'
    : daily.error ?? (daily.loading ? 'Loading candles…' : '')
  const chartStatus = view || !noData ? (alt.error && viewKind !== 'A' ? alt.error : 'Loading candles…') : noData

  return (
    <div className="nxc" data-theme={theme}>
      <div className="mainw" id="top">
        <div className="tick" aria-label="Market tape">
          <div className="tk">
            {[0, 1].flatMap((dup) =>
              (tape.data?.items ?? []).map((t) => {
                const up = (t.changePct ?? 0) >= 0
                return (
                  <div className="ti" key={`${dup}-${t.label}`} title={t.name}>
                    <b>{t.label}</b>
                    {t.price == null ? '—' : t.price.toLocaleString('en-US', { minimumFractionDigits: t.dp, maximumFractionDigits: t.dp })}
                    <span className={up ? 'up' : 'dn'}>
                      {t.changePct == null ? '' : `${up ? '+' : '−'}${Math.abs(t.changePct).toFixed(2)}%`}
                    </span>
                  </div>
                )
              }),
            )}
            {!tape.data && (
              <div className="ti">
                <b>MARKETS</b>
                {tape.loading ? 'loading…' : 'tape unavailable'}
              </div>
            )}
          </div>
        </div>

        <section className="pn hd">
          <div className="hr1">
            <div className="hl">
              <div className="sy">{resolved.displayName}</div>
              <div>
                <div className="nm">{subtitle || (quote.loading ? 'Loading…' : '')}</div>
                <div className="tags">
                  {tags.map((t) => (
                    <span key={t.t} className={`tg ${t.c}`}>
                      {t.t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="ctl">
              <div className="seg" role="group" aria-label="Market">
                {(['india', 'us'] as const).map((m) => (
                  <button key={m} type="button" className={resolved.market === m ? 'on' : ''} aria-pressed={resolved.market === m} onClick={() => switchMarket(m)}>
                    {m === 'india' ? 'India (NSE/BSE)' : 'US markets'}
                  </button>
                ))}
              </div>
              <SymbolForm key={activeSymbol} initial={activeSymbol} market={tab} />
            </div>
          </div>
          {snap ? (
            <PriceBlock s={snap} fmt={fmt} />
          ) : (
            <div className="hr2">
              <div className="empty" role="status">
                {quote.error && !quote.data ? (/not found|404|no data/i.test(quote.error) ? 'Symbol not found' : `Quote unavailable: ${quote.error}`) : 'Loading live quote…'}
              </div>
            </div>
          )}
        </section>

        {snap ? (
          <Kpis s={snap} A={A} fmt={fmt} />
        ) : (
          <section className="kp" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="pn k" style={{ height: 112 }} />
            ))}
          </section>
        )}

        <section className="g">
          <ChartPanel
            view={view}
            tf={tf}
            onTf={setTf}
            layers={layers}
            onLayer={(k: LayerKey) => setLayers((l) => ({ ...l, [k]: !l[k] }))}
            hi={snap?.hi ?? null}
            lo={snap?.lo ?? null}
            fmt={fmt}
            status={chartStatus}
          />
          {A ? (
            <SideRail A={A} hi={snap?.hi ?? null} lo={snap?.lo ?? null} fmt={fmt} capital={capital} onCapital={setCapital} risk={risk} onRisk={setRisk} />
          ) : (
            <aside className="rl">
              <div className="pn">
                <div className="lb">Confluence engine</div>
                <div className="empty">{noData || 'Loading…'}</div>
              </div>
            </aside>
          )}
        </section>

        <section className="r3">
          {A ? <ObScanner A={A} fmt={fmt} /> : <div className="pn"><h3>Order block scanner</h3><div className="empty">{noData || 'Loading…'}</div></div>}
          <VolumeProfilePanel view={view} tf={tf} fmt={fmt} />
          {A ? <MaMatrix A={A} fmt={fmt} /> : <div className="pn"><h3>Moving-average matrix</h3><div className="empty">{noData || 'Loading…'}</div></div>}
        </section>

        {isUs && <UsFundamentalsPanels f={usFund} />}
        {isIndia && <IndiaFundamentalsPanels f={inFund} />}

        {resolved.market !== 'global' && (
          <>
            <div className="dh">
              <h3>Trader desk</h3>
              <div className="tags">
                <span className="tg a">Live</span>
                {hasDesk && clock.data && (
                  <span className={`tg ${clock.data.open ? 'u' : 'd'}`}>
                    {EXCHANGE[deskMarket].name} {clock.data.open ? 'open' : 'closed'}
                  </span>
                )}
                <span className="tg">{hasDesk ? `${EXCHANGE[deskMarket].name} day-trade tools` : 'Research tools only'}</span>
              </div>
            </div>
            {hasDesk && (
              <section className="r2">
                <EntryPanel clock={clock} trade={trade} symbol={sym} market={deskMarket} />
                <PlanPanel trade={trade} hasBudget={budget != null} market={deskMarket} cu={fmt.cu} />
              </section>
            )}
            <section className="r2">
              {hasDesk && <TimeMachinePanel tm={tm} />}
              <NewsPanel news={news} symbol={resolved.displayName} />
            </section>
            <section className="r2">
              <EarningsPanel er={earnings} cur={fmt.cu} />
              <SetupsPanel setups={setups} scan={scan} onOpen={openDesk} market={deskMarket} />
            </section>
            {hasDesk && (
              <section className="r2">
                {isUs ? <CongressPanel cg={congress} symbol={sym} onOpen={openUs} /> : <DisclosuresPanel dc={disclosures} symbol={sym} />}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SymbolForm({ initial, market }: { initial: string; market: 'india' | 'us' }) {
  const navigate = useNavigate()
  const [value, setValue] = useState(initial)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = value.trim().toUpperCase()
    if (next) navigate(chartPath(next, market))
  }
  return (
    <form onSubmit={submit} role="search" style={{ display: 'contents' }}>
      <label htmlFor="chart-symbol" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Ticker symbol
      </label>
      <input id="chart-symbol" className="in" name="symbol" autoComplete="off" aria-label="Symbol" value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="submit" className="btn p">
        Load chart
      </button>
    </form>
  )
}
