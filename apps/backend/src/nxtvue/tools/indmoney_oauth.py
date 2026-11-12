"""
INDmoney interactive sign-in (OAuth 2.0 authorization-code flow with PKCE).

Used when the stored refresh token is dead and a person has to consent again:

  1. ``begin_authorization()``  registers a client with INDmoney once (RFC 7591 dynamic registration),
     then returns the /authorize URL to send the browser to.
  2. INDmoney redirects the browser back to ``redirect_uri`` with ``code`` + ``state``.
  3. ``complete_authorization()`` swaps the code for tokens and stores them via the token manager,
     together with the client that minted them (a refresh token only works for its own client).

Endpoints come from https://mcp.indmoney.com/.well-known/oauth-authorization-server.
"""

import base64
import hashlib
import logging
import os
import secrets
import threading
import time
from typing import Optional
from urllib.parse import urlencode

import httpx

from .indmoney_token import TOKEN_URL, token_manager

logger = logging.getLogger(__name__)

AUTHORIZE_URL = "https://mcp.indmoney.com/authorize"
REGISTER_URL = "https://mcp.indmoney.com/register"
SCOPES = "portfolio:read market:read insights:write"
CLIENT_NAME = "NXTvue"
STATE_TTL_SECONDS = 600

DEFAULT_REDIRECT_URI = "http://localhost:8000/api/v1/indmoney/callback"
DEFAULT_FRONTEND_URL = "http://localhost:5173"


class OAuthFlowError(RuntimeError):
    """The interactive sign-in could not start or finish. `reason` is a short machine tag for the UI."""

    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message


def redirect_uri() -> str:
    return os.getenv("INDMONEY_REDIRECT_URI", DEFAULT_REDIRECT_URI)


def frontend_url() -> str:
    return os.getenv("INDMONEY_FRONTEND_URL", DEFAULT_FRONTEND_URL).rstrip("/")


# ── Pending sign-ins (state -> PKCE verifier). In memory: a sign-in lasts minutes. ─────────────

_pending: dict[str, dict] = {}
_pending_lock = threading.Lock()


def _remember(state: str, verifier: str) -> None:
    now = time.time()
    with _pending_lock:
        for key in [k for k, v in _pending.items() if now - v["at"] > STATE_TTL_SECONDS]:
            del _pending[key]
        _pending[state] = {"verifier": verifier, "at": now}


def _take(state: str) -> Optional[str]:
    with _pending_lock:
        entry = _pending.pop(state, None)
    if not entry or time.time() - entry["at"] > STATE_TTL_SECONDS:
        return None
    return entry["verifier"]


def _pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


# ── Client registration ─────────────────────────────────────────────────────────────────────


def ensure_client() -> tuple[str, str]:
    """Return (client_id, client_secret) registered for our redirect URI, registering on first use."""
    uri = redirect_uri()
    client = token_manager.get_oauth_client()
    if client and client.get("redirect_uri") == uri and client.get("client_id") and client.get("client_secret"):
        return client["client_id"], client["client_secret"]

    logger.info("Registering an INDmoney OAuth client for %s", uri)
    try:
        with httpx.Client(timeout=15) as http:
            resp = http.post(
                REGISTER_URL,
                json={
                    "client_name": CLIENT_NAME,
                    "redirect_uris": [uri],
                    "grant_types": ["authorization_code", "refresh_token"],
                    "response_types": ["code"],
                    "token_endpoint_auth_method": "client_secret_post",
                    "scope": SCOPES,
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        raise OAuthFlowError(
            "registration_failed",
            f"INDmoney refused client registration (HTTP {exc.response.status_code}): {exc.response.text[:300]}",
        ) from exc
    except Exception as exc:
        raise OAuthFlowError("registration_unreachable", f"Could not reach INDmoney to register: {exc}") from exc

    client_id = data.get("client_id", "")
    client_secret = data.get("client_secret", "")
    if not client_id or not client_secret:
        raise OAuthFlowError("registration_incomplete", "INDmoney registration returned no client_id/client_secret.")
    token_manager.set_oauth_client(client_id, client_secret, uri)
    return client_id, client_secret


# ── Flow ────────────────────────────────────────────────────────────────────────────────────


def begin_authorization() -> str:
    """Create a PKCE challenge + state and return the INDmoney consent URL."""
    client_id, _ = ensure_client()
    verifier, challenge = _pkce_pair()
    state = secrets.token_urlsafe(24)
    _remember(state, verifier)
    query = urlencode(
        {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": redirect_uri(),
            "scope": SCOPES,
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
    )
    return f"{AUTHORIZE_URL}?{query}"


def complete_authorization(code: str, state: str) -> None:
    """Exchange the authorization code for tokens and store them."""
    verifier = _take(state)
    if not verifier:
        raise OAuthFlowError("invalid_state", "This sign-in link is invalid or has expired. Start again.")
    client = token_manager.get_oauth_client()
    if not client:
        raise OAuthFlowError("no_client", "No registered INDmoney client. Start the sign-in again.")

    try:
        with httpx.Client(timeout=15) as http:
            resp = http.post(
                TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": client["redirect_uri"],
                    "client_id": client["client_id"],
                    "client_secret": client["client_secret"],
                    "code_verifier": verifier,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        raise OAuthFlowError(
            "code_exchange_failed",
            f"INDmoney rejected the sign-in (HTTP {exc.response.status_code}): {exc.response.text[:300]}",
        ) from exc
    except Exception as exc:
        raise OAuthFlowError("token_unreachable", f"Could not reach INDmoney to finish sign-in: {exc}") from exc

    access = data.get("access_token", "")
    refresh = data.get("refresh_token", "")
    if not access or not refresh:
        raise OAuthFlowError("incomplete_tokens", "INDmoney returned no access/refresh token.")

    token_manager.update(
        access_token=access,
        refresh_token=refresh,
        expires_in=int(data.get("expires_in", 3600)),
        client_id=client["client_id"],
        client_secret=client["client_secret"],
    )
    logger.info("INDmoney sign-in completed; tokens stored")


# ── Keep-alive ──────────────────────────────────────────────────────────────────────────────

KEEP_ALIVE_INTERVAL_SECONDS = 300


async def keep_alive_loop(interval: int = KEEP_ALIVE_INTERVAL_SECONDS) -> None:
    """Background task: renew the access token before it lapses so the rotating refresh token stays alive.

    A dead link is logged once per change and left for the user to reconnect; it never crashes the loop.
    """
    import asyncio

    from .indmoney_token import IndmoneyAuthError

    while True:
        try:
            if await asyncio.to_thread(token_manager.keep_alive):
                logger.info("INDmoney keep-alive: token renewed")
        except IndmoneyAuthError as exc:
            logger.warning("INDmoney keep-alive: sign-in required (%s)", exc.reason)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("INDmoney keep-alive failed: %s", exc)
        await asyncio.sleep(interval)
