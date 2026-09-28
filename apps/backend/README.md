# NXTvue — Backend

Multi-asset investment analysis (Stocks, ETFs, Mutual Funds, Bonds) with quantitative analyzers and AI-powered report generation.

## Architecture

```
apps/backend/
├── pyproject.toml          # Package configuration
├── src/
│   └── nxtvue/             # Main package
│       ├── __init__.py
│       ├── config/         # Settings & configuration
│       ├── analyzers/      # Quant, Risk, Portfolio analyzers
│       ├── providers/      # Data providers & normalizers
│       ├── schemas/        # Pydantic models & data contracts
│       ├── tools/          # Data layer implementations
│       ├── portfolio_analyser.py
│       ├── report_generator.py
│       └── pdf_writer.py
├── tests/                  # Unit & integration tests
├── scripts/                # Utility scripts
└── .env.example            # Environment variables template
```

## Quick Start

```bash
# Install in development mode
cd apps/backend
pip install -e ".[dev]"

# Copy environment template
cp .env.example .env
# Edit .env with your API keys

# Run CLI analysis
python -m nxtvue.main NETWEB --market india
python -m nxtvue.main AAPL:us

# Run API server
uvicorn nxtvue.api.server:app --reload --port 8000
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BOB_API_KEY` | LLM API key for report generation | Yes |
| `FRED_API_KEY` | FRED API for US yield curves | For bond analysis |
| `RISK_FREE_RATE_INDIA` | Risk-free rate for India (default: 0.065) | No |
| `RISK_FREE_RATE_US` | Risk-free rate for US (default: 0.05) | No |
| `LOG_LEVEL` | Logging level (DEBUG, INFO, WARNING, ERROR) | No |

## CLI Commands

```bash
# Single stock analysis
python -m nxtvue.main NETWEB --market india --year 2026

# Batch from watchlist
python -m nxtvue.main --watchlist watchlist.txt

# Compare two stocks
python -m nxtvue.main NETWEB LUPIN --compare

# Portfolio analysis
python -m nxtvue.main --portfolio holdings.xlsx

# Generate holdings template
python -m nxtvue.main --create-holdings-template

# ETF analysis (future)
python -m nxtvue.main NIFTYBEES --asset-type etf

# Mutual Fund analysis (future)
python -m nxtvue.main "SBI Bluechip Fund" --asset-type mf

# Bond analysis (future)
python -m nxtvue.main "india-10y" --asset-type bond --market india
```

## API Endpoints (Future)

```
POST   /api/v1/analysis/stock     # Stock analysis
POST   /api/v1/analysis/etf       # ETF analysis
POST   /api/v1/analysis/mf        # Mutual Fund analysis
POST   /api/v1/analysis/bond      # Bond analysis
POST   /api/v1/portfolio/analyze  # Portfolio analysis
GET    /api/v1/health             # Health check
```

## Development

```bash
# Run tests
pytest

# Format code
black src/
ruff check src/ --fix

# Type check
mypy src/
```

## Data Flow

```
TICKER → Data Layer → Quant Analyzer → Risk Analyzer → Compact Data → Bob LLM → PDF
                    ↓
            Portfolio Analyzer (for portfolio mode)
```

## Analyzers

- **QuantAnalyzer**: Returns, risk metrics, alpha/beta, tracking error, valuation percentiles
- **RiskAnalyzer**: Contextual risk labels, drawdown analysis, up/down capture
- **PortfolioAnalyzer**: Overlap, concentration, cross-asset allocation, diversification score

## Data Layers

- `screener_layer.py` — Indian stocks (screener.in)
- `yfinance_layer.py` — US stocks & global (Yahoo Finance)
- `etf_layer.py` — ETFs (extends yfinance)
- `mutual_fund_layer.py` — MFs (AMFI, mftool, SEBI)
- `bond_layer.py` — Bonds (US Treasury, FRED, RBI/FBIL)

## License

MIT