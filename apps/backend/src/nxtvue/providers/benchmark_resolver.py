"""BenchmarkResolver — maps tickers, MF categories, and asset types to canonical benchmarks.

Rules:
- Total return benchmarks are always preferred over price return.
- If no mapping exists, returns None and the caller records the gap in data_gaps.
- Never silently substitutes a price-return index for a total-return benchmark.
"""

from __future__ import annotations

import logging
from typing import Optional

from ..schemas.asset_schema import BenchmarkDef

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Static lookup tables
# ---------------------------------------------------------------------------

# ETF ticker → benchmark
_ETF_BENCHMARK_MAP: dict[str, BenchmarkDef] = {
    # Indian index ETFs
    "NIFTYBEES":    BenchmarkDef("NIFTY 50 TRI",          "^NSEI",   "index", "india", "total_return"),
    "JUNIORBEES":   BenchmarkDef("NIFTY Next 50 TRI",     "^NSMIDCP","index", "india", "total_return"),
    "BANKBEES":     BenchmarkDef("NIFTY Bank TRI",        "^NSEBANK","index", "india", "total_return"),
    "MIDCAPBEES":   BenchmarkDef("NIFTY Midcap 150 TRI",  "NIFTY_MC","index", "india", "total_return"),
    "ITBEES":       BenchmarkDef("NIFTY IT TRI",          "^CNXIT",  "index", "india", "total_return"),
    "LIQUIDBEES":   BenchmarkDef("NIFTY 1D Rate Index",   "LIQUID",  "index", "india", "total_return"),
    "GOLDBEES":     BenchmarkDef("MCX Gold",              "GOLD_MCX","index", "india", "price_return"),
    "SILVERBEES":   BenchmarkDef("MCX Silver",            "SILV_MCX","index", "india", "price_return"),
    # US broad ETFs
    "SPY":   BenchmarkDef("S&P 500 TR",           "^SP500TR", "index", "us", "total_return"),
    "VOO":   BenchmarkDef("S&P 500 TR",           "^SP500TR", "index", "us", "total_return"),
    "IVV":   BenchmarkDef("S&P 500 TR",           "^SP500TR", "index", "us", "total_return"),
    "QQQ":   BenchmarkDef("NASDAQ-100 TR",        "^NDX",     "index", "us", "total_return"),
    "VTI":   BenchmarkDef("CRSP US Total Mkt TR", "VTI",      "etf",   "us", "total_return"),
    "SCHD":  BenchmarkDef("Dow Jones US Dividend", "^DJUSDIV", "index", "us", "total_return"),
    "VEA":   BenchmarkDef("FTSE Dev ex-US TR",    "VEA",      "etf",   "us", "total_return"),
    "VWO":   BenchmarkDef("FTSE EM TR",           "VWO",      "etf",   "us", "total_return"),
    # US bond ETFs
    "TLT":   BenchmarkDef("Bloomberg US 20+Y TR",   "TLT",  "etf", "us", "total_return"),
    "AGG":   BenchmarkDef("Bloomberg US Agg TR",    "AGG",  "etf", "us", "total_return"),
    "LQD":   BenchmarkDef("Bloomberg US Corp IG TR","LQD",  "etf", "us", "total_return"),
    "BND":   BenchmarkDef("Bloomberg US Agg TR",    "AGG",  "etf", "us", "total_return"),
    "SHY":   BenchmarkDef("Bloomberg US 1-3Y TR",   "SHY",  "etf", "us", "total_return"),
    "HYG":   BenchmarkDef("Bloomberg US HY Corp TR","HYG",  "etf", "us", "total_return"),
    # Sector ETFs (US)
    "XLK":   BenchmarkDef("S&P 500 IT TR",     "^SP500IT",  "index", "us", "total_return"),
    "XLF":   BenchmarkDef("S&P 500 Fin TR",    "^SP500FIN", "index", "us", "total_return"),
    "XLE":   BenchmarkDef("S&P 500 Energy TR", "^SP500EN",  "index", "us", "total_return"),
    "XLV":   BenchmarkDef("S&P 500 HC TR",     "^SP500HC",  "index", "us", "total_return"),
}

# MF category string → benchmark
_MF_CATEGORY_BENCHMARK_MAP: dict[str, BenchmarkDef] = {
    "large cap":            BenchmarkDef("NIFTY 50 TRI",         "^NSEI",    "index", "india", "total_return"),
    "large and mid cap":    BenchmarkDef("NIFTY LargeMidcap 250","NIFTY_LM", "index", "india", "total_return"),
    "mid cap":              BenchmarkDef("NIFTY Midcap 150 TRI", "NIFTY_MC", "index", "india", "total_return"),
    "small cap":            BenchmarkDef("NIFTY Smallcap 250 TRI","NIFTY_SC","index", "india", "total_return"),
    "multi cap":            BenchmarkDef("NIFTY 500 TRI",        "NIFTY_500","index", "india", "total_return"),
    "flexi cap":            BenchmarkDef("NIFTY 500 TRI",        "NIFTY_500","index", "india", "total_return"),
    "focused fund":         BenchmarkDef("NIFTY 50 TRI",         "^NSEI",    "index", "india", "total_return"),
    "elss":                 BenchmarkDef("NIFTY 500 TRI",        "NIFTY_500","index", "india", "total_return"),
    "value fund":           BenchmarkDef("NIFTY 500 Value 50",   "NIFTY_V",  "index", "india", "total_return"),
    "contra fund":          BenchmarkDef("NIFTY 500 TRI",        "NIFTY_500","index", "india", "total_return"),
    "sectoral/thematic":    BenchmarkDef("NIFTY 500 TRI",        "NIFTY_500","index", "india", "total_return"),
    "index fund":           BenchmarkDef("NIFTY 50 TRI",         "^NSEI",    "index", "india", "total_return"),
    "fund of funds":        BenchmarkDef("NIFTY 50 TRI",         "^NSEI",    "index", "india", "total_return"),
    "liquid":               BenchmarkDef("NIFTY 1D Rate Index",  "LIQUID",   "index", "india", "total_return"),
    "overnight":            BenchmarkDef("NIFTY 1D Rate Index",  "LIQUID",   "index", "india", "total_return"),
    "short duration":       BenchmarkDef("NIFTY Short Duration", "NSE_SD",   "index", "india", "total_return"),
    "medium duration":      BenchmarkDef("NIFTY Medium Duration","NSE_MD",   "index", "india", "total_return"),
    "long duration":        BenchmarkDef("NIFTY 10Y Gilt",       "NIFTY_GS", "index", "india", "total_return"),
    "gilt":                 BenchmarkDef("NIFTY 10Y Gilt",       "NIFTY_GS", "index", "india", "total_return"),
    "hybrid aggressive":    BenchmarkDef("NIFTY 50 Hybrid 65:35","NIFTYHyb", "index", "india", "total_return"),
    "hybrid conservative":  BenchmarkDef("CRISIL Hybrid 25+75",  "CRISIL_H", "index", "india", "total_return"),
    "balanced advantage":   BenchmarkDef("NIFTY 50 Hybrid 50:50","NIFTY_BA", "index", "india", "total_return"),
}


class BenchmarkResolver:
    """Resolves an asset or MF category to its canonical benchmark."""

    def resolve(self, ticker: str, asset_type: str = "stock",
                market: str = "india") -> Optional[BenchmarkDef]:
        """Return the canonical benchmark for a given ticker/asset_type/market.

        Returns None if no mapping exists — caller must add a data_gap entry.
        """
        t = ticker.upper().replace(".NS", "").replace(".BO", "")
        if t in _ETF_BENCHMARK_MAP:
            bm = _ETF_BENCHMARK_MAP[t]
            if bm.return_type == "price_return":
                logger.warning(
                    "BenchmarkResolver: %s maps to a price-return index (%s). "
                    "Tracking calculations will note this limitation.",
                    ticker, bm.name,
                )
            return bm
        logger.debug("BenchmarkResolver: no mapping for ticker '%s'", ticker)
        return None

    def resolve_category_benchmark(self, category: str,
                                   market: str = "india") -> Optional[BenchmarkDef]:
        """Return the canonical benchmark for an MF category string (case-insensitive)."""
        key = category.lower().strip()
        # Try exact match first, then prefix match
        if key in _MF_CATEGORY_BENCHMARK_MAP:
            return _MF_CATEGORY_BENCHMARK_MAP[key]
        for k, v in _MF_CATEGORY_BENCHMARK_MAP.items():
            if key.startswith(k) or k.startswith(key):
                return v
        logger.debug("BenchmarkResolver: no category mapping for '%s'", category)
        return None


benchmark_resolver = BenchmarkResolver()
