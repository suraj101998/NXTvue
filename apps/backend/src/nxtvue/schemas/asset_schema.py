"""Canonical schema / dataclass definitions for the NXTvue Intelligence Platform.

All fields are Optional — a missing field becomes a data_gap entry, never a crash.
Type checking is advisory, not enforced at runtime. Validation is handled by the
data layers themselves when they populate these structures.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# DataFetchResult — replaces silent {} returns from external providers
# ---------------------------------------------------------------------------

@dataclass
class DataFetchResult:
    """Wraps the outcome of any external data fetch."""
    success:   bool
    data:      Any                = None
    source:    str                = ""
    error:     str                = ""
    retryable: bool               = False

    def __bool__(self) -> bool:
        return self.success


# ---------------------------------------------------------------------------
# DataQualityEntry — per-field provenance metadata
# ---------------------------------------------------------------------------

@dataclass
class DataQualityEntry:
    """Provenance metadata attached to a single data field."""
    value:     Any    = None
    source:    str    = ""           # e.g. "U.S. Treasury", "AMFI", "Yahoo Finance"
    timestamp: str    = ""           # ISO date string
    quality:   str    = "B"          # A=official, B=third-party, C=estimated, D=unavailable
    freshness: str    = "unknown"    # same_day / daily / weekly / stale / unknown

    def to_dict(self) -> Dict[str, Any]:
        return {
            "value":     self.value,
            "source":    self.source,
            "timestamp": self.timestamp,
            "quality":   self.quality,
            "freshness": self.freshness,
        }


# ---------------------------------------------------------------------------
# BenchmarkDef — canonical benchmark representation
# ---------------------------------------------------------------------------

@dataclass
class BenchmarkDef:
    """Canonical benchmark definition used throughout the analyzer."""
    name:        str  = ""
    symbol:      str  = ""
    type:        str  = "index"        # index / etf / custom
    market:      str  = ""
    return_type: str  = "total_return" # total_return / price_return

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name":        self.name,
            "symbol":      self.symbol,
            "type":        self.type,
            "market":      self.market,
            "return_type": self.return_type,
        }


# ---------------------------------------------------------------------------
# QuantMetrics — output of QuantAnalyzer / RiskAnalyzer
# ---------------------------------------------------------------------------

@dataclass
class QuantMetrics:
    sharpe:            Optional[float] = None
    sortino:           Optional[float] = None
    volatility_ann:    Optional[float] = None
    max_drawdown:      Optional[float] = None
    var_95:            Optional[float] = None
    cvar_95:           Optional[float] = None
    calmar:            Optional[float] = None
    alpha:             Optional[float] = None
    beta:              Optional[float] = None
    r_squared:         Optional[float] = None
    tracking_error_ann:Optional[float] = None
    upside_capture:    Optional[float] = None
    downside_capture:  Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in self.__dict__.items()}


@dataclass
class RiskMetrics:
    current_drawdown_pct: Optional[float] = None
    drawdown_start:       Optional[str]   = None
    recovery_days:        Optional[int]   = None
    ulcer_index:          Optional[float] = None
    pain_index:           Optional[float] = None
    labels:               Dict[str, str]  = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in self.__dict__.items()}


# ---------------------------------------------------------------------------
# Asset data schemas (TypedDict-style but as plain dicts for flexibility)
# All optional — missing keys become data_gap entries, not errors.
# ---------------------------------------------------------------------------

class BaseAssetData:
    """Documents the expected keys in a canonical asset data dict.
    Data layers return plain dicts; this class serves as a reference contract.
    """
    REQUIRED_KEYS = ["source", "source_url", "key_metrics"]
    OPTIONAL_KEYS = [
        "fundamental_metrics", "technical_metrics", "chart_signals",
        "forensic_metrics", "debt_breakdown", "financials_annual",
        "financials_quarterly", "balance_sheet_annual", "cashflow_annual",
        "shareholding", "peer_comparison", "major_holders",
        "institutional_holders", "pe_history", "analyst_consensus",
        "news", "macro_sector",
        "quant_metrics", "risk_metrics", "valuation_percentile",
        "data_quality", "data_gaps",
    ]

    @staticmethod
    def validate(data: Dict[str, Any]) -> List[str]:
        """Return list of missing required keys. Empty list = valid."""
        return [k for k in BaseAssetData.REQUIRED_KEYS if k not in data or data[k] is None]


class ETFData(BaseAssetData):
    OPTIONAL_KEYS = BaseAssetData.OPTIONAL_KEYS + [
        "etf_profile", "holdings_top10", "asset_allocation",
        "sector_allocation", "tracking_difference",
        "nav_premium_discount", "liquidity_score",
    ]


class MutualFundData(BaseAssetData):
    OPTIONAL_KEYS = BaseAssetData.OPTIONAL_KEYS + [
        "scheme_info", "nav_history", "nav_current", "nav_returns",
    ]


class BondData(BaseAssetData):
    OPTIONAL_KEYS = BaseAssetData.OPTIONAL_KEYS + [
        "yield_curve", "current_yields", "yield_changes",
        "spread_analysis", "real_yield", "macro_context",
        "bond_risk_metrics",
    ]
