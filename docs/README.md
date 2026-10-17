# NXTvue — Investment Intelligence Engine

An AI-powered, multi-asset investment analysis platform that produces detailed, source-grounded investment reports in the style of a senior financial analyst. Powered by IBM Bob for report generation.

> **Disclaimer:** This is a research and education tool — not financial advice. Always review company filings, exchange disclosures and annual reports before making an investment decision.

---

## Architecture

```
                  USER (CLI or Web UI)
                        │
                        ▼
             apps/backend/   ←──── Python FastAPI + CLI
             ├── Data Layer
             │   ├── screener_layer.py     ← Indian stocks (Screener.in)
             │   └── yfinance_layer.py     ← US stocks (Yahoo Finance)
             ├── Quant / Risk / Portfolio Analyzers
             ├── report_generator.py       ← Bob LLM orchestration
             └── pdf_writer.py             ← PDF output
                        │
                        ▼
             apps/frontend/nxtvue-web/     ← Vue web UI
```

### Data Sources

| Market        | Source      | Data                                                                                            |
| ------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| Indian stocks | Screener.in | Valuation snapshot, quarterly/annual P&L, balance sheet, cash flow, shareholding, announcements |
| US stocks     | yfinance    | Company info, financials, cash flows, ownership, news, price history                            |

---

## Project Layout

```
StocksAgent/
├── apps/
│   ├── backend/
│   │   ├── src/nxtvue/
│   │   │   ├── api/server.py          ← FastAPI server (port 8000)
│   │   │   ├── report_generator.py    ← Bob Shell orchestration + prompt building
│   │   │   ├── portfolio_analyser.py  ← Portfolio P&L metrics
│   │   │   ├── pdf_writer.py          ← PDF generation
│   │   │   ├── config/settings.py     ← App config
│   │   │   ├── tools/
│   │   │   │   ├── screener_layer.py  ← Screener.in (India)
│   │   │   │   ├── yfinance_layer.py  ← Yahoo Finance (US + India prices)
│   │   │   │   ├── etf_layer.py
│   │   │   │   ├── mutual_fund_layer.py
│   │   │   │   └── bond_layer.py
│   │   │   ├── analyzers/
│   │   │   │   ├── quant_analyzer.py
│   │   │   │   ├── risk_analyzer.py
│   │   │   │   └── portfolio_analyzer.py
│   │   │   ├── providers/
│   │   │   │   ├── historical_data_provider.py
│   │   │   │   ├── benchmark_resolver.py
│   │   │   │   └── timeseries_normalizer.py
│   │   │   └── schemas/asset_schema.py
│   │   ├── holdings.xlsx              ← Backend working copy (keep in sync with root)
│   │   └── .venv/                     ← Python venv
│   └── frontend/
│       └── nxtvue-web/                ← Vue web application
├── docs/
│   ├── commands.txt                   ← Full CLI command reference
│   └── myPlan.md                      ← Architecture evolution roadmap
├── holdings.xlsx                      ← Canonical portfolio holdings file
├── watchlist.txt                      ← Stock watchlist
├── .env                               ← API keys (BOB_API_KEY, etc.)
└── AGENTS.md                          ← Bob agent graph rules
```

---

## Setup

```bash
# 1. Install Python dependencies
cd apps/backend
source .venv/bin/activate

# 2. Set environment variables
cp apps/backend/.env.example .env
# Then edit .env and add your keys:
#   BOB_API_KEY=your-key-here
#   FRED_API_KEY=your-fred-key   (optional — for bond analysis)
```

### Environment Variables

| Variable                 | Description                                   | Required          |
| ------------------------ | --------------------------------------------- | ----------------- |
| `BOB_API_KEY`          | IBM Bob API key for report generation         | **Yes**     |
| `FRED_API_KEY`         | FRED API key for US yield curves              | For bond analysis |
| `RISK_FREE_RATE_INDIA` | Risk-free rate for India (default:`0.065`)  | No                |
| `RISK_FREE_RATE_US`    | Risk-free rate for US (default:`0.05`)      | No                |
| `LOG_LEVEL`            | Logging level: DEBUG / INFO / WARNING / ERROR | No                |

---

## CLI Usage

All commands are run from the **project root** (`/Users/surajchakraborty/git/StocksAgent`).

### Single stock report

```bash
# Indian stock — saved to reports/NETWEB.pdf
python -m nxtvue.main NETWEB --market india --year 2026 --output

# US stock — saved to reports/AAPL.pdf
python -m nxtvue.main AAPL --market us --year 2026 --output

# Default market is india — --market can be omitted for Indian stocks
python -m nxtvue.main LUPIN --year 2026 --output
```

### Batch mode

```bash
# Multiple Indian stocks — one PDF per ticker
python -m nxtvue.main NETWEB LUPIN TCS --market india --output

# Mixed markets using TICKER:market syntax
python -m nxtvue.main NETWEB:india AAPL:us TCS:india MSFT:us --output
```

### Watchlist mode

```bash
# Run all tickers in watchlist.txt
python -m nxtvue.main --watchlist watchlist.txt --output
```

`watchlist.txt` format — one ticker per line, `#` = comment:

```
STLTECH:india
MCX:india
AAPL:us
# This line is ignored
```

### Compare mode

```bash
# Side-by-side comparison — saved to reports/NETWEB_vs_KPIT.pdf
python -m nxtvue.main NETWEB KPIT --compare --market india --output

# US stocks
python -m nxtvue.main AAPL MSFT --compare --market us --output
```

### Portfolio mode

```bash
# Analyse holdings from spreadsheet — saved to reports/PORTFOLIO.pdf
python -m nxtvue.main --portfolio holdings.xlsx --output
```

`holdings.xlsx` required columns:

| Column       | Example    | Notes                            |
| ------------ | ---------- | -------------------------------- |
| `ticker`   | `NETWEB` | Stock symbol                     |
| `qty`      | `10`     | Number of shares                 |
| `avg_cost` | `3200`   | Average buy price                |
| `market`   | `india`  | Optional — defaults to`india` |

### CLI flags reference

| Flag                  | Description                                                               |
| --------------------- | ------------------------------------------------------------------------- |
| `TICKER[:market]`   | One or more stock symbols; append`:india` or `:us` to override market |
| `--market india\|us` | Default market when no`:market` suffix given (default: `india`)       |
| `--year YYYY`       | Projection year for the report (default:`2026`)                         |
| `--output [FILE]`   | Save as PDF; no value →`reports/<TICKER>.pdf`                          |
| `--watchlist FILE`  | Load tickers from a text file                                             |
| `--compare`         | Side-by-side report for exactly 2 tickers                                 |
| `--portfolio FILE`  | Load a holdings`.xlsx`/`.csv` and generate a portfolio report         |

---

## API Server

```bash
cd apps/backend
uvicorn nxtvue.api.server:app --reload --port 8000
```

### Endpoints

| Method   | Path                           | Description                     |
| -------- | ------------------------------ | ------------------------------- |
| `GET`  | `/health`                    | Health check                    |
| `GET`  | `/api/indices`               | Market index snapshot           |
| `POST` | `/api/v1/analysis/stock`     | Single stock analysis + report  |
| `POST` | `/api/v1/analysis/compare`   | Side-by-side comparison report  |
| `POST` | `/api/v1/analysis/portfolio` | Portfolio analysis report       |
| `GET`  | `/api/v1/reports/{filename}` | Download a generated PDF report |

---

## Report Contents

### Single stock report (12 sections)

1. Business quality & sector positioning
2. Financial performance (annual + quarterly)
3. Balance-sheet analysis
4. Order book & revenue visibility
5. Shareholding pattern
6. Valuation (P/E, P/B, ROCE, ROE, peer comparison)
7. End-year projection — bear / base / bull scenarios
8. Growth potential vs stock-return potential
9. Key risks + forensic red flags
10. Bullish monitoring triggers
11. Bearish monitoring triggers
12. Technical trading signals (MACD, Bollinger Bands, OBV, RSI, Golden/Death Cross, Breakout/Breakdown)

→ **Final investment judgement**

### Compare report (A vs B)

- Summary verdict
- Head-to-head scorecard table
- Business / Financial / Valuation / Shareholding / Risk sections
- End-year projection for each
- Which stock for which investor
- Final verdict

### Portfolio report

- Portfolio snapshot table (all holdings with P&L)
- Key statistics (total invested / current value / P&L / return %)
- Allocation analysis (weights, concentration flags)
- Risk assessment
- Individual stock stances (hold / trim / add)
- Rebalancing recommendations
- Final portfolio verdict

---

## Output files

| Path                       | Content                             |
| -------------------------- | ----------------------------------- |
| `reports/<TICKER>.pdf`   | Single / batch reports (auto-named) |
| `reports/<A>_vs_<B>.pdf` | Compare reports                     |
| `reports/PORTFOLIO.pdf`  | Portfolio report                    |
| `<custom path>`          | Any path passed to`--output FILE` |

---

## Development

```bash
cd apps/backend

# Run tests
pytest

# Format code
black src/
ruff check src/ --fix

# Type check
mypy src/
```

---

## Roadmap

See [`docs/myPlan.md`](docs/myPlan.md) for the full architecture evolution plan. The high-level phases are:

| Phase                | Focus                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------- |
| **Phase 1** ✅ | Stocks (India + US), ETF, MF, Bond, CLI, PDF                                              |
| **Phase 2**    | Better data: AMC factsheets, AMFI TER, SEC filings, US Treasury, FINRA, source provenance |
| **Phase 3**    | Independent Quant/Risk Engine (Sharpe, Sortino, Beta, VaR, CVaR, Tracking Error)          |
| **Phase 4**    | Portfolio Intelligence (overlap detection, exposure, concentration, suitability)          |
| **Phase 5**    | Self-improving agent (thesis tracking, recommendation feedback loop, alerts)              |

---

## License

MIT
