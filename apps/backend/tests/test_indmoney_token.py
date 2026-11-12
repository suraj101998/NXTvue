"""INDmoney token manager: dead refresh tokens, .env overrides and the typed re-auth error."""

import json
import time

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from nxtvue.portfolio import indmoney_routes
from nxtvue.tools import indmoney_token as tok

ENV_KEYS = ["INDMONEY_TOKEN", "INDMONEY_REFRESH_TOKEN", "INDMONEY_CLIENT_ID", "INDMONEY_CLIENT_SECRET"]


@pytest.fixture
def store_path(tmp_path, monkeypatch):
    path = tmp_path / "indmoney_tokens.json"
    monkeypatch.setattr(tok, "TOKEN_FILE", path)
    for k in ENV_KEYS:
        monkeypatch.delenv(k, raising=False)
    return path


def write_store(path, **fields):
    base = {"access_token": "old-access", "refresh_token": "old-refresh", "client_id": "cid", "client_secret": "sec",
            "expires_at": int(time.time()) - 10}
    base.update(fields)
    path.write_text(json.dumps(base))


class FakeClient:
    """Stands in for httpx.Client so no request leaves the machine."""

    def __init__(self, status, body):
        self.status, self.body, self.calls = status, body, 0

    def __call__(self, *a, **k):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def post(self, url, data=None, headers=None):
        self.calls += 1
        return httpx.Response(self.status, json=self.body, request=httpx.Request("POST", url))


def test_invalid_grant_raises_reauth_error_and_is_remembered(store_path, monkeypatch):
    write_store(store_path)
    fake = FakeClient(400, {"error": "invalid_grant", "error_description": "refresh token does not exist"})
    monkeypatch.setattr(tok.httpx, "Client", fake)
    mgr = tok.TokenManager()

    with pytest.raises(tok.IndmoneyAuthError) as err:
        mgr.get_token()
    assert err.value.reason == "invalid_grant"
    assert mgr.status()["reauth_required"] is True

    # The same dead token is not sent to INDmoney a second time.
    with pytest.raises(tok.IndmoneyAuthError):
        mgr.get_token()
    assert fake.calls == 1


def test_rejection_survives_a_restart(store_path, monkeypatch):
    write_store(store_path)
    fake = FakeClient(400, {"error": "invalid_grant"})
    monkeypatch.setattr(tok.httpx, "Client", fake)
    with pytest.raises(tok.IndmoneyAuthError):
        tok.TokenManager().get_token()

    again = tok.TokenManager()
    with pytest.raises(tok.IndmoneyAuthError):
        again.get_token()
    assert fake.calls == 1


def test_new_refresh_token_in_env_replaces_the_rejected_one(store_path, monkeypatch):
    write_store(store_path)
    monkeypatch.setattr(tok.httpx, "Client", FakeClient(400, {"error": "invalid_grant"}))
    with pytest.raises(tok.IndmoneyAuthError):
        tok.TokenManager().get_token()

    monkeypatch.setenv("INDMONEY_REFRESH_TOKEN", "brand-new-refresh")
    good = FakeClient(200, {"access_token": "fresh", "refresh_token": "rotated", "expires_in": 3600})
    monkeypatch.setattr(tok.httpx, "Client", good)
    mgr = tok.TokenManager()

    assert mgr.get_token() == "fresh"
    assert mgr.status()["reauth_required"] is False
    assert good.calls == 1


def test_changed_env_value_beats_stale_store_but_rotation_is_kept(store_path, monkeypatch):
    monkeypatch.setenv("INDMONEY_REFRESH_TOKEN", "env-one")
    write_store(store_path, expires_at=int(time.time()) + 3600)
    tok.TokenManager()  # first run records env-one

    # The server rotated the token and only the store knows the new one.
    data = json.loads(store_path.read_text())
    data["refresh_token"] = "rotated-in-store"
    store_path.write_text(json.dumps(data))
    assert tok.TokenManager()._store["refresh_token"] == "rotated-in-store"

    # Editing .env is a deliberate act and wins.
    monkeypatch.setenv("INDMONEY_REFRESH_TOKEN", "env-two")
    assert tok.TokenManager()._store["refresh_token"] == "env-two"


def test_server_error_is_not_mistaken_for_a_dead_login(store_path, monkeypatch):
    write_store(store_path)
    monkeypatch.setattr(tok.httpx, "Client", FakeClient(503, {"error": "temporarily_unavailable"}))
    mgr = tok.TokenManager()
    with pytest.raises(RuntimeError) as err:
        mgr.get_token()
    assert not isinstance(err.value, tok.IndmoneyAuthError)
    assert mgr.status()["reauth_required"] is False


def test_missing_refresh_token_is_a_reauth_error(store_path):
    write_store(store_path, refresh_token="")
    with pytest.raises(tok.IndmoneyAuthError) as err:
        tok.TokenManager().get_token()
    assert err.value.reason == "missing_refresh_token"


def test_routes_answer_with_a_typed_424(monkeypatch):
    def boom():
        raise tok.IndmoneyAuthError("invalid_grant", "refresh token does not exist")

    monkeypatch.setattr(indmoney_routes, "get_networth_snapshot", boom)
    monkeypatch.setattr(indmoney_routes, "get_watchlist", boom)
    app = FastAPI()
    app.include_router(indmoney_routes.router, prefix="/api/v1")
    client = TestClient(app)

    for path in ("/api/v1/indmoney/snapshot", "/api/v1/indmoney/watchlist"):
        res = client.get(path)
        assert res.status_code == 424
        detail = res.json()["detail"]
        assert detail["code"] == tok.REAUTH_CODE
        assert detail["reason"] == "invalid_grant"
        assert "Reconnect" in detail["message"]


def test_holdings_route_survives_placeholder_strings_in_numeric_fields(store_path, monkeypatch):
    """A bond INDmoney cannot price arrives with invested_amount="unknown"; it must not 500 the whole page."""
    bond = {"investment": "NCD", "asset_type": "BOND", "invested_amount": "unknown", "market_value": 0,
            "total_units": 5, "unit_price": "N/A"}
    good = {"investment": "ACME", "asset_type": "IND_STOCK", "invested_amount": 100, "market_value": 120}
    raw = {k: {"holdings": [], "asset_summary": {"total_value": 0}} for k in ("ind_stocks", "mutual_funds", "bonds", "fd")}
    raw["ind_stocks"]["holdings"] = [good]
    raw["bonds"]["holdings"] = [bond]
    monkeypatch.setattr(indmoney_routes, "get_all_holdings", lambda: raw)

    app = FastAPI()
    app.include_router(indmoney_routes.router, prefix="/api/v1")
    resp = TestClient(app).get("/api/v1/indmoney/holdings")

    assert resp.status_code == 200
    body = resp.json()
    assert body["bonds"]["holdings"][0]["invested_amount"] == 0
    assert body["bonds"]["holdings"][0]["unit_price"] is None
    assert body["ind_stocks"]["holdings"][0]["market_value"] == 120
