"""Unit tests for the India data router (upstream calls are mocked, no network)."""
import asyncio

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from nxtvue.api import india_data as idata


@pytest.fixture(autouse=True)
def _clean_state():
    idata._cache.clear()
    idata._locks.clear()
    idata._nse_session = None
    yield
    idata._cache.clear()
    idata._locks.clear()
    idata._nse_session = None


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(idata.router, prefix="/api/v1")
    return TestClient(app)


MEMBERS = [
    {"sid": "RELI", "symbol": "RELIANCE", "name": "Reliance Industries Ltd", "sector": "Energy"},
    {"sid": "TCS", "symbol": "TCS", "name": "Tata Consultancy", "sector": "Information Technology"},
]
QUOTES = {
    "RELI": {"sid": "RELI", "price": 1158, "change": -38.2, "dyChange": -3.19, "c": 1196.2, "vol": 100,
             "turnover": 5e9, "ts": 1793183335000},
    "TCS": {"sid": "TCS", "price": 2460, "change": -36.9, "dyChange": -1.48, "c": 2496.9, "vol": 50,
            "turnover": 2e9, "ts": 1793183223000},
}


def test_heatmap_returns_live_rows(client, monkeypatch):
    monkeypatch.setattr(idata, "_tt_members", lambda _id: MEMBERS)
    monkeypatch.setattr(idata, "_tt_quotes", lambda sids: {s: QUOTES[s] for s in sids})
    body = client.get("/api/v1/market/india/heatmap?index=nifty50").json()
    assert body["index"] == "NIFTY50" and body["count"] == 2 and body["stale"] is False
    reliance = body["stocks"][0]
    assert reliance["symbol"] == "RELIANCE" and reliance["changePct"] == -3.19
    assert reliance["turnover"] == 5e9 and reliance["sector"] == "Energy"


def test_heatmap_unknown_index_is_422(client):
    assert client.get("/api/v1/market/india/heatmap?index=NIFTYPHARMA").status_code == 422


def test_heatmap_skips_stocks_without_a_quote(client, monkeypatch):
    monkeypatch.setattr(idata, "_tt_members", lambda _id: MEMBERS)
    monkeypatch.setattr(idata, "_tt_quotes", lambda sids: {"TCS": QUOTES["TCS"]})
    body = client.get("/api/v1/market/india/heatmap").json()
    assert [s["symbol"] for s in body["stocks"]] == ["TCS"]


def test_heatmap_serves_stale_when_upstream_fails_after_success(client, monkeypatch):
    monkeypatch.setattr(idata, "_tt_members", lambda _id: MEMBERS)
    monkeypatch.setattr(idata, "_tt_quotes", lambda sids: {s: QUOTES[s] for s in sids})
    assert client.get("/api/v1/market/india/heatmap").json()["stale"] is False
    key = ("quotes", "NIFTY50")
    value, _ = idata._cache[key]
    idata._cache[key] = (value, 0)  # expire the entry, then break upstream

    def boom(_sids):
        raise RuntimeError("down")

    monkeypatch.setattr(idata, "_tt_quotes", boom)
    body = client.get("/api/v1/market/india/heatmap").json()
    assert body["stale"] is True and body["count"] == 2


def test_heatmap_502_when_upstream_fails_and_nothing_cached(client, monkeypatch):
    def boom(_id):
        raise RuntimeError("down")

    monkeypatch.setattr(idata, "_tt_members", boom)
    assert client.get("/api/v1/market/india/heatmap").status_code == 502
    assert not idata._cache  # failures are never cached


def test_cache_prevents_second_upstream_call(client, monkeypatch):
    calls = {"n": 0}

    def quotes(sids):
        calls["n"] += 1
        return {s: QUOTES[s] for s in sids}

    monkeypatch.setattr(idata, "_tt_members", lambda _id: MEMBERS)
    monkeypatch.setattr(idata, "_tt_quotes", quotes)
    client.get("/api/v1/market/india/heatmap")
    client.get("/api/v1/market/india/heatmap")
    assert calls["n"] == 1


def test_quotes_resolves_symbols_and_skips_unknown(client, monkeypatch):
    sids = {"RELIANCE": MEMBERS[0], "TCS": MEMBERS[1]}
    monkeypatch.setattr(idata, "_tt_search_sid", lambda s: sids.get(s))
    monkeypatch.setattr(idata, "_tt_quotes", lambda s: {x: QUOTES[x] for x in s})
    body = client.get("/api/v1/market/india/quotes?symbols=reliance,tcs,NOPE").json()
    assert [q["symbol"] for q in body["quotes"]] == ["RELIANCE", "TCS"]
    assert body["quotes"][0]["changePct"] == -3.19


def test_quotes_all_unknown_is_empty_not_error(client, monkeypatch):
    monkeypatch.setattr(idata, "_tt_search_sid", lambda s: None)
    assert client.get("/api/v1/market/india/quotes?symbols=NOPE").json()["quotes"] == []


def test_quotes_validation(client):
    assert client.get("/api/v1/market/india/quotes?symbols=,").status_code == 422
    many = ",".join(f"S{i}" for i in range(26))
    assert client.get(f"/api/v1/market/india/quotes?symbols={many}").status_code == 422
    assert client.get("/api/v1/market/india/quotes?symbols=a%20b").status_code == 422


def test_fundamentals_maps_ratios_and_quarters(client, monkeypatch):
    info = {
        "info": {"name": "Reliance Industries Ltd", "description": "Refining"},
        "gic": {"sector": "Energy", "industry": "Oil, Gas & Consumable Fuels"},
        "isin": "INE002A01018",
        "labels": {"risk": {"title": "Low Risk"}},
        "ratios": {"marketCap": 1567067.98, "pe": 19.4, "indpe": 10.98, "pb": 1.44, "eps": 59.7, "roe": 7.7,
                   "beta": 1.0, "divYield": 0.52, "52wHigh": 1611.8, "52wLow": 1152.2, "marketCapLabel": "Largecap"},
    }
    qtr = [{"displayPeriod": "JUN 2026", "endDate": "2026-06-30", "qIncTrev": 316018, "qIncEbi": 54067,
            "qIncNinc": 20946, "qIncEps": 15.48}]

    def fake_get(url, params=None):
        return qtr if "financials" in url else info

    monkeypatch.setattr(idata, "_tt_search_sid", lambda s: MEMBERS[0])
    monkeypatch.setattr(idata, "_tt_get", fake_get)
    body = client.get("/api/v1/market/india/fundamentals/RELIANCE").json()
    assert body["sector"] == "Energy" and body["risk"] == "Low Risk"
    assert body["ratios"]["industryPe"] == 10.98 and body["ratios"]["high52w"] == 1611.8
    assert body["quarters"] == [{"period": "JUN 2026", "endDate": "2026-06-30", "revenue": 316018,
                                 "operatingProfit": 54067, "netIncome": 20946, "eps": 15.48}]


def test_fundamentals_survives_missing_income_statement(client, monkeypatch):
    info = {"info": {"name": "X"}, "gic": {}, "ratios": {"pe": 10}}

    def fake_get(url, params=None):
        if "financials" in url:
            raise RuntimeError("no financials")
        return info

    monkeypatch.setattr(idata, "_tt_search_sid", lambda s: MEMBERS[0])
    monkeypatch.setattr(idata, "_tt_get", fake_get)
    body = client.get("/api/v1/market/india/fundamentals/RELIANCE").json()
    assert body["quarters"] == [] and body["ratios"]["pe"] == 10


def test_fundamentals_unknown_symbol_404_and_not_cached(client, monkeypatch):
    monkeypatch.setattr(idata, "_tt_search_sid", lambda s: None)
    assert client.get("/api/v1/market/india/fundamentals/NOPE").status_code == 404
    assert ("sid", "NOPE") not in idata._cache


def test_tt_search_requires_exact_ticker(monkeypatch):
    monkeypatch.setattr(idata, "_tt_get", lambda url, params=None: {
        "stocks": [{"ticker": "M&MFIN", "sid": "MMFS", "name": "x", "sector": "y"},
                   {"ticker": "M&M", "sid": "MAHM", "name": "Mahindra", "sector": "Consumer"}]})
    assert idata._tt_search_sid("M&M")["sid"] == "MAHM"
    assert idata._tt_search_sid("ZZZ") is None


NSE_INDICES = {"data": [
    {"index": "NIFTY 50", "last": 22698.85, "variation": -50.9, "percentChange": -0.22, "advances": 28,
     "declines": 22, "unchanged": "0", "pe": "18.99", "pb": "2.79", "yearHigh": 26373.2, "yearLow": 22179.9},
    {"index": "INDIA VIX", "last": 16.36, "percentChange": -0.28, "pe": "-", "pb": "-"},
]}
NSE_MOVERS = {"NIFTY": {"timestamp": "28-Oct-2026 16:00:00", "data": [
    {"symbol": f"S{i}", "ltp": 100 + i, "perChange": float(i), "trade_quantity": 10} for i in range(8)]}}


def _fake_nse(path):
    if "allIndices" in path:
        return NSE_INDICES
    if "marketStatus" in path:
        return {"marketState": [{"market": "Capital Market", "marketStatus": "Closed",
                                 "marketStatusMessage": "Normal Market has Closed", "tradeDate": "28-Oct-2026 15:30"}]}
    if "live-analysis" in path:
        return NSE_MOVERS
    if "fiidii" in path:
        return [{"category": "DII", "date": "28-Oct-2026", "buyValue": "17240.9", "sellValue": "16597.55",
                 "netValue": "643.35"}]
    raise AssertionError(path)


def test_pulse_combines_sections(client, monkeypatch):
    monkeypatch.setattr(idata, "_nse_get", _fake_nse)
    body = client.get("/api/v1/market/india/pulse?top=3").json()
    assert body["status"]["status"] == "Closed"
    assert body["vix"]["name"] == "INDIA VIX" and body["vix"]["last"] == 16.36
    nifty = body["indices"][0]
    assert nifty["advances"] == 28 and nifty["pe"] == 18.99
    assert body["indices"][1]["pe"] is None  # "-" from NSE becomes null
    assert len(body["gainers"]["rows"]) == 3
    assert body["fiiDii"][0]["net"] == 643.35 and body["stale"] is False


def test_pulse_one_section_failing_does_not_fail_the_rest(client, monkeypatch):
    def partial(path):
        if "fiidii" in path:
            raise RuntimeError("down")
        return _fake_nse(path)

    monkeypatch.setattr(idata, "_nse_get", partial)
    body = client.get("/api/v1/market/india/pulse").json()
    assert body["fiiDii"] is None and body["vix"] is not None


def test_pulse_502_when_nse_fully_down(client, monkeypatch):
    def down(_path):
        raise RuntimeError("blocked")

    monkeypatch.setattr(idata, "_nse_get", down)
    assert client.get("/api/v1/market/india/pulse").status_code == 502


class _Resp:
    def __init__(self, status, payload=None):
        self.status_code = status
        self._payload = payload

    def json(self):
        if self._payload is None:
            raise ValueError("not json")
        return self._payload


class _Session:
    def __init__(self, statuses):
        self.statuses = statuses

    def get(self, url, timeout=None):
        return _Resp(self.statuses.pop(0), {"ok": True})


def test_nse_get_rewarms_session_once_after_rejection(monkeypatch):
    sessions = [_Session([403]), _Session([200])]
    monkeypatch.setattr(idata, "_nse_warm", lambda: sessions.pop(0))
    assert idata._nse_get("/api/x") == {"ok": True}


def test_nse_get_gives_up_after_two_rejections(monkeypatch):
    sessions = [_Session([403]), _Session([403])]
    monkeypatch.setattr(idata, "_nse_warm", lambda: sessions.pop(0))
    with pytest.raises(RuntimeError):
        idata._nse_get("/api/x")


def test_num_handles_dashes_and_none():
    assert idata._num("18.99") == 18.99
    assert idata._num("-") is None
    assert idata._num(None) is None


def test_cached_raises_http_502():
    def boom():
        raise RuntimeError("x")

    with pytest.raises(HTTPException) as e:
        asyncio.run(idata._cached(("k",), 10, boom))
    assert e.value.status_code == 502
