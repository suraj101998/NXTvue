"""INDmoney interactive sign-in (OAuth + PKCE), the connect/callback routes and the keep-alive renewal."""

import base64
import hashlib
import json
import time
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from nxtvue.portfolio import indmoney_routes
from nxtvue.tools import indmoney_oauth as oauth
from nxtvue.tools import indmoney_token as tok

ENV_KEYS = ["INDMONEY_TOKEN", "INDMONEY_REFRESH_TOKEN", "INDMONEY_CLIENT_ID", "INDMONEY_CLIENT_SECRET",
            "INDMONEY_REDIRECT_URI", "INDMONEY_FRONTEND_URL"]


@pytest.fixture
def mgr(tmp_path, monkeypatch):
    monkeypatch.setattr(tok, "TOKEN_FILE", tmp_path / "indmoney_tokens.json")
    for k in ENV_KEYS:
        monkeypatch.delenv(k, raising=False)
    manager = tok.TokenManager()
    monkeypatch.setattr(oauth, "token_manager", manager)
    monkeypatch.setattr(indmoney_routes, "token_manager", manager)
    oauth._pending.clear()
    return manager


class FakeHttp:
    """Stands in for httpx.Client; answers by URL and records what was sent."""

    def __init__(self, replies):
        self.replies, self.sent = replies, []

    def __call__(self, *a, **k):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def post(self, url, data=None, json=None, headers=None):
        self.sent.append((url, data if data is not None else json))
        status, body = self.replies[url]
        return httpx.Response(status, json=body, request=httpx.Request("POST", url))


REGISTERED = {"client_id": "new-cid", "client_secret": "new-secret"}
TOKENS = {"access_token": "acc", "refresh_token": "ref", "expires_in": 3600}


def query_of(url):
    return {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}


def test_begin_registers_once_and_builds_a_pkce_url(mgr, monkeypatch):
    fake = FakeHttp({oauth.REGISTER_URL: (201, REGISTERED)})
    monkeypatch.setattr(oauth.httpx, "Client", fake)

    first = query_of(oauth.begin_authorization())
    second = query_of(oauth.begin_authorization())

    assert [u for u, _ in fake.sent] == [oauth.REGISTER_URL]  # registered a single time
    assert first["client_id"] == "new-cid"
    assert first["redirect_uri"] == oauth.DEFAULT_REDIRECT_URI
    assert first["code_challenge_method"] == "S256"
    assert first["state"] != second["state"]
    assert mgr.get_oauth_client()["client_secret"] == "new-secret"


def test_callback_exchanges_code_with_matching_verifier_and_stores_tokens(mgr, monkeypatch):
    fake = FakeHttp({oauth.REGISTER_URL: (201, REGISTERED), oauth.TOKEN_URL: (200, TOKENS)})
    monkeypatch.setattr(oauth.httpx, "Client", fake)
    mgr._store["rejected_refresh_fp"] = "dead"  # a previously refused login

    q = query_of(oauth.begin_authorization())
    oauth.complete_authorization("the-code", q["state"])

    _, sent = fake.sent[-1]
    assert sent["grant_type"] == "authorization_code" and sent["code"] == "the-code"
    digest = hashlib.sha256(sent["code_verifier"].encode()).digest()
    assert base64.urlsafe_b64encode(digest).rstrip(b"=").decode() == q["code_challenge"]
    assert mgr.get_token() == "acc"
    assert mgr._store["refresh_token"] == "ref"
    assert mgr._store["client_id"] == "new-cid"  # the refresh token is bound to the client that minted it
    assert mgr.status()["reauth_required"] is False


def test_unknown_or_replayed_state_is_rejected(mgr, monkeypatch):
    fake = FakeHttp({oauth.REGISTER_URL: (201, REGISTERED), oauth.TOKEN_URL: (200, TOKENS)})
    monkeypatch.setattr(oauth.httpx, "Client", fake)
    with pytest.raises(oauth.OAuthFlowError) as err:
        oauth.complete_authorization("c", "never-issued")
    assert err.value.reason == "invalid_state"

    state = query_of(oauth.begin_authorization())["state"]
    oauth.complete_authorization("c", state)
    with pytest.raises(oauth.OAuthFlowError):
        oauth.complete_authorization("c", state)  # single use


def test_expired_state_is_rejected(mgr, monkeypatch):
    monkeypatch.setattr(oauth.httpx, "Client", FakeHttp({oauth.REGISTER_URL: (201, REGISTERED)}))
    state = query_of(oauth.begin_authorization())["state"]
    oauth._pending[state]["at"] -= oauth.STATE_TTL_SECONDS + 1
    with pytest.raises(oauth.OAuthFlowError) as err:
        oauth.complete_authorization("c", state)
    assert err.value.reason == "invalid_state"


def test_registration_refused_is_a_typed_error(mgr, monkeypatch):
    monkeypatch.setattr(oauth.httpx, "Client", FakeHttp({oauth.REGISTER_URL: (400, {"error": "invalid_redirect_uri"})}))
    with pytest.raises(oauth.OAuthFlowError) as err:
        oauth.begin_authorization()
    assert err.value.reason == "registration_failed"


@pytest.fixture
def client(mgr):
    app = FastAPI()
    app.include_router(indmoney_routes.router, prefix="/api/v1")
    return TestClient(app, follow_redirects=False)


def test_connect_route_returns_the_consent_url(client, monkeypatch):
    monkeypatch.setattr(oauth.httpx, "Client", FakeHttp({oauth.REGISTER_URL: (201, REGISTERED)}))
    body = client.post("/api/v1/indmoney/connect").json()
    assert body["authorize_url"].startswith(oauth.AUTHORIZE_URL + "?")


def test_connect_route_reports_registration_failure(client, monkeypatch):
    monkeypatch.setattr(oauth.httpx, "Client", FakeHttp({oauth.REGISTER_URL: (500, {})}))
    resp = client.post("/api/v1/indmoney/connect")
    assert resp.status_code == 502
    assert resp.json()["detail"]["code"] == "indmoney_connect_failed"


def test_callback_redirects_to_portfolio_on_success_and_on_failure(client, monkeypatch):
    fake = FakeHttp({oauth.REGISTER_URL: (201, REGISTERED), oauth.TOKEN_URL: (200, TOKENS)})
    monkeypatch.setattr(oauth.httpx, "Client", fake)
    state = query_of(oauth.begin_authorization())["state"]

    ok = client.get("/api/v1/indmoney/callback", params={"code": "c", "state": state})
    assert ok.status_code == 307
    assert ok.headers["location"] == f"{oauth.DEFAULT_FRONTEND_URL}/portfolio?indmoney=connected"

    bad = client.get("/api/v1/indmoney/callback", params={"code": "c", "state": "forged"})
    assert "indmoney=error" in bad.headers["location"] and "reason=invalid_state" in bad.headers["location"]

    denied = client.get("/api/v1/indmoney/callback", params={"error": "access_denied"})
    assert "reason=access_denied" in denied.headers["location"]


def test_keep_alive_renews_only_inside_the_window(mgr, monkeypatch):
    mgr._store.update(access_token="old", refresh_token="r", client_id="c", client_secret="s")
    fake = FakeHttp({tok.TOKEN_URL: (200, {"access_token": "fresh", "refresh_token": "rotated", "expires_in": 3600})})
    monkeypatch.setattr(tok.httpx, "Client", fake)

    mgr._store["expires_at"] = int(time.time()) + 3600
    assert mgr.keep_alive() is False and not fake.sent  # plenty of life left

    mgr._store["expires_at"] = int(time.time()) + 60
    assert mgr.keep_alive() is True
    assert mgr._store["access_token"] == "fresh" and mgr._store["refresh_token"] == "rotated"


def test_keep_alive_does_not_resend_a_refused_token(mgr, monkeypatch):
    mgr._store.update(access_token="old", refresh_token="r", client_id="c", client_secret="s", expires_at=0)
    mgr._store["rejected_refresh_fp"] = tok._fingerprint("r")
    fake = FakeHttp({})
    monkeypatch.setattr(tok.httpx, "Client", fake)
    assert mgr.keep_alive() is False and not fake.sent
