"""Pydantic models for INDmoney MCP API responses."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, field_validator


def _number_or_none(value: Any) -> Any:
    """INDmoney sometimes sends a placeholder string ("unknown", "N/A", "") where a number belongs
    (e.g. a bond it has no price for). Treat that as "no value" instead of failing the whole response."""
    if isinstance(value, str):
        try:
            return float(value.replace(",", ""))
        except ValueError:
            return None
    return value


# ─── Shared ───────────────────────────────────────────────────────────────────

class AssetSummary(BaseModel):
    total_value: float = 0
    invested: float = 0
    one_day_change: float = 0
    one_day_change_percentage: float = 0
    total_value_usd: Optional[float] = None
    invested_usd: Optional[float] = None
    one_day_change_usd: Optional[float] = None

    @field_validator("*", mode="before")
    @classmethod
    def _clean_numbers(cls, v: Any) -> Any:
        if isinstance(v, str):
            parsed = _number_or_none(v)
            return 0 if parsed is None else parsed
        return v


# ─── Holdings ─────────────────────────────────────────────────────────────────

class IndMoneyHolding(BaseModel):
    investment_code: Optional[str] = None
    investment: str
    asset_type: str
    assetclass_l2: Optional[str] = None
    invested_amount: float = 0
    market_value: float = 0
    holding_percent: float = 0
    total_pnl: float = 0
    pnl_per: float = 0
    total_units: Optional[float] = None
    unit_price: Optional[float] = None
    broker: Optional[str] = None
    market_cap: Optional[str] = None
    one_day_change: float = 0
    one_day_change_percentage: float = 0

    @field_validator(
        "invested_amount", "market_value", "holding_percent", "total_pnl", "pnl_per",
        "total_units", "unit_price", "one_day_change", "one_day_change_percentage",
        mode="before",
    )
    @classmethod
    def _clean_numbers(cls, v: Any, info) -> Any:
        v = _number_or_none(v)
        if v is None:
            # Optional fields stay unset; required-with-default ones fall back to 0.
            return None if info.field_name in ("total_units", "unit_price") else 0
        return v


class HoldingsResponse(BaseModel):
    holdings: List[IndMoneyHolding]
    asset_summary: AssetSummary
    fetch_error: Optional[str] = None  # set when the MCP call failed silently


class AllHoldingsResponse(BaseModel):
    ind_stocks: HoldingsResponse
    mutual_funds: HoldingsResponse
    bonds: HoldingsResponse
    fd: HoldingsResponse


# ─── Net Worth Snapshot ───────────────────────────────────────────────────────

class InvestmentItem(BaseModel):
    asset_type: str
    invested_value: float = 0
    current_value: float = 0
    return_: float = 0
    return_percentage: float = 0
    progress_value_percentage: float = 0

    class Config:
        populate_by_name = True

    @classmethod
    def from_raw(cls, d: Dict[str, Any]) -> "InvestmentItem":
        return cls(
            asset_type=d["asset_type"],
            invested_value=d.get("invested_value", 0),
            current_value=d.get("current_value", 0),
            return_=d.get("return", 0),
            return_percentage=d.get("return_percentage", 0),
            progress_value_percentage=d.get("progress_value_percentage", 0),
        )


class AssetClassItem(BaseModel):
    assetclass_l2: str
    invested_value: float = 0
    current_value: float = 0
    return_: float = 0
    return_percentage: float = 0
    progress_value_percentage: float = 0

    @classmethod
    def from_raw(cls, d: Dict[str, Any]) -> "AssetClassItem":
        return cls(
            assetclass_l2=d["assetclass_l2"],
            invested_value=d.get("invested_value", 0),
            current_value=d.get("current_value", 0),
            return_=d.get("return", 0),
            return_percentage=d.get("return_percentage", 0),
            progress_value_percentage=d.get("progress_value_percentage", 0),
        )


class MarketCapItem(BaseModel):
    market_cap: str
    invested_value: float = 0
    current_value: float = 0
    return_: float = 0
    return_percentage: float = 0
    progress_value_percentage: float = 0

    @classmethod
    def from_raw(cls, d: Dict[str, Any]) -> "MarketCapItem":
        return cls(
            market_cap=d["market_cap"],
            invested_value=d.get("invested_value", 0),
            current_value=d.get("current_value", 0),
            return_=d.get("return", 0),
            return_percentage=d.get("return_percentage", 0),
            progress_value_percentage=d.get("progress_value_percentage", 0),
        )


class LoanItem(BaseModel):
    lender: str
    loan_type: str
    current_balance: float = 0


class CreditCardItem(BaseModel):
    name: str
    card_variant: str
    total_due: float = 0
    due_date: Optional[str] = None


class Liabilities(BaseModel):
    total_loan_balance: float = 0
    total_credit_card_due: float = 0
    total: float = 0
    loans: List[LoanItem] = []
    credit_cards: List[CreditCardItem] = []


class NetWorthSnapshot(BaseModel):
    total_invested: float
    total_current_value: float
    total_networth: float
    investments: List[InvestmentItem]
    assets: List[AssetClassItem]
    market_cap: List[MarketCapItem]
    liabilities: Liabilities


# ─── Watchlist ────────────────────────────────────────────────────────────────

class WatchlistStock(BaseModel):
    ind_key: Optional[str] = None
    ticker: Optional[str] = None
    market: str = "us"  # "india" or "us"
    has_report: bool = False
    price: Optional[float] = None
    change_pct: Optional[float] = None


class WatchlistGroup(BaseModel):
    name: str
    watchlist_id: int
    stocks: List[WatchlistStock]
    us_count: int = 0
    india_count: int = 0


class IndMoneyWatchlistResponse(BaseModel):
    type: str = "all"
    watchlists: List[WatchlistGroup]
