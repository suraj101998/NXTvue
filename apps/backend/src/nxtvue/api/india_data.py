"""India market data: live NIFTY constituents, quotes, fundamentals and market pulse.

Sources (unofficial public web APIs, so every call is cached, time-limited and may fail):
  - Tickertape: index constituents, batch quotes, company info, quarterly income.
  - NSE: all-indices (India VIX, breadth, sector indices), market status, top movers, FII/DII.

If an upstream call fails, the last good value is served (flagged ``stale``) instead of an error.
"""

import asyncio
import logging
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

import requests
from fastapi import APIRouter, HTTPException, Query

from .market_gateway import _clean_symbol

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market/india", tags=["india"])

_TIMEOUT = 10
_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
_TT_HEADERS = {
    "User-Agent": _UA,
    "Accept": "application/json",
    "Referer": "https://www.tickertape.in/",
    "Origin": "https://www.tickertape.in",
}
_TT_API = "https://api.tickertape.in"
_TT_QUOTES = "https://quotes-api.tickertape.in/quotes"
_NSE = "https://www.nseindia.com"
_NSE_HEADERS = {"User-Agent": _UA, "Accept": "application/json", "Referer": f"{_NSE}/"}

# Heatmap index key -> Tickertape index id. Only indices Tickertape actually serves.
HEATMAP_INDICES: Dict[str, Tuple[str, str]] = {
    "NIFTY50": (".NSEI", "NIFTY 50"),
    "NIFTYBANK": (".NSEBANK", "NIFTY Bank"),
    "NIFTYIT": (".NIFTYIT", "NIFTY IT"),
    "NIFTYAUTO": (".NIFTYAUTO", "NIFTY Auto"),
    "NIFTYFMCG": (".NIFTYFMCG", "NIFTY FMCG"),
    "NIFTY100": (".NIFTY100", "NIFTY 100"),
    "NIFTY200": (".NIFTY200", "NIFTY 200"),
}

# TTLs in seconds
_TTL_QUOTES = 15
_TTL_MEMBERS = 6 * 3600
_TTL_SID = 24 * 3600
_TTL_FUNDAMENTALS = 6 * 3600
_TTL_INDICES = 30
_TTL_STATUS = 30
_TTL_MOVERS = 60
_TTL_FIIDII = 15 * 60
_CACHE_MAX = 1024

_cache: Dict[Tuple, Tuple[Any, float]] = {}
_locks: Dict[Tuple, asyncio.Lock] = {}


def _cache_trim() -> None:
    while len(_cache) > _CACHE_MAX:
        _cache.pop(min(_cache, key=lambda k: _cache[k][1]), None)


async def _cached(key: Tuple, ttl: int, fetch: Callable[[], Any]) -> Tuple[Any, bool]:
    """Return ``(value, stale)``. Fetches in a thread, one fetch per key at a time.

    Failures are never cached. On failure the last good value is returned as stale;
    with none, a 502 is raised.
    """
    hit = _cache.get(key)
    if hit and time.time() - hit[1] < ttl:
        return hit[0], False
    lock = _locks.setdefault(key, asyncio.Lock())
    async with lock:
        hit = _cache.get(key)
        if hit and time.time() - hit[1] < ttl:
            return hit[0], False
        loop = asyncio.get_running_loop()
        try:
            value = await loop.run_in_executor(None, fetch)
        except Exception as exc:
            logger.warning("upstream fetch failed for %s: %s", key, exc)
            if hit:
                return hit[0], True
            raise HTTPException(status_code=502, detail="Upstream market data is unavailable") from exc
        _cache[key] = (value, time.time())
        _cache_trim()
        return value, False


# ---------------------------------------------------------------------------
# Tickertape
# ---------------------------------------------------------------------------

def _tt_get(url: str, params: Optional[Dict[str, Any]] = None) -> Any:
    r = requests.get(url, headers=_TT_HEADERS, params=params, timeout=_TIMEOUT)
    r.raise_for_status()
    body = r.json()
    if isinstance(body, dict) and body.get("success") is False:
        raise RuntimeError(f"tickertape error: {body.get('error')}")
    return body["data"] if isinstance(body, dict) and "data" in body else body


def _tt_members(index_id: str) -> List[Dict[str, Any]]:
    data = _tt_get(f"{_TT_API}/indices/constituents/{index_id}")
    if not data or not data.get("constituents"):
        raise RuntimeError(f"no constituents for {index_id}")
    return [
        {"sid": c["sid"], "symbol": c["ticker"], "name": c.get("name"), "sector": c.get("sector")}
        for c in data["constituents"]
        if c.get("sid") and c.get("ticker")
    ]


def _tt_quotes(sids: List[str]) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    for i in range(0, len(sids), 100):
        for q in _tt_get(_TT_QUOTES, {"sids": ",".join(sids[i:i + 100])}):
            out[q["sid"]] = q
    return out


def _tt_search_sid(symbol: str) -> Optional[Dict[str, Any]]:
    data = _tt_get(f"{_TT_API}/search", {"text": symbol, "types": "stock"})
    for s in data.get("stocks", []):
        if str(s.get("ticker", "")).upper() == symbol:
            return {"sid": s["sid"], "symbol": s["ticker"], "name": s.get("name"), "sector": s.get("sector")}
    return None


async def _sid_for(symbol: str) -> Dict[str, Any]:
    info, _ = await _cached(("sid", symbol), _TTL_SID, lambda: _tt_search_sid(symbol) or {})
    if not info:
        # an empty result is a valid answer but must not be cached for a day
        _cache.pop(("sid", symbol), None)
        raise HTTPException(status_code=404, detail=f"No NSE stock found for {symbol}")
    return info


def _quote_row(q: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "price": q.get("price"),
        "change": q.get("change"),
        "changePct": q.get("dyChange"),
        "prevClose": q.get("c"),
        "open": q.get("o"),
        "high": q.get("h"),
        "low": q.get("l"),
        "volume": q.get("vol"),
        "turnover": q.get("turnover"),
        "high52w": q.get("high52w"),
        "low52w": q.get("low52w"),
        "asOf": q.get("ts"),  # epoch ms
    }


@router.get("/heatmap")
async def heatmap(index: str = Query("NIFTY50", description=f"One of {sorted(HEATMAP_INDICES)}")):
    """Constituents of an NSE index with live price and day change, for a treemap.

    ``turnover`` (traded value) is the size measure; market cap is not in the quote feed.
    """
    key = index.upper().replace(" ", "")
    if key not in HEATMAP_INDICES:
        raise HTTPException(status_code=422, detail=f"index must be one of {sorted(HEATMAP_INDICES)}")
    index_id, label = HEATMAP_INDICES[key]
    members, _ = await _cached(("members", key), _TTL_MEMBERS, lambda: _tt_members(index_id))
    quotes, stale = await _cached(
        ("quotes", key), _TTL_QUOTES, lambda: _tt_quotes([m["sid"] for m in members])
    )
    stocks = []
    for m in members:
        q = quotes.get(m["sid"])
        if not q or q.get("price") is None:
            continue
        stocks.append({**m, **_quote_row(q)})
    if not stocks:
        raise HTTPException(status_code=502, detail="No quotes returned for this index")
    return {"index": key, "name": label, "count": len(stocks), "stale": stale, "stocks": stocks}


@router.get("/quotes")
async def quotes(symbols: str = Query(..., description="Comma separated NSE tickers, max 25")):
    """Live quotes for NSE tickers. Unknown tickers are skipped."""
    syms = list(dict.fromkeys(_clean_symbol(s) for s in symbols.split(",") if s.strip()))
    if not syms:
        raise HTTPException(status_code=422, detail="symbols is empty")
    if len(syms) > 25:
        raise HTTPException(status_code=422, detail="At most 25 symbols per request")

    async def one(sym: str) -> Optional[Dict[str, Any]]:
        try:
            return await _sid_for(sym)
        except HTTPException as exc:
            if exc.status_code == 404:
                return None
            raise

    found = [x for x in await asyncio.gather(*(one(s) for s in syms)) if x]
    if not found:
        return {"stale": False, "quotes": []}
    sids = [f["sid"] for f in found]
    data, stale = await _cached(("quotes-sids", tuple(sids)), _TTL_QUOTES, lambda: _tt_quotes(sids))
    rows = [{"symbol": f["symbol"], "name": f["name"], **_quote_row(data[f["sid"]])} for f in found if f["sid"] in data]
    return {"stale": stale, "quotes": rows}


def _tt_fundamentals(sid: str) -> Dict[str, Any]:
    info = _tt_get(f"{_TT_API}/stocks/info/{sid}")
    ratios = info.get("ratios") or {}
    out: Dict[str, Any] = {
        "name": (info.get("info") or {}).get("name"),
        "description": (info.get("info") or {}).get("description"),
        "sector": (info.get("gic") or {}).get("sector"),
        "industry": (info.get("gic") or {}).get("industry"),
        "isin": info.get("isin"),
        "marketCapLabel": ratios.get("marketCapLabel"),
        "risk": (info.get("labels") or {}).get("risk", {}).get("title"),
        "ratios": {
            "marketCap": ratios.get("marketCap"),  # crore INR
            "pe": ratios.get("pe"),
            "industryPe": ratios.get("indpe"),
            "pb": ratios.get("pb"),
            "industryPb": ratios.get("indpb"),
            "eps": ratios.get("eps"),
            "roe": ratios.get("roe"),
            "beta": ratios.get("beta"),
            "dividendYield": ratios.get("divYield"),
            "industryDividendYield": ratios.get("inddy"),
            "high52w": ratios.get("52wHigh"),
            "low52w": ratios.get("52wLow"),
            "shareholders": ratios.get("nShareholders"),
        },
        "quarters": [],
    }
    try:  # profile is still useful without the income statement
        rows = _tt_get(f"{_TT_API}/stocks/financials/income/{sid}/interim/normal", {"count": 4})
        out["quarters"] = [
            {
                "period": r.get("displayPeriod"),
                "endDate": r.get("endDate"),
                "revenue": r.get("qIncTrev"),
                "operatingProfit": r.get("qIncEbi"),
                "netIncome": r.get("qIncNinc"),
                "eps": r.get("qIncEps"),
            }
            for r in rows
        ]
    except Exception as exc:
        logger.warning("quarterly income unavailable for %s: %s", sid, exc)
    return out


@router.get("/fundamentals/{symbol}")
async def fundamentals(symbol: str):
    """Company profile, key ratios and the last four quarters (amounts in INR crore)."""
    sym = _clean_symbol(symbol)
    sid = (await _sid_for(sym))["sid"]
    data, stale = await _cached(("fund", sid), _TTL_FUNDAMENTALS, lambda: _tt_fundamentals(sid))
    return {"symbol": sym, "stale": stale, **data}


# ---------------------------------------------------------------------------
# NSE
# ---------------------------------------------------------------------------

_nse_session: Optional[requests.Session] = None
_nse_lock = threading.Lock()


def _nse_warm() -> requests.Session:
    s = requests.Session()
    s.headers.update(_NSE_HEADERS)
    s.get(f"{_NSE}/market-data/live-equity-market", timeout=_TIMEOUT)  # sets the cookies NSE requires
    return s


def _nse_get(path: str) -> Any:
    """GET an NSE API path with a cookie-warmed session; re-warm once if NSE rejects it."""
    global _nse_session
    with _nse_lock:
        for attempt in (1, 2):
            if _nse_session is None:
                _nse_session = _nse_warm()
            r = _nse_session.get(f"{_NSE}{path}", timeout=_TIMEOUT)
            if r.status_code == 200:
                try:
                    return r.json()
                except ValueError:
                    pass
            _nse_session = None  # cookies expired or blocked: start over
            if attempt == 2:
                raise RuntimeError(f"NSE {path} returned {r.status_code}")
    raise RuntimeError("unreachable")


def _num(v: Any) -> Optional[float]:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _nse_indices() -> List[Dict[str, Any]]:
    rows = _nse_get("/api/allIndices")["data"]
    return [
        {
            "name": r["index"],
            "last": r.get("last"),
            "change": r.get("variation"),
            "changePct": r.get("percentChange"),
            "open": r.get("open"),
            "high": r.get("high"),
            "low": r.get("low"),
            "prevClose": r.get("previousClose"),
            "advances": _num(r.get("advances")),
            "declines": _num(r.get("declines")),
            "unchanged": _num(r.get("unchanged")),
            "pe": _num(r.get("pe")),
            "pb": _num(r.get("pb")),
            "high52w": r.get("yearHigh"),
            "low52w": r.get("yearLow"),
            "key": r.get("key"),
        }
        for r in rows
        if r.get("index")
    ]


def _nse_status() -> Dict[str, Any]:
    states = _nse_get("/api/marketStatus").get("marketState", [])
    cm = next((s for s in states if s.get("market") == "Capital Market"), states[0] if states else {})
    return {"status": cm.get("marketStatus"), "message": cm.get("marketStatusMessage"), "tradeDate": cm.get("tradeDate")}


def _nse_movers(kind: str) -> Dict[str, Any]:
    body = _nse_get(f"/api/live-analysis-variations?index={kind}")["NIFTY"]
    rows = [
        {
            "symbol": r["symbol"],
            "price": r.get("ltp"),
            "changePct": r.get("perChange"),
            "volume": r.get("trade_quantity"),
        }
        for r in body.get("data", [])
    ]
    return {"asOf": body.get("timestamp"), "rows": rows}


def _nse_fiidii() -> List[Dict[str, Any]]:
    return [
        {
            "category": r["category"],
            "date": r["date"],
            "buy": _num(r["buyValue"]),
            "sell": _num(r["sellValue"]),
            "net": _num(r["netValue"]),
        }
        for r in _nse_get("/api/fiidiiTradeReact")
    ]


@router.get("/pulse")
async def pulse(top: int = Query(5, ge=1, le=15)):
    """India market pulse: status, India VIX, every NSE index with breadth, top movers, FII/DII.

    Each section fails independently: a section that cannot be fetched is ``null``.
    """
    async def section(key: Tuple, ttl: int, fetch: Callable[[], Any]) -> Tuple[Any, bool]:
        try:
            return await _cached(key, ttl, fetch)
        except HTTPException:
            return None, False

    (indices, s1), (status, s2), (gain, s3), (lose, s4), (fii, s5) = await asyncio.gather(
        section(("nse-indices",), _TTL_INDICES, _nse_indices),
        section(("nse-status",), _TTL_STATUS, _nse_status),
        section(("nse-movers", "gainers"), _TTL_MOVERS, lambda: _nse_movers("gainers")),
        section(("nse-movers", "loosers"), _TTL_MOVERS, lambda: _nse_movers("loosers")),
        section(("nse-fiidii",), _TTL_FIIDII, _nse_fiidii),
    )
    if not any([indices, status, gain, lose, fii]):
        raise HTTPException(status_code=502, detail="NSE data is unavailable")
    vix = next((i for i in indices or [] if i["name"] == "INDIA VIX"), None)
    return {
        "stale": any([s1, s2, s3, s4, s5]),
        "status": status,
        "vix": vix,
        "indices": indices,
        "gainers": {"asOf": gain["asOf"], "rows": gain["rows"][:top]} if gain else None,
        "losers": {"asOf": lose["asOf"], "rows": lose["rows"][:top]} if lose else None,
        "fiiDii": fii,
    }
