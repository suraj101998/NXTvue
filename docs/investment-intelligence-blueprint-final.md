# Investment Intelligence Engine — Final Technical Blueprint

> **Version:** Final (merged from blueprint v1 + blueprint v2)
> **Supersedes:** `investment-intelligence-blueprint.md`, `investment-intelligence-blueprint-v2.md`
>
> **Purpose:** The single authoritative implementation guide for StocksAgent v2.
> Every section traces to a named file, class, or function. Nothing is speculative.
> Every new component has an assigned sub-task and an execution-order dependency.
>
> **Iron rule:** Every line of code added must make the final PDF report richer than BSE.pdf.
> Nothing is removed. Nothing is shortened. Additions only.

---

## 0. The Non-Negotiable Quality Contract

The current `reports/BSE.pdf` — 9 pages, 12 sections, bear/base/bull projection, precise
EPS arithmetic, per-investor-type verdict table — defines the **quality floor**.
Every change to this codebase must produce a report that is at least as detailed.

### The five iron rules

1. **`REPORT_SYSTEM_PROMPT` is sacred for stocks.** Its 12 sections, bear/base/bull structure,
   and investor-type table are never removed, shortened, or merged. Stock analysis always
   uses this prompt verbatim.

2. **Bob interprets; Python calculates.** `QuantEngine` pre-computes every metric.
   Bob reads pre-calculated values and writes about them in prose.
   Bob never derives a number from scratch. This eliminates hallucinated figures.

3. **`_compact_data()` is additive only.** No existing key is ever removed from the JSON
   sent to Bob. New keys are appended. Bob's sections gain more data, never less.

4. **New prompts for ETF / MF / Bond are their own constants.** They are never substituted
   for `REPORT_SYSTEM_PROMPT`. Asset routing is explicit, never implicit.

5. **No section may be omitted.** If data is unavailable, Bob writes the section heading
   plus what is unavailable and what the investor must check manually.
   This is already the established pattern in BSE.pdf §4 (Order Book) and §5 (Shareholding).

### How the Quant Engine enriches — not replaces — the existing report

| BSE.pdf section | Before | After |
|---|---|---|
| §6 Valuation | P/E = 51x; Bob estimates fair value in prose | + `valuation_percentile`: "84th percentile over 10Y = historically expensive" → stated fact |
| §9 Key Risks | "High volatility" (qualitative only) | + `max_drawdown`, `var_95`, `volatility_ann` → "3Y max drawdown 43%, annualised vol 38%, VaR₉₅ –4.1%/day" |
| §12 Technical | MACD, RSI, Bollinger (already complete) | Unchanged for stocks |
| New tail block | Not present | Data confidence 🟢/🟡/🔴 appended after §12 — zero existing sections displaced |

---

## 1. The Architecture

### Current pipeline (v1)

```
TICKER
  └─► data layer (screener / yfinance)
        └─► _compact_data()
              └─► Bob  ← calculates AND interprets
                    └─► PDF
```

### Target pipeline (v2)

```
TICKER / SCHEME / INSTRUMENT
  │
  ▼
data layer                    ← fetch raw OHLCV, fundamentals, metadata
  │
  ▼
HistoricalDataProvider        ← canonical pd.Series for prices, NAV, yields,
  │                              benchmarks — normalised calendar, timezone, gaps
  ▼
TimeSeriesNormalizer          ← aligns all series to the same trading calendar
  │                              before any cross-series calculation
  ▼
SchemaValidator               ← enforces canonical data contract; converts
  │                              malformed responses to structured data_gaps
  ▼
QuantEngine                   ← ALL metric calculations live here (pure Python)
  │
  ▼
RiskEngine                    ← thin wrapper: adds contextual labels to quant output
  │
  ▼
PortfolioEngine               ← ETF overlap, hidden concentration, currency,
  │                              duration, diversification score (portfolio mode only)
  ▼
_compact_data()               ← selects pre-calculated values; additive only
  │
  ▼
Bob LLM                       ← interprets ONLY; writes every section
  │
  ▼
PDF
```

---

## 2. Complete File Map

```
src/investment_matrix/
│
├── tools/                              existing data-fetch layer
│   ├── screener_layer.py               existing — Indian stocks (unchanged logic)
│   ├── yfinance_layer.py               existing — US stocks (unchanged logic)
│   ├── etf_layer.py                    NEW — Sub-Task 1
│   ├── mutual_fund_layer.py            NEW — Sub-Task 2
│   └── bond_layer.py                   NEW — Sub-Task 3
│
├── providers/                          NEW directory — Sub-Task 7a
│   ├── __init__.py
│   ├── historical_data_provider.py     NEW — Sub-Task 7a
│   ├── benchmark_resolver.py           NEW — Sub-Task 7a
│   └── timeseries_normalizer.py        NEW — Sub-Task 7a
│
├── engines/                            NEW directory — Sub-Task 7b
│   ├── __init__.py
│   ├── quant_engine.py                 NEW — Sub-Task 7b
│   ├── risk_engine.py                  NEW — Sub-Task 7b
│   └── portfolio_engine.py             NEW — Sub-Task 8
│
├── schemas/                            NEW directory — Sub-Task 7a
│   ├── __init__.py
│   └── asset_schema.py                 NEW — Sub-Task 7a
│
├── report_generator.py                 extended — Sub-Task 4 (additive only)
├── portfolio_analyser.py               extended — Sub-Task 8 (additive only)
├── pdf_writer.py                       UNCHANGED
└── config/
    └── settings.py                     extended — Sub-Task 6
```

---

## 3. Canonical Data Contract

All data layers — existing and new — must return a dict with the following top-level keys.
`_compact_data()` reads exactly these keys. No layer-specific special-casing anywhere.

### 3.1 Existing keys (already produced by screener + yfinance layers)

```
source                str    "screener.in" / "yahoo_finance" / etc.
source_url            str    direct page URL
key_metrics           dict   price, market cap, P/E, EPS, ROCE, 52w range
fundamental_metrics   dict   revenue, profit, margins, ROE, ROCE, FCF
technical_metrics     dict   RSI value, MACD line, signal, moving averages
chart_signals         dict   MACD cross, Bollinger squeeze, patterns, summary
forensic_metrics      dict   pledge %, promoter flags, red-flag count
debt_breakdown        dict   short-term, long-term, net debt
financials_annual     dict   5Y P&L table
financials_quarterly  dict   last 8 quarters P&L
balance_sheet_annual  dict   5Y balance sheet
cashflow_annual       dict   5Y cash flow
shareholding          dict   promoter / FII / DII / retail %
peer_comparison       list   [{ticker, pe, roce, sales_growth, ...}]
major_holders         dict   top shareholders
institutional_holders dict   institutional ownership changes
pe_history            dict   trailing P/E by year (5–10Y)
analyst_consensus     dict   buy/hold/sell counts, mean target
news                  list   recent headlines (cleaned)
macro_sector          dict   sector index, macro indicators
```

### 3.2 New keys — added by new data layers and engines

```
# ETF-specific
etf_profile           dict   index tracked, AUM, expense ratio, fund family,
                              NAV, yield, ytd_return, 3y/5y avg return, beta
holdings_top10        list   [{name, weight_pct, isin}]
asset_allocation      dict   {equity, bond, cash, other} in %
sector_allocation     dict   {sector_name: weight_pct}
tracking_difference   dict   {1m, 3m, 1y, 3y, 5y} cumulative gap ETF vs index %
nav_premium_discount  dict   {market_price, nav, premium_pct, avg_30d_premium_pct,
                               alert: bool}
liquidity_score       dict   {score_0_100, avg_daily_volume, bid_ask_spread_pct,
                               aum_m}

# MF-specific
scheme_info           dict   fund house, category, type, launch date, scheme code,
                              benchmark, fund manager (if available), direct/regular flag
nav_history           list   [{date, nav}] — last 365 days
nav_current           float
nav_returns           dict   {1d, 1w, 1m, 3m, 6m, 1y, 3y, 5y} CAGR — Python only

# Bond-specific
yield_curve           dict   {maturity_label: yield_pct} — all available maturities
current_yields        dict   snapshot at key maturities (2y, 5y, 10y, 30y)
yield_changes         dict   {1w, 1m, 3m} change per maturity point
spread_analysis       dict   {2s10s, 10s30s, slope, inverted: bool,
                               spread_5y_percentile}
real_yield            dict   {nominal_10y, tips_10y, breakeven_inflation}
                              (US: TIPS; India: G-Sec minus RBI CPI)
macro_context         dict   curve shape classification + policy outlook string

# Quant / Risk (all asset types)
quant_metrics         dict   sharpe, sortino, volatility_ann, max_drawdown,
                              var_95, cvar_95, calmar, alpha, beta, r_squared,
                              tracking_error_ann, upside_capture, downside_capture
risk_metrics          dict   current_drawdown_pct, drawdown_start, recovery_days,
                              ulcer_index, pain_index, with human-readable labels
valuation_percentile  dict   {pe_10y: {value, pct, label},
                               pb_10y: {value, pct, label},
                               yield_5y: {value, pct, label},
                               div_yield_5y: {value, pct, label},
                               vol_1y: {value, pct, label}}

# Bond-specific quant
bond_risk_metrics     dict   duration, modified_duration, dv01, convexity,
                              effective_duration (for fund/ETF),
                              portfolio_dv01 (for fund/ETF)

# Provenance
data_quality          dict   per-field metadata: {source, timestamp, quality A/B/C/D,
                              freshness: same_day/daily/weekly/stale}
data_gaps             list   ["{field}: {reason} — check {where}"]
```

### 3.3 Benchmark representation (canonical)

Every benchmark reference uses this structure:

```python
benchmark = {
    "name":        "NIFTY 50 TRI",
    "symbol":      "^NSEI",
    "type":        "index",                 # index / etf / custom
    "market":      "india",
    "return_type": "total_return"           # total_return / price_return
}
```

`BenchmarkResolver` maintains a lookup table mapping ETF tickers and MF categories
to their correct primary benchmark + secondary/category benchmark.
Price-return benchmarks must never be silently substituted for total-return benchmarks.
If a total-return series is unavailable, the limitation is recorded in `data_gaps`.

### 3.4 Instrument identity for bonds

```python
instrument_type = {
    "asset_class": "bond",
    "sub_type":    "government | corporate | etf | mf",
    "issuer":      None,           # for government bonds; issuer name for corporate
    "currency":    "USD"
}
```

This ensures the correct risk and valuation methods are applied per sub-type.

### 3.5 Data integrity rules

**Total return vs price return (hard rule)**
All ETF and MF performance comparisons use total-return series on both sides.
A price-return index must not be used as a benchmark substitute without recording
the limitation in `data_gaps`.

**Look-ahead and survivorship bias**
Historical percentile calculations and any backtesting use data that would have been
available at the historical evaluation date. Category rankings and peer analysis
must not include funds that launched after the evaluation date.

**Freshness policy**

| Data type | Expected freshness | Stale threshold |
|---|---|---|
| Stock / ETF price | same_day | > 1 trading day |
| MF NAV | daily | > 1 calendar day |
| ETF holdings | latest disclosure | > 30 days |
| MF holdings | monthly disclosure | > 45 days |
| Treasury curve | same_day | > 1 trading day |
| Fundamentals | latest filing | N/A — note quarter |

Reports must distinguish Current / Recent / Stale / Unavailable and must not
make current-price recommendations silently using stale inputs.

**Structured fetch result**
Every external provider call returns a structured result, never a silent `{}`:

```python
DataFetchResult(
    success = False,
    data    = None,
    source  = "AMFI",
    error   = "HTTP 429 — rate limited",
    retryable = True
)
```

Failed fetches are converted to `data_gaps` entries, not swallowed.

---

## 4. Provider Layer — Sub-Task 7a

**Files:** `src/investment_matrix/providers/`

These three components are the foundation that Sub-Tasks 1, 2, and 3 all depend on.
They must be built before any data layer is written.

### 4.1 `HistoricalDataProvider`

```python
class HistoricalDataProvider:
    def get_price_history(asset: str, market: str, period: str) -> pd.Series
        # returns daily adjusted close prices
        # source: yfinance for stocks/ETFs; mftool for MF NAV

    def get_benchmark_history(benchmark: dict, period: str) -> pd.Series
        # resolves benchmark via BenchmarkResolver then fetches

    def get_nav_history(scheme_code: int, days: int) -> pd.Series
        # AMFI / mftool — returns date-indexed NAV series

    def get_yield_history(series_id: str, market: str, period: str) -> pd.Series
        # FRED for US (DGS10 etc.); RBI/FBIL for India

    def get_inflation_history(market: str, period: str) -> pd.Series
        # FRED CPIAUCSL for US; RBI CPI for India (best-effort)
```

**Called by:** every data layer in `tools/` before invoking `QuantEngine`.
**Returns:** `pd.Series` with `DatetimeIndex` in UTC, `NaN` for genuine missing values.

### 4.2 `BenchmarkResolver`

```python
class BenchmarkResolver:
    def resolve(ticker: str, asset_type: str, market: str) -> dict
        # returns canonical benchmark dict (§3.3)

    def resolve_category_benchmark(category: str, market: str) -> dict
        # for MF: maps category string to correct benchmark
```

**Built-in mappings (partial list):**

| Asset | Primary benchmark | Return type |
|---|---|---|
| Indian large-cap ETF | NIFTY 50 TRI | total_return |
| Indian mid-cap ETF | NIFTY Midcap 150 TRI | total_return |
| US broad ETF | S&P 500 TR | total_return |
| US bond ETF | Bloomberg US Agg TR | total_return |
| Indian large-cap MF | NIFTY 50 TRI | total_return |
| Indian multi-cap MF | NIFTY 500 TRI | total_return |
| US 10Y Treasury | N/A (yield series, not return) | — |

If a ticker or category does not match any mapping, the benchmark is `None`
and `data_gaps` records: `"benchmark: could not resolve — tracking calculations skipped"`.

### 4.3 `TimeSeriesNormalizer`

```python
class TimeSeriesNormalizer:
    def align(series_a: pd.Series, series_b: pd.Series,
              market: str) -> tuple[pd.Series, pd.Series]
        # inner join on trading dates for the given market calendar
        # fills gaps with forward-fill (max 1 day), then drops remaining NaN
        # records gap count in data_quality

    def to_returns(prices: pd.Series, method: str = "log") -> pd.Series
        # log or simple returns — consistent across all calculations
```

**Used by:** `QuantEngine` receives only normalised, aligned series.
India and US have different holiday calendars — misaligned correlation matrices
are the silent bug this component prevents.

### 4.4 `SchemaValidator` — `schemas/asset_schema.py`

Enforces the canonical data contract at the boundary between data layers and engines.

```python
class BaseAssetData(TypedDict):  # all fields optional — missing becomes data_gap
    source: str
    source_url: str
    key_metrics: dict
    fundamental_metrics: dict
    ...

class ETFData(BaseAssetData): ...
class MutualFundData(BaseAssetData): ...
class BondData(BaseAssetData): ...
class QuantMetrics(TypedDict): ...
class RiskMetrics(TypedDict): ...
class DataQuality(TypedDict): ...
```

**Validation rule:** a missing required field is not an error — it is a `data_gap`.
A field present with the wrong type is an error (logged + field nulled + data_gap recorded).
The pipeline never crashes on bad data; it degrades gracefully with explicit documentation.

---

## 5. Quant + Risk Engine — Sub-Task 7b

**Files:** `src/investment_matrix/engines/quant_engine.py`,
`src/investment_matrix/engines/risk_engine.py`

**Principle:** Every calculation lives here. Data layers fetch. Engines calculate.
Bob interprets. This boundary is never crossed.

### 5.1 `QuantEngine` — all methods `@staticmethod`

| Method | Inputs | Output keys |
|---|---|---|
| `compute_returns(prices)` | `pd.Series` | `{daily_mean, weekly, monthly, quarterly, annual_cagr}` |
| `compute_risk_metrics(returns, rf)` | returns `pd.Series`, rf `float` | `{sharpe, sortino, volatility_ann, max_drawdown, var_95, cvar_95, calmar}` |
| `compute_alpha_beta(fund_ret, bench_ret)` | two aligned `pd.Series` | `{alpha, beta, r_squared}` |
| `compute_tracking_error(fund_ret, idx_ret)` | two aligned `pd.Series` | `{tracking_error_ann}` |
| `compute_tracking_difference(fund_px, idx_px)` | two aligned `pd.Series` | `{1m, 3m, 1y, 3y, 5y}` in % |
| `compute_rolling_returns(prices, windows)` | `pd.Series`, `list[int]` (trading days) | `{1y_cagr, 3y_cagr, 5y_cagr, win_rate_1y}` |
| `compute_drawdown_analysis(prices)` | `pd.Series` | `{current_dd, max_dd, dd_start, recovery_days}` |
| `compute_updown_capture(fund_ret, bench_ret)` | two aligned `pd.Series` | `{upside_capture, downside_capture}` |
| `compute_valuation_percentile(value, history)` | `float`, `pd.Series` | `{percentile, label}` |
| `compute_nav_premium_discount(mkt_px, nav, hist_30d)` | floats + `pd.Series` | `{premium_pct, avg_30d, alert}` |
| `compute_duration(coupon, ytm, maturity_years, freq)` | floats | `{macaulay_duration, modified_duration, dv01, convexity}` |
| `compute_spread_percentile(spread_bps, history)` | `float`, `pd.Series` | `{percentile, label}` |

**Risk-free rates** are read from `settings.risk_free_rate_india` (default 6.5%)
and `settings.risk_free_rate_us` (default 5.0%). Never hard-coded in engine methods.

### 5.2 `RiskEngine`

Thin orchestrator — calls `QuantEngine`, adds human-readable labels, merges output:

```python
class RiskEngine:
    def run(price_series: pd.Series,
            benchmark_series: pd.Series | None,
            rf_rate: float,
            asset_type: str) -> dict:
        # returns quant_metrics + risk_metrics with labels
        # benchmark_series=None → alpha/beta/capture skipped, noted in data_gaps
```

### 5.3 How data layers call the engines — explicit wiring

```python
# Pattern used by ALL data layers (etf_layer, mutual_fund_layer, bond_layer,
# and the enrichment pass in screener_layer + yfinance_layer)

from ..providers.historical_data_provider import HistoricalDataProvider
from ..providers.benchmark_resolver import BenchmarkResolver
from ..providers.timeseries_normalizer import TimeSeriesNormalizer
from ..engines.quant_engine import QuantEngine
from ..engines.risk_engine import RiskEngine

hdp = HistoricalDataProvider()
br  = BenchmarkResolver()
tsn = TimeSeriesNormalizer()

# 1. Fetch histories
price_series = hdp.get_price_history(ticker, market, period="3y")
benchmark    = br.resolve(ticker, asset_type="etf", market=market)
bench_series = hdp.get_benchmark_history(benchmark, period="3y") if benchmark else None

# 2. Normalise / align
if bench_series is not None:
    price_series, bench_series = tsn.align(price_series, bench_series, market)
returns      = tsn.to_returns(price_series)
bench_ret    = tsn.to_returns(bench_series) if bench_series is not None else None

# 3. Run engines
risk_output  = RiskEngine().run(price_series, bench_series,
                                rf_rate=settings.risk_free_rate_india,
                                asset_type="etf")

# 4. Attach to output dict (additive)
dataset["quant_metrics"] = risk_output["quant_metrics"]
dataset["risk_metrics"]  = risk_output["risk_metrics"]
```

This wiring is identical for every data layer. The engines never know which layer called them.

---

## 6. Sub-Tasks (Ordered, Concrete, Wired)

### Sub-Task 6 — Dependencies and Settings `[x] done`

**Must be done first. Zero risk to existing code.**

**Files:** `requirements.txt`, `.env.example`, `src/investment_matrix/config/settings.py`

**New dependencies:**
```
mftool>=2.0
fredapi>=3.1
scipy>=1.12         # OLS regression for alpha/beta
```

**`settings.py` additions:**
```python
fred_api_key          = os.getenv("FRED_API_KEY", "")
risk_free_rate_india  = float(os.getenv("RISK_FREE_RATE_INDIA", "0.065"))
risk_free_rate_us     = float(os.getenv("RISK_FREE_RATE_US", "0.05"))
```

**`.env.example` additions:**
```dotenv
FRED_API_KEY=your-fred-api-key
RISK_FREE_RATE_INDIA=0.065
RISK_FREE_RATE_US=0.05
```

**Done when:** `python -c "import mftool, fredapi, scipy"` succeeds without error.

---

### Sub-Task 7a — Provider Layer `[x] done`

**Depends on:** Sub-Task 6

**Files to create:**
```
src/investment_matrix/providers/__init__.py
src/investment_matrix/providers/historical_data_provider.py
src/investment_matrix/providers/benchmark_resolver.py
src/investment_matrix/providers/timeseries_normalizer.py
src/investment_matrix/schemas/__init__.py
src/investment_matrix/schemas/asset_schema.py
```

**Todo list:**
- [ ] Create `providers/` and `schemas/` directories with `__init__.py`
- [ ] Implement `HistoricalDataProvider` with the 5 methods in §4.1
- [ ] Implement `BenchmarkResolver` with built-in lookup table (§4.2) + `resolve()` + `resolve_category_benchmark()`
- [ ] Implement `TimeSeriesNormalizer` with `align()` + `to_returns()`
- [ ] Implement `SchemaValidator` with `TypedDict` classes in `asset_schema.py`
- [ ] Implement `DataFetchResult` dataclass (used by all provider fetch methods)
- [ ] Smoke test: `HistoricalDataProvider().get_price_history("RELIANCE", "india", "1y")` returns a non-empty `pd.Series`

**Done when:** all 5 classes instantiate without error and the smoke test passes.

---

### Sub-Task 7b — Quant + Risk Engine `[x] done`

**Depends on:** Sub-Task 7a (needs `TimeSeriesNormalizer`)

**Files to create:**
```
src/investment_matrix/engines/__init__.py
src/investment_matrix/engines/quant_engine.py
src/investment_matrix/engines/risk_engine.py
```

**Todo list:**
- [ ] Create `engines/` directory with `__init__.py`
- [ ] Implement all 12 `QuantEngine` static methods (§5.1 table)
- [ ] Implement `RiskEngine.run()` (§5.2) — orchestrates `QuantEngine`, adds labels
- [ ] `compute_duration()` — Macaulay, modified, DV01, convexity (for bond layer)
- [ ] Risk-free rates sourced from `settings`, never hard-coded
- [ ] Smoke test: `QuantEngine.compute_risk_metrics(returns_series, rf=0.065)` returns dict with all keys

**Done when:** all methods return correctly shaped dicts on synthetic `pd.Series` input.

---

### Sub-Task 1 — ETF Data Layer `[x] done`

**Depends on:** Sub-Tasks 7a + 7b

**File:** `src/investment_matrix/tools/etf_layer.py`

**Inherits:** `YFinanceDataLayer` — reuses `compute_chart_signals()`, `compute_technical_metrics()`

**Data sources:** yfinance `.NS`/`.BO` (India), yfinance raw ticker (US)

**Methods to implement:**

| Method | What it does |
|---|---|
| `_extract_etf_profile(info)` | AUM, expense ratio, category, fund family, NAV, yield, beta, ytd_return |
| `_extract_holdings(ticker_obj)` | `yf.Ticker.funds_data` for US; `info` key fallback for India |
| `_extract_asset_allocation(ticker_obj)` | equity/bond/cash/other split |
| `_extract_sector_allocation(ticker_obj)` | sector weights dict |
| `_compute_tracking_difference(ticker, benchmark)` | `HistoricalDataProvider` + `QuantEngine.compute_tracking_difference()` |
| `_compute_nav_premium_discount(ticker)` | `info["navPrice"]` vs `regularMarketPrice`; 30d rolling via `HistoricalDataProvider` |
| `_compute_liquidity_score(ticker)` | avg 30d volume + bid-ask from `info` + AUM → score 0–100 |
| `_build_data_quality(info, methods_used)` | populate `data_quality` dict per field |
| `compile_full_dataset(ticker, market)` | orchestrate; call engine wiring pattern (§5.3); return canonical dict |

**New canonical keys:** `etf_profile`, `holdings_top10`, `asset_allocation`,
`sector_allocation`, `tracking_difference`, `nav_premium_discount`, `liquidity_score`,
`quant_metrics`, `risk_metrics`, `valuation_percentile`, `data_quality`, `data_gaps`

**Graceful degradation:** every method wrapped in `try/except`; failures → `data_gaps` entry.

**Done when:** `compile_full_dataset("SPY", "us")` and `compile_full_dataset("NIFTYBEES", "india")` both return dicts with at least `source`, `key_metrics`, `chart_signals`, `quant_metrics`.

---

### Sub-Task 2 — Mutual Fund Data Layer `[x] done`

**Depends on:** Sub-Tasks 7a + 7b

**File:** `src/investment_matrix/tools/mutual_fund_layer.py`

**Data sources (priority order):**

| Source | What | Method |
|---|---|---|
| `mftool` / MFAPI.in | NAV history, scheme metadata, fund house, category | `pip install mftool` |
| AMFI NAVAll.txt | authoritative daily NAV, scheme code | `requests` GET |
| AMFI TER page | Total Expense Ratio (mandatory SEBI disclosure) | `requests` + `pandas.read_html` |
| SEBI portfolio disclosure | Monthly holdings ISINs + weights | `requests` + HTML parsing |
| AMC factsheet | AUM, manager — fragile fallback | `requests` + `BeautifulSoup` |

**Methods to implement:**

| Method | What it does |
|---|---|
| `_resolve_scheme(scheme_input)` | `int` → code direct; `str` → fuzzy match `mftool.get_scheme_codes()` |
| `_fetch_nav_history(scheme_code, days=365)` | `mftool.get_historical_nav()` → date-indexed `pd.Series` |
| `_compute_nav_returns(series)` | `QuantEngine.compute_rolling_returns()` — 1d/1w/1m/3m/6m/1y/3y/5y CAGR |
| `_fetch_ter(scheme_code)` | AMFI TER page → float; `data_gaps` on failure |
| `_fetch_portfolio(scheme_code)` | SEBI disclosure → top-10 holdings + sector allocation; `data_gaps` on failure |
| `_fetch_scheme_details(scheme_code)` | `mftool.get_scheme_details()` → fund house, category, type, launch date |
| `_build_data_quality(sources_used)` | per-field quality metadata |
| `compile_full_dataset(scheme_input)` | orchestrate; apply engine wiring (§5.3); return canonical dict |

**`data_gaps` entries when sources fail (explicit text):**
```python
"AUM: not available via free API — check fund factsheet at AMC website"
"TER: AMFI fetch failed — see amfiindia.com/research-information/other-data/scheme-wise-ratio"
"Holdings: SEBI disclosure unavailable — check sebi.gov.in portfolio disclosures"
```

**Done when:** `compile_full_dataset("SBI Bluechip Fund")` returns dict with `nav_current`,
`nav_returns`, `quant_metrics`, `scheme_info`.

---

### Sub-Task 3 — Bond Data Layer `[x] done`

**Depends on:** Sub-Tasks 7a + 7b + Sub-Task 1 (ETF path delegates to `etf_layer`)

**File:** `src/investment_matrix/tools/bond_layer.py`

**Instrument routing:**

| Input format | Route |
|---|---|
| `TLT`, `AGG`, `LIQUIDBEES` | ETF path: `etf_layer.compile_full_dataset()` + yield context appended |
| `"india-10y"`, `"india-gsec"`, `"india-tbill"`, `"india-sdl"` | India benchmark path |
| `"us-10y"`, `"us-treasury"`, `"us-tips"`, `"us-tbill"` | US Treasury path |

**Data sources:**

| Source | What | Priority |
|---|---|---|
| US Treasury XML API (`home.treasury.gov/resource-center/data-chart-center/interest-rates/`) | Full par curve (14 maturities) + TIPS real curve | **Primary for US** |
| FRED (`fredapi`) | `DGS*` CMT series, `DFII*` TIPS, `T*YIE` breakeven | Secondary / validation |
| RBI / FBIL (`fbil.org.in`) | India G-Sec benchmark yields | Primary for India |
| NSE bond pages | Listed bond YTM, coupon, maturity | Best-effort India |

**Methods to implement:**

| Method | What it does |
|---|---|
| `_is_etf(instrument)` | benchmark keyword list → `bool` |
| `_fetch_us_treasury_curve()` | Treasury XML → `{maturity: yield}` all 14 points |
| `_fetch_us_real_curve()` | Treasury TIPS XML → real yield curve |
| `_fetch_fred_curve()` | `fredapi` → 8 CMT series (fallback / cross-validation) |
| `_compute_real_yield(nominal, tips)` | breakeven inflation = nominal − TIPS |
| `_fetch_india_yield_curve()` | FBIL → `{maturity: yield}`; RBI GSec page fallback |
| `_compute_spread_analysis(curve)` | 2s10s, 10s30s, slope, inversion flag, 5Y percentile via `QuantEngine.compute_spread_percentile()` |
| `_compute_bond_risk(ytm, coupon, maturity)` | `QuantEngine.compute_duration()` → duration, modified_duration, DV01, convexity |
| `_build_macro_context(curve, real_yield, market)` | curve shape classification + policy outlook string |
| `_build_data_quality(sources_used)` | per-field quality metadata |
| `compile_full_dataset(instrument, market)` | route; apply engine wiring; return canonical dict |

**Graceful degradation:** if FRED key missing → US yield curve skipped + `data_gaps` note.
If FBIL unreachable → India yield curve skipped + `data_gaps` note. Never blocks the run.

**Done when:** `compile_full_dataset("TLT", "us")` returns `yield_curve` + `etf_profile`;
`compile_full_dataset("india-10y", "india")` returns `yield_curve` + `spread_analysis`.

---

### Sub-Task 4 — System Prompts and Analysis Functions `[x] done`

**Depends on:** Sub-Tasks 1 + 2 + 3

**File:** `src/investment_matrix/report_generator.py` (additive only)

#### `ETF_SYSTEM_PROMPT` — required sections

1. Executive verdict (2 sentences: stance + single most important reason)
2. ETF profile — index tracked, AUM, expense ratio, fund family, type (physical/synthetic)
3. Performance vs benchmark — tracking difference 1m/3m/1y/3y/5y; not just tracking error
4. Holdings and concentration — top 10, effective sector tilt, ETF overlap warning if present
5. Cost, liquidity, and NAV premium — bid-ask spread, 30d avg premium/discount, liquidity score
6. Technical trading signals — MACD, Bollinger, RSI (labelled secondary for long-term investors)
7. Valuation context — earnings yield of underlying index, historical P/E percentile
8. When to buy / When to exit — concrete entry triggers, exit conditions
9. Data confidence — 🟢/🟡/🔴 block
10. Final verdict

#### `MF_SYSTEM_PROMPT` — required sections

1. Executive verdict
2. Fund profile — category, AMC, manager (if available), TER, direct/regular, benchmark
3. NAV performance — 1y/3y/5y/10y absolute returns + annualised CAGR (from `nav_returns`)
4. Consistency analysis — rolling 1Y win rate, best/worst year, standard deviation of annual returns
5. Risk metrics — Sharpe, Sortino, max drawdown, VaR (all from `quant_metrics` — pre-calculated)
6. Category rank and peer comparison (if available; state unavailable if not)
7. SIP vs lumpsum — entry reasoning, rupee-cost-averaging benefit at current NAV level
8. Exit strategy — underperformance thresholds, exit load awareness, tax impact (LTCG/STCG)
9. Data gaps — explicit list of unavailable fields and where to find them
10. Final verdict

#### `BOND_SYSTEM_PROMPT` — required sections

1. Executive verdict
2. Current yield environment — nominal yield, real yield, 5Y percentile
3. Yield curve analysis — shape, slope, 2s10s / 10s30s spreads, inversion signal
4. Duration and interest rate risk — DV01 interpretation ("a 1% rate rise costs X% NAV")
5. Credit quality — for bond ETFs: rating distribution, credit spread + percentile
6. Real yield and inflation — breakeven inflation; whether real yield is positive
7. RBI / Fed policy outlook — rate direction implied by curve shape
8. Equity vs bond allocation signal — earnings yield (1/P/E) vs bond yield comparison
9. Investment strategy — lump sum timing, SIP laddering, duration positioning
10. Data confidence — 🟢/🟡/🔴 block
11. Final verdict

#### New analysis functions

```python
def run_etf_analysis(ticker: str, market: str, projection_year: int) -> Dict
def run_mf_analysis(scheme_input: str, projection_year: int) -> Dict
def run_bond_analysis(instrument: str, market: str, projection_year: int) -> Dict
```

All three follow the identical pattern as `run_investment_analysis()`:
```
load data → schema validate → _compact_data() → build prompt → _run_bob() → return dict
```

**`_compact_data()` addition** — append these keys to the existing `selected` dict:
```python
"etf_profile", "holdings_top10", "asset_allocation", "sector_allocation",
"tracking_difference", "nav_premium_discount", "liquidity_score",
"scheme_info", "nav_current", "nav_returns",
"yield_curve", "spread_analysis", "real_yield", "macro_context",
"quant_metrics", "risk_metrics", "bond_risk_metrics",
"valuation_percentile", "data_quality", "data_gaps"
```

No existing key is removed. The `selected` dict grows. Bob always has more to write about.

**Done when:** `run_etf_analysis("SPY", "us", 2026)` returns a dict with `final_memo` containing
all 10 required ETF sections.

---

### Sub-Task 5 — CLI Integration `[x] done`

**Depends on:** Sub-Task 4

**File:** `main.py` (additive only)

**New flag:** `--asset-type stock|etf|mf|bond` (default: `stock`)

**Routing in `_run_single()`:**
```
stock → run_investment_analysis()   unchanged
etf   → run_etf_analysis()
mf    → run_mf_analysis()           positional arg = scheme name or code
bond  → run_bond_analysis()
```

**`_parse_ticker_market()` bypass:** `mf` and `bond` types skip the `:market` suffix parse —
MF scheme names may contain spaces; bond instrument keys are hyphen-delimited strings.

**`_print_batch_summary()` columns by asset type:**
```
stock: TICKER | MARKET | PRICE    | TTM P/E  | ROCE
etf:   TICKER | MARKET | AUM ($M) | EXPENSE% | 1Y RETURN%
mf:    SCHEME | NAV    | 1Y %     | 3Y CAGR% | SHARPE
bond:  INSTR  | MARKET | YIELD%   | SPREAD   | DURATION
```

**`__init__.py`** — export the three new `run_*` functions.

**`commands.txt`** — add examples:
```bash
python main.py NIFTYBEES --asset-type etf --market india
python main.py SPY --asset-type etf --market us
python main.py "SBI Bluechip Fund" --asset-type mf
python main.py "india-10y" --asset-type bond --market india
python main.py TLT --asset-type bond --market us
```

**Done when:** `python main.py --help` shows `--asset-type` with all four choices.

---

### Sub-Task 8 — Portfolio Intelligence Engine `[x] done`

**Depends on:** Sub-Tasks 7a + 7b (can build in parallel with 1–3)

**File:** `src/investment_matrix/engines/portfolio_engine.py`
(extends `portfolio_analyser.py` — does not replace it)

**New capabilities:**

| Feature | Method | How |
|---|---|---|
| ETF overlap analysis | `compute_etf_overlap(holdings_df)` | fetch `funds_data.top_holdings` for each ETF holding; intersection matrix; flag stocks > 10% combined weight across ETFs |
| Hidden sector concentration | `compute_effective_exposure(holdings_df)` | weight each ETF's sector_allocation by portfolio weight → aggregate; flag if any sector > 35% effective exposure |
| Cross-asset allocation | `compute_asset_class_allocation(holdings_df)` | equity/bond/cash/gold/other by `asset_type` column in holdings file |
| Currency exposure | `compute_currency_exposure(holdings_df)` | INR/USD split by market tag; % of portfolio in each currency |
| Duration exposure | `compute_duration_exposure(holdings_df)` | sum bond holdings weighted by effective_duration from `bond_risk_metrics` |
| Diversification score | `compute_diversification_score(metrics)` | 0–100 composite: num assets, num sectors, num markets, max_weight, pairwise correlation |
| Correlation matrix | `compute_correlation_matrix(holdings_df)` | 1Y price correlation via `HistoricalDataProvider` + `TimeSeriesNormalizer` |
| Portfolio quant | `compute_portfolio_risk(holdings_df)` | portfolio-level Sharpe, Sortino, max drawdown, beta via `QuantEngine` |

**Currency note:** cross-market portfolio returns are reported in the user's base currency
(default INR). USD asset returns are converted using USDINR history from `HistoricalDataProvider`.
Full FX-adjusted return calculations are a **Phase 2** feature — in Phase 1, currency *exposure*
is reported as a percentage, not used to adjust individual asset returns. This scope is explicit
in `data_gaps`: `"portfolio_returns: reported in local currency; FX-adjusted return = Phase 2"`.

**`PORTFOLIO_SYSTEM_PROMPT`** is extended (additive) to reference the new fields:
`etf_overlap`, `effective_sector_exposure`, `currency_exposure`, `diversification_score`,
`correlation_matrix`, `portfolio_risk`.

**Done when:** `--portfolio holdings.xlsx` run includes ETF overlap and diversification score
in the generated PDF.

---

## 7. Data Quality / Confidence System

Every data layer populates `data_quality` alongside its main output.
`_compact_data()` passes it through to Bob unchanged.
Every system prompt instructs Bob to render a compact confidence block at the end:

```
Data Confidence
  🟢 Stock price (A — exchange, same-day), NAV (A — AMFI, daily)
  🟡 ETF holdings (B — Yahoo Finance), TER (B — AMFI disclosure)
  🔴 Tracking error: estimated (price return index used); AUM: unavailable
```

**Quality grades:**
```
A — official primary source    (exchange, Treasury, AMFI, SEBI, RBI)
B — reliable third-party       (yfinance, mftool, MFAPI.in, FRED)
C — estimated / derived        (calculated from incomplete data)
D — unavailable                (not obtainable via free sources)
```

---

## 8. Valuation Percentile Scoring

`QuantEngine.compute_valuation_percentile(value, history_series)` is applied to:

| Metric | History source | Applied in |
|---|---|---|
| P/E ratio | `pe_history` (already in both layers) | stocks + ETF underlying |
| Dividend yield | yfinance 5Y | stocks + ETFs |
| Bond yield | FRED / FBIL 5Y history | bond layer |
| ETF NAV premium | 30d rolling (HistoricalDataProvider) | ETF layer |
| Volatility | 1Y rolling | all asset types |
| Credit spread | FRED / NSE 5Y | bond layer |

Output per metric: `{value: X, percentile: 84, label: "historically expensive"}`.
Bob writes the label as a stated fact, not an inference.

---

## 9. What Stays Completely Unchanged

| Component | Why |
|---|---|
| `pdf_writer.py` | asset-agnostic markdown → PDF; works for all asset types |
| `_run_bob()` | asset-agnostic subprocess call |
| `run_investment_analysis()` | stock path is untouched; new layers add alongside it |
| `run_compare_analysis()` | unchanged |
| `REPORT_SYSTEM_PROMPT` | sacred — see §0 |
| `COMPARE_SYSTEM_PROMPT` | unchanged |
| `screener_layer.py` internal logic | gains `quant_metrics` + `data_quality` at the return site; its own scraping logic is untouched |
| `yfinance_layer.py` internal logic | same |
| `_STAGES` / `_progress()` in `main.py` | unchanged |
| `--portfolio`, `--compare`, `--watchlist` flags | unchanged |
| `holdings.xlsx` format | unchanged; `asset_type` column is optional (defaults to `stock`) |

---

## 10. Execution Order and Dependency Graph

```
Sub-Task 6   (deps + settings)
     │
Sub-Task 7a  (providers: HistoricalDataProvider, BenchmarkResolver,
     │         TimeSeriesNormalizer, SchemaValidator)
     │
Sub-Task 7b  (engines: QuantEngine, RiskEngine)
     │
     ├─── Sub-Task 1  (ETF layer — needs 7a + 7b)
     │
     ├─── Sub-Task 2  (MF layer — needs 7a + 7b)
     │
     ├─── Sub-Task 3  (Bond layer — needs 7a + 7b + Sub-Task 1)
     │
     └─── Sub-Task 8  (Portfolio engine — needs 7a + 7b; parallel with 1–3)
              │
         Sub-Task 4   (prompts + run_* functions — needs 1 + 2 + 3)
              │
         Sub-Task 5   (CLI — needs 4)
```

**Revised execution order: 6 → 7a → 7b → 1 + 2 + 8 (parallel) → 3 → 4 → 5**

---

## 11. Phase 2 — Deferred Features

These are valuable but need their own dedicated plan. Captured here so they are not lost.

| Feature | Source | Why deferred |
|---|---|---|
| Investment Thesis vs Reality tracker | myPlan.md §21 | Requires persistent report storage + versioning |
| Recommendation feedback loop | myPlan.md §22 | Requires scheduler + price polling service |
| User profile / suitability scoring | myPlan.md §24 | Requires user config + suitability rules engine |
| Market regime engine | myPlan.md §17 | Requires VIX, credit spread, breadth data aggregation |
| FINRA TRACE / CUSIP corporate bonds | myPlan.md §11 | Requires FINRA API investigation |
| SEC EDGAR filings integration | myPlan.md §19 | Requires EDGAR API + 10-K/10-Q parser |
| MF portfolio month-over-month diff | myPlan.md §5 | Requires multi-month SEBI disclosure storage |
| Decision Engine with scoring | blueprint-v2 §3L | Needs regime + tax + suitability layers first |
| Tax Engine (post-tax returns) | blueprint-v2 §3K | Needs jurisdiction versioning |
| FX-adjusted portfolio returns | blueprint-v2 §3I | Phase 1 reports currency exposure %; adjusted returns in Phase 2 |

---

## 12. Sub-Task Status Tracker

| Sub-Task | Description | Depends on | Status |
|---|---|---|---|
| 6 | Dependencies, settings, .env | — | `[x] done` |
| 7a | Provider layer (HDP, Resolver, Normalizer, Schema) | 6 | `[x] done` |
| 7b | Quant + Risk Engine | 7a | `[x] done` |
| 1 | ETF Data Layer | 7a, 7b | `[x] done` |
| 2 | Mutual Fund Data Layer | 7a, 7b | `[x] done` |
| 3 | Bond Data Layer | 7a, 7b, 1 | `[x] done` |
| 8 | Portfolio Intelligence Engine | 7a, 7b | `[x] done` |
| 4 | System Prompts + Analysis Functions | 1, 2, 3 | `[x] done` |
| 5 | CLI Integration | 4 | `[x] done` |
