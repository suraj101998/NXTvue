"""Schema definitions — canonical data contracts for all asset types."""

from .asset_schema import (
    DataFetchResult,
    DataQualityEntry,
    BenchmarkDef,
    BaseAssetData,
    ETFData,
    MutualFundData,
    BondData,
    QuantMetrics,
    RiskMetrics,
)

__all__ = [
    "DataFetchResult",
    "DataQualityEntry",
    "BenchmarkDef",
    "BaseAssetData",
    "ETFData",
    "MutualFundData",
    "BondData",
    "QuantMetrics",
    "RiskMetrics",
]
