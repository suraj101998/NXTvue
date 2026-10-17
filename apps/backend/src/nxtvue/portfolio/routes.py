"""Portfolio API routes."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from pydantic import BaseModel

from .models import (
    PortfolioResponse, PortfolioSyncRequest, PortfolioSyncResponse,
    WatchlistResponse, WatchlistRequest,
    AnalysisHistoryResponse, AnalysisHistoryItem,
    PortfolioIntelligenceResponse
)
import asyncio
from .service import portfolio_service
from ..auth.dependencies import get_current_user, get_current_user_optional
from ..auth.models import User
from ..tools.yfinance_layer import yfinance_layer

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/holdings", response_model=PortfolioResponse)
async def get_portfolio_holdings(
    current_user: User = Depends(get_current_user)
):
    """Get user's portfolio holdings."""
    return portfolio_service.get_portfolio(current_user.id)


@router.post("/sync", response_model=PortfolioSyncResponse)
async def sync_portfolio(
    request: PortfolioSyncRequest,
    current_user: User = Depends(get_current_user)
):
    """Sync portfolio from INDmoney or manual input."""
    return portfolio_service.sync_portfolio(current_user.id, request)


# ─── Watchlist ────────────────────────────────────────────────────────────────

@router.get("/watchlist", response_model=WatchlistResponse)
async def get_watchlist(
    current_user: User = Depends(get_current_user)
):
    """Get user's watchlist."""
    return portfolio_service.get_watchlist(current_user.id)


@router.post("/watchlist", response_model=WatchlistResponse)
async def add_to_watchlist(
    request: WatchlistRequest,
    current_user: User = Depends(get_current_user)
):
    """Add item to watchlist."""
    return portfolio_service.add_to_watchlist(current_user.id, request)


@router.delete("/watchlist/{ticker}", response_model=WatchlistResponse)
async def remove_from_watchlist(
    ticker: str,
    current_user: User = Depends(get_current_user)
):
    """Remove item from watchlist."""
    return portfolio_service.remove_from_watchlist(current_user.id, ticker)


# ─── Analysis History ────────────────────────────────────────────────────────

@router.get("/analysis/history", response_model=AnalysisHistoryResponse)
async def get_analysis_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    analysis_type: Optional[str] = Query(None, pattern="^(stock|compare|portfolio)$"),
    current_user: User = Depends(get_current_user)
):
    """Get user's analysis history."""
    return portfolio_service.get_analysis_history(
        current_user.id,
        page=page,
        page_size=page_size,
        analysis_type=analysis_type
    )


@router.get("/analysis/history/{analysis_id}", response_model=AnalysisHistoryItem)
async def get_analysis_by_id(
    analysis_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get specific analysis by ID."""
    data = portfolio_service.get_analysis_history(current_user.id, page=1, page_size=1000)
    for item in data.items:
        if item.id == analysis_id:
            return item
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Analysis not found"
    )


# ─── Portfolio Intelligence ──────────────────────────────────────────────────

@router.get("/intelligence", response_model=PortfolioIntelligenceResponse)
async def get_portfolio_intelligence(
    current_user: User = Depends(get_current_user)
):
    """Get portfolio intelligence analysis."""
    return portfolio_service.get_portfolio_intelligence(current_user.id)


# ─── Search ────────────────────────────────────────────────────────────────────

class SearchResultItem(BaseModel):
    ticker: str
    name: str
    market: str
    type: str
    price: Optional[float] = None
    change_pct: Optional[float] = None


class SearchResponse(BaseModel):
    results: List[SearchResultItem]


@router.get("/search", response_model=SearchResponse)
async def search_tickers(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(10, ge=1, le=50),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Search for tickers by name or symbol across Indian and US markets."""
    loop = asyncio.get_event_loop()
    raw_results = await loop.run_in_executor(None, lambda: yfinance_layer.search_tickers(q, limit=limit))
    return SearchResponse(results=[SearchResultItem(**r) for r in raw_results])