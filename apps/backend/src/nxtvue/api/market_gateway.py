"""Market gateway: history, symbol resolution and native technicals.

Feeds the Lightweight Charts engine (NSE/BSE and any symbol the TradingView
widgets cannot render) and gives the frontend one cached, validated source.
"""

import asyncio
import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market", tags=["market"])

# interval -> (allowed range_period values, default range_period)
_INTERVALS: Dict[str, Tuple[Tuple[str, ...], str]] = {
    "5m": (("1d", "5d", "1mo"), "5d"),
    "15m": (("1d", "5d", "1mo"), "1mo"),
    "60m": (("5d", "1mo", "3mo", "6mo", "1y"), "3mo"),
    "1d": (("1mo", "3mo", "6mo", "1y", "2y", "5y", "max"), "1y"),
    "1wk": (("6mo", "1y", "2y", "5y", "max"), "5y"),
    "1mo": (("1y", "2y", "5y", "max"), "max"),
}
_INTRADAY = {"5m", "15m", "60m"}
_MARKETS = {"india", "us"}
_SYMBOL_RE = re.compile(r"^[A-Z0-9&\-\.\^=_]{1,24}$")

# Yahoo exchange code -> TradingView exchange prefix
_YAHOO_TO_TV = {
    "NMS": "NASDAQ", "NGM": "NASDAQ", "NCM": "NASDAQ", "NIM": "NASDAQ",
    "NYQ": "NYSE", "PCX": "NYSE ARCA", "ASE": "AMEX", "BTS": "BATS",
    "NSI": "NSE", "BSE": "BSE", "BOM": "BSE",
}

# (value, fetched_at)
_history_cache: Dict[Tuple[str, str, str, str], Tuple[Dict[str, Any], float]] = {}
_resolve_cache: Dict[Tuple[str, str], Tuple[Dict[str, Any], float]] = {}
_HISTORY_TTL = {"5m": 30, "15m": 60, "60m": 120}
_HISTORY_TTL_DEFAULT = 300
_RESOLVE_TTL = 24 * 3600
_CACHE_MAX = 512


def _evict(cache: Dict, ttl_for) -> None:
    """Drop expired entries, then oldest ones, so the cache cannot grow unbounded."""
    if len(cache) <= _CACHE_MAX:
        return
    now = time.time()
    for key in [k for k, (_, ts) in cache.items() if now - ts > ttl_for(k)]:
        cache.pop(key, None)
    while len(cache) > _CACHE_MAX:
        cache.pop(min(cache, key=lambda k: cache[k][1]), None)


def _clean_symbol(raw: str) -> str:
    sym = (raw or "").strip().upper()
    if not _SYMBOL_RE.match(sym):
        raise HTTPException(status_code=422, detail=f"Invalid symbol: {raw!r}")
    return sym


def _yahoo_candidates(symbol: str, market: str) -> List[str]:
    if market == "india":
        clean = re.sub(r"\.(NS|BO)$", "", symbol)
        return [f"{clean}.NS", f"{clean}.BO"]
    return [symbol]


def _bar_time(idx: Any, intraday: bool) -> Any:
    """Daily bars use YYYY-MM-DD; intraday bars use epoch seconds (UTC)."""
    if intraday:
        return int(pd.Timestamp(idx).timestamp())
    return pd.Timestamp(idx).strftime("%Y-%m-%d")


def _fetch_history(symbol: str, market: str, interval: str, range_period: str) -> Dict[str, Any]:
    import yfinance as yf

    intraday = interval in _INTRADAY
    for yt in _yahoo_candidates(symbol, market):
        try:
            hist = yf.Ticker(yt).history(period=range_period, interval=interval)
        except Exception as exc:  # network / provider failure: try the next listing
            logger.debug("history fetch failed for %s: %s", yt, exc)
            continue
        if hist is None or hist.empty:
            continue
        hist = hist.dropna(subset=["Open", "High", "Low", "Close"])
        candles = [
            {
                "time": _bar_time(idx, intraday),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row.get("Volume", 0) or 0),
            }
            for idx, row in hist.iterrows()
        ]
        if candles:
            currency = None
            try:
                currency = yf.Ticker(yt).fast_info.currency
            except Exception:
                pass
            return {"yahoo_symbol": yt, "currency": currency, "candles": candles}
    return {"yahoo_symbol": None, "currency": None, "candles": []}


async def _history(symbol: str, market: str, interval: str, range_period: str) -> Dict[str, Any]:
    key = (symbol, market, interval, range_period)
    ttl = _HISTORY_TTL.get(interval, _HISTORY_TTL_DEFAULT)
    hit = _history_cache.get(key)
    if hit and time.time() - hit[1] < ttl:
        return hit[0]
    loop = asyncio.get_running_loop()
    data = await loop.run_in_executor(None, _fetch_history, symbol, market, interval, range_period)
    if data["candles"]:  # never cache failures
        _history_cache[key] = (data, time.time())
        _evict(_history_cache, lambda k: _HISTORY_TTL.get(k[2], _HISTORY_TTL_DEFAULT))
    return data


def _validate_params(market: str, interval: str, range_period: Optional[str]) -> Tuple[str, str, str]:
    market = market.lower()
    if market not in _MARKETS:
        raise HTTPException(status_code=422, detail=f"market must be one of {sorted(_MARKETS)}")
    if interval not in _INTERVALS:
        raise HTTPException(status_code=422, detail=f"interval must be one of {sorted(_INTERVALS)}")
    allowed, default = _INTERVALS[interval]
    rng = range_period or default
    if rng not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"range_period for interval {interval} must be one of {list(allowed)}",
        )
    return market, interval, rng


@router.get("/history")
async def get_market_history(
    symbol: str = Query(..., description="Stock symbol, e.g. RELIANCE, GVT&D, NVDA"),
    market: str = Query("india", description="india or us"),
    interval: str = Query("1d", description="5m, 15m, 60m, 1d, 1wk, 1mo"),
    range_period: Optional[str] = Query(None, description="Defaults per interval"),
):
    """OHLCV candles. 404 when the symbol has no data, 422 on bad parameters."""
    sym = _clean_symbol(symbol)
    market, interval, rng = _validate_params(market, interval, range_period)
    data = await _history(sym, market, interval, rng)
    if not data["candles"]:
        raise HTTPException(status_code=404, detail=f"No price data found for {sym} ({market})")
    return {
        "symbol": sym,
        "market": market,
        "interval": interval,
        "range_period": rng,
        "yahoo_symbol": data["yahoo_symbol"],
        "currency": data["currency"],
        "candles": data["candles"],
        "count": len(data["candles"]),
    }


# ---------------------------------------------------------------------------
# Symbol resolution (TradingView exchange prefix for non-India symbols)
# ---------------------------------------------------------------------------

def _resolve_blocking(symbol: str) -> Optional[Dict[str, Any]]:
    import yfinance as yf

    try:
        fi = yf.Ticker(symbol).fast_info
        code = fi.exchange
        price = fi.last_price
    except Exception:
        return None
    if not code or price is None:
        return None
    exchange = _YAHOO_TO_TV.get(code)
    if not exchange:
        return None
    return {"symbol": symbol, "exchange": exchange, "tv_symbol": f"{exchange}:{symbol}", "currency": fi.currency}


@router.get("/resolve")
async def resolve_symbol(symbol: str = Query(...), market: str = Query("us")):
    """Map a bare ticker to its TradingView exchange-qualified symbol."""
    sym = _clean_symbol(symbol)
    market = market.lower()
    if market not in _MARKETS:
        raise HTTPException(status_code=422, detail=f"market must be one of {sorted(_MARKETS)}")
    key = (sym, market)
    hit = _resolve_cache.get(key)
    if hit and time.time() - hit[1] < _RESOLVE_TTL:
        return hit[0]
    if market == "india":
        out = {"symbol": re.sub(r"\.(NS|BO)$", "", sym), "exchange": "NSE", "tv_symbol": None, "currency": "INR"}
        # NSE/BSE are not renderable in TradingView widgets; the native engine is used.
        _resolve_cache[key] = (out, time.time())
        return out
    loop = asyncio.get_running_loop()
    out = await loop.run_in_executor(None, _resolve_blocking, sym)
    if not out:
        raise HTTPException(status_code=404, detail=f"Could not resolve {sym} to a listed exchange")
    _resolve_cache[key] = (out, time.time())
    _evict(_resolve_cache, lambda _k: _RESOLVE_TTL)
    return out


# ---------------------------------------------------------------------------
# Native technicals
# ---------------------------------------------------------------------------

def _rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - 100 / (1 + rs)
    return rsi.where(loss != 0, 100.0)


def compute_technicals(closes: List[float]) -> Dict[str, Any]:
    """Score trend and momentum from closing prices. Pure function (unit-testable)."""
    close = pd.Series(closes, dtype="float64")
    n = len(close)
    if n < 30:
        raise ValueError("Need at least 30 daily candles")

    last = float(close.iloc[-1])
    sma20 = close.rolling(20).mean().iloc[-1]
    sma50 = close.rolling(50).mean().iloc[-1] if n >= 50 else np.nan
    sma200 = close.rolling(200).mean().iloc[-1] if n >= 200 else np.nan
    rsi = float(_rsi(close).iloc[-1])

    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    macd_hist = float((macd_line - signal_line).iloc[-1])

    # Each vote is +1 (bullish), -1 (bearish) or 0 (neutral / unavailable)
    votes: Dict[str, int] = {}
    votes["rsi"] = 1 if rsi < 30 else -1 if rsi > 70 else (1 if rsi >= 55 else -1 if rsi <= 45 else 0)
    votes["macd"] = 1 if macd_hist > 0 else -1 if macd_hist < 0 else 0
    votes["price_vs_sma20"] = 1 if last > sma20 else -1
    if not np.isnan(sma50):
        votes["price_vs_sma50"] = 1 if last > sma50 else -1
    if not np.isnan(sma200):
        votes["price_vs_sma200"] = 1 if last > sma200 else -1
    if not np.isnan(sma50) and not np.isnan(sma200):
        votes["sma50_vs_sma200"] = 1 if sma50 > sma200 else -1

    score = sum(votes.values()) / len(votes)
    if score >= 0.6:
        label = "Strong Buy"
    elif score >= 0.2:
        label = "Buy"
    elif score > -0.2:
        label = "Neutral"
    elif score > -0.6:
        label = "Sell"
    else:
        label = "Strong Sell"

    def r(x: float) -> Optional[float]:
        return None if np.isnan(x) else round(float(x), 2)

    return {
        "signal": label,
        "score": round(score, 2),
        "price": round(last, 2),
        "rsi14": round(rsi, 1),
        "macd_histogram": round(macd_hist, 3),
        "sma20": r(sma20),
        "sma50": r(sma50),
        "sma200": r(sma200),
        "votes": votes,
        "candles_used": n,
    }


@router.get("/technicals/{symbol}")
async def get_technicals(symbol: str, market: str = Query("india")):
    """Signal computed from daily candles (RSI, MACD, SMA 20/50/200)."""
    sym = _clean_symbol(symbol)
    market, interval, rng = _validate_params(market, "1d", "2y")
    data = await _history(sym, market, interval, rng)
    if not data["candles"]:
        raise HTTPException(status_code=404, detail=f"No price data found for {sym} ({market})")
    try:
        result = compute_technicals([c["close"] for c in data["candles"]])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"symbol": sym, "market": market, "currency": data["currency"], **result}
