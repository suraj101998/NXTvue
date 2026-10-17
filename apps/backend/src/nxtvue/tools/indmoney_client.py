"""INDmoney MCP client — calls https://mcp.indmoney.com/mcp via JSON-RPC over SSE."""

import json
import logging
import threading
import time
from typing import Any, Dict, Optional, Tuple

import httpx

from .indmoney_token import token_manager

logger = logging.getLogger(__name__)

MCP_URL = "https://mcp.indmoney.com/mcp"

# ─── In-process TTL cache ──────────────────────────────────────────────────────
# Read-heavy usage: portfolio positions don't change intraday, so 6-hour TTL
# means at most 4 MCP calls per day — well within INDmoney rate limits.

_HOLDINGS_TTL = 6 * 3600   # 6 hours
_SNAPSHOT_TTL = 6 * 3600   # 6 hours
_WATCHLIST_TTL = 6 * 3600  # 6 hours

_cache_lock = threading.Lock()
_cache: Dict[str, Tuple[float, Any]] = {}   # key → (expires_at, data)


def _cache_get(key: str) -> Optional[Any]:
    with _cache_lock:
        entry = _cache.get(key)
        if entry and time.time() < entry[0]:
            return entry[1]
        return None


def _cache_set(key: str, data: Any, ttl: int) -> None:
    with _cache_lock:
        _cache[key] = (time.time() + ttl, data)


def _cache_invalidate(key: str) -> None:
    with _cache_lock:
        _cache.pop(key, None)


# ─── MCP JSON-RPC call ────────────────────────────────────────────────────────

def _call(tool: str, arguments: Dict[str, Any] = {}) -> Any:
    """
    Call an INDmoney MCP tool and return the parsed JSON result.

    - Fetches a valid token from TokenManager (auto-refreshes if near expiry).
    - On a 401 response, force-refreshes once and retries.
    - Raises RuntimeError on MCP-level errors or unrecoverable failures.
    """
    for attempt in range(2):          # attempt 0 = normal, attempt 1 = after force-refresh
        token = token_manager.get_token() if attempt == 0 else token_manager.force_refresh()

        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": tool, "arguments": arguments},
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=30) as client:
                resp = client.post(MCP_URL, json=payload, headers=headers)
        except httpx.RequestError as exc:
            raise RuntimeError(f"INDmoney MCP request failed: {exc}") from exc

        # 401 → force-refresh on first attempt, then bubble up
        if resp.status_code == 401:
            if attempt == 0:
                logger.warning("INDmoney 401 — forcing token refresh and retrying…")
                continue
            raise RuntimeError(
                "INDmoney MCP returned 401 after token refresh. "
                "Re-authenticate via the OAuth flow."
            )

        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"INDmoney MCP HTTP error {exc.response.status_code}: {exc.response.text}"
            ) from exc

        # MCP returns Server-Sent Events — parse the `data:` line
        for line in resp.text.splitlines():
            if line.startswith("data:"):
                obj = json.loads(line[5:].strip())
                if obj.get("result", {}).get("isError"):
                    msg = obj["result"]["content"][0]["text"]
                    raise RuntimeError(f"INDmoney MCP tool error ({tool}): {msg}")
                raw = obj["result"]["content"][0]["text"]
                return json.loads(raw)

        raise RuntimeError(f"No data line in MCP response for tool={tool}")

    # Should never reach here
    raise RuntimeError("INDmoney _call exhausted retries")


# ─── Public helpers ────────────────────────────────────────────────────────────

def get_networth_snapshot() -> Dict[str, Any]:
    """Full net-worth snapshot (cached 2 min to avoid rate limits)."""
    cached = _cache_get("snapshot")
    if cached is not None:
        logger.debug("Returning cached snapshot")
        return cached
    result = _call("networth_snapshot")
    _cache_set("snapshot", result, _SNAPSHOT_TTL)
    return result


def get_holdings(asset_type: str) -> Dict[str, Any]:
    """
    Row-level holdings for one asset type (no cache — called by get_all_holdings).
    asset_type: IND_STOCK | MF | US_STOCK | BOND | FD | EPF | GOLD | SILVER | SA
    """
    return _call("networth_holdings", {"asset_type": asset_type})


def get_watchlist() -> Dict[str, Any]:
    """All user watchlists with tickers (cached 5 min)."""
    cached = _cache_get("watchlist")
    if cached is not None:
        logger.debug("Returning cached watchlist")
        return cached
    result = _call("user_watchlist")
    _cache_set("watchlist", result, _WATCHLIST_TTL)
    return result


def get_all_holdings() -> Dict[str, Any]:
    """
    Fetch IND_STOCK, MF, BOND, FD holdings sequentially with a 400 ms inter-request
    delay to stay under INDmoney rate limits. Result is cached for 2 minutes so that
    repeated page navigations and HMR reloads never re-hit the MCP.
    Returns:
      {
        "ind_stocks":  { holdings: [...], asset_summary: {...} },
        "mutual_funds":{ holdings: [...], asset_summary: {...} },
        "bonds":       { holdings: [...], asset_summary: {...} },
        "fd":          { holdings: [...], asset_summary: {...} },
      }
    """
    cached = _cache_get("all_holdings")
    if cached is not None:
        # Only return cache if it has actual data (not a previously failed fetch)
        has_data = any(
            len(cached.get(k, {}).get("holdings", [])) > 0
            for k in ["ind_stocks", "mutual_funds"]
        )
        if has_data:
            logger.debug("Returning cached all_holdings")
            return cached

    asset_types = [
        ("ind_stocks",   "IND_STOCK"),
        ("mutual_funds", "MF"),
        ("bonds",        "BOND"),
        ("fd",           "FD"),
    ]

    results: Dict[str, Any] = {}
    any_error = False

    for i, (key, at) in enumerate(asset_types):
        if i > 0:
            time.sleep(0.5)  # 500 ms gap — well under rate limit threshold
        try:
            results[key] = get_holdings(at)
        except Exception as exc:
            logger.warning("Failed to fetch %s holdings: %s", at, exc)
            # Extract a clean error label (e.g. "rate_limit_exceeded")
            msg = str(exc)
            if "rate_limit" in msg.lower():
                error_label = "rate_limit_exceeded"
            elif "401" in msg:
                error_label = "auth_error"
            else:
                error_label = "fetch_failed"
            results[key] = {"holdings": [], "asset_summary": {}, "error": error_label}
            any_error = True

    # Only cache if we got complete data — don't cache partial failures
    if not any_error:
        _cache_set("all_holdings", results, _HOLDINGS_TTL)
    else:
        _cache_invalidate("all_holdings")

    return results


def invalidate_holdings_cache() -> None:
    """Force-invalidate the holdings cache (e.g. after a manual refresh)."""
    _cache_invalidate("all_holdings")
    _cache_invalidate("snapshot")
