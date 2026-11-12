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

import hashlib
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
KEEP_ALIVE_WINDOW_SECONDS = 900  # background job renews when less than 15 min is left
TOKEN_FILE = Path(__file__).parents[3] / "data" / "indmoney_tokens.json"

REAUTH_CODE = "indmoney_reauth_required"

# OAuth errors that mean "this login is over, a person has to sign in again".
_DEAD_GRANT_ERRORS = {"invalid_grant", "invalid_client", "unauthorized_client", "invalid_token"}

_ENV_FIELDS = [
    ("INDMONEY_TOKEN",         "access_token"),
    ("INDMONEY_REFRESH_TOKEN", "refresh_token"),
    ("INDMONEY_CLIENT_ID",     "client_id"),
    ("INDMONEY_CLIENT_SECRET", "client_secret"),
]


def _fingerprint(value: str) -> str:
    """Short one-way tag, so the store can notice a changed .env value without keeping a second secret."""
    return hashlib.sha256(value.encode()).hexdigest()[:16]


class IndmoneyAuthError(RuntimeError):
    """The INDmoney login can no longer be renewed automatically: the user has to sign in again.

    `reason` is a short machine tag (invalid_grant, missing_refresh_token, missing_client, unauthorized...).
    """

    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message


class TokenManager:
    """Thread-safe INDmoney OAuth token manager with persistent store."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._store: dict = {}
        self._last_auth_error: Optional[dict] = None
        self._load()

    # ── Persistence ───────────────────────────────────────────────────────────

    def _load(self) -> None:
        """Load token store from disk, then apply env vars.

        A value in .env wins when it is *new*: different from the one applied last time. A rotated
        refresh token that only lives in the store file is kept, because the old .env value would
        be dead by then. A missing field is always filled from .env. A store written before this
        tracking existed is only overridden for a refresh token INDmoney is known to have refused.
        """
        if TOKEN_FILE.exists():
            try:
                with open(TOKEN_FILE) as f:
                    self._store = json.load(f)
                logger.info("Loaded INDmoney token store from %s", TOKEN_FILE)
            except Exception as exc:
                logger.warning("Could not read token store: %s — starting fresh", exc)
                self._store = {}

        changed = False
        legacy = "env_applied" not in self._store
        applied: dict = self._store.setdefault("env_applied", {})
        changed = legacy
        for env_key, store_key in _ENV_FIELDS:
            val = os.getenv(env_key, "")
            if not val:
                continue
            tag = _fingerprint(val)
            stored = self._store.get(store_key, "")
            if not stored:
                take = True
            elif legacy:
                take = store_key == "refresh_token" and self._is_rejected() and val != stored
            else:
                take = applied.get(env_key) != tag
            if take:
                if stored and stored != val:
                    logger.info("%s in .env changed — replacing the stored %s", env_key, store_key)
                self._store[store_key] = val
                if store_key == "access_token":
                    self._store["expires_at"] = int(time.time()) + 3600
            if take or not applied.get(env_key):
                applied[env_key] = tag
                changed = True

        # If we just got a fresh access token from env but no expiry, set ~1 h
        if self._store.get("access_token") and not self._store.get("expires_at"):
            self._store["expires_at"] = int(time.time()) + 3600
            changed = True

        if changed:
            self._save()
        self._warn_if_unusable()

    def _warn_if_unusable(self) -> None:
        missing = [k for k in ("refresh_token", "client_id", "client_secret") if not self._store.get(k)]
        if missing:
            logger.warning(
                "INDmoney auto-refresh is not possible: missing %s. Live portfolio data will stop when the "
                "access token expires. Set the INDMONEY_* variables in apps/backend/.env.",
                ", ".join(missing),
            )

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
                raise IndmoneyAuthError(
                    "missing_access_token",
                    "No INDmoney access token available. "
                    "Set INDMONEY_TOKEN (and ideally INDMONEY_REFRESH_TOKEN + "
                    "INDMONEY_CLIENT_ID + INDMONEY_CLIENT_SECRET) in your .env, "
                    "then restart the backend.",
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
                "reauth_required":   self._is_rejected(),
                "last_auth_error":   self._last_auth_error,
            }

    def keep_alive(self, window: int = KEEP_ALIVE_WINDOW_SECONDS) -> bool:
        """Renew the access token ahead of time so the (rotating) refresh token never sits idle.

        Returns True when a refresh happened. Does nothing while the stored refresh token is the one
        INDmoney already refused. Raises IndmoneyAuthError / RuntimeError like a normal refresh.
        """
        with self._lock:
            if not self._store.get("refresh_token") or self._is_rejected():
                return False
            if time.time() < self._store.get("expires_at", 0) - window:
                return False
            self._do_refresh()
            return True

    def get_oauth_client(self) -> Optional[dict]:
        """The client we registered with INDmoney for the interactive sign-in (None until registered)."""
        with self._lock:
            client = self._store.get("oauth_client")
            return dict(client) if client else None

    def set_oauth_client(self, client_id: str, client_secret: str, redirect_uri: str) -> None:
        with self._lock:
            self._store["oauth_client"] = {
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
            }
            self._save()

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
            self._clear_rejection()
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

    def _is_rejected(self) -> bool:
        """True while the stored refresh token is the one INDmoney refused (persisted across restarts)."""
        stored = self._store.get("refresh_token", "")
        return bool(stored) and self._store.get("rejected_refresh_fp") == _fingerprint(stored)

    def _clear_rejection(self) -> None:
        self._store.pop("rejected_refresh_fp", None)
        self._last_auth_error = None

    def _reauth(self, reason: str, message: str) -> IndmoneyAuthError:
        self._last_auth_error = {"reason": reason, "message": message, "at": int(time.time())}
        return IndmoneyAuthError(reason, message)

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
            raise self._reauth(
                "missing_refresh_token",
                "Cannot auto-refresh: no refresh_token stored. "
                "Set INDMONEY_REFRESH_TOKEN in your .env and restart.",
            )
        if not client_id or not client_secret:
            raise self._reauth(
                "missing_client",
                "Cannot auto-refresh: client_id/client_secret missing. "
                "Set INDMONEY_CLIENT_ID and INDMONEY_CLIENT_SECRET in your .env.",
            )
        if self._is_rejected():
            # INDmoney already refused this exact token: do not hammer the token endpoint.
            last = self._last_auth_error or {}
            raise IndmoneyAuthError(
                last.get("reason", "invalid_grant"),
                last.get("message", "INDmoney refused the stored refresh token."),
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
            status_code = exc.response.status_code
            body = exc.response.text
            try:
                oauth_error = str(exc.response.json().get("error", ""))
            except Exception:
                oauth_error = ""
            message = f"Token refresh failed (HTTP {status_code}): {body}"
            if oauth_error in _DEAD_GRANT_ERRORS or (status_code in (400, 401) and not oauth_error):
                self._store["rejected_refresh_fp"] = _fingerprint(refresh_token)
                self._save()
                logger.error("INDmoney refresh token rejected (%s) — sign-in required", oauth_error or status_code)
                raise self._reauth(oauth_error or "invalid_grant", message) from exc
            raise RuntimeError(message) from exc
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
        self._clear_rejection()
        self._save()
        logger.info(
            "INDmoney token refreshed successfully; next expiry in %ds", expires_in
        )


# ── Module-level singleton ─────────────────────────────────────────────────────
token_manager = TokenManager()
