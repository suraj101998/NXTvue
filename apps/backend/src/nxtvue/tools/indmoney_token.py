"""
INDmoney OAuth token manager.

Responsibilities:
- Load the access/refresh token from a JSON file on disk.
- Seed the store from env vars (INDMONEY_TOKEN, INDMONEY_REFRESH_TOKEN,
  INDMONEY_CLIENT_ID, INDMONEY_CLIENT_SECRET) when no store file exists yet.
- Return a valid access token for every call, auto-refreshing when the token
  is within REFRESH_BUFFER_SECONDS of expiry.
- On a 401 from the MCP endpoint, force-refresh once then retry.
- Thread-safe: a threading.Lock guards all store reads/writes.

Token store file: apps/backend/data/indmoney_tokens.json
Schema:
  {
    "access_token":  "...",
    "refresh_token": "...",
    "expires_at":    1234567890,   # unix timestamp
    "client_id":     "...",
    "client_secret": "..."
  }
"""

import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

TOKEN_URL = "https://mcp.indmoney.com/token"
REFRESH_BUFFER_SECONDS = 300   # refresh 5 min before actual expiry
TOKEN_FILE = Path(__file__).parents[3] / "data" / "indmoney_tokens.json"


class TokenManager:
    """Thread-safe INDmoney OAuth token manager with persistent store."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._store: dict = {}
        self._load()

    # ── Persistence ───────────────────────────────────────────────────────────

    def _load(self) -> None:
        """Load token store from disk, then seed missing fields from env vars."""
        if TOKEN_FILE.exists():
            try:
                with open(TOKEN_FILE) as f:
                    self._store = json.load(f)
                logger.info("Loaded INDmoney token store from %s", TOKEN_FILE)
            except Exception as exc:
                logger.warning("Could not read token store: %s — starting fresh", exc)
                self._store = {}

        # Seed from environment if store is missing critical fields
        changed = False
        for env_key, store_key in [
            ("INDMONEY_TOKEN",         "access_token"),
            ("INDMONEY_REFRESH_TOKEN", "refresh_token"),
            ("INDMONEY_CLIENT_ID",     "client_id"),
            ("INDMONEY_CLIENT_SECRET", "client_secret"),
        ]:
            val = os.getenv(env_key, "")
            if val and not self._store.get(store_key):
                self._store[store_key] = val
                changed = True

        # If we just got a fresh access token from env but no expiry, set ~1 h
        if self._store.get("access_token") and not self._store.get("expires_at"):
            self._store["expires_at"] = int(time.time()) + 3600
            changed = True

        if changed:
            self._save()

    def _save(self) -> None:
        """Persist the token store to disk."""
        try:
            TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(TOKEN_FILE, "w") as f:
                json.dump(self._store, f, indent=2)
        except Exception as exc:
            logger.error("Could not save token store: %s", exc)

    # ── Public API ────────────────────────────────────────────────────────────

    def get_token(self) -> str:
        """Return a valid access token, refreshing first if near expiry."""
        with self._lock:
            if self._needs_refresh():
                self._do_refresh()
            token = self._store.get("access_token", "")
            if not token:
                raise RuntimeError(
                    "No INDmoney access token available. "
                    "Set INDMONEY_TOKEN (and ideally INDMONEY_REFRESH_TOKEN + "
                    "INDMONEY_CLIENT_ID + INDMONEY_CLIENT_SECRET) in your .env, "
                    "then restart the backend."
                )
            return token

    def force_refresh(self) -> str:
        """Force-refresh the access token (called after a 401)."""
        with self._lock:
            self._do_refresh()
            return self._store["access_token"]

    def status(self) -> dict:
        """Return a safe status dict (no secrets) for the /token/status endpoint."""
        with self._lock:
            expires_at = self._store.get("expires_at", 0)
            seconds_left = max(0, int(expires_at - time.time()))
            return {
                "has_access_token":  bool(self._store.get("access_token")),
                "has_refresh_token": bool(self._store.get("refresh_token")),
                "has_client_id":     bool(self._store.get("client_id")),
                "has_client_secret": bool(self._store.get("client_secret")),
                "expires_at":        expires_at,
                "seconds_until_expiry": seconds_left,
                "needs_refresh":     self._needs_refresh(),
                "token_file":        str(TOKEN_FILE),
            }

    def update(
        self,
        access_token: str,
        refresh_token: str,
        expires_in: int = 3600,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
    ) -> None:
        """Manually store a newly-obtained token set (called from OAuth callback route)."""
        with self._lock:
            self._store["access_token"]  = access_token
            self._store["refresh_token"] = refresh_token
            self._store["expires_at"]    = int(time.time()) + expires_in
            if client_id:
                self._store["client_id"]     = client_id
            if client_secret:
                self._store["client_secret"] = client_secret
            self._save()
            logger.info("Token store updated manually; expires in %ds", expires_in)

    # ── Internal ──────────────────────────────────────────────────────────────

    def _needs_refresh(self) -> bool:
        expires_at = self._store.get("expires_at", 0)
        return time.time() >= (expires_at - REFRESH_BUFFER_SECONDS)

    def _do_refresh(self) -> None:
        """
        Use the refresh_token grant to obtain a new access token.
        Updates the store in place and persists to disk.
        Raises RuntimeError if refresh fails (caller must handle).
        """
        refresh_token  = self._store.get("refresh_token", "")
        client_id      = self._store.get("client_id", "")
        client_secret  = self._store.get("client_secret", "")

        if not refresh_token:
            raise RuntimeError(
                "Cannot auto-refresh: no refresh_token stored. "
                "Set INDMONEY_REFRESH_TOKEN in your .env and restart."
            )
        if not client_id or not client_secret:
            raise RuntimeError(
                "Cannot auto-refresh: client_id/client_secret missing. "
                "Set INDMONEY_CLIENT_ID and INDMONEY_CLIENT_SECRET in your .env."
            )

        logger.info("Auto-refreshing INDmoney access token…")
        try:
            with httpx.Client(timeout=15) as client:
                resp = client.post(
                    TOKEN_URL,
                    data={
                        "grant_type":    "refresh_token",
                        "refresh_token": refresh_token,
                        "client_id":     client_id,
                        "client_secret": client_secret,
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                resp.raise_for_status()
                data = resp.json()

        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"Token refresh failed (HTTP {exc.response.status_code}): "
                f"{exc.response.text}"
            ) from exc
        except Exception as exc:
            raise RuntimeError(f"Token refresh request failed: {exc}") from exc

        new_access  = data.get("access_token", "")
        new_refresh = data.get("refresh_token", refresh_token)  # reuse old if not rotated
        expires_in  = int(data.get("expires_in", 3600))

        if not new_access:
            raise RuntimeError(f"Token refresh response missing access_token: {data}")

        self._store["access_token"]  = new_access
        self._store["refresh_token"] = new_refresh
        self._store["expires_at"]    = int(time.time()) + expires_in
        self._save()
        logger.info(
            "INDmoney token refreshed successfully; next expiry in %ds", expires_in
        )


# ── Module-level singleton ─────────────────────────────────────────────────────
token_manager = TokenManager()
