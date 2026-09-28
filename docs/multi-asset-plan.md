# Multi-Asset Extension Plan: ETFs, Mutual Funds, and Bonds

## Top-Level Overview

Extend StocksAgent to analyse ETFs (India + US), Indian Mutual Funds, and Bonds (India + US)
using the same pipeline already proven for stocks:

```
data layer → _compact_data() → Bob LLM → PDF report
```

Each new asset class gets:

1. A dedicated **data layer** (`tools/<asset>_layer.py`) with a `compile_full_dataset()` method
   that returns the same canonical dict keys `_compact_data()` already reads.
2. A dedicated **system prompt** and `run_<asset>_analysis()` function in `report_generator.py`.
3. A new **`--asset-type`** CLI flag in `main.py` to route to the right layer.

No changes to `_compact_data()`, `_run_bob()`, `save_pdf()`, or `pdf_writer.py` are needed —
they are already asset-agnostic.

---

## Data Sources — Final Choices (grounded in research)

| Asset class        | Primary source                          | Python access                       | Auth needed   |
| ------------------ | --------------------------------------- | ----------------------------------- | ------------- |
| Indian ETF         | yfinance`.NS` / `.BO`               | `yfinance`                        | No            |
| US ETF             | yfinance (ticker as-is)                 | `yfinance`                        | No            |
| Indian Mutual Fund | AMFI NAVAll.txt + MFAPI.in via mftool   | `mftool` + `requests`           | No            |
| Indian Bonds       | RBI FBIL yield curve + NSE bond pages   | `requests` + `pandas.read_html` | No            |
| US Bonds           | FRED (Treasury yields) + yfinance (ETF) | `fredapi` + `yfinance`          | FRED free key |

### What each source actually provides (honest assessment)

**ETFs (both):** yfinance returns OHLCV, 52w range, dividends, basic fund metadata (AUM,
expense ratio, category, holdings) for US ETFs reliably, for Indian ETFs partially. Chart signals
(MACD, Bollinger, RSI) work identically to stocks since OHLCV is the same format.

**Indian MF:** AMFI gives authoritative daily NAV + scheme code. mftool/MFAPI.in adds historical
NAV series, scheme category, fund house. AUM/expense ratio/holdings NOT available via free APIs —
the report will note this and direct the user to the fund factsheet.

**Indian Bonds:** RBI/FBIL provides benchmark G-Sec yield curve (free, reliable). NSE provides
YTM, coupon, maturity for listed bonds (scraping, fragile). No single clean API — we fetch what is
available and clearly note gaps.

**US Bonds:** FRED provides the complete Treasury yield curve (free key, reliable). For corporate
bond ETFs (TLT, AGG, LQD) yfinance works well. Individual corporate bonds are NOT attempted —
FINRA TRACE access is too complex. The report covers bond ETFs + yield context, not CUSIP-level bonds.

---

## Architecture

```
tools/
  etf_layer.py          ← Indian + US ETFs (yfinance, detects market)
  mutual_fund_layer.py  ← Indian MFs only (AMFI + mftool)
  bond_layer.py         ← Indian G-Sec/corporate + US Treasuries + bond ETFs
```

`report_generator.py` additions:

- `ETF_SYSTEM_PROMPT`
- `MF_SYSTEM_PROMPT`
- `BOND_SYSTEM_PROMPT`
- `run_etf_analysis(ticker, market, year)`
- `run_mf_analysis(scheme_code_or_name, year)`
- `run_bond_analysis(instrument, market, year)`
- `_load_data()` extended for new asset types

`main.py` addition:

- `--asset-type stock|etf|mf|bond` (default: `stock`)
- MF accepts scheme name or code instead of ticker

`__init__.py`: export the three new `run_*` functions.

`requirements.txt`: add `mftool>=2.0`, `fredapi>=3.1`.

---

## Sub-Tasks

---

### Sub-Task 1 — ETF Data Layer

**Status:** [ ] pending

**Intent**
Create `src/investment_matrix/tools/etf_layer.py`. ETFs trade like stocks so yfinance handles
both India and US. The layer reuses `YFinanceDataLayer` for price/chart data and adds ETF-specific
fields: AUM, expense ratio, NAV, category, top holdings, tracking error (US only), dividend
history.

**Expected Outcomes**

- `etf_layer.compile_full_dataset(ticker, market)` returns a dict with all canonical keys
  plus ETF-specific keys: `etf_profile`, `holdings_top10`, `asset_allocation`, `sector_allocation`.
- Indian ETF (`NIFTYBEES.NS`) and US ETF (`SPY`) both work; missing fields are `None` not errors.
- Chart signals (MACD, Bollinger, RSI, patterns) are fully populated from yfinance OHLCV.

**Todo List**

- [ ] Create `etf_layer.py` with class `ETFDataLayer` inheriting `YFinanceDataLayer`
- [ ] `compile_full_dataset(ticker, market)`: add `.NS`/`.BO` suffix for India, use raw ticker for US
- [ ] `_extract_etf_profile(info)`: pull AUM, expense ratio, category, fund family, legal type, NAV, yield, beta
- [ ] `_extract_holdings(ticker_obj)`: call `yf.Ticker.funds_data` for US; fallback to `info` fields for India
- [ ] `_extract_asset_allocation(ticker_obj)`: equity/bond/cash split from `funds_data` where available
- [ ] `_extract_sector_allocation(ticker_obj)`: sector weights from `funds_data`
- [ ] Fall through gracefully: all ETF-specific fields wrapped in `try/except`, return `{}` on failure
- [ ] Return dict with all `_compact_data` canonical keys + `etf_profile`, `holdings_top10`,
  `asset_allocation`, `sector_allocation`
- [ ] Add `etf_layer = ETFDataLayer()` singleton at module bottom
- [ ] Unit-test: assert `compile_full_dataset("SPY", "us")` and `compile_full_dataset("NIFTYBEES", "india")`
  return dicts with at least `source`, `key_metrics`, `chart_signals`

**Relevant Context**

- Pattern: `screener_layer.compile_full_dataset()` and `yfinance_layer.compile_full_dataset()`
- `YFinanceDataLayer.compute_chart_signals()` — reuse directly
- `yf.Ticker.funds_data` — new yfinance attribute for ETF holdings/allocation
- `yf.Ticker.info` keys: `totalAssets`, `expenseRatio`, `category`, `fundFamily`, `navPrice`,
  `yield`, `ytdReturn`, `threeYearAverageReturn`, `fiveYearAverageReturn`

---

### Sub-Task 2 — Mutual Fund Data Layer

**Status:** [ ] pending

**Intent**
Create `src/investment_matrix/tools/mutual_fund_layer.py` for Indian MFs only.
Uses AMFI NAVAll.txt for authoritative NAV and `mftool`/MFAPI.in for scheme metadata and
historical NAV series. AUM/expense ratio/holdings are NOT available via free APIs — the layer
honestly reports what is missing and what the user should look up in the fund factsheet.

**Expected Outcomes**

- `mutual_fund_layer.compile_full_dataset(scheme_input)` accepts either a scheme code (integer)
  or a partial scheme name string (fuzzy-matched).
- Returns dict with: `source`, `source_url`, `scheme_info`, `nav_history` (last 90 days),
  `nav_current`, `nav_change_1d`, `nav_change_1w`, `nav_change_1m`, `nav_change_3m`,
  `nav_change_6m`, `nav_change_1y`, `category`, `fund_house`, `data_gaps` (explicit list of
  unavailable fields).
- Gracefully handles: scheme not found → clear error message; mftool network failure → fallback
  to AMFI direct fetch.

**Todo List**

- [ ] `pip install mftool` and add `mftool>=2.0` to `requirements.txt`
- [ ] Create `mutual_fund_layer.py` with class `MutualFundDataLayer`
- [ ] `_resolve_scheme(scheme_input)`: if integer → use as code; if string → use `mftool.get_scheme_codes()`
  to fuzzy-match by name; return `(scheme_code, scheme_name)` or raise `ValueError`
- [ ] `_fetch_nav_history(scheme_code, days=365)`: call `mftool.get_historical_nav(scheme_code)`;
  parse date + NAV pairs; return sorted list
- [ ] `_compute_nav_returns(history)`: compute 1d/1w/1m/3m/6m/1y returns from NAV series
- [ ] `_fetch_scheme_details(scheme_code)`: call `mftool.get_scheme_details(scheme_code)`;
  extract fund house, category, scheme type, launch date, NAV date
- [ ] `compile_full_dataset(scheme_input)`: orchestrate above; return canonical dict
- [ ] `data_gaps` field: always list fields not available (AUM, expense ratio, holdings, duration,
  credit rating) with note "See fund factsheet at AMC website"
- [ ] Add `mutual_fund_layer = MutualFundDataLayer()` singleton
- [ ] Unit-test: assert `compile_full_dataset("SBI Bluechip")` returns dict with `nav_current`,
  `nav_change_1y`, `category`, `fund_house`

**Relevant Context**

- `mftool` docs: `Mftool().get_scheme_codes()`, `get_historical_nav()`, `get_scheme_details()`
- AMFI fallback: `https://www.amfiindia.com/spages/NAVAll.txt` — semicolon-delimited, parse with
  `pandas.read_csv(sep=';')`
- Pattern: same as screener_layer but simpler (no tables, no HTML scraping)

---

### Sub-Task 3 — Bond Data Layer

**Status:** [ ] pending

**Intent**
Create `src/investment_matrix/tools/bond_layer.py`. Handles two sub-cases:

1. **Bond ETFs** (e.g. `TLT`, `AGG`, `LIQUIDBEES.NS`): delegate to `ETFDataLayer` for price
   data, augment with yield curve context.
2. **Benchmark yield analysis** (e.g. "India 10Y", "US 10Y"): fetch yield curve from
   RBI/FBIL (India) or FRED (US), compute term structure, spreads, and macro context.

Individual CUSIP-level corporate bonds are out of scope — too fragile and no reliable free API.

**Expected Outcomes**

- `bond_layer.compile_full_dataset(instrument, market)` where `instrument` is either:
  - A bond ETF ticker (`TLT`, `LIQUIDBEES`) → returns ETF data + yield context
  - A benchmark string (`"india-10y"`, `"us-10y"`, `"india-gsec"`, `"us-treasury"`) → returns
    yield curve data
- For FRED (US): fetches DGS1MO, DGS3MO, DGS6MO, DGS1, DGS2, DGS5, DGS10, DGS30 — full curve
- For India: fetches RBI FBIL benchmark rates via public endpoint
- Returns: `yield_curve`, `current_yields`, `yield_changes_1w_1m_3m`, `spread_analysis`,
  `macro_context`, plus standard ETF fields if it is a bond ETF
- FRED requires a free API key stored as `FRED_API_KEY` in `.env`

**Todo List**

- [ ] `pip install fredapi` and add `fredapi>=3.1` to `requirements.txt`
- [ ] Add `FRED_API_KEY=your-fred-key` to `.env.example`
- [ ] Create `bond_layer.py` with class `BondDataLayer`
- [ ] `_is_etf(instrument)`: heuristic — if instrument contains letters only and not in benchmark
  keyword list, treat as ETF ticker
- [ ] `_fetch_us_yield_curve()`: use `fredapi` to fetch the 8 standard CMT series (DGS1MO through
  DGS30); return `{maturity: yield}` dict + 1w/1m/3m changes per point
- [ ] `_fetch_india_yield_curve()`: fetch FBIL benchmark rates from
  `https://www.fbil.org.in/fbil_rates.php` or RBI stats page; parse with `requests` +
  `pandas.read_html`; fallback to NSE GSec data
- [ ] `_compute_spread_analysis(curve)`: 2s10s spread, 10s30s spread, slope, inversion flag
- [ ] `_fetch_bond_etf_data(ticker, market)`: delegate to `etf_layer.compile_full_dataset()`
- [ ] `_build_macro_context(curve, market)`: interpret yield level and curve shape for the Bob prompt
- [ ] `compile_full_dataset(instrument, market)`: route to ETF path or benchmark path; return
  canonical dict with `yield_curve`, `spread_analysis`, `macro_context`
- [ ] Graceful degradation: if FRED key missing → skip US yield curve, note in `data_gaps`;
  if FBIL fetch fails → note in `data_gaps`
- [ ] Add `bond_layer = BondDataLayer()` singleton

**Relevant Context**

- FRED series: `DGS1MO`, `DGS3MO`, `DGS6MO`, `DGS1`, `DGS2`, `DGS5`, `DGS10`, `DGS30`
- FBIL: `https://www.fbil.org.in` — benchmark rates published daily
- RBI stats: `https://rbi.org.in/scripts/BS_ViewBulletin.aspx` — GSec yields
- `etf_layer.compile_full_dataset()` — reuse for bond ETF pricing/chart data

---

### Sub-Task 4 — System Prompts and Analysis Functions

**Status:** [ ] pending

**Intent**
Add three new system prompts and `run_*` functions to `report_generator.py`. Each prompt is
tailored to what analysts actually care about for that asset class — not a copy of the stock
prompt with words changed.

**Expected Outcomes**

- `ETF_SYSTEM_PROMPT` — covers: NAV vs market price premium/discount, tracking error, expense
  ratio vs peers, index it tracks, top holdings concentration, factor exposure, chart signals,
  when to buy/exit, tax efficiency (India: LTCG after 1 year; US: standard ETF tax)
- `MF_SYSTEM_PROMPT` — covers: consistent NAV return vs benchmark, rolling returns (1/3/5/7/10y),
  fund manager tenure, AUM trend, category rank, SIP vs lumpsum view, expense ratio impact,
  exit load, direct vs regular plan, when to switch/exit
- `BOND_SYSTEM_PROMPT` — covers: current yield vs historical range, yield curve shape (normal/
  inverted/flat), duration risk, reinvestment risk, credit quality (for bond ETFs), RBI/Fed
  policy outlook, when bonds are attractive vs equities, laddering strategy
- `run_etf_analysis(ticker, market, projection_year)` — loads data, builds prompt, returns standard
  result dict
- `run_mf_analysis(scheme_input, projection_year)` — same pattern for MF
- `run_bond_analysis(instrument, market, projection_year)` — same pattern for bond

**Todo List**

- [ ] Write `ETF_SYSTEM_PROMPT` with sections:
  Executive view, 1. ETF profile (index tracked, AUM, expense, type),
  2. Performance vs benchmark, 3. Holdings and concentration,
  4. Technical trading signals, 5. Cost and tax analysis,
  6. When to buy / When to exit, Final verdict
- [ ] Write `MF_SYSTEM_PROMPT` with sections:
  Executive view, 1. Fund profile, 2. NAV performance (1/3/5/10y rolling),
  3. Consistency analysis (rolling returns), 4. Risk metrics,
  5. Category rank and peer comparison, 6. Manager and AMC quality,
  7. SIP vs lumpsum recommendation, 8. Exit strategy, Final verdict
- [ ] Write `BOND_SYSTEM_PROMPT` with sections:
  Executive view, 1. Current yield environment, 2. Yield curve analysis,
  3. Duration and interest rate risk, 4. Credit quality (bond ETF),
  5. Policy outlook (RBI/Fed), 6. Equity vs bond allocation signal,
  7. Investment strategy (lump sum, SIP, laddering), Final verdict
- [ ] Add `run_etf_analysis()` — pattern identical to `run_investment_analysis()`
- [ ] Add `run_mf_analysis()` — uses `mutual_fund_layer.compile_full_dataset()`
- [ ] Add `run_bond_analysis()` — uses `bond_layer.compile_full_dataset()`
- [ ] All three functions return `{"type": "<asset>", "final_memo": ..., ...}`

**Relevant Context**

- Pattern: `COMPARE_SYSTEM_PROMPT` + `run_compare_analysis()` in `report_generator.py`
- `_compact_data()` — reused unchanged; all new layers return the same canonical keys
- `_run_bob()` — reused unchanged

---

### Sub-Task 5 — CLI Integration

**Status:** [ ] pending

**Intent**
Extend `main.py` to route `--asset-type etf|mf|bond` to the correct analysis function.
MF is special: it accepts a scheme name/code, not a stock ticker. Everything else (batch mode,
watchlist, --output, PDF saving, batch summary) works unchanged.

**Expected Outcomes**

- `python main.py NIFTYBEES --asset-type etf --market india --output` works
- `python main.py SPY --asset-type etf --market us --output` works
- `python main.py "SBI Bluechip" --asset-type mf --output` works (MF name as positional arg)
- `python main.py "india-10y" --asset-type bond --market india --output` works
- `python main.py TLT --asset-type bond --market us --output` works
- `--asset-type stock` (default) behaviour is completely unchanged
- Batch and watchlist modes work for ETFs; MF and Bond in single mode only (batch is optional)
- `--help` clearly explains each `--asset-type` option

**Todo List**

- [ ] Add `--asset-type stock|etf|mf|bond` argument (default: `stock`)
- [ ] Import `run_etf_analysis`, `run_mf_analysis`, `run_bond_analysis` from `report_generator`
- [ ] In `_run_single()`: branch on `asset_type`; call the appropriate `run_*` function;
  return same summary row structure
- [ ] For MF: positional arg is the scheme name (string with spaces is valid); skip watchlist
  market-mix syntax for MF/Bond (they have no `:market` suffix)
- [ ] Update batch summary table to show relevant columns per asset type (ETF: AUM, expense;
  MF: NAV, 1y return; Bond: yield, duration)
- [ ] Update `commands.txt` with new examples for each asset type
- [ ] Update `__init__.py` to export the three new `run_*` functions

**Relevant Context**

- `main.py:_run_single()` — needs asset_type parameter
- `main.py:_parse_ticker_market()` — MF names may contain spaces; needs bypass for mf/bond types
- `main.py:_print_batch_summary()` — column selection by asset type

---

### Sub-Task 6 — Dependencies and Validation

**Status:** [ ] pending

**Intent**
Install new dependencies, add config entries, and run a smoke test across all three new asset classes.

**Expected Outcomes**

- `pip install mftool fredapi` succeeds
- `requirements.txt` updated with `mftool>=2.0`, `fredapi>=3.1`
- `.env.example` updated with `FRED_API_KEY=your-fred-key`
- `config/settings.py` reads `FRED_API_KEY` from env
- Full smoke test: import all new layers, call `compile_full_dataset` on one instrument per class,
  assert canonical keys present
- `python main.py --help` shows `--asset-type`

**Todo List**

- [ ] `pip install mftool fredapi --break-system-packages`
- [ ] Add to `requirements.txt`: `mftool>=2.0`, `fredapi>=3.1`
- [ ] Add `FRED_API_KEY=your-fred-key` to `.env.example`
- [ ] Add `fred_api_key = os.getenv("FRED_API_KEY", "")` to `config/settings.py`
- [ ] Run smoke test: import each new layer, call compile, assert keys
- [ ] Run `python main.py --help` and confirm `--asset-type` present
- [ ] Update `commands.txt` with new commands

**Relevant Context**

- `src/investment_matrix/config/settings.py` — where env vars are read
- `.env.example` — user-facing template
- `requirements.txt` — existing dependencies

---

## What Each Report Will Cover

### ETF Report

```
[ETF Name]: 2026 Investment View
Executive verdict

1. ETF Profile (index tracked, AUM, expense ratio, type, fund house)
2. Performance vs benchmark (1m/3m/6m/1y/3y/5y returns, tracking error)
3. Holdings and concentration (top 10 holdings, sector/asset allocation)
4. Technical trading signals (MACD, Bollinger, RSI, patterns — same as stocks)
5. Cost and tax analysis (expense ratio vs peers, India LTCG, US ETF tax)
6. When to buy / When to exit
Final verdict
```

### Mutual Fund Report

```
[Fund Name]: 2026 Investment View
Executive verdict

1. Fund profile (category, AMC, fund manager, AUM if available, expense ratio if available)
2. NAV performance (1y/3y/5y/10y absolute and annualised returns)
3. Consistency analysis (rolling 1y returns — how many years positive)
4. Risk metrics (standard deviation, max drawdown from NAV history)
5. Category rank and peer comparison
6. Manager and AMC quality
7. SIP vs lumpsum recommendation
8. Exit strategy (when to switch or redeem)
Final verdict
```

### Bond / Yield Report

```
[Bond/Yield Instrument]: 2026 Investment View
Executive verdict

1. Current yield environment (where yields are relative to 5-year history)
2. Yield curve analysis (shape, slope, inversion signal)
3. Duration and interest rate risk (how much NAV falls per 1% rate rise)
4. Credit quality (for bond ETFs: rating distribution)
5. RBI / Fed policy outlook and rate direction
6. Equity vs bond allocation signal (earnings yield vs bond yield comparison)
7. Investment strategy (lump sum, SIP, laddering)
Final verdict
```

---

## Known Limitations (documented honestly)

| Asset class | What we cannot get for free                                             |
| ----------- | ----------------------------------------------------------------------- |
| Indian ETF  | Reliable AUM, full holdings, tracking error (not in yfinance for India) |
| US ETF      | Real-time underlying bond prices, creation/redemption basket            |
| Indian MF   | AUM, expense ratio, full portfolio holdings, duration, credit rating    |
| Indian Bond | Individual corporate bond live prices, complete credit rating data      |
| US Bond     | CUSIP-level corporate bond prices, FINRA TRACE individual bond data     |

These gaps are surfaced in a `data_gaps` field in every layer's output dict and communicated
clearly in the Bob-generated report.
