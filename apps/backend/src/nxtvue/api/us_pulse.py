"""US market pulse and S&P 500 sector heatmap.

Sources (free, unofficial, so every call is cached and may fail):
  - Wikipedia: current S&P 500 members with their GICS sector and sub-industry.
  - Yahoo Finance (yfinance): one batched daily download for every member, the sector ETFs,
    the major indices, the VIX and the macro series.

One snapshot feeds both endpoints. If a refresh fails, the last good snapshot is served
(flagged ``stale``) instead of an error.
"""

import asyncio
import datetime as dt
import io
import logging
import math
import time
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import requests
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market/us", tags=["us"])

_WIKI_SP500 = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
_LOGO_URL = "https://images.financialmodelingprep.com/symbol/{symbol}.png"
_TTL_MEMBERS = 24 * 3600
_TTL_SNAPSHOT = 60
_NY = ZoneInfo("America/New_York")

INDICES: Dict[str, str] = {
    "S&P 500": "^GSPC",
    "NASDAQ": "^IXIC",
    "DOW JONES": "^DJI",
    "RUSSELL 2000": "^RUT",
}
VIX = "^VIX"
# Stand-ins for FII/DII style flow: there is no free daily US fund-flow feed, so these show
# where money is moving (yields, dollar, gold, oil, crypto).
MACRO: Dict[str, str] = {
    "US 10Y yield": "^TNX",
    "US dollar index": "DX-Y.NYB",
    "Gold": "GC=F",
    "WTI crude": "CL=F",
    "Bitcoin": "BTC-USD",
}
# SPDR sector ETF -> GICS sector
SECTOR_ETFS: Dict[str, str] = {
    "XLK": "Information Technology",
    "XLF": "Financials",
    "XLV": "Health Care",
    "XLY": "Consumer Discretionary",
    "XLP": "Consumer Staples",
    "XLC": "Communication Services",
    "XLI": "Industrials",
    "XLE": "Energy",
    "XLU": "Utilities",
    "XLRE": "Real Estate",
    "XLB": "Materials",
}


def _num(x: Any) -> Optional[float]:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(v) or math.isinf(v) else v


def _members() -> List[Dict[str, str]]:
    import pandas as pd

    r = requests.get(_WIKI_SP500, headers={"User-Agent": _UA}, timeout=20)
    r.raise_for_status()
    df = pd.read_html(io.StringIO(r.text))[0]
    rows = [
        {
            "symbol": str(row["Symbol"]).strip().replace(".", "-"),  # Yahoo writes BRK-B
            "name": str(row["Security"]),
            "sector": str(row["GICS Sector"]),
            "subIndustry": str(row["GICS Sub-Industry"]),
        }
        for _, row in df.iterrows()
    ]
    if len(rows) < 400:
        raise RuntimeError(f"S&P 500 list looks wrong ({len(rows)} rows)")
    return rows


def _last_two(series: Any) -> Optional[tuple]:
    """Latest and previous valid value of a price column, or None."""
    vals = [v for v in (_num(x) for x in series) if v is not None]
    return (vals[-1], vals[-2]) if len(vals) >= 2 else None


def _market_status(last_bar: Optional[dt.date]) -> Dict[str, Any]:
    """Regular US hours (9:30-16:00 New York). A weekday with no bar yet today is a holiday."""
    now = dt.datetime.now(_NY)
    in_hours = now.weekday() < 5 and dt.time(9, 30) <= now.time() < dt.time(16, 0)
    open_ = in_hours and last_bar == now.date()
    return {
        "status": "Open" if open_ else "Closed",
        "message": "Regular session" if open_ else "Showing the last completed session",
        "tradeDate": last_bar.isoformat() if last_bar else None,
    }


def _snapshot() -> Dict[str, Any]:
    import yfinance as yf

    members = _cached_members()
    tickers = (
        [m["symbol"] for m in members]
        + list(SECTOR_ETFS)
        + list(INDICES.values())
        + [VIX]
        + list(MACRO.values())
    )
    data = yf.download(
        tickers, period="5d", interval="1d", progress=False, auto_adjust=False, threads=True
    )
    if data is None or data.empty:
        raise RuntimeError("no price data returned")
    close, volume = data["Close"], data["Volume"]

    def move(sym: str) -> Optional[Dict[str, float]]:
        if sym not in close.columns:
            return None
        pair = _last_two(close[sym])
        if not pair or not pair[1]:
            return None
        last, prev = pair
        return {"last": last, "prevClose": prev, "change": last - prev, "changePct": (last - prev) / prev * 100}

    stocks: List[Dict[str, Any]] = []
    for m in members:
        mv = move(m["symbol"])
        if not mv:
            continue
        vol = _num(volume[m["symbol"]].dropna().iloc[-1]) if m["symbol"] in volume.columns and volume[m["symbol"]].notna().any() else None
        stocks.append(
            {
                **m,
                "price": mv["last"],
                "change": mv["change"],
                "changePct": mv["changePct"],
                "prevClose": mv["prevClose"],
                "volume": vol,
                "turnover": mv["last"] * vol if vol else None,
            }
        )
    if len(stocks) < 100:
        raise RuntimeError(f"only {len(stocks)} S&P 500 quotes came back")

    def named(table: Dict[str, str]) -> List[Dict[str, Any]]:
        out = []
        for name, sym in table.items():
            mv = move(sym)
            if mv:
                out.append({"name": name, **mv})
        return out

    vix = move(VIX)
    if vix:
        try:
            fi = yf.Ticker(VIX).fast_info
            vix["high52w"], vix["low52w"] = _num(fi.year_high), _num(fi.year_low)
        except Exception as exc:
            logger.debug("VIX 52-week range unavailable: %s", exc)

    sectors = []
    for etf, sector in SECTOR_ETFS.items():
        mv = move(etf)
        if not mv:
            continue
        inside = [s for s in stocks if s["sector"] == sector]
        sectors.append(
            {
                "name": sector,
                "etf": etf,
                "changePct": mv["changePct"],
                "advances": sum(1 for s in inside if s["changePct"] > 0),
                "declines": sum(1 for s in inside if s["changePct"] < 0),
            }
        )
    sectors.sort(key=lambda s: s["changePct"], reverse=True)

    # Bitcoin trades 24/7 and adds rows equity markets do not have, so date the session by the S&P 500.
    spx = close[INDICES["S&P 500"]].dropna() if INDICES["S&P 500"] in close.columns else close.iloc[:, 0].dropna()
    last_bar = spx.index[-1].date() if len(spx) else None
    return {
        "status": _market_status(last_bar),
        "vix": vix,
        "indices": named(INDICES),
        "macro": named(MACRO),
        "sectors": sectors,
        "stocks": stocks,
        "asOf": dt.datetime.now(dt.timezone.utc).isoformat(),
    }


_members_cache: List[Dict[str, str]] = []
_members_at = 0.0


def _cached_members() -> List[Dict[str, str]]:
    """S&P 500 list, refreshed daily. Runs inside the snapshot thread, so it is synchronous."""
    global _members_cache, _members_at
    if not _members_cache or time.time() - _members_at > _TTL_MEMBERS:
        _members_cache = _members()
        _members_at = time.time()
    return _members_cache


_snap: Optional[Dict[str, Any]] = None
_snap_at = 0.0
_snap_lock = asyncio.Lock()


async def _refresh_snapshot() -> None:
    """Download a new snapshot. One at a time; a failure keeps the previous snapshot."""
    global _snap, _snap_at
    async with _snap_lock:
        if _snap is not None and time.time() - _snap_at < _TTL_SNAPSHOT:
            return  # another caller just refreshed it
        loop = asyncio.get_running_loop()
        try:
            _snap = await loop.run_in_executor(None, _snapshot)
            _snap_at = time.time()
        except Exception as exc:
            logger.warning("US snapshot refresh failed: %s", exc)
            if _snap is None:
                raise HTTPException(status_code=502, detail="Upstream market data is unavailable") from exc


_background: set = set()


async def _get_snapshot() -> Tuple[Dict[str, Any], bool]:
    """Return ``(snapshot, stale)``.

    The download takes ~15 s, so once a snapshot exists it is always served at once and an
    expired one is refreshed in the background. Only the very first call waits.
    """
    if _snap is None:
        await _refresh_snapshot()
    elif time.time() - _snap_at >= _TTL_SNAPSHOT and not _snap_lock.locked():
        task = asyncio.create_task(_refresh_snapshot())
        _background.add(task)
        task.add_done_callback(_background.discard)
    assert _snap is not None
    return _snap, time.time() - _snap_at > 10 * _TTL_SNAPSHOT


@router.get("/pulse")
async def pulse(top: int = Query(5, ge=1, le=15)):
    """US market pulse: status, VIX, S&P 500 breadth, top movers, sector ETFs, rates/dollar/commodities."""
    snap, stale = await _get_snapshot()
    stocks = snap["stocks"]
    by_pct = sorted(stocks, key=lambda s: s["changePct"], reverse=True)

    def row(s: Dict[str, Any]) -> Dict[str, Any]:
        return {"symbol": s["symbol"], "name": s["name"], "price": s["price"], "changePct": s["changePct"], "volume": s["volume"]}

    return {
        "stale": stale,
        "status": snap["status"],
        "vix": snap["vix"],
        "indices": snap["indices"],
        "breadth": {
            "advances": sum(1 for s in stocks if s["changePct"] > 0),
            "declines": sum(1 for s in stocks if s["changePct"] < 0),
            "unchanged": sum(1 for s in stocks if s["changePct"] == 0),
            "count": len(stocks),
        },
        "gainers": [row(s) for s in by_pct[:top]],
        "losers": [row(s) for s in reversed(by_pct[-top:])],
        "sectors": snap["sectors"],
        "macro": snap["macro"],
    }


@router.get("/heatmap")
async def heatmap(sector: Optional[str] = Query(None, description="A GICS sector; omit for the whole S&P 500")):
    """S&P 500 stocks with live price and day change. ``turnover`` (price x volume) sizes the tiles.

    For a single sector the stocks are grouped by GICS sub-industry, otherwise by sector.
    """
    snap, stale = await _get_snapshot()
    stocks = snap["stocks"]
    if sector:
        known = {s["sector"] for s in stocks}
        match = next((k for k in known if k.lower() == sector.lower()), None)
        if not match:
            raise HTTPException(status_code=422, detail=f"sector must be one of {sorted(known)}")
        stocks = [s for s in stocks if s["sector"] == match]
        name = f"S&P 500 {match}"
    else:
        name = "S&P 500"
    out = [
        {
            "symbol": s["symbol"],
            "name": s["name"],
            "sector": s["subIndustry"] if sector else s["sector"],
            "price": s["price"],
            "change": s["change"],
            "changePct": s["changePct"],
            "prevClose": s["prevClose"],
            "volume": s["volume"],
            "turnover": s["turnover"],
            "asOf": None,
            "logo": _LOGO_URL.format(symbol=s["symbol"]),
        }
        for s in stocks
    ]
    return {"index": sector or "SP500", "name": name, "count": len(out), "stale": stale, "stocks": out}
