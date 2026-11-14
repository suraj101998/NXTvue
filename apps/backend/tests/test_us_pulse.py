"""Unit tests for the US pulse router (the Yahoo/Wikipedia snapshot is mocked, no network)."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from nxtvue.api import us_pulse as us


@pytest.fixture(autouse=True)
def _clean_state():
    us._snap, us._snap_at = None, 0.0
    yield
    us._snap, us._snap_at = None, 0.0


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(us.router, prefix="/api/v1")
    return TestClient(app)


def _stock(sym, sector, sub, pct):
    return {"symbol": sym, "name": sym + " Inc", "sector": sector, "subIndustry": sub, "price": 100.0,
            "change": pct, "changePct": pct, "prevClose": 100.0 - pct, "volume": 1e6, "turnover": 1e8}


SNAPSHOT = {
    "status": {"status": "Closed", "message": "m", "tradeDate": "2026-11-11"},
    "vix": {"last": 17.5, "prevClose": 19.5, "change": -2.0, "changePct": -10.2, "high52w": 35.0, "low52w": 13.0},
    "indices": [{"name": "S&P 500", "last": 7600.0, "prevClose": 7500.0, "change": 100.0, "changePct": 1.3}],
    "macro": [{"name": "Gold", "last": 3900.0, "prevClose": 3920.0, "change": -20.0, "changePct": -0.5}],
    "sectors": [{"name": "Information Technology", "etf": "XLK", "changePct": 3.2, "advances": 2, "declines": 0}],
    "stocks": [
        _stock("AAA", "Information Technology", "Software", 4.0),
        _stock("BBB", "Information Technology", "Semiconductors", 2.0),
        _stock("CCC", "Energy", "Oil", -1.0),
        _stock("DDD", "Energy", "Oil", 0.0),
    ],
    "asOf": "2026-11-12T00:00:00+00:00",
}


def test_pulse_computes_breadth_and_movers(client, monkeypatch):
    monkeypatch.setattr(us, "_snapshot", lambda: SNAPSHOT)
    body = client.get("/api/v1/market/us/pulse?top=2").json()
    assert body["breadth"] == {"advances": 2, "declines": 1, "unchanged": 1, "count": 4}
    assert [g["symbol"] for g in body["gainers"]] == ["AAA", "BBB"]
    assert [x["symbol"] for x in body["losers"]] == ["CCC", "DDD"]
    assert body["vix"]["last"] == 17.5 and body["sectors"][0]["etf"] == "XLK"


def test_heatmap_all_groups_by_sector_and_filters_by_sector(client, monkeypatch):
    monkeypatch.setattr(us, "_snapshot", lambda: SNAPSHOT)
    whole = client.get("/api/v1/market/us/heatmap").json()
    assert whole["count"] == 4 and {s["sector"] for s in whole["stocks"]} == {"Information Technology", "Energy"}
    one = client.get("/api/v1/market/us/heatmap?sector=information technology").json()
    assert one["count"] == 2 and one["name"] == "S&P 500 Information Technology"
    assert {s["sector"] for s in one["stocks"]} == {"Software", "Semiconductors"}
    assert one["stocks"][0]["logo"].endswith("/AAA.png")


def test_heatmap_unknown_sector_is_422(client, monkeypatch):
    monkeypatch.setattr(us, "_snapshot", lambda: SNAPSHOT)
    assert client.get("/api/v1/market/us/heatmap?sector=Crypto").status_code == 422


def test_pulse_502_when_nothing_cached_and_upstream_fails(client, monkeypatch):
    def boom():
        raise RuntimeError("yahoo down")

    monkeypatch.setattr(us, "_snapshot", boom)
    assert client.get("/api/v1/market/us/pulse").status_code == 502


def test_market_status_closed_on_weekend():
    import datetime as dt

    class _Fake(dt.datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 11, 14, 11, 0, tzinfo=tz)  # a Saturday

    orig = us.dt.datetime
    us.dt.datetime = _Fake
    try:
        assert us._market_status(dt.date(2026, 11, 13))["status"] == "Closed"
    finally:
        us.dt.datetime = orig


def test_expired_snapshot_is_served_at_once_and_refreshed_in_background(client, monkeypatch):
    calls = []

    def fake():
        calls.append(1)
        return {**SNAPSHOT, "asOf": f"call-{len(calls)}"}

    monkeypatch.setattr(us, "_snapshot", fake)
    assert client.get("/api/v1/market/us/pulse").status_code == 200
    assert len(calls) == 1
    us._snap_at -= us._TTL_SNAPSHOT + 1  # expire it
    assert client.get("/api/v1/market/us/pulse").status_code == 200  # served from the old snapshot
    assert us._snap is not None


def test_failed_refresh_keeps_the_last_snapshot(client, monkeypatch):
    monkeypatch.setattr(us, "_snapshot", lambda: SNAPSHOT)
    assert client.get("/api/v1/market/us/pulse").status_code == 200

    def boom():
        raise RuntimeError("yahoo down")

    monkeypatch.setattr(us, "_snapshot", boom)
    us._snap_at -= us._TTL_SNAPSHOT + 1
    body = client.get("/api/v1/market/us/pulse").json()
    assert body["breadth"]["count"] == 4
