# Investment Intelligence Engine — Technical Blueprint

> **Purpose:** This document is the missing bridge between `myPlan.md` (the vision) and
> `multi-asset-plan.md` (the execution plan). It translates every high-value idea from the
> vision into a concrete, layered architecture grounded in the actual codebase — without
> discarding what `multi-asset-plan.md` already got right.
>
> **Rule:** Every section traces back to either existing code or a named new file/class/function.
> Nothing is speculative without a named home.

---

## 0. The Non-Negotiable Quality Contract

The current BSE.pdf report (9 pages, 12 sections, bear/base/bull projection, investor-type
stances, precise EPS arithmetic) defines the **quality floor**. Every change made to this
codebase must produce a report that is **at least as detailed and at least as long**.

### The iron rules

1. **`REPORT_SYSTEM_PROMPT` is sacred for stocks.** Its 12 numbered sections, the
   bear/base/bull projection structure, and the per-investor-type verdict table are never
   removed, shortened, or merged.

2. **Bob interprets; Python calculates.** The Quant Engine pre-computes Sharpe, drawdown,
   VaR, percentile ranks and puts them in the JSON. Bob reads pre-calculated values and
   writes about them — Bob never derives them from scratch. This makes the analysis *more*
   precise, not shorter.

3. **New keys in `_compact_data()` are additive only.** No existing key is ever removed
   from the JSON sent to Bob. New keys are appended. Bob's sections gain *more* data to
   write about.

4. **New prompts for ETF / MF / Bond are written to their own constants.** They are never
   substituted for `REPORT_SYSTEM_PROMPT`. Stock analysis always uses `REPORT_SYSTEM_PROMPT`.

5. **No section in any report may be omitted.** If data is unavailable, Bob must write the
   section heading and explain what is unavailable and what the investor should check manually
   (this is already the behaviour in BSE.pdf §4 and §5 — the pattern is preserved).

### How the Quant Engine makes the report richer, not shorter

| BSE.pdf section | Before Quant Engine | After Quant Engine |
|---|---|---|
| §6 Valuation | Raw P/E = 51x; Bob estimates fair value in prose | + `valuation_percentile`: "84th percentile over 10Y — historically expensive" → Bob writes this as a stated fact |
| §9 Key Risks | "High volatility" (qualitative) | + `max_drawdown`, `VaR_95`, `volatility_ann` → Bob writes "3Y max drawdown 43%, annualised vol 38%, VaR₉₅ = -4.1%/day" |
| §12 Technical signals | MACD, RSI, Bollinger (already strong) | Unchanged for stocks |
| New tail block | Not present | Data confidence 🟢/🟡/🔴 added after §12 — no existing section displaced |

---

---

## 1. The Fundamental Architecture Shift

### Current pipeline (v1)

```
TICKER
  └─► data layer (screener / yfinance)
        └─► _compact_data()  ← hand-picks ~20 keys
              └─► Bob LLM   ← calculates AND interprets
                    └─► PDF
```

### Target pipeline (v2)

```
TICKER / SCHEME / INSTRUMENT
  └─► data layer            ← fetch raw data (existing + new layers)
        └─► quant_engine    ← deterministic Python calculates ALL metrics
              └─► risk_engine       ← Sharpe, Sortino, VaR, CVaR, drawdown
                    └─► portfolio_engine  ← overlap, concentration, allocation
                          └─► _compact_data()  ← selects pre-calculated values
                                └─► Bob LLM  ← interprets ONLY, never calculates
                                      └─► PDF
```

**Key principle (from myPlan.md §12):** Bob must never calculate a financial metric.
Python calculates; Bob interprets. This eliminates hallucinated numbers.

---

## 2. New Files and Their Homes

```
src/investment_matrix/
├── tools/
│   ├── screener_layer.py        ← existing (Indian stocks)
│   ├── yfinance_layer.py        ← existing (US stocks)
│   ├── etf_layer.py             ← NEW Sub-Task 1
│   ├── mutual_fund_layer.py     ← NEW Sub-Task 2
│   └── bond_layer.py            ← NEW Sub-Task 3
├── engines/                     ← NEW directory
│   ├── __init__.py
│   ├── quant_engine.py          ← NEW Sub-Task 7
│   ├── risk_engine.py           ← NEW Sub-Task 7
│   └── portfolio_engine.py      ← NEW Sub-Task 8 (extends portfolio_analyser.py)
├── report_generator.py          ← extended in Sub-Task 4
├── portfolio_analyser.py        ← extended in Sub-Task 8
├── pdf_writer.py                ← unchanged
└── config/
    └── settings.py              ← add FRED_API_KEY, CONFIDENCE_LEVEL
```

---

## 3. Canonical Data Contract

All data layers (existing + new) must return a dict with these top-level keys.
`_compact_data()` reads exactly these keys — no layer-specific special-casing.

### Existing keys (already in screener + yfinance layers)

```
source              str   — "screener.in" / "yahoo_finance" / "amfi+mftool" / etc.
source_url          str   — direct URL
key_metrics         dict  — price, market cap, P/E, EPS, ROCE, etc.
fundamental_metrics dict  — revenue, profit, margins, ratios
technical_metrics   dict  — RSI, MACD values, moving averages
chart_signals       dict  — MACD cross, Bollinger squeeze, patterns, etc.
forensic_metrics    dict  — pledge %, red flags
debt_breakdown      dict  — short/long-term debt
financials_annual   dict
financials_quarterly dict
balance_sheet_annual dict
cashflow_annual     dict
shareholding        dict
peer_comparison     list
major_holders       dict
institutional_holders dict
pe_history          dict
analyst_consensus   dict
news                list
macro_sector        dict
```

### New keys added by new layers / quant engine

```
etf_profile         dict  — AUM, expense ratio, index tracked, fund family, NAV
holdings_top10      list  — [{name, weight_pct}]
asset_allocation    dict  — {equity, bond, cash, other} in %
sector_allocation   dict  — {sector_name: weight_pct}
tracking_difference dict  — {1m, 3m, 1y, 3y, 5y}  (calculated independently)
nav_premium_discount dict — {market_price, nav, premium_pct}
liquidity_score     dict  — {score_0_100, avg_daily_volume, bid_ask_spread_pct}

scheme_info         dict  — MF: fund house, category, type, launch date, scheme code
nav_history         list  — [{date, nav}]  last 365 days
nav_current         float
nav_returns         dict  — {1d, 1w, 1m, 3m, 6m, 1y, 3y, 5y}  calculated in Python

yield_curve         dict  — {maturity_label: yield_pct}
current_yields      dict  — snapshot of key maturities
yield_changes       dict  — {1w, 1m, 3m} per maturity
spread_analysis     dict  — {2s10s, 10s30s, slope, inverted: bool}
real_yield          dict  — {nominal, inflation_expectation, real}  (US: from TIPS)
macro_context       dict  — interpreted yield environment

quant_metrics       dict  — Sharpe, Sortino, beta, alpha, max_drawdown, VaR, CVaR,
                            volatility_ann, calmar, tracking_error, tracking_difference
risk_metrics        dict  — drawdown_pct, ulcer_index, pain_index, upside_capture,
                            downside_capture, correlation_to_benchmark
valuation_percentile dict — {pe_10y_pct, pb_10y_pct, yield_5y_pct, vol_5y_pct}

data_quality        dict  — per-field confidence metadata (see §6)
data_gaps           list  — fields unavailable with reason strings
```

---

## 4. Quant Engine — `engines/quant_engine.py`

**Principle:** All calculations live here. Data layers produce raw numbers. Bob receives
pre-calculated results. No metric should ever be computed inside an LLM prompt.

### Class `QuantEngine`

```python
class QuantEngine:
    def compute_returns(price_series) -> dict
        # daily, weekly, monthly, quarterly, annual returns from price history

    def compute_risk_metrics(returns_series) -> dict
        # Sharpe (rf=0.065 India / 0.05 US), Sortino, max_drawdown,
        # VaR_95, CVaR_95, calmar_ratio, ulcer_index

    def compute_alpha_beta(returns_series, benchmark_series) -> dict
        # OLS regression → alpha, beta, R²

    def compute_tracking_error(fund_returns, index_returns) -> dict
        # annualized std dev of (fund_return - index_return) per period

    def compute_tracking_difference(fund_returns, index_returns) -> dict
        # cumulative performance gap: {1m, 3m, 1y, 3y, 5y}

    def compute_rolling_returns(nav_series, windows=[252,756,1260]) -> dict
        # rolling 1y/3y/5y CAGR, win_rate

    def compute_drawdown_analysis(price_series) -> dict
        # current_drawdown, max_drawdown, recovery_days, drawdown_start

    def compute_updown_capture(fund_returns, benchmark_returns) -> dict
        # upside_capture_pct, downside_capture_pct

    def compute_valuation_percentile(current_value, historical_series) -> dict
        # percentile rank: "84th — historically expensive"

    def compute_nav_premium_discount(market_price, nav) -> dict
        # premium_pct, 30d_avg_premium, alert if > ±1%
```

**Used by:** all data layers call `QuantEngine` methods before returning their dict.
Existing `yfinance_layer.compute_chart_signals()` and `compute_technical_metrics()` remain
but their raw numbers also flow through `QuantEngine.compute_risk_metrics()`.

---

## 5. Sub-Task Detail (Merged Vision + Execution)

### Sub-Task 1 — ETF Data Layer  `[ ] pending`

**Files:** `src/investment_matrix/tools/etf_layer.py`

**Inherits:** `YFinanceDataLayer` (reuses `compute_chart_signals`, `compute_technical_metrics`)

**Data sources:** yfinance `.NS`/`.BO` (India) + yfinance raw (US)

**What to build:**

| Method                                              | What it does                                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `_extract_etf_profile(info)`                      | AUM, expense ratio, category, fund family, NAV, yield, beta                              |
| `_extract_holdings(ticker_obj)`                   | `yf.Ticker.funds_data` for US; `info` fallback for India                             |
| `_extract_asset_allocation(ticker_obj)`           | equity/bond/cash/other split                                                             |
| `_extract_sector_allocation(ticker_obj)`          | sector weights                                                                           |
| `_compute_tracking_difference(ticker, benchmark)` | call`QuantEngine.compute_tracking_difference()` using 5y price history of ETF vs index |
| `_compute_nav_premium_discount(ticker)`           | intraday iNAV from`info["navPrice"]` vs `regularMarketPrice`; 30d rolling avg        |
| `_compute_liquidity_score(ticker)`                | avg 30d volume, bid-ask spread from`info`, AUM → score 0–100                         |
| `compile_full_dataset(ticker, market)`            | orchestrate all above; return canonical dict                                             |

**New canonical keys added:** `etf_profile`, `holdings_top10`, `asset_allocation`,
`sector_allocation`, `tracking_difference`, `nav_premium_discount`, `liquidity_score`,
`quant_metrics`, `valuation_percentile`, `data_quality`, `data_gaps`

**Graceful degradation:** every ETF-specific method wrapped in `try/except`; returns `{}` on failure.

---

### Sub-Task 2 — Mutual Fund Data Layer  `[ ] pending`

**File:** `src/investment_matrix/tools/mutual_fund_layer.py`

**Data sources (upgraded from multi-asset-plan.md):**

| Source                    | What it provides                                      | Access                              |
| ------------------------- | ----------------------------------------------------- | ----------------------------------- |
| `mftool` / MFAPI.in     | historical NAV, scheme metadata, fund house, category | `pip install mftool`              |
| AMFI NAVAll.txt           | authoritative daily NAV, scheme code                  | `requests` GET                    |
| AMFI TER page             | Total Expense Ratio (mandatory daily disclosure)      | `requests` + `pandas.read_html` |
| SEBI portfolio disclosure | Monthly scheme portfolio (ISINs, weights)             | `requests` + PDF/HTML parsing     |
| AMC factsheet (fallback)  | AUM, manager, holdings — note: fragile               | `requests` + `BeautifulSoup`    |

**Priority:** AMFI + mftool first (reliable). AMFI TER + SEBI portfolio = best-effort.
Never block on fragile sources — populate `data_gaps` if they fail.

**What to build:**

| Method                                        | What it does                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `_resolve_scheme(scheme_input)`             | int → code; str → fuzzy match via`mftool.get_scheme_codes()`                                 |
| `_fetch_nav_history(scheme_code, days=365)` | `mftool.get_historical_nav()` → sorted `[{date, nav}]`                                      |
| `_compute_nav_returns(history)`             | 1d/1w/1m/3m/6m/1y/3y/5y CAGR via`QuantEngine.compute_rolling_returns()`                        |
| `_compute_risk_metrics(history)`            | Sharpe, Sortino, max drawdown, VaR via`QuantEngine.compute_risk_metrics()`                     |
| `_fetch_ter(scheme_code)`                   | AMFI TER page → float; populate`data_gaps` on failure                                         |
| `_fetch_portfolio(scheme_code)`             | SEBI monthly disclosure → top-10 holdings + sector allocation; populate`data_gaps` on failure |
| `_fetch_scheme_details(scheme_code)`        | `mftool.get_scheme_details()` → fund house, category, type, launch date                       |
| `compile_full_dataset(scheme_input)`        | orchestrate; return canonical dict                                                               |

**New canonical keys added:** `scheme_info`, `nav_history`, `nav_current`, `nav_returns`,
`quant_metrics`, `holdings_top10` (from SEBI), `sector_allocation` (from SEBI),
`data_quality`, `data_gaps`

**`data_gaps` content when sources fail:**

```python
["AUM: not available via free API — check fund factsheet",
 "TER: AMFI fetch failed — see amfiindia.com",
 "Holdings: SEBI disclosure unavailable — check AMC website"]
```

---

### Sub-Task 3 — Bond Data Layer  `[ ] pending`

**File:** `src/investment_matrix/tools/bond_layer.py`

**Instrument types handled:**

| Input                                                | Routed to                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| `TLT`, `AGG`, `LIQUIDBEES`                     | ETF path:`etf_layer.compile_full_dataset()` + yield context |
| `"india-10y"`, `"india-gsec"`, `"india-tbill"` | India G-Sec path                                              |
| `"us-10y"`, `"us-treasury"`, `"us-tips"`       | US Treasury path                                              |

**Data sources (upgraded from multi-asset-plan.md):**

| Source              | What                                                            | Primary/Fallback         |
| ------------------- | --------------------------------------------------------------- | ------------------------ |
| US Treasury XML API | Full par yield curve (14 maturities), real yield curve (TIPS)   | **Primary for US** |
| FRED                | `DGS*` series, TIPS yields, BREAKEVEN* inflation expectations | Secondary / validation   |
| RBI / FBIL          | India G-Sec benchmark yields                                    | Primary for India        |
| NSE bond pages      | Listed bond YTM, coupon, maturity                               | Best-effort India        |

**What to build:**

| Method                                                            | What it does                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `_is_etf(instrument)`                                           | benchmark keyword list → bool                                                 |
| `_fetch_us_treasury_curve()`                                    | US Treasury XML →`{maturity: yield}` for all 14 points                      |
| `_fetch_us_real_curve()`                                        | US Treasury TIPS XML → real yield curve                                       |
| `_fetch_fred_curve()`                                           | `fredapi` → 8 CMT series as fallback/validation                             |
| `_compute_real_yield(nominal, tips)`                            | breakeven inflation = nominal − TIPS                                          |
| `_fetch_india_yield_curve()`                                    | FBIL →`{maturity: yield}`; RBI fallback                                     |
| `_compute_spread_analysis(curve)`                               | 2s10s, 10s30s, slope, inversion flag, 5Y percentile                            |
| `_compute_credit_spread(corporate_yield, gsec_yield, duration)` | spread in bps; 5Y percentile via`QuantEngine.compute_valuation_percentile()` |
| `_build_macro_context(curve, market)`                           | curve shape classification + policy outlook string                             |
| `compile_full_dataset(instrument, market)`                      | route → return canonical dict                                                 |

**New canonical keys added:** `yield_curve`, `current_yields`, `yield_changes`,
`spread_analysis`, `real_yield`, `macro_context`, `quant_metrics`, `data_quality`, `data_gaps`

---

### Sub-Task 4 — System Prompts and Analysis Functions  `[ ] pending`

**File:** `src/investment_matrix/report_generator.py` (additions only)

**Three new prompts** — each structured differently because the asset class demands different analysis:

**`ETF_SYSTEM_PROMPT` sections:**

1. Executive verdict (2 sentences)
2. ETF profile — index, AUM, expense ratio, fund family, type
3. Performance vs benchmark — tracking difference 1m/3m/1y/3y/5y; not just tracking error
4. Holdings and concentration — top 10, overlap risk, sector tilt
5. Cost, liquidity, and NAV premium — bid-ask, 30d avg premium/discount, liquidity score
6. Technical trading signals — MACD, Bollinger, RSI (labeled as secondary for long-term)
7. When to buy / When to exit — entry signals, exit triggers
8. Final verdict

**`MF_SYSTEM_PROMPT` sections:**

1. Executive verdict
2. Fund profile — category, AMC, manager, AUM, TER, direct vs regular
3. NAV performance — 1y/3y/5y/10y absolute + annualised CAGR
4. Consistency analysis — rolling 1y win rate, best/worst year NAV
5. Risk metrics — Sharpe, Sortino, max drawdown, VaR (all pre-calculated in Python)
6. Category rank and peer comparison
7. SIP vs lumpsum recommendation — with entry-price reasoning
8. Exit strategy — underperformance triggers, tax exit-load awareness
9. Final verdict

**`BOND_SYSTEM_PROMPT` sections:**

1. Executive verdict
2. Current yield environment — nominal + real yield, 5Y percentile
3. Yield curve analysis — shape, slope, inversion signal, 2s10s/10s30s spreads
4. Duration and interest rate risk — DV01, how much NAV falls per 1% rate rise
5. Credit quality — for bond ETFs: rating distribution, credit spread percentile
6. Real yield and inflation — TIPS vs nominal, breakeven inflation (US); RBI CPI vs G-Sec (India)
7. RBI / Fed policy outlook
8. Equity vs bond allocation signal — earnings yield vs bond yield comparison
9. Investment strategy — lump sum, SIP, laddering, duration positioning
10. Final verdict

**Three new analysis functions:**

```python
def run_etf_analysis(ticker, market, projection_year) -> Dict
def run_mf_analysis(scheme_input, projection_year) -> Dict
def run_bond_analysis(instrument, market, projection_year) -> Dict
```

All follow the identical pattern as `run_investment_analysis()`:
load data → `_compact_data()` → build prompt → `_run_bob()` → return dict.

**`_compact_data()` extension:** add the new canonical keys to the selected dict:
`etf_profile`, `holdings_top10`, `asset_allocation`, `sector_allocation`,
`tracking_difference`, `nav_premium_discount`, `liquidity_score`,
`scheme_info`, `nav_current`, `nav_returns`,
`yield_curve`, `spread_analysis`, `real_yield`, `macro_context`,
`quant_metrics`, `risk_metrics`, `valuation_percentile`,
`data_quality`, `data_gaps`

---

### Sub-Task 5 — CLI Integration  `[ ] pending`

**File:** `main.py` (additions only)

**New flag:** `--asset-type stock|etf|mf|bond` (default: `stock`)

**Routing in `_run_single()`:**

```
stock → run_investment_analysis()  (unchanged)
etf   → run_etf_analysis()
mf    → run_mf_analysis()          (positional arg = scheme name/code)
bond  → run_bond_analysis()
```

**`_parse_ticker_market()` bypass:** for `--asset-type mf` and `bond`, skip the `:market`
suffix parsing — scheme names may contain spaces and colons are not valid.

**`_print_batch_summary()` columns by asset type:**

```
stock: TICKER | MARKET | PRICE | TTM P/E | ROCE
etf:   TICKER | MARKET | AUM   | EXPENSE | 1Y RETURN
mf:    SCHEME | NAV    | 1Y    | 3Y CAGR | SHARPE
bond:  INSTR  | MARKET | YIELD | SPREAD  | DURATION
```

**New example commands added to `commands.txt`:**

```bash
python main.py NIFTYBEES --asset-type etf --market india
python main.py SPY --asset-type etf --market us
python main.py "SBI Bluechip Fund" --asset-type mf
python main.py "india-10y" --asset-type bond --market india
python main.py TLT --asset-type bond --market us
```

---

### Sub-Task 6 — Dependencies and Validation  `[ ] pending`

**Files:** `requirements.txt`, `.env.example`, `config/settings.py`

**New dependencies:**

```
mftool>=2.0
fredapi>=3.1
scipy>=1.12        # for QuantEngine OLS regression (alpha/beta)
```

**`settings.py` additions:**

```python
fred_api_key = os.getenv("FRED_API_KEY", "")
risk_free_rate_india = float(os.getenv("RISK_FREE_RATE_INDIA", "0.065"))
risk_free_rate_us = float(os.getenv("RISK_FREE_RATE_US", "0.05"))
```

**`.env.example` additions:**

```dotenv
FRED_API_KEY=your-fred-api-key
RISK_FREE_RATE_INDIA=0.065
RISK_FREE_RATE_US=0.05
```

**Smoke tests (run manually, not pytest):**

- `compile_full_dataset("SPY", "us")` → assert keys `etf_profile`, `quant_metrics`
- `compile_full_dataset("NIFTYBEES", "india")` → same
- `compile_full_dataset("SBI Bluechip")` → assert `nav_current`, `nav_returns`
- `compile_full_dataset("us-10y", "us")` → assert `yield_curve`, `spread_analysis`
- `compile_full_dataset("india-10y", "india")` → assert `yield_curve`

---

### Sub-Task 7 — Quant + Risk Engine  `[ ] pending`

**Files:** `src/investment_matrix/engines/__init__.py`,
`src/investment_matrix/engines/quant_engine.py`,
`src/investment_matrix/engines/risk_engine.py`

**`quant_engine.py` — class `QuantEngine` (all methods are static):**

| Method                                                        | Inputs                                | Output keys                                                                  |
| ------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| `compute_returns(prices)`                                   | `pd.Series`                         | `{daily, weekly, monthly, quarterly, annual}`                              |
| `compute_risk_metrics(returns, rf)`                         | returns`pd.Series`, risk-free float | `{sharpe, sortino, volatility_ann, max_drawdown, var_95, cvar_95, calmar}` |
| `compute_alpha_beta(fund_ret, bench_ret)`                   | two`pd.Series`                      | `{alpha, beta, r_squared}`                                                 |
| `compute_tracking_error(fund_ret, idx_ret)`                 | two`pd.Series`                      | `{tracking_error_ann}`                                                     |
| `compute_tracking_difference(fund_prices, idx_prices)`      | two`pd.Series`                      | `{1m, 3m, 1y, 3y, 5y}` in %                                                |
| `compute_rolling_returns(prices, windows)`                  | `pd.Series`, list[int]              | `{1y_cagr, 3y_cagr, 5y_cagr, win_rate_1y}`                                 |
| `compute_drawdown_analysis(prices)`                         | `pd.Series`                         | `{current_dd, max_dd, dd_start, recovery_days}`                            |
| `compute_updown_capture(fund_ret, bench_ret)`               | two`pd.Series`                      | `{upside_capture, downside_capture}`                                       |
| `compute_valuation_percentile(value, history)`              | float,`pd.Series`                   | `{percentile, label}` e.g. `{84, "historically expensive"}`              |
| `compute_nav_premium_discount(market_px, nav, history_30d)` | floats +`pd.Series`                 | `{premium_pct, avg_30d, alert}`                                            |

**`risk_engine.py` — class `RiskEngine`:**
Thin wrapper that calls `QuantEngine` and adds contextual labels:

```python
def run(price_series, benchmark_series, rf_rate, asset_type) -> dict
    # returns quant_metrics + risk_metrics merged with human-readable labels
```

**Both engines are called by data layers before `compile_full_dataset()` returns.**

---

### Sub-Task 8 — Portfolio Intelligence Engine  `[ ] pending`

**File:** `src/investment_matrix/engines/portfolio_engine.py`
(extends but does not replace `portfolio_analyser.py`)

**New capabilities (from myPlan.md §2, §7):**

| Feature                     | Method                                          | How                                                                                                                                            |
| --------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| ETF overlap analysis        | `compute_etf_overlap(holdings_df)`            | fetch`funds_data.top_holdings` for each ETF holding; compute intersection matrix; flag stocks with >10% combined weight across multiple ETFs |
| Hidden sector concentration | `compute_effective_exposure(holdings_df)`     | weight each ETF's sector allocation by portfolio weight → aggregate sector exposure; flag if any sector >35% effective                        |
| Cross-asset allocation      | `compute_asset_class_allocation(holdings_df)` | equity/bond/cash/gold/other by reading`asset_type` column from holdings file                                                                 |
| Duration exposure           | `compute_duration_exposure(holdings_df)`      | sum bond holdings weighted by effective duration                                                                                               |
| Currency exposure           | `compute_currency_exposure(holdings_df)`      | tag each holding as INR/USD; compute % exposure                                                                                                |
| Diversification score       | `compute_diversification_score(metrics)`      | 0–100 from: num assets, num sectors, num markets, correlation, max weight                                                                     |
| Correlation matrix          | `compute_correlation_matrix(holdings_df)`     | 1y price correlation between holdings                                                                                                          |

**Updated `PORTFOLIO_SYSTEM_PROMPT`** to reference these new fields.

**CLI:** no new flags needed; `--portfolio` automatically uses the new engine if new keys are present in holdings.

---

## 6. Data Quality / Confidence System

**From myPlan.md §13–14.** Every value produced by a data layer should carry provenance metadata.

**Structure:** each data layer adds a `data_quality` dict alongside its data:

```python
data_quality = {
    "etf_profile.expense_ratio": {
        "value": 0.0003,
        "source": "Yahoo Finance / yfinance",
        "timestamp": "2026-06-15",
        "quality": "B",          # A=official, B=third-party, C=estimated, D=unavailable
        "freshness": "same_day"  # same_day / daily / weekly / stale
    },
    "yield_curve.10y": {
        "value": 4.82,
        "source": "U.S. Treasury",
        "timestamp": "2026-06-15",
        "quality": "A",
        "freshness": "same_day"
    }
}
```

**In the report:** Bob is instructed to render a compact data confidence block:

```
Data Confidence
  🟢 US Treasury yield (A — official), NAV (A — AMFI)
  🟡 ETF holdings (B — Yahoo Finance), TER (B — third-party)
  🔴 Tracking error: estimated; AUM: unavailable
```

**Implementation:** each data layer populates `data_quality` as it fetches.
`_compact_data()` adds `data_quality` to the selected dict.
The system prompt instructs Bob to render the confidence block at report end.

---

## 7. Valuation Percentile Scoring

**From myPlan.md §16.** Replace raw numbers with percentile context wherever a 5–10 year
history exists. `QuantEngine.compute_valuation_percentile()` handles the calculation.

**Applied to:**

- P/E ratio (10Y history via `pe_history` — already fetched in both layers)
- Bond yield (5Y history via FRED / RBI data)
- ETF NAV premium/discount (30d rolling)
- Dividend yield (5Y history via yfinance)
- Volatility (1Y rolling history)

**Output appended into `valuation_percentile` key:**

```python
{
    "pe_ratio": {"value": 27.3, "percentile": 84, "label": "historically expensive"},
    "bond_yield_10y": {"value": 4.82, "percentile": 31, "label": "below 5Y average"},
    "nav_premium": {"value": 0.6, "percentile": 72, "label": "slightly elevated"}
}
```

---

## 8. What Stays Unchanged

The following require **zero modification**:

| Component                                             | Why unchanged                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `pdf_writer.py`                                     | asset-agnostic markdown → PDF pipeline                                    |
| `_run_bob()`                                        | asset-agnostic subprocess call                                             |
| `run_investment_analysis()`                         | stock path completely untouched                                            |
| `run_compare_analysis()`                            | unchanged                                                                  |
| `screener_layer.py`                                 | gains`quant_metrics` + `data_quality` keys but its own logic is intact |
| `yfinance_layer.py`                                 | same — gains new keys at`compile_full_dataset()` return site            |
| `_STAGES` / `_progress()` in `main.py`          | unchanged                                                                  |
| `--portfolio`, `--compare`, `--watchlist` flags | unchanged                                                                  |

---

## 9. Implementation Order and Dependencies

```
Sub-Task 6  ← do FIRST: install deps, settings.py, .env.example
     │
Sub-Task 7  ← Quant + Risk Engine (no external deps, pure Python)
     │
     ├── Sub-Task 1  (ETF layer — depends on QuantEngine)
     ├── Sub-Task 2  (MF layer — depends on QuantEngine)
     └── Sub-Task 3  (Bond layer — depends on QuantEngine + ETFLayer)
            │
       Sub-Task 4  (prompts + run_* functions — depends on 1,2,3)
            │
       Sub-Task 5  (CLI — depends on Sub-Task 4)
            │
       Sub-Task 8  (Portfolio Engine — can be done in parallel with 1-3)
```

Revised execution order: **6 → 7 → 1 → 2 → 3 → 4 → 5 → 8**

---

## 10. Phase 2 Ideas (Do Not Implement Now)

These ideas from `myPlan.md` are valuable but require dedicated planning:

| Idea                                        | Why deferred                                          |
| ------------------------------------------- | ----------------------------------------------------- |
| Investment Thesis vs Reality tracker (§21) | Requires persistent storage + report history          |
| Recommendation feedback loop (§22)         | Requires scheduler + price polling                    |
| User profile / suitability scoring (§24)   | Requires user config file + profile engine            |
| Market regime engine (§17)                 | Requires VIX, credit spread, breadth data aggregation |
| FINRA TRACE / CUSIP bonds (§11)            | Requires FINRA API investigation                      |
| SEC filings integration (§19)              | Requires EDGAR API + filing parser                    |
| MF portfolio diff engine (§5)              | Requires multi-month SEBI disclosure storage          |

These are captured here so they are not lost — file a separate plan when ready to build.

---

## 11. Sub-Task Status Tracker

| Sub-Task | Description                         | Status          |
| -------- | ----------------------------------- | --------------- |
| 6        | Dependencies and settings           | `[ ] pending` |
| 7        | Quant + Risk Engine                 | `[ ] pending` |
| 1        | ETF Data Layer                      | `[ ] pending` |
| 2        | Mutual Fund Data Layer              | `[ ] pending` |
| 3        | Bond Data Layer                     | `[ ] pending` |
| 4        | System Prompts + Analysis Functions | `[ ] pending` |
| 5        | CLI Integration                     | `[ ] pending` |
| 8        | Portfolio Intelligence Engine       | `[ ] pending` |
