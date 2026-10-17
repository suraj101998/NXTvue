"""Portfolio models and schemas."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr


@dataclass
class PortfolioHolding:
    """Portfolio holding model."""
    ticker: str
    company_name: str
    market: str
    qty: float
    avg_cost: float
    current_price: Optional[float] = None
    invested: float = 0
    current_value: float = 0
    unrealised_pnl: float = 0
    gain_pct: Optional[float] = None
    weight_pct: float = 0

    def to_dict(self) -> dict:
        return {
            "ticker": self.ticker,
            "company_name": self.company_name,
            "market": self.market,
            "qty": self.qty,
            "avg_cost": self.avg_cost,
            "current_price": self.current_price,
            "invested": self.invested,
            "current_value": self.current_value,
            "unrealised_pnl": self.unrealised_pnl,
            "gain_pct": self.gain_pct,
            "weight_pct": self.weight_pct,
        }


@dataclass
class PortfolioSummary:
    """Portfolio summary model."""
    total_invested: float
    total_value: float
    total_pnl: float
    total_gain_pct: float
    num_holdings: int
    best_performer: Optional[str] = None
    worst_performer: Optional[str] = None


@dataclass
class PortfolioMetrics:
    """Portfolio metrics model."""
    summary: PortfolioSummary
    holdings: List[PortfolioHolding]
    market_allocation: Dict[str, float]
    top_gainers: List[Dict[str, Any]]
    top_losers: List[Dict[str, Any]]
    concentration_flags: List[str]
    rebalancing_signals: List[str]

    def to_dict(self) -> dict:
        return {
            "summary": {
                "total_invested": self.summary.total_invested,
                "total_value": self.summary.total_value,
                "total_pnl": self.summary.total_pnl,
                "total_gain_pct": self.summary.total_gain_pct,
                "num_holdings": self.summary.num_holdings,
                "best_performer": self.summary.best_performer,
                "worst_performer": self.summary.worst_performer,
            },
            "holdings": [h.to_dict() for h in self.holdings],
            "market_allocation": self.market_allocation,
            "top_gainers": self.top_gainers,
            "top_losers": self.top_losers,
            "concentration_flags": self.concentration_flags,
            "rebalancing_signals": self.rebalancing_signals,
        }


class PortfolioHoldingRequest(BaseModel):
    """Request model for a portfolio holding."""
    ticker: str
    qty: float
    avg_cost: float
    market: str = "india"


class PortfolioSyncRequest(BaseModel):
    """Request model for portfolio sync."""
    source: str = "indmoney"  # indmoney, manual, file
    holdings: Optional[List[PortfolioHoldingRequest]] = None
    file_data: Optional[str] = None  # base64 encoded file


class PortfolioResponse(BaseModel):
    """Portfolio response model."""
    user_id: str
    holdings: List[Dict[str, Any]]
    summary: Dict[str, Any]
    market_allocation: Dict[str, float]
    sector_allocation: Dict[str, float]
    last_synced: Optional[str] = None
    data_source: str = "indmoney"


class PortfolioSyncResponse(BaseModel):
    """Portfolio sync response model."""
    success: bool
    message: str
    holdings_count: int
    last_synced: str


class WatchlistItem(BaseModel):
    """Watchlist item model."""
    ticker: str
    name: str
    market: str
    added_at: Optional[str] = None


class WatchlistRequest(BaseModel):
    """Request model for watchlist operations."""
    ticker: str
    name: Optional[str] = None
    market: str = "india"


class WatchlistResponse(BaseModel):
    """Watchlist response model."""
    items: List[WatchlistItem]


class AnalysisHistoryItem(BaseModel):
    """Analysis history item model."""
    id: str
    ticker: str
    market: str
    analysis_type: str  # "stock", "compare", "portfolio"
    created_at: str
    projection_year: int
    status: str  # "completed", "failed"
    pdf_path: Optional[str] = None


class AnalysisHistoryResponse(BaseModel):
    """Analysis history response model."""
    items: List[AnalysisHistoryItem]
    total: int
    page: int
    page_size: int


# ─── Search ────────────────────────────────────────────────────────────────────

class SearchResultItem(BaseModel):
    """Search result item model."""
    ticker: str
    name: str
    market: str
    type: str
    price: Optional[float] = None
    change_pct: Optional[float] = None


class SearchResponse(BaseModel):
    """Search response model."""
    results: List[SearchResultItem]


# ─── Portfolio Intelligence ────────────────────────────────────────────────

class PortfolioIntelligenceResponse(BaseModel):
    """Portfolio intelligence response model."""
    health_score: int
    health_label: str
    diversification: Dict[str, Any]
    risk: Dict[str, Any]
    concentration: Dict[str, Any]
    sector_concentration: List[Dict[str, Any]]
    currency_exposure: List[Dict[str, Any]]
    etf_overlap: List[Dict[str, Any]]
    correlation_matrix: Dict[str, Any]
    rebalancing: List[Dict[str, Any]]
    data_gaps: List[str]
    note: str