"""FastAPI server for NXTvue."""

import asyncio
import logging
import os
import time
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..config.settings import settings

logger = logging.getLogger(__name__)

app = FastAPI(
    title="NXTvue API",
    description="Multi-asset investment analysis API",
    version="0.1.0",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory cache for live indices (avoids hammering yfinance on every request)
# ---------------------------------------------------------------------------

_indices_cache: Dict[str, Any] = {}
_indices_last_fetched: float = 0.0

_INDEX_SYMBOLS = {
    "india": [
        ("NIFTY 50",    "^NSEI",    "NSE"),
        ("SENSEX",      "^BSESN",   "BSE"),
        ("NIFTY BANK",  "^NSEBANK", "NSE"),
        ("NIFTY IT",    "^CNXIT",   "NSE"),
        ("NIFTY PHARMA","^CNXPHARMA","NSE"),
        ("NIFTY AUTO",  "^CNXAUTO", "NSE"),
        ("NIFTY FMCG",  "^CNXFMCG", "NSE"),
        ("NIFTY METAL", "^CNXMETAL","NSE"),
    ],
    "us": [
        ("S&P 500",      "^GSPC",  "yfinance"),
        ("NASDAQ",       "^IXIC",  "yfinance"),
        ("DOW JONES",    "^DJI",   "yfinance"),
        ("RUSSELL 2000", "^RUT",   "yfinance"),
    ],
}


def _fetch_live_indices() -> Dict[str, Any]:
    """Fetch live index quotes from yfinance. Returns structured dict."""
    import yfinance as yf

    all_symbols = [sym for group in _INDEX_SYMBOLS.values() for _, sym, _ in group]
    result: Dict[str, List] = {"india": [], "us": []}

    try:
        tickers = yf.Tickers(" ".join(all_symbols))
        for market, entries in _INDEX_SYMBOLS.items():
            for name, sym, source in entries:
                try:
                    info = tickers.tickers[sym].fast_info
                    price = float(getattr(info, "last_price", 0) or 0)
                    prev  = float(getattr(info, "previous_close", price) or price)
                    change = price - prev
                    change_pct = (change / prev * 100) if prev else 0.0
                    result[market].append({
                        "name":      name,
                        "value":     round(price, 2),
                        "change":    round(change, 2),
                        "changePct": round(change_pct, 2),
                        "positive":  change >= 0,
                        "source":    source,
                    })
                except Exception as exc:
                    logger.debug("Index fetch failed for %s: %s", sym, exc)
                    result[market].append({
                        "name": name, "value": 0.0,
                        "change": 0.0, "changePct": 0.0,
                        "positive": True, "source": source,
                    })
    except Exception as exc:
        logger.warning("Live indices fetch failed: %s", exc)

    return result


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class IndexQuote(BaseModel):
    name: str
    value: float
    change: float
    changePct: float
    positive: bool
    source: str


class IndicesData(BaseModel):
    india: List[IndexQuote]
    us: List[IndexQuote]
    updated_at: int
    cache_ttl: int


class HealthResponse(BaseModel):
    status: str
    version: str
    services: dict


class AnalysisRequest(BaseModel):
    ticker: str
    market: str = "india"
    asset_type: str = "stock"
    projection_year: int = 2026


class AnalysisResponse(BaseModel):
    ticker: str
    market: str
    asset_type: str
    projection_year: int
    final_memo: str
    key_metrics: dict
    pdf_path: Optional[str] = None


class CompareRequest(BaseModel):
    ticker_a: str
    ticker_b: str
    market_a: str = "india"
    market_b: str = "india"
    projection_year: int = 2026


class PortfolioHolding(BaseModel):
    ticker: str
    qty: float
    avg_cost: float
    market: str = "india"


class PortfolioRequest(BaseModel):
    holdings: List[PortfolioHolding]
    projection_year: int = 2026


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        services={
            "database": False,
            "cache": bool(_indices_cache),
            "llm": bool(os.environ.get("BOB_API_KEY")),
            "data_providers": True,
        },
    )


@app.get("/api/indices", response_model=IndicesData)
async def get_indices():
    """Get live market indices (NSE/BSE + US). Cached for `indices_cache_ttl` seconds."""
    global _indices_cache, _indices_last_fetched

    now = time.time()
    ttl = settings.indices_cache_ttl

    if not _indices_cache or (now - _indices_last_fetched) > ttl:
        # Run blocking yfinance call in a thread pool so we don't block the event loop
        loop = asyncio.get_event_loop()
        fresh = await loop.run_in_executor(None, _fetch_live_indices)
        if fresh.get("india") or fresh.get("us"):
            _indices_cache = fresh
            _indices_last_fetched = now

    data = _indices_cache or {"india": [], "us": []}
    return IndicesData(
        india=[IndexQuote(**q) for q in data.get("india", [])],
        us=[IndexQuote(**q) for q in data.get("us", [])],
        updated_at=int(_indices_last_fetched or now),
        cache_ttl=ttl,
    )


@app.post("/api/v1/analysis/stock", response_model=AnalysisResponse)
async def analyze_stock(request: AnalysisRequest):
    """Run full investment analysis for a single stock (synchronous Bob call)."""
    if not os.environ.get("BOB_API_KEY"):
        raise HTTPException(status_code=503, detail="BOB_API_KEY is not configured on the server.")

    from ..report_generator import run_investment_analysis
    from ..pdf_writer import save_pdf

    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(
            None,
            lambda: run_investment_analysis(
                request.ticker,
                market=request.market,
                projection_year=request.projection_year,
            )
        )
    except Exception as exc:
        logger.error("Stock analysis failed for %s: %s", request.ticker, exc)
        raise HTTPException(status_code=500, detail=str(exc))

    # Save PDF in reports/ directory
    pdf_path: Optional[str] = None
    try:
        reports_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "reports")
        os.makedirs(reports_dir, exist_ok=True)
        out_file = os.path.join(reports_dir, f"{request.ticker.upper()}.pdf")
        pdf_path = save_pdf(result["final_memo"], request.ticker, out_file)
    except Exception as exc:
        logger.warning("PDF save failed for %s: %s", request.ticker, exc)

    return AnalysisResponse(
        ticker=result["ticker"],
        market=result["market"],
        asset_type=request.asset_type,
        projection_year=result["projection_year"],
        final_memo=result["final_memo"],
        key_metrics=result.get("key_metrics", {}),
        pdf_path=pdf_path,
    )


@app.post("/api/v1/analysis/compare")
async def analyze_compare(request: CompareRequest):
    """Run side-by-side comparison of two tickers (concurrent data fetch)."""
    if not os.environ.get("BOB_API_KEY"):
        raise HTTPException(status_code=503, detail="BOB_API_KEY is not configured on the server.")

    from ..report_generator import run_compare_analysis
    from ..pdf_writer import save_pdf

    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(
            None,
            lambda: run_compare_analysis(
                request.ticker_a, request.ticker_b,
                market=request.market_a,
                market_b=request.market_b,
                projection_year=request.projection_year,
            )
        )
    except Exception as exc:
        logger.error("Compare analysis failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

    pdf_path: Optional[str] = None
    try:
        reports_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "reports")
        os.makedirs(reports_dir, exist_ok=True)
        a, b = request.ticker_a.upper(), request.ticker_b.upper()
        out_file = os.path.join(reports_dir, f"{a}_vs_{b}.pdf")
        pdf_path = save_pdf(result["final_memo"], f"{a} vs {b}", out_file)
    except Exception as exc:
        logger.warning("PDF save failed for compare: %s", exc)

    return {**result, "pdf_path": pdf_path}


@app.post("/api/v1/analysis/portfolio")
async def analyze_portfolio(request: PortfolioRequest):
    """Analyze a portfolio from an inline holdings list."""
    if not os.environ.get("BOB_API_KEY"):
        raise HTTPException(status_code=503, detail="BOB_API_KEY is not configured on the server.")

    import pandas as pd
    from ..report_generator import run_portfolio_analysis
    from ..pdf_writer import save_pdf
    from ..portfolio_analyser import load_holdings, fetch_current_prices, compute_portfolio_metrics

    # Build a temp DataFrame from the inline payload
    df = pd.DataFrame([h.model_dump() for h in request.holdings])

    loop = asyncio.get_event_loop()
    try:
        holdings_with_prices = await loop.run_in_executor(None, lambda: fetch_current_prices(df))
        metrics = compute_portfolio_metrics(holdings_with_prices)

        import json
        from ..report_generator import PORTFOLIO_SYSTEM_PROMPT, _run_bob, _json_safe
        prompt = (
            f"{PORTFOLIO_SYSTEM_PROMPT}\n\n"
            f"Projection year: {request.projection_year}\n"
            f"Portfolio data (JSON):\n"
            f"{json.dumps(_json_safe(metrics), ensure_ascii=False, default=str)}"
        )
        memo = await loop.run_in_executor(None, lambda: _run_bob(prompt))
    except Exception as exc:
        logger.error("Portfolio analysis failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

    pdf_path: Optional[str] = None
    try:
        reports_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "reports")
        os.makedirs(reports_dir, exist_ok=True)
        out_file = os.path.join(reports_dir, "PORTFOLIO.pdf")
        pdf_path = save_pdf(memo.strip(), "PORTFOLIO", out_file)
    except Exception as exc:
        logger.warning("PDF save failed for portfolio: %s", exc)

    return {
        "type":            "portfolio",
        "projection_year": request.projection_year,
        "metrics":         metrics,
        "final_memo":      memo.strip(),
        "pdf_path":        pdf_path,
    }


@app.get("/api/v1/reports/{filename}")
async def get_report(filename: str):
    """Serve generated PDF reports."""
    # Sanitize: only allow simple filenames, no path traversal
    safe_name = os.path.basename(filename)
    if safe_name != filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    filepath = os.path.join("reports", safe_name)
    if os.path.exists(filepath):
        return FileResponse(filepath, media_type="application/pdf")
    raise HTTPException(status_code=404, detail="Report not found.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload,
    )
