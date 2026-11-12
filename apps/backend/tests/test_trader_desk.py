"""Tests for the trader-desk bridge (no network)."""
import datetime

import pytest
from fastapi import HTTPException

from nxtvue.api import desk_skills as ds
from nxtvue.api import ptr_text, trader_desk as td
from nxtvue.api import us_data


def test_skills_load_and_are_cached():
    assert ds.skill("alerts") is ds.skill("alerts")
    for name in ds.SKILL_FILES:
        assert ds.skill(name) is not None


def test_us_symbol_gate():
    assert td._desk_symbol("nvda", "us") == "NVDA"
    assert td._desk_symbol("brk.b", "us") == "BRK.B"
    with pytest.raises(HTTPException) as e:
        td._desk_symbol("RELIANCE.NS", "us")
    assert e.value.status_code == 422


def test_effective_now_rolls_back_to_last_close_on_weekend():
    sat = datetime.datetime(2026, 11, 7, 15, 0)       # Saturday 10:00 New York
    eff = td.effective_now(sat)
    assert eff == datetime.datetime(2026, 11, 6, 21, 0)  # Friday 16:00 EST = 21:00 UTC


def test_effective_now_keeps_live_clock_in_session():
    live = datetime.datetime(2026, 11, 5, 17, 0)      # Thursday 12:00 New York
    assert td.effective_now(live) == live


def test_exit_plan_from_waiting_entry_plans_at_range_high():
    res = {
        "date": "2026-11-05",
        "level": 196.24,
        "opening_range": {"high": 196.24, "low": 191.51, "minutes": 15, "complete": True},
        "trigger": None,
        "last": {"bar_start": "12:15", "close": 185.53},
    }
    entry, why = td._entry_inputs(res)
    assert why is None and entry["price"] == 196.24 and entry["time"] == "12:20 PM" and entry["bar"] == 33
    plan = td._plan_from("NVDA", res, entry, "or-mid", 2.0)
    assert plan["stop"] == 193.87 and plan["target"] == 200.98 and plan["reward_risk"] == 2.0


def test_entry_inputs_uses_trigger_when_fired():
    res = {"opening_range": {"high": 10, "low": 9, "complete": True},
           "trigger": {"price": 10.2, "time": "10:05 AM", "bar_index": 7}}
    entry, _ = td._entry_inputs(res)
    assert entry == {"basis": "trigger", "price": 10.2, "time": "10:05 AM", "bar": 7}


def test_entry_inputs_needs_opening_range():
    entry, why = td._entry_inputs({"opening_range": None, "reason": "5 of 15 minutes"})
    assert entry is None and "15" in why


def test_ptr_normalise_joins_wrapped_rows():
    text = (
        "Name: Hon. Test Member\nStatus: Member\nState/District: OK01\n"
        "ID Owner Asset Transaction\nType\nDate Notification\nDate\nAmount Cap.\nGains >\n$200?\n"
        "JT ASML Holding N.V. - New York\nRegistry Shares (ASML) [ST]\n"
        "S (partial) 10/23/2026 10/27/2026 $15,001 -\n$50,000\n"
        "F\x00\x00 S\x00\x00: New\nS\x00\x00 O\x00: Family Foundation\n"
        "* For the complete list of asset type abbreviations\nFiling ID #20035710\n"
        "Digitally Signed: Hon. Test Member , 10/28/2026\n"
    )
    rep = ds.skill("pelosi").parse_ptr_text(ptr_text.normalise(text), filed="2026-10-28")
    assert len(rep["rows"]) == 1
    row = rep["rows"][0]
    assert row["ticker"] == "ASML" and row["type"] == "S (partial)" and row["owner"] == "JT"
    assert row["amount_low"] == 15001 and row["amount_high"] == 50000
    assert row["account"] == "Family Foundation"


def test_us_fundamentals_helpers():
    assert us_data._num(float("nan")) is None
    assert us_data._num("x") is None
    assert us_data._pct(0.5) == 50.0
    assert us_data._pct(None) is None


def test_tape_covers_template_instruments():
    assert list(us_data.TAPE) == ["SPX500", "NAS100", "USDINR", "XAUUSD", "USOIL", "BTCUSD"]


def test_interval_30m_registered():
    from nxtvue.api import market_gateway as mg

    assert mg._validate_params("us", "30m", None) == ("us", "30m", "1mo")
