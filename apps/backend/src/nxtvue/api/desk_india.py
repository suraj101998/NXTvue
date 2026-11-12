"""NSE overlay for the trader-* skills, plus live NSE sources (calendar, universe, disclosures).

The skills in ``.agents/skills`` are NYSE day-trade tools: New York time, NYSE holidays, 09:30-16:00,
one-cent prices, US tickers. They stay untouched. For India the desk loads a *second copy* of each
skill module and rebinds those module-level names (clock, calendar, session, tick, currency, Yahoo
symbol) to NSE values, so every rule - opening range, stop, sizing, risk, alerts, replay - is still the
skill's own code. Nothing here is a stored price or a stored calendar: holidays come from NSE's holiday
master, the stock list from NSE's EQUITY_L.csv, disclosures from NSE's corporate APIs.
"""

import csv
import datetime
import io
import logging
import re
import threading
import time
import urllib.parse
from decimal import ROUND_FLOOR, ROUND_HALF_UP, Decimal
from typing import Any, Dict, List, Tuple

import requests

from .india_data import _UA, _nse_get

logger = logging.getLogger(__name__)

IST = datetime.timedelta(hours=5, minutes=30)
OPEN = datetime.time(9, 15)
CLOSE = datetime.time(15, 30)
TICK = Decimal("0.05")
EQUITY_L = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"

# Defaults for the NSE desk: rupee limits and an entry window shifted to the NSE session.
# trader/config.india.json overrides any of them.
LIMITS = {"max_order_usd": 200000, "min_order_usd": 500, "max_loss_per_trade_usd": 2000, "max_daily_loss_usd": 6000}
WINDOW = {"no_entries_before": "09:30", "no_entries_after": "15:00", "flat_by": "15:15"}

_TM_SYMBOL = r"^[A-Z][A-Z0-9.\-]{0,9}$"
_TM_SYMBOL_NSE = r"^[A-Z0-9&][A-Z0-9&.\-]{0,23}$"


# ---------------------------------------------------------------------------
# Time
# ---------------------------------------------------------------------------

def to_ist(utc: datetime.datetime) -> datetime.datetime:
    return utc.replace(tzinfo=None) + IST


def ist_to_utc(local: datetime.datetime) -> datetime.datetime:
    return local - IST


def ist_offset(_utc: datetime.datetime) -> float:
    return 5.5


# ---------------------------------------------------------------------------
# NSE trading calendar (live holiday master)
# ---------------------------------------------------------------------------

_HOLIDAYS: Dict[str, str] = {}      # shared with every patched skill module, updated in place
_cal: Dict[str, Any] = {"at": 0.0, "years": ()}
_cal_lock = threading.Lock()
_CAL_TTL = 6 * 3600


def parse_holidays(rows: List[Dict[str, Any]]) -> Dict[str, str]:
    """NSE holiday-master CM rows -> {iso date: description}. A day with a special session
    (Muhurat trading is an evening hour) is also listed: the 09:15-15:30 day-trade rules do not apply."""
    out: Dict[str, str] = {}
    for r in rows or []:
        try:
            d = datetime.datetime.strptime(str(r.get("tradingDate")), "%d-%b-%Y").date()
        except ValueError:
            continue
        name = str(r.get("description") or "holiday").strip().rstrip("*")
        if r.get("morning_session") or r.get("evening_session"):
            name += " (special session only)"
        out[d.isoformat()] = name
    return out


def calendar() -> Tuple[Dict[str, str], Tuple[int, ...]]:
    """The shared holiday dict and the years it covers, refreshed from NSE every 6 hours."""
    with _cal_lock:
        if time.time() - _cal["at"] > _CAL_TTL:
            try:
                data = _nse_get("/api/holiday-master?type=trading")
                hol = parse_holidays(data.get("CM") or [])
                if not hol:
                    raise RuntimeError("empty holiday list")
                _HOLIDAYS.clear()
                _HOLIDAYS.update(hol)
                _cal["years"] = tuple(sorted({int(d[:4]) for d in hol}))
                _cal["at"] = time.time()
            except Exception as exc:
                if not _HOLIDAYS:
                    raise RuntimeError("NSE holiday calendar unavailable: %s" % exc) from exc
                logger.warning("NSE holiday refresh failed, keeping the last list: %s", exc)
                _cal["at"] = time.time() - _CAL_TTL + 300
        return _HOLIDAYS, _cal["years"]


# ---------------------------------------------------------------------------
# Skill overlay
# ---------------------------------------------------------------------------

def _tick_round(mod: Any, x: Any, rounding: str) -> Decimal:
    d = mod.D(x)
    return ((d / TICK).quantize(Decimal(1), rounding=rounding) * TICK).quantize(Decimal("0.01"))


def _patch_time(mod: Any) -> None:
    hol, years = calendar()
    mod.NYSE_HOLIDAYS = hol
    mod.CALENDAR_YEARS = years
    if not getattr(mod, "_nse_patched", False):
        mod.NYSE_EARLY_CLOSE = {}
        for attr, fn in (("eastern_offset", ist_offset), ("to_eastern", to_ist), ("eastern_to_utc", ist_to_utc)):
            if hasattr(mod, attr):
                setattr(mod, attr, fn)
        if hasattr(mod, "OPEN"):
            mod.OPEN, mod.CLOSE = OPEN, CLOSE


def _patch_entry(mod: Any) -> None:
    mod.DEFAULTS.update({k: WINDOW[k] for k in ("no_entries_before", "no_entries_after")})
    mod.next_open = lambda d: _next_open(mod, d)
    mod.yahoo_symbol = lambda sym: sym.upper() + ".NS"
    mod.chart_path = lambda sym, rng, interval: "/v8/finance/chart/%s?range=%s&interval=%s" % (
        urllib.parse.quote(mod.yahoo_symbol(sym), safe=".-"), rng, interval)


def _next_open(mod: Any, d: datetime.date) -> Any:
    nd = d + datetime.timedelta(days=1)
    for _ in range(15):
        if mod.session(nd):
            return "%s %s" % (nd.isoformat(), OPEN.strftime("%H:%M"))
        nd += datetime.timedelta(days=1)
    return None


def _patch_exit(mod: Any) -> None:
    mod.DEFAULTS["flat_by"] = WINDOW["flat_by"]
    mod.cents = lambda x: _tick_round(mod, x, ROUND_HALF_UP)
    mod.floor_cents = lambda x: _tick_round(mod, x, ROUND_FLOOR)
    mod.money = lambda x: "\u20b9%s" % format(mod.D(x).quantize(Decimal("0.01")), ",f")


def _patch_limits(mod: Any) -> None:
    for k, v in {**LIMITS, **WINDOW}.items():
        if k in mod.DEFAULTS:
            mod.DEFAULTS[k] = v


def _rupees(x: Any) -> str:
    x = float(x)
    return "\u20b9" + (("{:,.0f}" if abs(x - round(x)) < 0.005 else "{:,.2f}").format(x))


def _patch_budget(mod: Any) -> None:
    _patch_limits(mod)
    mod.round_cent = lambda x: round(mod.math.floor(float(x) / 0.05 + 0.5 + mod.EPS) * 0.05, 2)
    mod.money = _rupees


def _patch_risk(mod: Any) -> None:
    _patch_limits(mod)
    mod.TICKER = re.compile(r"^[A-Z0-9&][A-Z0-9&\-]{0,19}$")
    mod.money = _rupees


def _patch_alerts(mod: Any) -> None:
    orig = mod.market_status

    def market_status(now_utc: datetime.datetime) -> Dict[str, Any]:
        st = orig(now_utc)
        if st.get("next_open"):
            st["next_open"] = st["next_open"].replace("09:30", OPEN.strftime("%H:%M"))
        return st

    mod.market_status = market_status


class _ReShim:
    """The time machine validates tickers with a US-only regex; swap just that pattern."""

    def __getattr__(self, name: str) -> Any:
        return getattr(re, name)

    def match(self, pattern: str, string: str, *a: Any, **k: Any) -> Any:
        return re.match(_TM_SYMBOL_NSE if pattern == _TM_SYMBOL else pattern, string, *a, **k)


def _patch_timemachine(mod: Any) -> None:
    # Yahoo sends null bars for the NSE's last two slots (15:20, 15:25, the closing auction) on almost
    # every day, so a full 75-bar session never exists. Replay the 72 bars to 15:15, which is also the
    # desk's flat-by time; nothing is filled in.
    mod.SESSION_BARS = 72
    mod.OPEN_MIN = OPEN.hour * 60 + OPEN.minute
    mod.CLOSE_MIN = mod.OPEN_MIN + 5 * mod.SESSION_BARS
    mod.EARLY_MIN = mod.CLOSE_MIN
    mod.re = _ReShim()
    mod.chart_url = lambda sym, host="query2": (
        "https://%s.finance.yahoo.com/v8/finance/chart/%s?range=60d&interval=5m" % (host, urllib.parse.quote(sym.upper() + ".NS", safe=".-")))
    mod.cents_away = lambda x, long: round((mod.math.floor if long else mod.math.ceil)(round(x / 0.05, 4)) * 0.05, 2)
    orig_bars = mod.parse_bars

    def parse_bars(result: Dict[str, Any], now_utc: datetime.datetime) -> Any:
        meta, bars, dropped = orig_bars(result, now_utc)
        ysym = str(meta.get("symbol") or "")
        if ysym.upper().endswith((".NS", ".BO")):  # the plan carries the bare NSE symbol
            meta = dict(meta, symbol=ysym.rsplit(".", 1)[0])
        return meta, bars, dropped

    mod.parse_bars = parse_bars


def _patch_scanner(mod: Any) -> None:
    mod.to_yahoo = lambda sym: sym.upper() + ".NS"
    mod.spark_path = lambda symbols, rng, interval: "/v7/finance/spark?symbols=%s&range=%s&interval=%s" % (
        ",".join(urllib.parse.quote(mod.to_yahoo(s), safe=".-") for s in symbols), rng, interval)
    mod.chart_path = lambda sym, rng, interval: "/v8/finance/chart/%s?range=%s&interval=%s" % (
        urllib.parse.quote(mod.to_yahoo(sym), safe=".-"), rng, interval)


_PATCHES = {"entry": _patch_entry, "exit": _patch_exit, "budget": _patch_budget, "risk": _patch_risk,
            "alerts": _patch_alerts, "timemachine": _patch_timemachine, "scanner": _patch_scanner}


def patch(name: str, mod: Any) -> Any:
    """Rebind a freshly imported skill copy to the NSE session. The calendar refreshes on every call."""
    _patch_time(mod)
    if not getattr(mod, "_nse_patched", False):
        _PATCHES.get(name, lambda m: None)(mod)
        mod._nse_patched = True
    return mod


# ---------------------------------------------------------------------------
# Wording: the skills print New York / NYSE / dollars
# ---------------------------------------------------------------------------

_WORDS = (("New York time", "IST"), ("New York", "IST"), ("NYSE", "NSE"), ("opens at 9:30", "opens at 9:15"),
          ("$", "\u20b9"))
_ET = re.compile(r"\bET\b")


def localize(obj: Any) -> Any:
    """Rewrite the skills' US wording in a result tree to NSE wording."""
    if isinstance(obj, str):
        for a, b in _WORDS:
            obj = obj.replace(a, b)
        return _ET.sub("IST", obj)
    if isinstance(obj, dict):
        return {k: localize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [localize(v) for v in obj]
    return obj


# ---------------------------------------------------------------------------
# NSE stock universe (EQUITY_L.csv)
# ---------------------------------------------------------------------------

_uni: Dict[str, Any] = {"at": 0.0, "rows": []}
_uni_lock = threading.Lock()


def parse_equity_l(text: str) -> List[Dict[str, str]]:
    """EQUITY_L.csv -> [{symbol, name}] for the EQ (rolling-settlement equity) series."""
    out = []
    for row in csv.DictReader(io.StringIO(text)):
        r = {str(k).strip().upper(): (v or "").strip() for k, v in row.items() if k}
        if r.get("SERIES") == "EQ" and r.get("SYMBOL"):
            out.append({"symbol": r["SYMBOL"].upper(), "name": r.get("NAME OF COMPANY", "")})
    return out


def universe() -> List[Dict[str, str]]:
    with _uni_lock:
        if not _uni["rows"] or time.time() - _uni["at"] > 12 * 3600:
            try:
                resp = requests.get(EQUITY_L, headers={"User-Agent": _UA}, timeout=20)
                resp.raise_for_status()
                rows = parse_equity_l(resp.text)
                if not rows:
                    raise RuntimeError("no EQ rows in EQUITY_L.csv")
                _uni.update(rows=rows, at=time.time())
            except Exception as exc:
                if not _uni["rows"]:
                    raise RuntimeError("NSE stock list unavailable: %s" % exc) from exc
                logger.warning("EQUITY_L refresh failed, keeping the last list: %s", exc)
        return _uni["rows"]


# ---------------------------------------------------------------------------
# NSE disclosures: announcements, insider (PIT) trades, bulk / block / short deals
# ---------------------------------------------------------------------------

def _int(v: Any) -> Any:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def _flt(v: Any) -> Any:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def shape_announcements(rows: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    rows = sorted(rows or [], key=lambda r: str(r.get("sort_date") or ""), reverse=True)[:limit]
    return [{"time": r.get("an_dt"), "subject": r.get("desc"), "text": r.get("attchmntText"),
             "url": r.get("attchmntFile")} for r in rows]


def shape_insider(doc: Dict[str, Any], limit: int) -> List[Dict[str, Any]]:
    rows = (doc or {}).get("data") or []
    rows = sorted(rows, key=lambda r: datetime.datetime.strptime(r["date"], "%d-%b-%Y %H:%M")
                  if re.match(r"^\d{2}-\w{3}-\d{4} \d{2}:\d{2}$", str(r.get("date") or "")) else datetime.datetime.min,
                  reverse=True)[:limit]
    return [{"date": r.get("date"), "person": r.get("acqName"), "category": r.get("personCategory"),
             "type": r.get("tdpTransactionType"), "security": r.get("secType"), "shares": _int(r.get("secAcq")),
             "value": _flt(r.get("secVal")), "mode": r.get("acqMode"), "from": r.get("acqfromDt"),
             "to": r.get("acqtoDt"), "url": r.get("xbrl")} for r in rows]


def shape_deals(doc: Dict[str, Any], sym: str) -> List[Dict[str, Any]]:
    out = []
    for key, kind in (("BULK_DEALS_DATA", "Bulk"), ("BLOCK_DEALS_DATA", "Block"), ("SHORT_DEALS_DATA", "Short")):
        for r in (doc or {}).get(key) or []:
            if str(r.get("symbol") or "").upper() == sym:
                out.append({"kind": kind, "date": r.get("date"), "client": r.get("clientName"), "side": r.get("buySell"),
                            "qty": _int(r.get("qty")), "price": _flt(r.get("watp"))})
    return out


def disclosures(sym: str, limit: int = 12) -> Dict[str, Any]:
    q = urllib.parse.quote(sym)
    errors: List[str] = []

    def get(label: str, path: str) -> Any:
        try:
            return _nse_get(path)
        except Exception as exc:
            errors.append("%s: %s" % (label, exc))
            return None

    ann = get("announcements", "/api/corporate-announcements?index=equities&symbol=%s" % q)
    pit = get("insider trades", "/api/corporates-pit?index=equities&symbol=%s" % q)
    deals = get("bulk and block deals", "/api/snapshot-capital-market-largedeal")
    return {
        "announcements": shape_announcements(ann if isinstance(ann, list) else [], limit),
        "insider": shape_insider(pit if isinstance(pit, dict) else {}, limit),
        "deals": shape_deals(deals if isinstance(deals, dict) else {}, sym),
        "deals_as_on": (deals or {}).get("as_on_date") if isinstance(deals, dict) else None,
        "errors": errors,
    }
