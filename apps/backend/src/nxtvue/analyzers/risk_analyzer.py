"""RiskAnalyzer — orchestrates QuantAnalyzer calls and attaches human-readable labels.

Thin wrapper: data layers call RiskAnalyzer.run() once per asset.
The analyzer returns quant_metrics + risk_metrics merged into one dict
ready to be placed into the canonical data contract.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import pandas as pd

from .quant_analyzer import QuantAnalyzer
from ..providers.timeseries_normalizer import TimeSeriesNormalizer
from ..config.settings import settings

logger = logging.getLogger(__name__)

_tsn = TimeSeriesNormalizer()


def _rf(market: str) -> float:
    """Return the appropriate risk-free rate for the given market."""
    return (
        settings.risk_free_rate_india
        if market == "india"
        else settings.risk_free_rate_us
    )


class RiskAnalyzer:
    """Orchestrate QuantAnalyzer calls; add contextual labels; return merged dict."""

    def run(
        self,
        price_series:     Optional[pd.Series],
        benchmark_series: Optional[pd.Series],
        rf_rate:          Optional[float]  = None,
        market:           str              = "india",
        asset_type:       str              = "stock",
    ) -> Dict[str, Any]:
        """Full quant + risk pass for a single asset.

        Args:
            price_series:     daily adjusted close / NAV pd.Series
            benchmark_series: benchmark price pd.Series (None → alpha/beta skipped)
            rf_rate:          annualised risk-free rate; defaults to settings value
            market:           'india' or 'us'
            asset_type:       'stock' | 'etf' | 'mf' | 'bond'

        Returns:
            dict with keys 'quant_metrics' and 'risk_metrics', both fully populated
            or containing a 'warning' key if data was insufficient.
        """
        if rf_rate is None:
            rf_rate = _rf(market)

        data_gaps: list[str] = []
        quant: Dict[str, Any] = {}
        risk:  Dict[str, Any] = {}

        # ---- Guard: need at least a price series ----
        if price_series is None or len(price_series) < 10:
            data_gaps.append(
                "quant_metrics: insufficient price history — risk calculations skipped"
            )
            return {"quant_metrics": {}, "risk_metrics": {}, "data_gaps_engine": data_gaps}

        prices = price_series.dropna().sort_index()

        # ---- Returns ----
        returns = _tsn.to_returns(prices, method="log")

        # ---- Core risk metrics ----
        core = QuantAnalyzer.compute_risk_metrics(returns, rf=rf_rate)
        quant.update(core)

        # ---- Rolling returns ----
        rolling = QuantAnalyzer.compute_rolling_returns(prices)
        quant.update(rolling)

        # ---- Drawdown detail ----
        dd = QuantAnalyzer.compute_drawdown_analysis(prices)
        risk.update(dd)

        # ---- Alpha / Beta / Capture (only if benchmark provided) ----
        if benchmark_series is not None and len(benchmark_series) >= 30:
            try:
                p_aligned, b_aligned = _tsn.align(prices, benchmark_series, market)
                r_fund  = _tsn.to_returns(p_aligned)
                r_bench = _tsn.to_returns(b_aligned)

                ab = QuantAnalyzer.compute_alpha_beta(r_fund, r_bench)
                quant.update(ab)

                te = QuantAnalyzer.compute_tracking_error(r_fund, r_bench)
                quant.update(te)

                cap = QuantAnalyzer.compute_updown_capture(r_fund, r_bench)
                quant.update(cap)

                td = QuantAnalyzer.compute_tracking_difference(p_aligned, b_aligned)
                quant["tracking_difference"] = td

            except Exception as exc:
                logger.warning("RiskAnalyzer: benchmark calculations failed: %s", exc)
                data_gaps.append(
                    f"alpha_beta: benchmark calculation failed — {exc}"
                )
        else:
            data_gaps.append(
                "alpha_beta/tracking_error: no benchmark series provided — skipped"
            )

        # ---- Human-readable labels ----
        risk["labels"] = self._build_labels(quant, risk, asset_type)

        return {
            "quant_metrics":     quant,
            "risk_metrics":      risk,
            "data_gaps_engine":  data_gaps,
        }

    # ------------------------------------------------------------------
    # Label builder
    # ------------------------------------------------------------------

    @staticmethod
    def _build_labels(quant: Dict, risk: Dict, asset_type: str) -> Dict[str, str]:
        labels: Dict[str, str] = {}

        sharpe = quant.get("sharpe")
        if sharpe is not None:
            if sharpe > 1.5:
                labels["sharpe"] = f"{sharpe:.2f} — excellent risk-adjusted return"
            elif sharpe > 1.0:
                labels["sharpe"] = f"{sharpe:.2f} — good risk-adjusted return"
            elif sharpe > 0.5:
                labels["sharpe"] = f"{sharpe:.2f} — moderate risk-adjusted return"
            elif sharpe > 0:
                labels["sharpe"] = f"{sharpe:.2f} — poor risk-adjusted return"
            else:
                labels["sharpe"] = f"{sharpe:.2f} — negative risk-adjusted return"

        vol = quant.get("volatility_ann")
        if vol is not None:
            pct = vol * 100
            if pct > 40:
                labels["volatility"] = f"{pct:.1f}% annualised — very high volatility"
            elif pct > 25:
                labels["volatility"] = f"{pct:.1f}% annualised — high volatility"
            elif pct > 15:
                labels["volatility"] = f"{pct:.1f}% annualised — moderate volatility"
            else:
                labels["volatility"] = f"{pct:.1f}% annualised — low volatility"

        max_dd = quant.get("max_drawdown")
        if max_dd is not None:
            pct = abs(max_dd) * 100
            labels["max_drawdown"] = f"−{pct:.1f}% historical maximum drawdown"

        var = quant.get("var_95")
        if var is not None:
            labels["var_95"] = f"{var*100:.2f}% daily loss at 95% confidence (VaR)"

        beta = quant.get("beta")
        if beta is not None:
            if beta > 1.2:
                labels["beta"] = f"{beta:.2f} — amplified market moves (aggressive)"
            elif beta > 0.8:
                labels["beta"] = f"{beta:.2f} — broadly in line with market"
            else:
                labels["beta"] = f"{beta:.2f} — defensive, less correlated to market"

        return labels


risk_analyzer = RiskAnalyzer()
# Backward compatibility alias
RiskEngine = RiskAnalyzer
risk_engine = risk_analyzer
