# India market data: gap audit and integration plan

Audited 2026-10-28 against the running app (`localhost:5173`) and backend (`localhost:8000`).

## 1. What is already correct

| Area | Evidence |
|---|---|
| Dashboard indices (12 India, 6 US) | `/api/v1/indices` returns NIFTY 50 = 22698.85 (-0.22%). NSE `allIndices` returns the identical value, so the data is live. Cache TTL is 30s; `updated_at` was 4s old. |
| Native chart for NSE stocks | `/api/v1/market/history` returns RELIANCE.NS daily and 5m candles through yfinance. |
| Technical signal card | `/api/v1/market/technicals/RELIANCE` returns RSI, MACD and SMAs from 496 candles. |

## 2. Gaps found

| # | Gap | Where | Cause | Severity |
|---|---|---|---|---|
| G1 | India is grey (no data) on the World market summary map | `GlobalMarketsSection.tsx` | TradingView widget does not colour India. | High |
| G2 | "Company profile and fundamentals ... Indian (NSE) symbols are not supported" | `ChartPage.tsx:136` | TradingView profile and financials widgets are not available for NSE symbols. No backend replacement exists. | High |
| G3 | The NIFTY 50 heatmap shows the 30 BSE Sensex stocks. Sector cards (NIFTY Bank, IT, Pharma ...) show the same Sensex heatmap. | `MarketOverviewSection.tsx:13-34` | TradingView has no NIFTY or sector data source. | High |
| G4 | The ticker tape on the Charts page has no Indian index. It shows SPX, NDX, USDINR, gold, oil and BTC. | `Header.tsx:21` | Symbol list only. | Medium |
| G5 | Only 10 India sector indices are fetched. `screener_layer.py` already maps PSU Bank, Financial Services, Consumer, Defence, Healthcare, Oil & Gas and others, but `_fetch_live_indices` does not fetch them. | `server.py:68-79` | Yahoo has no tickers for most of these. NSE `allIndices` has 139 indices. | Medium |
| G6 | No India VIX, breadth (advances/declines/unchanged), index P/E, P/B, 52-week range, or market open/closed status | none | Not fetched. NSE `allIndices` and `marketStatus` provide all of them. | Medium |
| G7 | No top gainers/losers, FII/DII flows, or option chain for India | none | Not built. NSE endpoints below work. | Medium |
| G8 | Hardcoded `change` percentages on the quick-search popular stocks (`+1.24%`, `+0.62%` ...) | `QuickStockSearchModal.tsx:12-17` | Static strings, always wrong. | High (wrong data) |
| G9 | Hardcoded "NIFTY 50 crossed above 200-day EMA" notification | `NotificationContext.tsx:52` | Seed notification, not computed. | Low |
| G10 | Intraday India candles have `volume: 0` | `/history?interval=5m` | yfinance intraday volume for NSE is unreliable. | Low |
| G11 | `enableMockData` defaults to true in dev | `api/config.ts:26` | Nothing consumes it today, but it hides failures if used. | Low |
| G12 | The login is a hardcoded test user | `AuthContext.tsx:18` | Not a market data gap. Noted only. | n/a |

## 3. Source test results (live calls, 2026-10-28 ~23:45 IST, market closed)

**Caveat:** the `Plan/*.md` files (`NSE`, `NSEBase`, `NSEDerivatives`, `MoneyControl`, `Tickertape`, `sensibull`) were still 0 bytes, so I did not run your code. I called the public HTTP endpoints those names refer to, from Python `requests`. Sensibull was not tested (no endpoint known). When the files have content, re-check that their methods hit these same endpoints.

Reference check: NIFTY 50 close = **22698.85**. All three sources returned it, so they are current.

### NSE (needs a cookie from loading an nseindia.com page first)
| Endpoint | Status | Real-time? | Fills |
|---|---|---|---|
| `/api/allIndices` | 200, 139 indices | Yes, NIFTY 22698.85 | G5, G6: all sector indices, India VIX 16.36, advances/declines, P/E, P/B, 52w range, today sparkline |
| `/api/marketStatus` | 200 | Yes ("Normal Market has Closed", 15:30) | G6 |
| `/api/live-analysis-variations?index=gainers\|loosers` | 200 | Yes | G7 top movers for NIFTY, BANKNIFTY, NIFTYNEXT50, F&O |
| `/api/fiidiiTradeReact` | 200 | Yes (dated 28-Oct-2026) | G7 FII/DII |
| `/api/option-chain-contract-info?symbol=NIFTY` then `/api/option-chain-v3?type=Indices&symbol=NIFTY&expiry=<date>` | 200, 104 strikes | Yes, underlying 22698.85, timestamp 28-Oct-2026 15:40 | Option chain: OI, change in OI, IV, bid/ask per strike. **Only works with `expiry`** and only for the nearest expiry (BANKNIFTY with that expiry returned empty). |
| `/api/liveEquity-derivatives?index=nse50_fut` | 200 | Yes (NIFTY futures 22775.3) | Futures prices |
| `/api/etf`, `/api/index-names` | 200 | Yes | Extras |
| `/api/equity-stockIndices?index=...` | **404** | n/a | Constituents. Dead; use Tickertape instead. |
| `/api/option-chain-indices`, `/api/quote-derivative` | **404** | n/a | Dead paths |
| `/api/quote-equity` | **403** | n/a | Blocked from scripts |
| Home page `curl` without cookie | 403 | n/a | Cookie warm-up is required |

### MoneyControl (`priceapi.moneycontrol.com`, needs `Referer: https://www.moneycontrol.com/`)
| Endpoint | Status | Real-time? | Fills |
|---|---|---|---|
| `/pricefeed/notapplicable/inidicesindia/in%3BNSX` (also `in%3BSEN`, `in%3Bnbx`) | 200 | Yes: 22698.85, `lastupd` 2026-10-28 16:10:02, `market_state`, adv 28 / decl 22 | Index quote, breadth, 52w, 1w to 5y returns. NIFTY, SENSEX, Bank Nifty only. India VIX, NIFTY IT and the other codes I tried returned "No data". |
| `/pricefeed/nse/equitycash/<id>` (e.g. `RI`) | 200 | Yes: RELIANCE 1158.00, `lastupd` 16:00:00 | **G2:** market cap, P/E, industry P/E, P/B, dividend, 52w H/L, circuit limits, delivery %, 5/20 day volume, returns to 10Y. Needs MoneyControl's own short id (`RI`), not the NSE ticker. |
| `/techCharts/indianMarket/index/history?symbol=in%3BNSX&resolution=5` | 200 | Yes, 5-minute bars, last 22698.85 | Intraday index series (volume is 0) |
| `/techCharts/indianMarket/stock/history?symbol=RELIANCE&resolution=1D` | 200 | Yes | Daily OHLC with volume |
| gainers/losers and FII/DII `mcapi/...` JSON | **404** | n/a | Only exist as HTML pages (`/stocks/marketstats/...`), which would need scraping |

### Tickertape (`api.tickertape.in`, `quotes-api.tickertape.in`, needs `Referer` and `Origin`)
| Endpoint | Status | Real-time? | Fills |
|---|---|---|---|
| `quotes-api.tickertape.in/quotes?sids=RELI,TCS,.NSEI,.BSESN` | 200 | Yes: NIFTY 22698.85 and SENSEX 73246.03 match NSE/Yahoo; each quote has a `ts` (RELI 15:58 IST); 50 stocks in 0.12 s | **Batch quotes** for stocks and indices. Fixes G8. Returned `.NSEBANK` but not `.INDIAVIX`, `.CNXIT` etc. |
| `/indices/constituents/.NSEI` | 200, **50 stocks** with `sector`, `lastPrice`, `pr1d`, `freeFloat` | Yes | **G3: real NIFTY 50 heatmap data.** Also works for `.NSEBANK` (14), `.NIFTYIT` (10), `.NIFTYAUTO` (15), `.NIFTYFMCG` (15), `.NIFTY100`, `.NIFTY200`, `.NIFTY500` (500). Does not work for Pharma, Metal, Energy, Realty, Media, Infra codes I tried. |
| `/stocks/info/RELI` | 200 | Yes | **G2:** sector, description, market cap, P/E, P/B, ROE, EPS, beta, dividend yield, 52w range, risk label |
| `/stocks/financials/income/RELI/annual\|interim/normal?count=N` | 200 | Latest reported quarter (JUN 2026) | **G2:** income statement by year or quarter |
| `/stocks/charts/inter/RELI?duration=1d\|1w` | 200 | Intraday points (`ts`, `lp`, `v`), 724 points over 2 days, with volume | Fixes G10 (intraday volume) |
| `/mmi/now` | 200 | Yes (14:20 UTC) | Market Mood Index 41.8, India VIX, FII flow, NIFTY |
| `/search?text=...&types=stock` | 200 | Yes | Name to `sid` lookup, with live quote |
| `/stocks/scorecard`, `/stocks/ratios`, `/stocks/forecasts`, `/stocks/technicals`, `/indices/quotes`, `/sectors` | **404** | n/a | Guessed paths, not usable |
| `/stocks/news/RELI` | 200, empty | n/a | No news returned |

### Gap coverage
| Gap | Best source | Notes |
|---|---|---|
| G3 NIFTY 50 / sector heatmap | Tickertape `/indices/constituents/` + `quotes` | Sector cards for Bank, IT, Auto, FMCG work. Pharma, Metal, Energy, Realty, Media: not found, fall back to filtering the NIFTY 100/200/500 list by its `sector` field. |
| G2 Company profile and fundamentals | Tickertape `/stocks/info` + `/financials`, plus MoneyControl `equitycash` for circuits, delivery and industry P/E | Needs symbol → Tickertape `sid` (via `/search`). |
| G5, G6 sectors, VIX, breadth, P/E | NSE `allIndices` | Only NSE has India VIX and all 139 indices. |
| G7 movers | NSE `live-analysis-variations` | |
| G7 FII/DII | NSE `fiidiiTradeReact` (daily), Tickertape MMI (sentiment) | |
| Option chain (new) | NSE `option-chain-v3` | Nearest expiry only. Sensibull not tested. |
| G8 hardcoded % | Tickertape `quotes` | |
| G10 intraday volume | Tickertape `charts/inter` | Yahoo gives 0. |
| G1 world map India | None of these. | Needs a native card, as planned. |

### Reliability warnings
- None of these are official or documented APIs. All can change or block without notice (NSE already changed `equity-stockIndices` and `option-chain-indices`). Each call needs a TTL cache, a timeout and the existing Yahoo path as fallback.
- I did not read the terms of use of NSE, Tickertape or MoneyControl. These are private web APIs, so check licensing before shipping to paying users.
- NSE needs a cookie warm-up. I did not test its rate limits, or whether it blocks cloud IP ranges, so test from the deployment host.
- All tests ran after the close (market closed), so I confirmed the values and timestamps match the close but not tick-by-tick freshness during trading hours. Re-run during 09:15 to 15:30 IST.

## 3b. Status: what has been built

Verified in the browser on 2026-10-29 during market hours (NSE status "Open", NIFTY 50 +0.71%).

| Gap | Status | How |
|---|---|---|
| G2 company profile and fundamentals | **Done** | `GET /api/v1/market/india/fundamentals/{symbol}` (Tickertape). Shown by `IndiaFundamentals.tsx` on `/chart/<NSE symbol>`: sector, ratios, 4 quarters of results. Checked for RELIANCE. |
| G3 NIFTY heatmap | **Done for 7 indices** | `GET /api/v1/market/india/heatmap?index=` for NIFTY 50, Bank, IT, Auto, FMCG, 100, 200. Native SVG treemap (`IndiaHeatmap.tsx`, `utils/treemap.ts`). Tile size is traded value (the quote feed has no market cap). Other index cards still show the BSE Sensex heatmap with a note. |
| G5, G6 sectors, VIX, breadth, P/E | **Done** | `GET /api/v1/market/india/pulse` (NSE). `IndiaPulseSection.tsx` shows India VIX, advance/decline, NIFTY P/E and P/B, market open/closed, and 16 sector indices. |
| G7 movers, FII/DII | **Done** | Same `pulse` endpoint. NIFTY 50 gainers/losers and FII/DII cash flows. |
| G8 hardcoded percentages | **Done in code, not clickable** | `QuickStockSearchModal.tsx` now loads real changes (`/market/india/quotes` for India, history for US). The modal is never opened anywhere in the app today (`setIsSearchOpen(true)` has no caller), so I checked its loader in the browser, not the modal itself. |
| G1 India on world map | Not started | None of the sources fix a TradingView widget. |
| G4 India index in ticker tape | Not started | |
| G9, G11 seed notification, mock flag | Not started | |
| G10 intraday volume | Not started | Tickertape `charts/inter` has it. |
| Option chain | Not started | NSE `option-chain-v3` works (nearest expiry only). |
| Sector heatmaps for Pharma, Metal, Energy, Realty, Media | Not started | Tickertape has no constituents for these. Plan: filter the NIFTY 200 list by `sector`. |

Behaviour of the new backend (`api/india_data.py`): per-endpoint TTL caches (quotes 15s, indices 30s, movers 60s, FII/DII 15 min, fundamentals 6h), one upstream fetch per key at a time, failures never cached, last good data served flagged `stale`, NSE cookie session re-warmed once on rejection. Unit tests: `apps/backend/tests/test_india_data.py` (20, upstreams mocked). Frontend: 9 new tests for the treemap and colour scale.

Not tested: behaviour from a cloud host (NSE may block it), NSE rate limits, and the unauthenticated state of these endpoints over time. The Yahoo fallback described in Phase 2 was **not** built. If an upstream is down, the new sections show an "unavailable" message.


## 4. Plan

### Phase 1: Remove wrong data (small, no new dependencies)
1. **G8**: Replace the static `change` strings in `QuickStockSearchModal.tsx` with a call to the existing market gateway (or remove the percentage). Add a `/api/v1/market/quotes?symbols=` batch endpoint that reuses `_history` cache (last two daily closes).
2. **G4**: Add `NSE:NIFTY`, `BSE:SENSEX`, `NSE:BANKNIFTY` to the ticker tape in `Header.tsx`. Confirm in the browser that TradingView renders them. If not, build a small native ticker from `/api/v1/indices`.
3. **G9, G11**: Drop the seed notification, and set `enableMockData` to false by default.

### Phase 2: NSE adapter in the backend
New `apps/backend/src/nxtvue/api/nse_client.py`:
- One cookie-warmed `requests.Session`, re-warmed on 401/403, with `User-Agent`, `Referer`, `Accept-Language` headers.
- TTL cache per endpoint (indices 30s, movers 60s, FII/DII 15 min) and a lock so concurrent callers share one fetch, same pattern as `_get_indices_data`.
- Yahoo remains the fallback if NSE fails. Never cache failures.
- Router `/api/v1/india/*`:
  - `/indices`: all 139 indices with breadth, P/E, P/B, 52w range. Replaces the 10-entry Yahoo list (G5, G6).
  - `/status`: market open/closed (G6).
  - `/movers?index=NIFTY&type=gainers|losers` (G7).
  - `/fii-dii` (G7).
- Add pydantic response models and tests in `apps/backend/tests/` with recorded fixtures, so tests do not hit NSE.

### Phase 3: Render in the UI
| Gap | Change |
|---|---|
| G6 | Dashboard hero and `MarketOverview`: add India VIX, advance/decline bar, P/E and market status badge from `/india/indices` and `/india/status`. |
| G5 | Market overview India tab: show every sector index from NSE, sorted by % change. Use `chartTodayPath` for the sparkline. |
| G3 | Replace the TradingView heatmap for India with a native treemap (ECharts treemap is already available) fed by NIFTY constituents. Needs the constituents endpoint, see Open items. Interim fallback: build from top gainers/losers plus Sensex. |
| G7 | New "India movers" and "FII/DII flows" cards on the dashboard. |
| G1 | Replace the world-map tile for India with a native card (NIFTY, SENSEX, VIX) next to the TradingView map, since the widget cannot be fixed. Disclose it in the section copy. |
| G2 | Native "Company" panel for NSE symbols: yfinance `Ticker.info` (market cap, P/E, sector, 52w range, dividend yield) and `financials` / `quarterly_financials` through a new `/api/v1/market/fundamentals/{symbol}` endpoint, cached 6h. |
| G10 | Hide the volume series on India intraday charts, or label it unavailable. |

### Phase 4: Verify
- Backend: pytest for the adapter, cache and fallback paths.
- Frontend: vitest for formatters and mappers, Playwright check that no Indian number on the dashboard is static.
- Browser: compare dashboard values with `nseindia.com` at market hours, and confirm refresh cadence.

## 5. Open items
1. Re-add the contents of the `Plan/*.md` files (all empty).
2. NSE constituent endpoint: `equity-stockIndices` now 404s. Its new path has to be read from nseindia.com's network tab (needs a browser session). This blocks the native NIFTY heatmap.
3. Terms of use: NSE's public API is unofficial. If this ships to paying users, check NSE data licensing or use a licensed vendor.
