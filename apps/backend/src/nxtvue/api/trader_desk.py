"""Trader desk: serves the trader-* skills' live results to the Charts page.

Every number comes from a skill function run against live Yahoo, SEC, House Clerk, NSE or Google
News data; nothing is stored or invented here. The skills are NYSE day-trade tools; for
``market=india`` the same skill code runs on a copy rebound to the NSE session (IST, 09:15-15:30,
live NSE holidays, 0.05 tick, rupees), see ``desk_india``.
"""

import concurrent.futures
import datetime
import logging
import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Query

from . import desk_india as di
from . import desk_skills as ds
from .india_data import _cached
from .market_gateway import _MARKETS, _clean_symbol, _history, _yahoo_candidates

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/desk", tags=["trader-desk"])

_TTL_CLOCK = 15
_TTL_TRADE = 15
_TTL_TM = 60
_TTL_NEWS = 120
_TTL_ANALYST = 6 * 3600
_TTL_CONGRESS = 10 * 60
_TTL_SETUPS = 5 * 60
_SCAN_TTL = 30 * 60


NSE_TICKER = re.compile(r"^[A-Z0-9&][A-Z0-9&\-]{0,19}$")
_PLAN_RULE = r"^(or-mid|or-low|pct:[0-9.]+|atr:[0-9.]+|price:[0-9.]+)$"


def _market(raw: str) -> str:
    market = (raw or "us").lower()
    if market not in _MARKETS:
        raise HTTPException(status_code=422, detail=f"market must be one of {sorted(_MARKETS)}")
    return market


def _desk_symbol(raw: str, market: str) -> str:
    """The ticker the day-trade desk accepts: NYSE/Nasdaq for us, an NSE symbol for india."""
    sym = _clean_symbol(raw)
    if market == "india":
        if not NSE_TICKER.match(sym):
            raise HTTPException(status_code=422, detail=f"{sym} is not an NSE symbol")
        return sym
    if not ds.US_TICKER.match(sym):
        raise HTTPException(status_code=422, detail=f"{sym} is not a US ticker: use market=india for NSE stocks")
    return sym


def _local(market: str, obj: Any) -> Any:
    """NSE wording (IST, NSE, rupees) for the skills' New York / NYSE / dollar text."""
    return di.localize(obj) if market == "india" else obj


def _sk(name: str, market: str) -> Any:
    return ds.skill(name, market)


def _fail(exc: Exception, status: int = 502) -> HTTPException:
    return HTTPException(status_code=status, detail=str(exc) or exc.__class__.__name__)


async def _run(key: Tuple, ttl: int, fn, *args) -> Tuple[Any, bool]:
    """Cached blocking call. Skill errors become 502 with the skill's own message."""
    try:
        return await _cached(key, ttl, lambda: fn(*args))
    except HTTPException:
        raise


# ---------------------------------------------------------------------------
# Market clock (trader-alerts)
# ---------------------------------------------------------------------------

def effective_now(now: datetime.datetime, market: str = "us") -> datetime.datetime:
    """The clock the intraday skills should read: now when the session has begun,
    otherwise the close of the previous session (so weekends still show the last day)."""
    al = _sk("alerts", market)
    local = al.to_eastern(now)
    day = local.date()
    s = al.session(day)
    if s and local.time() >= s[0]:
        return now
    day -= datetime.timedelta(days=1)
    for _ in range(15):
        s = al.session(day)
        if s:
            return al.eastern_to_utc(datetime.datetime.combine(day, s[1]))
        day -= datetime.timedelta(days=1)
    return now


def _clock(market: str = "us") -> Dict[str, Any]:
    al = _sk("alerts", market)
    now = ds.utc_now()
    st = al.market_status(now)
    st["utc"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    st["now_local"] = st["now_new_york"]
    st["tz"], st["exchange"] = ("IST", "NSE") if market == "india" else ("ET", "NYSE")
    return _local(market, ds.plain(st))


@router.get("/clock")
async def clock(market: str = Query("us")):
    """Session state: NYSE in New York time (holidays, 1:00 p.m. early closes) or NSE in IST (live holiday list)."""
    market = _market(market)
    data, _ = await _run(("desk-clock", market), _TTL_CLOCK, _clock, market)
    return data


# ---------------------------------------------------------------------------
# Entry timer, exit plan, budget, risk, alerts (one pipeline, one request)
# ---------------------------------------------------------------------------

def _entry_cfg(market: str = "us") -> Dict[str, Any]:
    en = _sk("entry", market)
    cfg = dict(en.DEFAULTS)
    user = ds.trader_config(market)
    for k in cfg:
        if user.get(k):
            cfg[k] = user[k]
    return cfg


def _hhmm_to_bar(hhmm: str, market: str = "us") -> int:
    h, m = hhmm.split(":")
    o = _sk("entry", market).OPEN
    return (int(h) * 60 + int(m) - (o.hour * 60 + o.minute)) // 5


def _entry_inputs(res: Dict[str, Any], market: str = "us") -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """The entry the exit planner needs: the trigger bar, else the last closed bar (plan ahead)."""
    en = _sk("entry", market)
    orr = res.get("opening_range")
    if not orr or not orr.get("complete"):
        return None, res.get("reason") or "the opening range is not set yet"
    trig = res.get("trigger")
    if trig:
        return {"basis": "trigger", "price": trig["price"], "time": trig["time"], "bar": trig["bar_index"]}, None
    last = res.get("last")
    if not last:
        return None, "no closed bar yet to plan from"
    start = datetime.datetime.strptime(last["bar_start"], "%H:%M")
    # Not triggered yet: plan the breakout ahead, entering at the range high (the level that triggers it).
    # A last bar past the entry cutoff (after the close) cannot hold a new entry: plan the last bar that can.
    cutoff = res.get("no_entries_after")
    if cutoff:
        latest = datetime.datetime.strptime(cutoff, "%H:%M") - datetime.timedelta(minutes=5)
        start = min(start, latest)
    end = (start + datetime.timedelta(minutes=5)).time()
    price = res.get("level") if res.get("level") and res["level"] > last["close"] else last["close"]
    basis = "range high (plan ahead)" if price != last["close"] else "last close"
    return {"basis": basis, "price": price, "time": en.ampm(end), "bar": _hhmm_to_bar(start.strftime("%H:%M"), market)}, None


def _plan_from(sym: str, res: Dict[str, Any], entry: Dict[str, Any], stop_rule: str, target_r: float,
               market: str = "us") -> Dict[str, Any]:
    ex = _sk("exit", market)
    orr = res["opening_range"]
    day = datetime.date.fromisoformat(res["date"])
    kind, param = ex.parse_stop(stop_rule)
    t_rule, t_param = ex.parse_target("%gR" % target_r)
    c = ex.compute(entry["price"], kind, param, t_rule, t_param, orr["high"], orr["low"])
    entry_time = ex.parse_clock(entry["time"], "the entry time")
    cfg = {**ex.DEFAULTS, **{k: v for k, v in ds.trader_config(market).items() if k in ex.DEFAULTS and v}}
    flat_by, flat_note = ex.resolve_flat_by(day, None, cfg, entry_time)
    plan = {
        "symbol": sym, "side": "buy", "date": day.isoformat(), "setup": "orb",
        "entry": float(c["entry"]), "entry_time": entry["time"], "entry_bar": entry["bar"], "interval": "5m",
        "opening_range": {"high": orr["high"], "low": orr["low"], "minutes": orr["minutes"]},
        "stop": float(c["stop"]), "stop_rule": kind, "stop_label": c["stop_label"], "stop_detail": c["stop_detail"],
        "target": float(c["target"]), "target_r": float(c["target_r"]), "target_label": c["target_label"],
        "risk_per_share": float(c["risk"]), "reward_risk": float(c["reward_risk"]), "flat_by": flat_by,
        "entry_basis": entry["basis"], "note": ex.NOTE,
    }
    plan["warnings"] = ["Flat-by %s: %s." % (flat_by, flat_note)] if flat_note else []
    return plan


def _trade_blocking(sym: str, budget: Optional[float], max_loss: Optional[float], stop_rule: str, target_r: float,
                    market: str = "us") -> Dict[str, Any]:
    return _local(market, _trade_raw(sym, budget, max_loss, stop_rule, target_r, market))


def _trade_raw(sym: str, budget: Optional[float], max_loss: Optional[float], stop_rule: str, target_r: float,
               market: str) -> Dict[str, Any]:
    en, al = _sk("entry", market), _sk("alerts", market)
    now = ds.utc_now()
    eff = effective_now(now, market)
    today = en.to_eastern(now).date()
    day = en.to_eastern(eff).date()
    chart = en.get_chart(sym, "5m", day, None, today)
    res = en.evaluate(chart, eff, "orb", 15, "5m", None, None, _entry_cfg(market))
    res["symbol"] = sym
    meta = chart.get("meta") or {}
    live = meta.get("regularMarketPrice")
    out: Dict[str, Any] = {
        "symbol": sym, "market": market, "currency": "INR" if market == "india" else "USD",
        "clock": ds.plain(al.market_status(now)),
        "session_date": day.isoformat(),
        "live": {"price": live, "prev_close": chart.get("prev_close"),
                 "time": en.iso(en.utc_of(meta["regularMarketTime"])) if meta.get("regularMarketTime") else None},
        "entry": ds.plain(en.public(res)),
        "plan": None, "plan_error": None, "sizing": None, "order": None, "risk": None, "alerts": None,
    }
    entry, why = _entry_inputs(res, market)
    if not entry:
        out["plan_error"] = why
        return out
    try:
        plan = _plan_from(sym, res, entry, stop_rule, target_r, market)
    except Exception as exc:  # the exit skill's PlanError carries the plain-words reason
        out["plan_error"] = str(exc)
        return out
    out["plan"] = plan
    cfg = ds.trader_config(market)
    cfg = {k: v for k, v in cfg.items() if k != "sec_user_agent"}
    if budget:
        cfg["budget"] = budget
    if max_loss:
        cfg["max_loss_per_trade_usd"] = max_loss
    bud, rk = _sk("budget", market), _sk("risk", market)
    out["limits"] = {k: cfg.get(k, bud.DEFAULTS[k]) for k in (
        "max_loss_per_trade_usd", "max_position_pct", "max_order_usd", "cash_buffer_pct",
        "max_daily_loss_usd", "max_trades_per_day", "min_reward_risk", "no_entries_before", "no_entries_after")}
    out["limits"]["budget"] = cfg.get("budget")
    if cfg.get("budget"):
        try:
            sized = bud.size_trade(plan, cfg, budget=cfg["budget"], price=live, today=day.isoformat() if day == today else None)
        except Exception as exc:
            out["sizing"] = {"error": str(exc)}
        else:
            out["sizing"] = ds.plain(sized)
            order = bud.bracket_order(sized)
            if order:
                out["order"] = ds.plain(order)
                verdict = rk.check([order], cfg, None, {sym: live} if live else {}, None, today.isoformat(), now, None)
                out["risk"] = ds.plain(verdict)
    rules = al.rules_from_plan(plan)
    quotes = {sym: {"price": float(live), "prev_close": chart.get("prev_close"), "open": None}} if live else {}
    rings, _ = al.evaluate(rules, quotes, al.market_status(now), {}, now)
    out["alerts"] = {"rules": ds.plain(rules), "rings": ds.plain(rings)}
    return out


@router.get("/{symbol}/trade")
async def trade(
    symbol: str,
    market: str = Query("us"),
    budget: Optional[float] = Query(None, gt=0, description="Account budget in the market's currency (USD / INR), sizes the position"),
    max_loss: Optional[float] = Query(None, gt=0, description="Max loss per trade in the market's currency"),
    stop: str = Query("or-mid", pattern=_PLAN_RULE),
    target_r: float = Query(2.0, gt=0, le=10),
):
    """Entry timer, exit plan, position size, risk verdict and alert rules for a US or NSE ticker."""
    market = _market(market)
    sym = _desk_symbol(symbol, market)
    data, stale = await _run(("desk-trade", market, sym, budget, max_loss, stop, target_r), _TTL_TRADE,
                             _trade_blocking, sym, budget, max_loss, stop, target_r, market)
    return {"stale": stale, **data}


# ---------------------------------------------------------------------------
# Time machine (trader-timemachine)
# ---------------------------------------------------------------------------

def _tm_blocking(plan: Dict[str, Any], market: str = "us") -> Dict[str, Any]:
    tm = _sk("timemachine", market)
    norm = tm.normalize_plan(plan)
    text = tm.fetch_chart(norm["symbol"])
    doc = tm.time_machine(text, norm, effective_now(ds.utc_now(), market), replays=10000)
    mc = {k: v for k, v in doc["mc"].items() if k != "sample_paths"}
    return _local(market, ds.plain({
        "mc": mc, "history": {k: v for k, v in doc["history"].items() if k != "trades"} | {
            "trades": doc["history"].get("trades", [])[-30:]},
        "verdict": doc["verdict"], "verdict_notes": doc["verdict_notes"], "warnings": doc["warnings"],
        "data": doc["data"], "note": doc["note"], "plan": doc["plan"],
    }))


@router.get("/{symbol}/timemachine")
async def timemachine(
    symbol: str,
    market: str = Query("us"),
    stop: str = Query("or-mid", pattern=_PLAN_RULE),
    target_r: float = Query(2.0, gt=0, le=10),
):
    """10,000 simulated sessions + every past time the setup fired, for the live exit plan."""
    market = _market(market)
    sym = _desk_symbol(symbol, market)
    base, _ = await _run(("desk-trade", market, sym, None, None, stop, target_r), _TTL_TRADE,
                         _trade_blocking, sym, None, None, stop, target_r, market)
    plan = base.get("plan")
    if not plan:
        raise HTTPException(status_code=409, detail=base.get("plan_error") or "no exit plan yet")
    key = ("desk-tm", market, sym, plan["date"], plan["entry"], plan["stop"], plan["target"], plan["entry_bar"])
    data, stale = await _cached(key, _TTL_TM, lambda: _tm_blocking(plan, market))
    return {"stale": stale, **data}


# ---------------------------------------------------------------------------
# News (trader-news): Yahoo headlines + SEC 8-Ks for US, Google News for NSE names
# ---------------------------------------------------------------------------

def _news_blocking(sym: str, market: str, name: Optional[str]) -> Dict[str, Any]:
    ne = ds.skill("news")
    now = ds.utc_now()
    ua = ds.sec_user_agent()
    fetcher = ne.Fetcher(ua)
    errors: List[str] = []
    watch = {sym: name}
    if market == "us":
        items = ne.collect(fetcher, watch, {}, sec=bool(ua), errors=errors)
        moves = ne.collect_moves(fetcher, watch, errors)
        if not ua:
            errors.append("SEC 8-K filings are off: set SEC_USER_AGENT (\"Your Name you@email.com\") to enable them")
    else:
        import urllib.parse

        q = urllib.parse.quote('"%s" when:3d' % (name or sym))
        url = "https://news.google.com/rss/search?q=%s&hl=en-IN&gl=IN&ceid=IN:en" % q
        items, moves = [], []
        try:
            items = ne.parse_rss(fetcher.get(url, "gnews-%s.xml" % sym), sym)
            for it in items:
                it["source"] = "Google News"
                it["summary"] = ""  # Google's description is an HTML link list, not text
        except ne.NewsError as exc:
            errors.append("headlines for %s: %s" % (sym, exc))
    items = ne.dedupe(ne.tag(items, watch))
    aware = now.replace(tzinfo=datetime.timezone.utc)  # news.select compares against aware item times
    items = ne.select(items, {}, aware, hours=24 * 7, show_all=True)[:30]
    return ds.plain({"items": ne._json_ready(items), "moves": [
        dict(m, time=m["time"].isoformat() if m.get("time") else None) for m in moves],
        "errors": errors, "move_pct": ne.MOVE_PCT, "sec_enabled": bool(ua)})


@router.get("/{symbol}/news")
async def news(symbol: str, market: str = Query("us"), name: Optional[str] = Query(None, max_length=80)):
    sym = _clean_symbol(symbol)
    market = market.lower()
    if market not in _MARKETS:
        raise HTTPException(status_code=422, detail=f"market must be one of {sorted(_MARKETS)}")
    if market == "us" and not ds.US_TICKER.match(sym):
        raise HTTPException(status_code=422, detail=f"{sym} is not a US ticker")
    data, stale = await _run(("desk-news", sym, market, name), _TTL_NEWS, _news_blocking, sym, market, name)
    return {"symbol": sym, "market": market, "stale": stale, **data}


# ---------------------------------------------------------------------------
# Earnings analyst (trader-analyst): SEC XBRL when a contact User-Agent is set,
# otherwise the same quarter-by-quarter table from Yahoo's statements.
# ---------------------------------------------------------------------------

_ciks: Dict[str, Tuple[Dict[str, Any], float]] = {}
_ciks_lock = threading.Lock()


def _cik_for(fetcher: Any, an: Any, sym: str) -> Tuple[Optional[str], Optional[str]]:
    with _ciks_lock:
        hit = _ciks.get("map")
        if not hit or time.time() - hit[1] > 24 * 3600:
            _ciks["map"] = (an.ticker_ciks(fetcher), time.time())
    return _ciks["map"][0].get(sym.replace("-", "."), (None, None))


def _pct_change(a: Optional[float], b: Optional[float]) -> Optional[float]:
    return None if a is None or not b else round(100.0 * (a - b) / abs(b), 1)


def _margin(part: Optional[float], whole: Optional[float]) -> Optional[float]:
    return None if part is None or not whole else round(100.0 * part / whole, 1)


def _yahoo_quarters(sym: str, market: str) -> Dict[str, Any]:
    import yfinance as yf

    last_error: Optional[str] = None
    for yt in _yahoo_candidates(sym, market):
        try:
            q = yf.Ticker(yt).quarterly_income_stmt
        except Exception as exc:
            last_error = str(exc)
            continue
        if q is None or q.empty:
            continue

        def row(label: str, col: Any) -> Optional[float]:
            if label not in q.index:
                return None
            v = q.loc[label, col]
            return None if v != v else float(v)

        cols = sorted(q.columns, reverse=True)
        rows = []
        for i, c in enumerate(cols[:4]):
            year_ago = next((o for o in cols if 350 <= (c - o).days <= 380), None)
            rev, gp, oi, ni, eps = (row(k, c) for k in ("Total Revenue", "Gross Profit", "Operating Income", "Net Income", "Diluted EPS"))
            rows.append({
                "end": c.strftime("%Y-%m-%d"), "revenue": rev, "gross_profit": gp, "operating_income": oi,
                "net_income": ni, "eps_diluted": eps,
                "gross_margin": _margin(gp, rev), "operating_margin": _margin(oi, rev), "net_margin": _margin(ni, rev),
                "revenue_yoy": _pct_change(rev, row("Total Revenue", year_ago)) if year_ago is not None else None,
                "net_income_yoy": _pct_change(ni, row("Net Income", year_ago)) if year_ago is not None else None,
                "eps_yoy": _pct_change(eps, row("Diluted EPS", year_ago)) if year_ago is not None else None,
                "derived": False, "fiscal": "",
            })
        if rows:
            return {"source": "Yahoo Finance statements", "entity": None, "rows": rows, "ttm": {}, "filings": None,
                    "note": None, "changes": []}
    raise RuntimeError(last_error or "no quarterly statements for %s" % sym)


def _analyst_blocking(sym: str, market: str) -> Dict[str, Any]:
    an = ds.skill("analyst")
    ua = ds.sec_user_agent()
    if market == "us" and ua:
        try:
            fetcher = an.Fetcher(ua)
            cik, name = _cik_for(fetcher, an, sym)
            if cik:
                cf = fetcher.json(an.FACTS_URL % cik, "companyfacts-CIK%s.json" % cik)
                result = an.analyse(cf, quarters=4, name=name)
                sub = fetcher.json(an.SUBMISSIONS_URL % cik, "submissions-CIK%s.json" % cik)
                filings = an.latest_filings(sub, cik, fetcher)
                return ds.plain({"source": "SEC EDGAR XBRL", "entity": result["entity"], "rows": result["rows"],
                                 "ttm": result["ttm"], "filings": filings, "changes": an.changes(result),
                                 "note": an.stale_note(result, filings)})
        except an.FactsError as exc:
            logger.info("SEC facts unavailable for %s (%s); using Yahoo statements", sym, exc)
    out = _yahoo_quarters(sym, market)
    an_rows = {"rows": out["rows"]}
    out["changes"] = an.changes(an_rows) if out["rows"] else []
    if market == "india":
        out["changes"] = di.localize(out["changes"])
    out["sec_enabled"] = bool(ua)
    return ds.plain(out)


@router.get("/{symbol}/earnings")
async def earnings(symbol: str, market: str = Query("us")):
    """Revenue, margins, net income and EPS by quarter against the same quarter a year earlier."""
    sym = _clean_symbol(symbol)
    market = market.lower()
    if market not in _MARKETS:
        raise HTTPException(status_code=422, detail=f"market must be one of {sorted(_MARKETS)}")
    data, stale = await _run(("desk-earn", sym, market), _TTL_ANALYST, _analyst_blocking, sym, market)
    return {"symbol": sym, "market": market, "stale": stale, **data}


# ---------------------------------------------------------------------------
# Chart-setup flags for any symbol (trader-scanner's find_setups on daily closes)
# ---------------------------------------------------------------------------

@router.get("/{symbol}/setups")
async def setups(symbol: str, market: str = Query("us")):
    """Which scanner setups (20-day breakout, bull flag, 20-day reclaim, oversold, bounce) fire now."""
    sym = _clean_symbol(symbol)
    market = market.lower()
    if market not in _MARKETS:
        raise HTTPException(status_code=422, detail=f"market must be one of {sorted(_MARKETS)}")
    data = await _history(sym, market, "1d", "1y")
    closes = [c["close"] for c in data["candles"]]
    sc = ds.skill("scanner")
    if len(closes) < sc.MIN_DAILY_BARS:
        raise HTTPException(status_code=404, detail=f"Need {sc.MIN_DAILY_BARS} daily closes for {sym}")
    tags, nums = sc.find_setups(closes)
    return {"symbol": sym, "market": market, "setups": tags, "close_date": str(data["candles"][-1]["time"]),
            "labels": dict(sc.SETUPS), "numbers": ds.plain(nums),
            "price": closes[-1]}


# ---------------------------------------------------------------------------
# Market-wide scan (trader-scanner) in the background
# ---------------------------------------------------------------------------

def _new_scan() -> Dict[str, Any]:
    return {"state": "idle", "done": 0, "total": 0, "hits": [], "counts": None, "as_of": None,
            "finished": 0.0, "error": None}


_scans: Dict[str, Dict[str, Any]] = {"us": _new_scan(), "india": _new_scan()}
_scan_lock = threading.Lock()
# Liquidity floors per market: US in dollars, NSE in rupees and shares.
_SCAN_FLOORS = {"us": (5.0, 1_000_000), "india": (50.0, 500_000)}


def _scan_symbols(market: str) -> List[str]:
    """US: the Nasdaq Trader list in trader/universe.txt. NSE: the live EQUITY_L.csv (EQ series)."""
    if market == "india":
        return [r["symbol"] for r in di.universe()]
    return ds.skill("scanner").symbols_from_file(str(ds.TRADER_DIR / "universe.txt"))


def _scan_run(market: str, min_price: float, min_volume: int) -> None:
    sc = ds.skill("scanner", market)
    state = _scans[market]
    try:
        symbols = _scan_symbols(market)
        data: Dict[str, Any] = {}
        batches = [symbols[i:i + sc.SPARK_MAX] for i in range(0, len(symbols), sc.SPARK_MAX)]
        state.update(total=len(batches), done=0)
        for k, batch in enumerate(batches):
            got, _failed = sc.fetch_spark(batch, "3mo", "1d", 0)
            data.update(got)
            state["done"] = k + 1
            time.sleep(0.15)
        hits, counts, last = sc.scan_daily(data, symbols, ds.utc_now(), min_price, min_volume)
        state.update(state="ready", hits=ds.plain(hits), counts=counts, finished=time.time(),
                     as_of=last.isoformat() if last else None, error=None)
    except Exception as exc:
        logger.warning("%s market scan failed: %s", market, exc)
        state.update(state="error", error=str(exc))


@router.get("/scan")
async def scan(
    market: str = Query("us"),
    min_price: Optional[float] = Query(None, ge=0),
    min_volume: Optional[int] = Query(None, ge=0),
    limit: int = Query(40, ge=1, le=200),
):
    """Daily-chart scan of a whole market (US: Nasdaq Trader list; NSE: live EQUITY_L list),
    run in the background and refreshed every 30 minutes."""
    market = _market(market)
    floor_price, floor_volume = _SCAN_FLOORS[market]
    min_price = floor_price if min_price is None else min_price
    min_volume = floor_volume if min_volume is None else min_volume
    state = _scans[market]
    with _scan_lock:
        stale = state["state"] == "ready" and time.time() - state["finished"] > _SCAN_TTL
        if state["state"] in ("idle", "error") or stale:
            state.update(state="running", error=None)
            threading.Thread(target=_scan_run, args=(market, min_price, min_volume), daemon=True).start()
    ready = state["state"] in ("ready",) or bool(state["hits"])
    return {"market": market, "state": state["state"], "progress": [state["done"], state["total"]],
            "as_of": state["as_of"], "counts": state["counts"], "error": state["error"],
            "hits": state["hits"][:limit] if ready else []}


# ---------------------------------------------------------------------------
# NSE disclosures (announcements, insider trades, bulk/block deals): India's counterpart to the
# US filings and Congress panels
# ---------------------------------------------------------------------------

_TTL_DISCLOSURES = 5 * 60


@router.get("/{symbol}/disclosures")
async def disclosures(symbol: str, limit: int = Query(12, ge=1, le=40)):
    """A company's latest NSE corporate announcements, SEBI insider (PIT) trades and today's bulk/block/short deals."""
    sym = _desk_symbol(symbol, "india")
    data, stale = await _run(("desk-disc", sym, limit), _TTL_DISCLOSURES, di.disclosures, sym, limit)
    return {"symbol": sym, "market": "india", "stale": stale, **data}


# ---------------------------------------------------------------------------
# Congress trades (trader-pelosi)
# ---------------------------------------------------------------------------

_ptr_cache: Dict[str, Dict[str, Any]] = {}      # doc_id -> parsed report (filings never change)
_ptr_lock = threading.Lock()


def _parse_filing(row: Dict[str, Any]) -> Dict[str, Any]:
    from . import ptr_text

    hit = _ptr_cache.get(row["doc_id"])
    if hit is not None:
        return hit
    pe = ds.skill("pelosi")
    try:
        report = pe.parse_ptr_text(ptr_text.normalise(ptr_text.pdf_text(pe.download(row["url"]))), filed=row["filed"])
    except Exception as exc:
        logger.info("PTR %s unreadable: %s", row["doc_id"], exc)
        return {"rows": [], "error": str(exc)}
    out = {"rows": report["rows"], "name": row["name"], "district": row["district"], "doc_id": row["doc_id"],
           "filed": row["filed"], "url": row["url"]}
    with _ptr_lock:
        _ptr_cache[row["doc_id"]] = out
    return out


def _congress_blocking(days: int, limit: int) -> Dict[str, Any]:
    pe = ds.skill("pelosi")
    today = datetime.date.today()
    rows = pe.load_index(today.year)
    if today.month == 1:
        rows += pe.load_index(today.year - 1)
    since = (today - datetime.timedelta(days=days)).isoformat()
    recent = pe.select(rows, None, "P", since)[:limit]
    pelosi = pe.select(rows, ["pelosi"], "P")[:3]
    todo = {r["doc_id"]: r for r in recent + pelosi}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        parsed = dict(zip(todo, pool.map(_parse_filing, todo.values())))

    def flatten(filings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        out = []
        for f in filings:
            rep = parsed.get(f["doc_id"]) or {}
            for r in rep.get("rows", []):
                out.append(dict(r, member=f["name"], district=f["district"], doc_id=f["doc_id"],
                                filed=f["filed"], url=f["url"], text=pe.describe(r)))
        out.sort(key=lambda r: (r["date"] or "", r["doc_id"]), reverse=True)
        return out

    return ds.plain({
        "as_of": since, "filings_scanned": len(recent), "trades": flatten(recent)[:400],
        "pelosi": {"filings": [{k: f[k] for k in ("doc_id", "filed", "url", "name")} for f in pelosi],
                   "trades": flatten(pelosi)},
        "note": "Public STOCK Act disclosures, filed up to 45 days after the trade. Amounts are ranges.",
    })


@router.get("/congress")
async def congress(days: int = Query(30, ge=1, le=120), limit: int = Query(40, ge=1, le=120)):
    """Recent House PTR trades (the Clerk's public PDFs), plus Nancy Pelosi's latest filings."""
    data, stale = await _run(("desk-congress", days, limit), _TTL_CONGRESS, _congress_blocking, days, limit)
    return {"stale": stale, **data}
