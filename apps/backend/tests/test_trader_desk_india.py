"""Tests for the NSE overlay of the trader skills (no network: the holiday list is injected)."""
import datetime

import pytest
from fastapi import HTTPException

from nxtvue.api import desk_india as di
from nxtvue.api import desk_skills as ds
from nxtvue.api import trader_desk as td

HOLIDAY_ROWS = [
    {"tradingDate": "10-Nov-2026", "description": "Diwali-Balipratipada", "morning_session": None, "evening_session": None},
    {"tradingDate": "08-Nov-2026", "description": "Diwali Laxmi Pujan*", "morning_session": None, "evening_session": "18:15"},
    {"tradingDate": "bad date", "description": "ignored"},
]


@pytest.fixture(autouse=True)
def nse_calendar(monkeypatch):
    """Pin the NSE calendar so no test reaches the network."""
    di._HOLIDAYS.clear()
    di._HOLIDAYS.update(di.parse_holidays(HOLIDAY_ROWS))
    monkeypatch.setitem(di._cal, "at", 1e18)
    monkeypatch.setitem(di._cal, "years", (2026,))
    yield


def test_parse_holidays_keeps_special_sessions_as_closed_for_day_trading():
    hol = di.parse_holidays(HOLIDAY_ROWS)
    assert hol["2026-11-10"] == "Diwali-Balipratipada"
    assert hol["2026-11-08"] == "Diwali Laxmi Pujan (special session only)"
    assert len(hol) == 2


def test_ist_has_no_dst_and_round_trips():
    utc = datetime.datetime(2026, 11, 5, 3, 45)
    assert di.to_ist(utc) == datetime.datetime(2026, 11, 5, 9, 15)
    assert di.ist_to_utc(di.to_ist(utc)) == utc


def test_india_modules_are_separate_from_the_us_copies():
    us, india = ds.skill("alerts"), ds.skill("alerts", "india")
    assert us is not india
    assert us.OPEN.strftime("%H:%M") == "09:30" and india.OPEN.strftime("%H:%M") == "09:15"
    assert india.CLOSE.strftime("%H:%M") == "15:30"
    assert "2026-01-19" in us.NYSE_HOLIDAYS and "2026-11-10" not in us.NYSE_HOLIDAYS
    assert "2026-11-10" in india.NYSE_HOLIDAYS


def test_nse_market_status_in_ist():
    al = ds.skill("alerts", "india")
    st = al.market_status(datetime.datetime(2026, 11, 5, 4, 0))          # 09:30 IST Thursday
    assert st["open"] and st["opens"] == "09:15" and st["closes"] == "15:30"
    assert st["now_new_york"] == "2026-11-05 09:30"
    closed = al.market_status(datetime.datetime(2026, 11, 9, 4, 0))      # Monday 09:30 IST, open again
    assert closed["open"]
    holiday = al.market_status(datetime.datetime(2026, 11, 10, 4, 0))    # Balipratipada
    assert not holiday["open"] and "Diwali-Balipratipada" in holiday["reason"]
    assert holiday["next_open"] == "2026-11-11 09:15"


def test_effective_now_rolls_back_to_last_nse_close():
    sat = datetime.datetime(2026, 11, 7, 6, 0)                           # Saturday 11:30 IST
    assert td.effective_now(sat, "india") == datetime.datetime(2026, 11, 6, 10, 0)  # Friday 15:30 IST
    live = datetime.datetime(2026, 11, 5, 5, 0)                          # Thursday 10:30 IST
    assert td.effective_now(live, "india") == live


def test_desk_symbol_gate_per_market():
    assert td._desk_symbol("m&m", "india") == "M&M"
    assert td._desk_symbol("reliance", "india") == "RELIANCE"
    with pytest.raises(HTTPException):
        td._desk_symbol("RELIANCE", "us")       # more than five letters: not a US ticker
    with pytest.raises(HTTPException) as e:
        td._desk_symbol("^NSEI", "india")
    assert e.value.status_code == 422


def test_entry_bar_index_uses_the_nse_open():
    assert td._hhmm_to_bar("09:15", "india") == 0
    assert td._hhmm_to_bar("09:30", "india") == 3
    assert td._hhmm_to_bar("09:30", "us") == 0


def test_exit_plan_rounds_to_the_nse_tick_in_rupees():
    ex = ds.skill("exit", "india")
    kind, param = ex.parse_stop("or-mid")
    t_rule, t_param = ex.parse_target("2R")
    c = ex.compute(1325.0, kind, param, t_rule, t_param, 1325.0, 1315.5)
    assert float(c["stop"]) == 1320.25                                   # (1325 + 1315.5) / 2, on the 0.05 grid
    assert float(c["target"]) == 1334.5
    assert ex.money(1320.25) == "\u20b91,320.25"
    # a midpoint off the tick grid rounds the stop down, away from the entry
    c2 = ex.compute(100.0, kind, param, t_rule, t_param, 100.0, 98.12)
    assert float(c2["stop"]) == 99.05 and float(c2["target"]) == 101.9


def test_plan_ahead_is_capped_at_the_entry_cutoff():
    res = {"date": "2026-11-05", "level": 1325.0, "no_entries_after": "15:00",
           "opening_range": {"high": 1325.0, "low": 1315.5, "minutes": 15, "complete": True},
           "trigger": None, "last": {"bar_start": "15:15", "close": 1312.9}}
    entry, why = td._entry_inputs(res, "india")
    assert why is None and entry["time"] == "3:00 PM" and entry["bar"] == 68 and entry["price"] == 1325.0  # 14:55 bar


def test_budget_sizes_in_rupees_with_nse_limits():
    bud = ds.skill("budget", "india")
    assert bud.DEFAULTS["max_order_usd"] == di.LIMITS["max_order_usd"]
    assert bud.DEFAULTS["no_entries_after"] == "15:00" and bud.DEFAULTS["flat_by"] == "15:15"
    assert bud.round_cent(1320.27) == 1320.25 and bud.round_cent(1320.28) == 1320.3
    assert bud.money(1234.5) == "\u20b91,234.50"
    us = ds.skill("budget")
    assert us.DEFAULTS["max_order_usd"] == 4000 and us.round_cent(1320.27) == 1320.27


def test_risk_accepts_nse_symbols_and_uses_the_nse_window():
    rk = ds.skill("risk", "india")
    assert rk.TICKER.match("M&M") and rk.TICKER.match("BAJAJ-AUTO")
    assert not ds.skill("risk").TICKER.match("BAJAJ-AUTO")
    inside = datetime.datetime(2026, 11, 5, 5, 0)                        # 10:30 IST
    reasons, _ = rk.window_check(rk.to_eastern(inside), {"no_entries_before": "09:30", "no_entries_after": "15:00"})
    assert reasons == []
    reasons, _ = rk.window_check(datetime.datetime(2026, 11, 5, 9, 20), {"no_entries_before": "09:30", "no_entries_after": "15:00"})
    assert reasons and "before 09:30" in reasons[0]


def test_timemachine_session_shape_and_symbol_rule():
    tm = ds.skill("timemachine", "india")
    assert tm.SESSION_BARS == 72 and tm.OPEN_MIN == 555 and tm.CLOSE_MIN == 555 + 360
    plan = tm.normalize_plan({"symbol": "M&M", "date": "2026-11-05", "entry": 100, "stop": 99, "target": 102,
                              "entry_bar": 5, "entry_time": "9:45 AM", "opening_range": {"minutes": 15}})
    assert plan["symbol"] == "M&M" and plan["entry_time"] == "9:45 AM"
    us = ds.skill("timemachine")
    with pytest.raises(us.TMError):
        us.normalize_plan({"symbol": "M&M", "date": "2026-11-05", "entry": 100, "stop": 99,
                           "target": 102, "entry_bar": 5})


def test_scanner_targets_nse_yahoo_symbols():
    sc = ds.skill("scanner", "india")
    assert sc.to_yahoo("RELIANCE") == "RELIANCE.NS"
    assert sc.spark_path(["M&M", "TCS"], "3mo", "1d") == "/v7/finance/spark?symbols=M%26M.NS,TCS.NS&range=3mo&interval=1d"
    assert ds.skill("scanner").to_yahoo("BRK.B") == "BRK-B"


def test_localize_rewrites_us_wording_only_where_needed():
    out = di.localize({"a": "no entries after 15:30 New York; $1,200 at NYSE ET", "b": ["ETF stays"]})
    assert out == {"a": "no entries after 15:30 IST; \u20b91,200 at NSE IST", "b": ["ETF stays"]}


def test_parse_equity_l_keeps_only_eq_series():
    text = ("SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING\n"
            "RELIANCE,Reliance Industries Limited,EQ,29-NOV-1995\n"
            "ABAN,Aban Offshore,BE,01-JAN-2000\n"
            "M&M,Mahindra & Mahindra Limited,EQ,01-JAN-1995\n")
    assert di.parse_equity_l(text) == [{"symbol": "RELIANCE", "name": "Reliance Industries Limited"},
                                       {"symbol": "M&M", "name": "Mahindra & Mahindra Limited"}]


def test_disclosure_shapers():
    ann = di.shape_announcements([
        {"sort_date": "2026-11-03 10:00:00", "an_dt": "03-Nov-2026 10:00:00", "desc": "Old", "attchmntText": "o", "attchmntFile": "u1"},
        {"sort_date": "2026-11-04 20:47:14", "an_dt": "04-Nov-2026 20:47:14", "desc": "Credit Rating", "attchmntText": "n", "attchmntFile": "u2"},
    ], 1)
    assert ann == [{"time": "04-Nov-2026 20:47:14", "subject": "Credit Rating", "text": "n", "url": "u2"}]
    ins = di.shape_insider({"data": [
        {"date": "01-Feb-2026 10:00", "acqName": "A", "tdpTransactionType": "Buy", "secAcq": "10", "secVal": "1000.5"},
        {"date": "18-Feb-2026 19:06", "acqName": "B", "tdpTransactionType": "Sell", "secAcq": "2320", "secVal": "3294168"},
    ]}, 5)
    assert [r["person"] for r in ins] == ["B", "A"] and ins[0]["shares"] == 2320 and ins[0]["value"] == 3294168.0
    deals = di.shape_deals({"BULK_DEALS_DATA": [
        {"symbol": "RELIANCE", "buySell": "BUY", "clientName": "X", "qty": "100", "watp": "1300.5", "date": "05-Nov-2026"},
        {"symbol": "TCS", "buySell": "SELL", "clientName": "Y", "qty": "5", "watp": "1", "date": "05-Nov-2026"}]}, "RELIANCE")
    assert deals == [{"kind": "Bulk", "date": "05-Nov-2026", "client": "X", "side": "BUY", "qty": 100, "price": 1300.5}]


def test_scan_symbols_for_india_come_from_the_live_list(monkeypatch):
    monkeypatch.setattr(di, "universe", lambda: [{"symbol": "TCS", "name": "x"}, {"symbol": "M&M", "name": "y"}])
    assert td._scan_symbols("india") == ["TCS", "M&M"]
