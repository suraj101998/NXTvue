"""Live quote, market tape and US company fundamentals for the Charts page (yfinance)."""

import logging
import math
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from .india_data import _cached
from .market_gateway import _MARKETS, _clean_symbol, _yahoo_candidates

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market", tags=["market-live"])

# label -> (yahoo symbol, display name, decimals)
TAPE: Dict[str, Dict[str, Any]] = {
    "SPX500": {"yahoo": "^GSPC", "name": "S&P 500", "dp": 2},
    "NAS100": {"yahoo": "^NDX", "name": "Nasdaq 100", "dp": 2},
    "USDINR": {"yahoo": "INR=X", "name": "USD / INR", "dp": 3},
    "XAUUSD": {"yahoo": "GC=F", "name": "Gold", "dp": 2},
    "USOIL": {"yahoo": "CL=F", "name": "WTI Crude", "dp": 2},
    "BTCUSD": {"yahoo": "BTC-USD", "name": "Bitcoin", "dp": 0},
}

_TTL_QUOTE = 5
_TTL_TAPE = 15
_TTL_FUNDAMENTALS = 6 * 3600


def _num(x: Any) -> Optional[float]:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(v) or math.isinf(v) else v


def _fast_quote(yahoo_symbol: str) -> Optional[Dict[str, Any]]:
    import yfinance as yf

    try:
        fi = yf.Ticker(yahoo_symbol).fast_info
        price = _num(fi.last_price)
        prev = _num(fi.previous_close)
        if price is None:
            return None
        return {
            "yahoo_symbol": yahoo_symbol,
            "price": price,
            "prevClose": prev,
            "open": _num(fi.open),
            "high": _num(fi.day_high),
            "low": _num(fi.day_low),
            "volume": _num(fi.last_volume),
            "high52w": _num(fi.year_high),
            "low52w": _num(fi.year_low),
            "currency": fi.currency,
            "exchange": fi.exchange,
        }
    except Exception as exc:  # provider failure: caller treats as no quote
        logger.debug("fast_info failed for %s: %s", yahoo_symbol, exc)
        return None


def _quote_blocking(symbol: str, market: str) -> Optional[Dict[str, Any]]:
    for yt in _yahoo_candidates(symbol, market):
        q = _fast_quote(yt)
        if q:
            return q
    return None


@router.get("/quote")
async def get_quote(symbol: str = Query(...), market: str = Query("us")):
    """Live last price, previous close, open, day range, volume and 52-week range."""
    sym = _clean_symbol(symbol)
    market = market.lower()
    if market not in _MARKETS:
        raise HTTPException(status_code=422, detail=f"market must be one of {sorted(_MARKETS)}")

    def fetch() -> Dict[str, Any]:
        q = _quote_blocking(sym, market)
        if not q:
            raise LookupError(sym)
        return q

    try:
        data, stale = await _cached(("quote", sym, market), _TTL_QUOTE, fetch)
    except HTTPException as exc:
        if exc.status_code == 502:
            raise HTTPException(status_code=404, detail=f"No quote found for {sym} ({market})") from exc
        raise
    return {"symbol": sym, "market": market, "stale": stale, **data}


@router.get("/tape")
async def get_tape():
    """Live cross-asset tape: index, FX, gold, oil and bitcoin."""

    def one(label: str) -> Dict[str, Any]:
        meta = TAPE[label]
        q = _fast_quote(meta["yahoo"])
        row: Dict[str, Any] = {"label": label, "name": meta["name"], "dp": meta["dp"]}
        if q and q["price"] is not None and q["prevClose"]:
            row["price"] = q["price"]
            row["changePct"] = (q["price"] - q["prevClose"]) / q["prevClose"] * 100
        return row

    def fetch() -> List[Dict[str, Any]]:
        rows = [one(k) for k in TAPE]
        if not any("price" in r for r in rows):
            raise LookupError("tape unavailable")
        return rows

    rows, stale = await _cached(("tape",), _TTL_TAPE, fetch)
    return {"stale": stale, "items": [r for r in rows if "price" in r]}


# ---------------------------------------------------------------------------
# US company profile + fundamentals
# ---------------------------------------------------------------------------

_CF_ROWS = {
    "operating": "Operating Cash Flow",
    "investing": "Investing Cash Flow",
    "financing": "Financing Cash Flow",
    "freeCashFlow": "Free Cash Flow",
    "capex": "Capital Expenditure",
}


def _ttm_cashflow(tk: Any) -> Dict[str, Optional[float]]:
    """Trailing-twelve-month cash flow: the sum of the latest four quarters."""
    out: Dict[str, Optional[float]] = {k: None for k in _CF_ROWS}
    try:
        q = tk.quarterly_cashflow
    except Exception:
        return out
    if q is None or q.empty:
        return out
    cols = list(q.columns)[:4]
    if len(cols) < 4:
        return out
    for key, row in _CF_ROWS.items():
        if row in q.index:
            vals = [_num(q.loc[row, c]) for c in cols]
            if all(v is not None for v in vals):
                out[key] = float(sum(vals))
    return out


def _date(ts: Any) -> Optional[str]:
    v = _num(ts)
    if v is None:
        return None
    import datetime as dt

    return dt.datetime.fromtimestamp(v, dt.timezone.utc).strftime("%Y-%m-%d")


def _us_fundamentals(symbol: str) -> Dict[str, Any]:
    import yfinance as yf

    tk = yf.Ticker(symbol)
    info = tk.info or {}
    if not (info.get("longName") or info.get("shortName")):
        raise LookupError(symbol)
    price_to_cf = None
    cf = _ttm_cashflow(tk)
    cap = _num(info.get("marketCap"))
    if cap and cf["operating"]:
        price_to_cf = cap / cf["operating"]
    price_to_fcf = cap / cf["freeCashFlow"] if cap and cf["freeCashFlow"] else None
    city = ", ".join(x for x in (info.get("city"), info.get("state") or info.get("country")) if x)
    return {
        "name": info.get("longName") or info.get("shortName"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "employees": info.get("fullTimeEmployees"),
        "description": info.get("longBusinessSummary"),
        "headquarters": city or None,
        "website": info.get("website"),
        "ratios": {
            "marketCap": cap,
            "enterpriseValue": _num(info.get("enterpriseValue")),
            "evToEbitda": _num(info.get("enterpriseToEbitda")),
            "pe": _num(info.get("trailingPE")),
            "ps": _num(info.get("priceToSalesTrailing12Months")),
            "pb": _num(info.get("priceToBook")),
            "priceToCashFlow": price_to_cf,
            "priceToFreeCashFlow": price_to_fcf,
            "revenuePerShare": _num(info.get("revenuePerShare")),
            "eps": _num(info.get("trailingEps")),
            "beta": _num(info.get("beta")),
        },
        "fiscalYearEnd": _date(info.get("lastFiscalYearEnd")),
        "lastPeriod": _date(info.get("mostRecentQuarter")),
        "cashFlow": {"totalRevenue": _num(info.get("totalRevenue")), **cf},
        "margins": {
            "gross": _pct(info.get("grossMargins")),
            "operating": _pct(info.get("operatingMargins")),
            "net": _pct(info.get("profitMargins")),
            "returnOnAssets": _pct(info.get("returnOnAssets")),
            "returnOnEquity": _pct(info.get("returnOnEquity")),
        },
    }


def _pct(x: Any) -> Optional[float]:
    v = _num(x)
    return None if v is None else v * 100


@router.get("/us/fundamentals/{symbol}")
async def us_fundamentals(symbol: str):
    """Company profile, valuation ratios, TTM cash flow and margins for a US-listed symbol."""
    sym = _clean_symbol(symbol)
    if not re.match(r"^[A-Z0-9\-\.]{1,10}$", sym):
        raise HTTPException(status_code=422, detail=f"Invalid US symbol: {symbol!r}")
    try:
        data, stale = await _cached(("usfund", sym), _TTL_FUNDAMENTALS, lambda: _us_fundamentals(sym))
    except HTTPException as exc:
        if exc.status_code == 502:
            raise HTTPException(status_code=404, detail=f"No company data for {sym}") from exc
        raise
    return {"symbol": sym, "stale": stale, **data}

