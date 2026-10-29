"""INDmoney API routes — proxies live data from the INDmoney MCP server."""

import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Any, Dict

from ..tools.indmoney_client import (
    get_networth_snapshot,
    get_all_holdings,
    get_watchlist,
    get_holdings,
    invalidate_holdings_cache,
)
from ..tools.indmoney_token import token_manager
from .indmoney_models import (
    NetWorthSnapshot,
    AllHoldingsResponse,
    HoldingsResponse,
    IndMoneyWatchlistResponse,
    InvestmentItem,
    AssetClassItem,
    MarketCapItem,
    Liabilities,
    LoanItem,
    CreditCardItem,
    IndMoneyHolding,
    AssetSummary,
    WatchlistGroup,
    WatchlistStock,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/indmoney", tags=["indmoney"])


def _handle(fn, label: str):
    try:
        return fn()
    except RuntimeError as exc:
        msg = str(exc)
        if "INDMONEY_TOKEN" in msg:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="INDmoney token not configured. Set INDMONEY_TOKEN env var.",
            )
        logger.error("%s failed: %s", label, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"INDmoney MCP error: {msg}",
        )
    except Exception as exc:
        logger.error("%s unexpected error: %s", label, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Unexpected error fetching {label}: {str(exc)}",
        )


@router.get("/snapshot", response_model=NetWorthSnapshot)
async def indmoney_snapshot():
    """Live net-worth snapshot from INDmoney."""
    raw: Dict[str, Any] = _handle(get_networth_snapshot, "snapshot")
    try:
        liab_raw = raw.get("liabilities", {})
        liabilities = Liabilities(
            total_loan_balance=liab_raw.get("total_loan_balance", 0),
            total_credit_card_due=liab_raw.get("total_credit_card_due", 0),
            total=liab_raw.get("total", 0),
            loans=[LoanItem(**l) for l in liab_raw.get("loans", [])],
            credit_cards=[CreditCardItem(**c) for c in liab_raw.get("credit_cards", [])],
        )
        return NetWorthSnapshot(
            total_invested=raw["total_invested"],
            total_current_value=raw["total_current_value"],
            total_networth=raw["total_networth"],
            investments=[InvestmentItem.from_raw(i) for i in raw.get("investments", [])],
            assets=[AssetClassItem.from_raw(a) for a in raw.get("assets", [])],
            market_cap=[MarketCapItem.from_raw(m) for m in raw.get("market_cap", [])],
            liabilities=liabilities,
        )
    except Exception as exc:
        logger.error("Snapshot parse error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Parse error: {exc}")


@router.get("/holdings", response_model=AllHoldingsResponse)
async def indmoney_all_holdings(refresh: bool = False):
    """All holdings across IND_STOCK, MF, BOND, FD from INDmoney.
    Pass ?refresh=true to bypass the cache and fetch fresh data.
    """
    if refresh:
        invalidate_holdings_cache()
    raw: Dict[str, Any] = _handle(get_all_holdings, "all holdings")

    def parse_group(key: str) -> HoldingsResponse:
        group = raw.get(key, {})
        holdings = [IndMoneyHolding(**h) for h in group.get("holdings", [])]
        summary_raw = group.get("asset_summary", {})
        asset_summary = AssetSummary(**summary_raw) if summary_raw else AssetSummary()
        fetch_error = group.get("error")  # present when the per-asset MCP call failed
        return HoldingsResponse(holdings=holdings, asset_summary=asset_summary, fetch_error=fetch_error)

    return AllHoldingsResponse(
        ind_stocks=parse_group("ind_stocks"),
        mutual_funds=parse_group("mutual_funds"),
        bonds=parse_group("bonds"),
        fd=parse_group("fd"),
    )


@router.get("/holdings/{asset_type}", response_model=HoldingsResponse)
async def indmoney_holdings_by_type(asset_type: str):
    """Holdings for a specific asset type (IND_STOCK, MF, BOND, FD, US_STOCK, etc.)."""
    raw: Dict[str, Any] = _handle(
        lambda: get_holdings(asset_type.upper()), f"{asset_type} holdings"
    )
    holdings = [IndMoneyHolding(**h) for h in raw.get("holdings", [])]
    summary_raw = raw.get("asset_summary", {})
    asset_summary = AssetSummary(**summary_raw) if summary_raw else AssetSummary()
    return HoldingsResponse(holdings=holdings, asset_summary=asset_summary)


import glob
import os

def _determine_stock_market(ticker: str, ind_key: str = "") -> str:
    """Dynamically classify whether a stock ticker belongs to Indian market or US market from INDmoney attributes."""
    t = (ticker or "").strip().upper()
    k = (ind_key or "").strip().upper()
    if ":INDIA" in t or t.endswith(".NS") or t.endswith(".BO"):
        return "india"
    if ":US" in t:
        return "us"
    if k.startswith("INDS") or "NSE" in k or "BSE" in k or any(char.isdigit() for char in t):
        return "india"
    if k.startswith("USS") or "NASDAQ" in k or "NYSE" in k:
        return "us"
    # Fallback based on INDmoney default namespace
    return "india" if "IND" in k else "us"


def _get_existing_reports_set() -> set:
    """Find all existing generated report tickers."""
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "reports")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "reports")),
        os.path.abspath("reports"),
    ]
    for d in candidates:
        if os.path.exists(d):
            files = glob.glob(os.path.join(d, "*.pdf"))
            if files:
                return {os.path.splitext(os.path.basename(f))[0].upper() for f in files}
    return set()


@router.get("/watchlist", response_model=IndMoneyWatchlistResponse)
async def indmoney_watchlist():
    """Live watchlists from INDmoney with market classification and report availability."""
    raw: Dict[str, Any] = _handle(get_watchlist, "watchlist")
    existing_reports = _get_existing_reports_set()
    watchlists = []
    
    for wl in raw.get("watchlists", []):
        stocks = []
        us_c = 0
        in_c = 0
        for s in wl.get("stocks", []):
            ticker = s.get("ticker")
            if not ticker:
                continue
            ticker_clean = ticker.strip().upper()
            ind_key = s.get("ind_key") or ""
            market = _determine_stock_market(ticker_clean, ind_key)
            if market == "india":
                in_c += 1
            else:
                us_c += 1
            has_report = ticker_clean in existing_reports
            stocks.append(
                WatchlistStock(
                    ind_key=ind_key,
                    ticker=ticker_clean,
                    market=market,
                    has_report=has_report,
                )
            )

        watchlists.append(
            WatchlistGroup(
                name=wl["name"],
                watchlist_id=wl["watchlist_id"],
                stocks=stocks,
                us_count=us_c,
                india_count=in_c,
            )
        )

    return IndMoneyWatchlistResponse(type=raw.get("type", "all"), watchlists=watchlists)


# ─── Token management routes ──────────────────────────────────────────────────

class TokenUpdateRequest(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int = 3600
    client_id: str = ""
    client_secret: str = ""


@router.get("/token/status")
async def indmoney_token_status():
    """
    Return current token health — no secrets exposed.
    Useful for debugging auth issues without restarting the backend.
    """
    return token_manager.status()


@router.post("/token/refresh")
async def indmoney_token_refresh():
    """
    Manually trigger a token refresh using the stored refresh_token.
    Useful if you want to pre-warm the token or recover from expiry.
    """
    try:
        token_manager.force_refresh()
        return {"success": True, **token_manager.status()}
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.post("/token/update")
async def indmoney_token_update(req: TokenUpdateRequest):
    """
    Store a freshly-obtained token set after a new OAuth sign-in.
    Call this from the OAuth callback after completing the browser flow.
    """
    token_manager.update(
        access_token=req.access_token,
        refresh_token=req.refresh_token,
        expires_in=req.expires_in,
        client_id=req.client_id or None,
        client_secret=req.client_secret or None,
    )
    return {"success": True, **token_manager.status()}
