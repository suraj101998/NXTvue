"""PortfolioAnalyzer — advanced cross-asset portfolio analytics.

Extends portfolio_analyser.py (does not replace it).
Adds: ETF overlap, hidden sector concentration, currency/duration exposure,
diversification score, correlation matrix, portfolio-level risk metrics.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import yfinance as yf

from ..providers.historical_data_provider import HistoricalDataProvider
from ..providers.timeseries_normalizer import TimeSeriesNormalizer
from .quant_analyzer import QuantAnalyzer
from ..config.settings import settings

logger = logging.getLogger(__name__)

_hdp = HistoricalDataProvider()
_tsn = TimeSeriesNormalizer()

_OVERLAP_FLAG_THRESHOLD   = 0.10   # 10% combined weight → flag
_SECTOR_CONC_THRESHOLD    = 0.35   # 35% effective exposure → flag
_HOLDING_CONC_THRESHOLD   = 0.25   # 25% single holding → flag


class PortfolioAnalyzer:
    """Cross-asset portfolio intelligence — ETF overlap, exposure, diversification."""

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    def run(self, holdings_df: pd.DataFrame) -> Dict[str, Any]:
        """Run all portfolio intelligence calculations.

        Args:
            holdings_df: DataFrame with columns ticker, qty, avg_cost,
                         current_price, market_value, weight, market, asset_type (optional)

        Returns:
            dict with all portfolio intelligence keys
        """
        results: Dict[str, Any] = {}
        data_gaps: List[str] = []

        # ---- Asset class allocation ----
        try:
            results["asset_class_allocation"] = self.compute_asset_class_allocation(holdings_df)
        except Exception as exc:
            data_gaps.append(f"asset_class_allocation: {exc}")

        # ---- Currency exposure ----
        try:
            results["currency_exposure"] = self.compute_currency_exposure(holdings_df)
        except Exception as exc:
            data_gaps.append(f"currency_exposure: {exc}")

        # ---- ETF overlap ----
        try:
            results["etf_overlap"] = self.compute_etf_overlap(holdings_df)
        except Exception as exc:
            data_gaps.append(f"etf_overlap: {exc}")

        # ---- Effective sector concentration ----
        try:
            results["effective_sector_exposure"] = self.compute_effective_exposure(
                holdings_df, results.get("etf_overlap", {})
            )
        except Exception as exc:
            data_gaps.append(f"effective_sector_exposure: {exc}")

        # ---- Correlation matrix ----
        try:
            results["correlation_matrix"] = self.compute_correlation_matrix(holdings_df)
        except Exception as exc:
            data_gaps.append(f"correlation_matrix: {exc}")
            results["correlation_matrix"] = {}

        # ---- Portfolio-level risk ----
        try:
            results["portfolio_risk"] = self.compute_portfolio_risk(
                holdings_df, results.get("correlation_matrix", {})
            )
        except Exception as exc:
            data_gaps.append(f"portfolio_risk: {exc}")

        # ---- Diversification score ----
        try:
            results["diversification_score"] = self.compute_diversification_score(
                holdings_df, results
            )
        except Exception as exc:
            data_gaps.append(f"diversification_score: {exc}")

        # ---- Duration exposure (bonds only) ----
        try:
            results["duration_exposure"] = self.compute_duration_exposure(holdings_df)
        except Exception as exc:
            data_gaps.append(f"duration_exposure: {exc}")

        results["data_gaps"] = data_gaps
        results["note"] = (
            "portfolio_returns: reported in local currency per holding. "
            "FX-adjusted portfolio return = Phase 2."
        )
        return results

    # ------------------------------------------------------------------
    # ETF overlap analysis
    # ------------------------------------------------------------------

    def compute_etf_overlap(self, holdings_df: pd.DataFrame) -> Dict[str, Any]:
        """Find stocks held by multiple ETFs in the portfolio."""
        etf_rows = holdings_df[
            holdings_df.get("asset_type", pd.Series(["stock"] * len(holdings_df)))
            .fillna("stock").str.lower() == "etf"
        ] if "asset_type" in holdings_df.columns else pd.DataFrame()

        if etf_rows.empty:
            return {"overlapping_stocks": [], "flags": []}

        # Fetch holdings for each ETF
        etf_holdings: Dict[str, Dict[str, float]] = {}
        for _, row in etf_rows.iterrows():
            ticker = str(row.get("ticker", ""))
            weight = float(row.get("weight", 0))
            try:
                t  = yf.Ticker(ticker)
                fd = getattr(t, "funds_data", None)
                if fd is None:
                    continue
                top = getattr(fd, "top_holdings", None)
                if top is None or (isinstance(top, pd.DataFrame) and top.empty):
                    continue
                if isinstance(top, pd.DataFrame):
                    for _, h in top.iterrows():
                        name    = str(h.get("holdingName", ""))
                        h_wt    = float(h.get("holdingPercent", 0))
                        eff_wt  = h_wt * weight   # weight in portfolio
                        if name not in etf_holdings:
                            etf_holdings[name] = {}
                        etf_holdings[name][ticker] = eff_wt
            except Exception as exc:
                logger.debug("ETF overlap fetch failed for %s: %s", ticker, exc)

        # Find overlap — stocks in >1 ETF
        overlapping = []
        for stock, by_etf in etf_holdings.items():
            if len(by_etf) > 1:
                combined = sum(by_etf.values())
                overlapping.append({
                    "stock":          stock,
                    "combined_weight_pct": round(combined * 100, 3),
                    "via_etfs":       list(by_etf.keys()),
                    "flagged":        combined > _OVERLAP_FLAG_THRESHOLD,
                })

        overlapping.sort(key=lambda x: x["combined_weight_pct"], reverse=True)
        flags = [o for o in overlapping if o["flagged"]]

        return {
            "overlapping_stocks": overlapping[:20],
            "flags": [
                f"{o['stock']}: {o['combined_weight_pct']:.1f}% combined weight "
                f"across {', '.join(o['via_etfs'])}"
                for o in flags
            ],
        }

    # ------------------------------------------------------------------
    # Effective sector exposure
    # ------------------------------------------------------------------

    def compute_effective_exposure(
        self,
        holdings_df: pd.DataFrame,
        etf_overlap: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Aggregate sector exposure through ETF holdings."""
        sector_totals: Dict[str, float] = {}

        for _, row in holdings_df.iterrows():
            ticker    = str(row.get("ticker", ""))
            weight    = float(row.get("weight", 0))
            atype     = str(row.get("asset_type", "stock")).lower()
            if atype != "etf":
                # Direct stock — add as its own "sector" proxy
                sector_totals[f"Direct:{ticker}"] = (
                    sector_totals.get(f"Direct:{ticker}", 0) + weight
                )
                continue
            try:
                t  = yf.Ticker(ticker)
                fd = getattr(t, "funds_data", None)
                if fd is None:
                    continue
                sw = getattr(fd, "sector_weightings", None)
                if sw is None:
                    continue
                if isinstance(sw, pd.DataFrame):
                    for _, s in sw.iterrows():
                        sec = str(s.get("sector", "Unknown"))
                        wt  = float(s.get("weightPercent", 0))
                        sector_totals[sec] = sector_totals.get(sec, 0) + wt * weight
                elif isinstance(sw, dict):
                    for sec, wt in sw.items():
                        sector_totals[str(sec)] = (
                            sector_totals.get(str(sec), 0) + float(wt) * weight
                        )
            except Exception as exc:
                logger.debug("Sector exposure fetch failed for %s: %s", ticker, exc)

        # Normalise to %
        total = sum(sector_totals.values()) or 1
        normalised = {k: round(v / total * 100, 2) for k, v in sector_totals.items()}
        flags = [
            f"{sec}: {pct:.1f}% effective exposure (> {_SECTOR_CONC_THRESHOLD*100:.0f}% threshold)"
            for sec, pct in normalised.items()
            if pct > _SECTOR_CONC_THRESHOLD * 100
        ]
        return {"sectors": normalised, "flags": flags}

    # ------------------------------------------------------------------
    # Cross-asset allocation
    # ------------------------------------------------------------------

    @staticmethod
    def compute_asset_class_allocation(holdings_df: pd.DataFrame) -> Dict[str, Any]:
        """Aggregate portfolio by asset class."""
        if "asset_type" not in holdings_df.columns:
            return {
                "equity": 100.0,
                "note": "asset_type column not present in holdings file; assumed equity",
            }
        totals: Dict[str, float] = {}
        for _, row in holdings_df.iterrows():
            at  = str(row.get("asset_type", "stock")).lower()
            wt  = float(row.get("weight", 0))
            totals[at] = totals.get(at, 0) + wt * 100
        return {k: round(v, 2) for k, v in totals.items()}

    # ------------------------------------------------------------------
    # Currency exposure
    # ------------------------------------------------------------------

    @staticmethod
    def compute_currency_exposure(holdings_df: pd.DataFrame) -> Dict[str, Any]:
        """Split portfolio by base currency (INR vs USD)."""
        inr = usd = other = 0.0
        for _, row in holdings_df.iterrows():
            market = str(row.get("market", "india")).lower()
            wt     = float(row.get("weight", 0)) * 100
            if market == "india":
                inr += wt
            elif market == "us":
                usd += wt
            else:
                other += wt
        return {
            "INR_pct": round(inr, 2),
            "USD_pct": round(usd, 2),
            "other_pct": round(other, 2),
            "note": (
                "FX-adjusted return calculations are Phase 2. "
                "Returns shown in local currency per holding."
            ),
        }

    # ------------------------------------------------------------------
    # Duration exposure (bonds)
    # ------------------------------------------------------------------

    @staticmethod
    def compute_duration_exposure(holdings_df: pd.DataFrame) -> Dict[str, Any]:
        """Portfolio-weighted effective duration (bonds / bond ETFs only)."""
        if "asset_type" not in holdings_df.columns:
            return {"weighted_duration": None, "note": "no asset_type column in holdings"}
        bond_rows = holdings_df[
            holdings_df["asset_type"].astype(str).str.lower().isin(["bond", "bond_etf"])
        ]
        if bond_rows.empty:
            return {"weighted_duration": None, "note": "no bond holdings in portfolio"}
        weighted = 0.0
        covered  = 0.0
        for _, row in bond_rows.iterrows():
            dur = row.get("effective_duration")
            wt  = float(row.get("weight", 0))
            if dur is not None:
                weighted += float(dur) * wt
                covered  += wt
        if covered == 0:
            return {
                "weighted_duration": None,
                "note": "effective_duration not available for bond holdings — check bond data",
            }
        return {"weighted_duration": round(weighted, 4), "covered_weight_pct": round(covered * 100, 2)}

    # ------------------------------------------------------------------
    # Diversification score
    # ------------------------------------------------------------------

    @staticmethod
    def compute_diversification_score(
        holdings_df: pd.DataFrame,
        engine_results: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Composite diversification score 0–100."""
        n_assets  = len(holdings_df)
        n_markets = holdings_df["market"].nunique() if "market" in holdings_df.columns else 1
        max_wt    = holdings_df["weight"].max() if "weight" in holdings_df.columns else 1.0

        # Assets score (max 25): 10+ holdings → 25
        asset_score = min(25, n_assets * 2.5)

        # Market score (max 20): 2+ markets → 20
        market_score = min(20, n_markets * 10)

        # Concentration score (max 30): max weight < 10% → 30
        conc_score = max(0, 30 - max_wt * 100 * 1.5)

        # Sector score (max 15): no sector > 35% → 15
        sector_exp = engine_results.get("effective_sector_exposure", {})
        sectors    = sector_exp.get("sectors", {})
        max_sector = max(sectors.values()) if sectors else 0
        sector_score = max(0, 15 - max_sector / 10)

        # Correlation score (max 10): lower avg correlation → higher score
        corr_matrix = engine_results.get("correlation_matrix", {})
        corr_score  = 10.0
        if corr_matrix and isinstance(corr_matrix, dict):
            vals = []
            tickers = list(corr_matrix.keys())
            for i in range(len(tickers)):
                for j in range(i + 1, len(tickers)):
                    c = corr_matrix.get(tickers[i], {}).get(tickers[j])
                    if c is not None:
                        vals.append(abs(float(c)))
            if vals:
                avg_corr  = float(np.mean(vals))
                corr_score = max(0, 10 * (1 - avg_corr))

        total = asset_score + market_score + conc_score + sector_score + corr_score
        if total >= 75:
            label = "well diversified"
        elif total >= 50:
            label = "moderately diversified"
        elif total >= 30:
            label = "concentrated"
        else:
            label = "highly concentrated"

        return {
            "score":         round(total, 1),
            "label":         label,
            "asset_score":   round(asset_score, 1),
            "market_score":  round(market_score, 1),
            "conc_score":    round(conc_score, 1),
            "sector_score":  round(sector_score, 1),
            "corr_score":    round(corr_score, 1),
        }

    # ------------------------------------------------------------------
    # Correlation matrix
    # ------------------------------------------------------------------

    def compute_correlation_matrix(
        self, holdings_df: pd.DataFrame, period: str = "1y"
    ) -> Dict[str, Any]:
        """1Y price correlation matrix for all holdings."""
        tickers = holdings_df["ticker"].tolist() if "ticker" in holdings_df.columns else []
        markets = holdings_df.set_index("ticker")["market"].to_dict() if "market" in holdings_df.columns else {}

        price_map: Dict[str, pd.Series] = {}
        for t in tickers:
            market = markets.get(t, "india")
            result = _hdp.get_price_history(t, market, period)
            if result.success:
                price_map[t] = result.data

        if len(price_map) < 2:
            return {}

        # Align all series together
        df = pd.DataFrame(price_map).dropna()
        if df.shape[0] < 20:
            return {}
        ret_df = df.pct_change().dropna()
        corr = ret_df.corr().round(4)
        return corr.to_dict()

    # ------------------------------------------------------------------
    # Portfolio-level risk
    # ------------------------------------------------------------------

    def compute_portfolio_risk(
        self,
        holdings_df: pd.DataFrame,
        correlation_matrix: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Portfolio Sharpe, Sortino, volatility using weighted returns."""
        tickers = holdings_df["ticker"].tolist() if "ticker" in holdings_df.columns else []
        weights = holdings_df["weight"].tolist() if "weight" in holdings_df.columns else []
        markets = holdings_df.set_index("ticker")["market"].to_dict() if "market" in holdings_df.columns else {}

        price_map: Dict[str, pd.Series] = {}
        for t in tickers:
            market = markets.get(t, "india")
            result = _hdp.get_price_history(t, market, "1y")
            if result.success:
                price_map[t] = result.data

        if not price_map:
            return {"warning": "no price history available for portfolio risk"}

        df   = pd.DataFrame(price_map).dropna()
        rets = df.pct_change().dropna()
        wts  = pd.Series(weights, index=tickers)
        common = rets.columns.intersection(wts.index)
        if common.empty:
            return {"warning": "no overlap between price data and holdings"}

        wts_aligned = wts[common] / wts[common].sum()
        port_ret    = (rets[common] * wts_aligned).sum(axis=1)

        rf_daily = settings.risk_free_rate_india / 252
        risk = QuantAnalyzer.compute_risk_metrics(port_ret, rf=settings.risk_free_rate_india)
        return risk


portfolio_analyzer = PortfolioAnalyzer()
# Backward compatibility alias
PortfolioEngine = PortfolioAnalyzer
portfolio_engine = portfolio_analyzer
