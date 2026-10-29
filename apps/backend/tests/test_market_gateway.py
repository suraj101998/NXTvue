"""Unit tests for the market gateway (no network)."""
import numpy as np
import pytest
from fastapi import HTTPException

from nxtvue.api import market_gateway as mg


def test_clean_symbol_accepts_special_chars():
    assert mg._clean_symbol("gvt&d") == "GVT&D"
    assert mg._clean_symbol("m&m") == "M&M"


@pytest.mark.parametrize("bad", ["", "  ", "A B", "a/b", "x" * 40, "<script>"])
def test_clean_symbol_rejects(bad):
    with pytest.raises(HTTPException) as e:
        mg._clean_symbol(bad)
    assert e.value.status_code == 422


def test_validate_params_defaults_and_errors():
    assert mg._validate_params("India", "1d", None) == ("india", "1d", "1y")
    assert mg._validate_params("us", "5m", None) == ("us", "5m", "5d")
    for args in [("mars", "1d", None), ("us", "2h", None), ("us", "1d", "bogus"), ("us", "5m", "5y")]:
        with pytest.raises(HTTPException) as e:
            mg._validate_params(*args)
        assert e.value.status_code == 422


def test_yahoo_candidates():
    assert mg._yahoo_candidates("RELIANCE.NS", "india") == ["RELIANCE.NS", "RELIANCE.BO"]
    assert mg._yahoo_candidates("NVDA", "us") == ["NVDA"]


def test_bar_time_formats():
    import pandas as pd
    ts = pd.Timestamp("2026-10-21 09:15:00", tz="Asia/Kolkata")
    assert mg._bar_time(ts, False) == "2026-10-21"
    assert mg._bar_time(ts, True) == int(ts.timestamp())


def test_technicals_uptrend_is_bullish():
    closes = list(np.linspace(100, 300, 260))
    out = mg.compute_technicals(closes)
    assert out["signal"] in ("Buy", "Strong Buy")
    assert out["sma50"] > out["sma200"]


def test_technicals_downtrend_is_bearish():
    closes = list(np.linspace(300, 100, 260))
    out = mg.compute_technicals(closes)
    assert out["signal"] in ("Sell", "Strong Sell")
    assert out["votes"]["price_vs_sma200"] == -1


def test_technicals_short_history_omits_long_smas():
    out = mg.compute_technicals(list(np.linspace(100, 120, 40)))
    assert out["sma200"] is None and "price_vs_sma200" not in out["votes"]


def test_technicals_requires_30_candles():
    with pytest.raises(ValueError):
        mg.compute_technicals([1.0] * 10)
