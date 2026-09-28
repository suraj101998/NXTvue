"""QuantAnalyzer — deterministic calculation of every financial metric.

All methods are @staticmethod. They take pre-fetched, pre-aligned pd.Series
and return plain dicts. They never fetch data and never call Bob.

Conventions:
- Returns series are log returns unless noted.
- Annualisation uses 252 trading days.
- Risk-free rates come from settings; never hard-coded here.
- All methods return {} (not raise) on insufficient data, with a 'warning' key.
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

_TRADING_DAYS = 252


def _safe(fn, *args, fallback=None, **kwargs):
    """Call fn(*args, **kwargs), return fallback on any exception."""
    try:
        return fn(*args, **kwargs)
    except Exception as exc:
        logger.debug("QuantAnalyzer safe-call failed: %s", exc)
        return fallback


class QuantAnalyzer:
    """All financial metric calculations. Pure Python + numpy/scipy. No external calls."""

    # ------------------------------------------------------------------
    # 1. Returns
    # ------------------------------------------------------------------

    @staticmethod
    def compute_returns(prices: pd.Series) -> Dict[str, Any]:
        """Compute period returns from a price/NAV series (simple %)."""
        if prices is None or len(prices) < 2:
            return {"warning": "insufficient price history"}
        prices = prices.dropna().sort_index()
        p = prices

        def _cagr(start_px, end_px, years):
            if start_px <= 0 or years <= 0:
                return None
            return round((end_px / start_px) ** (1 / years) - 1, 6)

        def _ret(days):
            if len(p) < days:
                return None
            return round(p.iloc[-1] / p.iloc[-days] - 1, 6)

        n = len(p)
        years_total = n / _TRADING_DAYS

        return {
            "1d":      _ret(2),
            "1w":      _ret(6),
            "1m":      _ret(22),
            "3m":      _ret(66),
            "6m":      _ret(126),
            "1y":      _ret(252),
            "3y":      _ret(756),
            "5y":      _ret(1260),
            "cagr_total": _cagr(p.iloc[0], p.iloc[-1], years_total),
            "total_period_years": round(years_total, 2),
        }

    # ------------------------------------------------------------------
    # 2. Risk metrics (Sharpe, Sortino, VaR, CVaR, drawdown, Calmar)
    # ------------------------------------------------------------------

    @staticmethod
    def compute_risk_metrics(
        returns: pd.Series,
        rf: float = 0.065,
    ) -> Dict[str, Any]:
        """Compute standard risk metrics from a daily log/simple return series.

        Args:
            returns: daily returns (log or simple, consistent series)
            rf:      annualised risk-free rate (e.g. 0.065 for India)
        """
        if returns is None or len(returns) < 30:
            return {"warning": "insufficient returns history (need ≥30 days)"}

        r = returns.dropna()
        rf_daily = rf / _TRADING_DAYS

        # Annualised volatility
        vol_ann = float(r.std() * math.sqrt(_TRADING_DAYS))

        # Sharpe
        excess = r - rf_daily
        sharpe = float(excess.mean() / r.std() * math.sqrt(_TRADING_DAYS)) if r.std() > 0 else None

        # Sortino (downside deviation only)
        downside = r[r < rf_daily]
        sortino = None
        if len(downside) > 1 and downside.std() > 0:
            sortino = float(
                (r.mean() - rf_daily) * _TRADING_DAYS
                / (downside.std() * math.sqrt(_TRADING_DAYS))
            )

        # Max drawdown (on cumulative returns from price series approximation)
        cum = (1 + r).cumprod()
        roll_max = cum.cummax()
        dd_series = (cum - roll_max) / roll_max
        max_dd = float(dd_series.min())

        # Current drawdown
        current_dd = float(dd_series.iloc[-1])

        # Drawdown start date
        dd_start = None
        dd_idx = dd_series.idxmin()
        if dd_idx is not None and not pd.isna(dd_idx):
            # Find where the drawdown trough started (last peak before trough)
            try:
                peak_candidates = roll_max[:dd_idx]
                if not peak_candidates.empty:
                    peak_idx = peak_candidates.idxmax()
                    dd_start = str(peak_idx.date()) if hasattr(peak_idx, "date") else str(peak_idx)
            except Exception:
                pass

        # Recovery days (days since trough to return to previous peak — None if not recovered)
        recovery_days = None
        try:
            trough_loc = dd_series.values.argmin()
            post_trough = cum.iloc[trough_loc:]
            peak_val = roll_max.iloc[trough_loc]
            recovered = post_trough[post_trough >= peak_val]
            if not recovered.empty:
                recovery_days = int(len(post_trough) - len(post_trough[post_trough.index >= recovered.index[0]]))
        except Exception:
            pass

        # VaR and CVaR at 95% confidence
        var_95  = float(np.percentile(r, 5))
        cvar_95 = float(r[r <= var_95].mean()) if (r <= var_95).any() else var_95

        # Calmar ratio
        calmar = None
        if max_dd < 0:
            ann_return = float(r.mean() * _TRADING_DAYS)
            calmar = round(ann_return / abs(max_dd), 4)

        # Ulcer Index (root-mean-square of drawdowns)
        ulcer = float(math.sqrt((dd_series ** 2).mean()))

        # Pain Index (mean of absolute drawdowns)
        pain = float(dd_series.abs().mean())

        return {
            "sharpe":         round(sharpe, 4)    if sharpe    is not None else None,
            "sortino":        round(sortino, 4)   if sortino   is not None else None,
            "volatility_ann": round(vol_ann, 4),
            "max_drawdown":   round(max_dd, 4),
            "current_drawdown": round(current_dd, 4),
            "drawdown_start": dd_start,
            "recovery_days":  recovery_days,
            "var_95":         round(var_95, 6),
            "cvar_95":        round(cvar_95, 6),
            "calmar":         calmar,
            "ulcer_index":    round(ulcer, 4),
            "pain_index":     round(pain, 4),
        }

    # ------------------------------------------------------------------
    # 3. Alpha / Beta (OLS regression)
    # ------------------------------------------------------------------

    @staticmethod
    def compute_alpha_beta(
        fund_returns: pd.Series,
        bench_returns: pd.Series,
    ) -> Dict[str, Any]:
        """Jensen's alpha and market beta via OLS regression."""
        if fund_returns is None or bench_returns is None:
            return {"warning": "returns series required"}
        if len(fund_returns) < 30 or len(bench_returns) < 30:
            return {"warning": "need ≥30 observations for alpha/beta"}
        try:
            from scipy import stats
            slope, intercept, r_value, p_value, _ = stats.linregress(
                bench_returns.values, fund_returns.values
            )
            alpha_ann = float(intercept * _TRADING_DAYS)
            return {
                "alpha":     round(alpha_ann, 6),
                "beta":      round(float(slope), 4),
                "r_squared": round(float(r_value ** 2), 4),
                "p_value_beta": round(float(p_value), 4),
            }
        except Exception as exc:
            return {"warning": f"alpha/beta calculation failed: {exc}"}

    # ------------------------------------------------------------------
    # 4. Tracking error and tracking difference
    # ------------------------------------------------------------------

    @staticmethod
    def compute_tracking_error(
        fund_returns: pd.Series,
        index_returns: pd.Series,
    ) -> Dict[str, Any]:
        """Annualised standard deviation of (fund_return − index_return)."""
        if fund_returns is None or index_returns is None or len(fund_returns) < 20:
            return {"warning": "insufficient data for tracking error"}
        diff = fund_returns - index_returns
        te = float(diff.std() * math.sqrt(_TRADING_DAYS))
        return {"tracking_error_ann": round(te, 6)}

    @staticmethod
    def compute_tracking_difference(
        fund_prices: pd.Series,
        index_prices: pd.Series,
    ) -> Dict[str, Any]:
        """Cumulative performance gap (fund − index) over standard periods."""
        if fund_prices is None or index_prices is None:
            return {"warning": "price series required"}

        def _td(days: int) -> Optional[float]:
            if len(fund_prices) < days or len(index_prices) < days:
                return None
            f_ret = fund_prices.iloc[-1] / fund_prices.iloc[-days] - 1
            i_ret = index_prices.iloc[-1] / index_prices.iloc[-days] - 1
            return round(float(f_ret - i_ret), 6)

        return {
            "1m": _td(22), "3m": _td(66), "1y": _td(252),
            "3y": _td(756), "5y": _td(1260),
        }

    # ------------------------------------------------------------------
    # 5. Rolling returns and win rate
    # ------------------------------------------------------------------

    @staticmethod
    def compute_rolling_returns(
        prices: pd.Series,
        windows: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """Rolling CAGR and 1Y win rate.

        windows: list of trading-day windows, default [252, 756, 1260] = 1y, 3y, 5y
        """
        if windows is None:
            windows = [252, 756, 1260]
        if prices is None or len(prices) < min(windows):
            return {"warning": "insufficient history for rolling returns"}

        prices = prices.dropna().sort_index()
        result: Dict[str, Any] = {}

        label_map = {252: "1y", 756: "3y", 1260: "5y", 504: "2y", 1764: "7y", 2520: "10y"}
        for w in windows:
            lbl = label_map.get(w, f"{w}d")
            if len(prices) >= w + 1:
                r_series = prices / prices.shift(w) - 1
                r_series = r_series.dropna()
                cagr = float(prices.iloc[-1] / prices.iloc[-w] - 1) if len(prices) >= w else None
                # Annualise
                years = w / _TRADING_DAYS
                if cagr is not None and years > 0:
                    cagr = (1 + cagr) ** (1 / years) - 1
                result[f"{lbl}_cagr"] = round(cagr, 6) if cagr is not None else None
            else:
                result[f"{lbl}_cagr"] = None

        # 1Y rolling win rate — fraction of 1Y windows with positive return
        if len(prices) >= 252 * 2:
            r1y = prices / prices.shift(252) - 1
            r1y = r1y.dropna()
            result["win_rate_1y"] = round(float((r1y > 0).mean()), 4)
        else:
            result["win_rate_1y"] = None

        return result

    # ------------------------------------------------------------------
    # 6. Drawdown analysis
    # ------------------------------------------------------------------

    @staticmethod
    def compute_drawdown_analysis(prices: pd.Series) -> Dict[str, Any]:
        """Detailed drawdown profile from a price series."""
        if prices is None or len(prices) < 2:
            return {"warning": "insufficient data"}
        prices = prices.dropna().sort_index()
        roll_max = prices.cummax()
        dd = (prices - roll_max) / roll_max

        max_dd   = float(dd.min())
        curr_dd  = float(dd.iloc[-1])
        dd_idx   = dd.idxmin()

        dd_start = None
        try:
            peak_before = roll_max[:dd_idx]
            if not peak_before.empty:
                peak_idx = peak_before.idxmax()
                dd_start = str(peak_idx.date()) if hasattr(peak_idx, "date") else str(peak_idx)
        except Exception:
            pass

        return {
            "current_drawdown_pct": round(curr_dd * 100, 2),
            "max_drawdown_pct":     round(max_dd * 100, 2),
            "drawdown_start":       dd_start,
        }

    # ------------------------------------------------------------------
    # 7. Upside / downside capture
    # ------------------------------------------------------------------

    @staticmethod
    def compute_updown_capture(
        fund_returns: pd.Series,
        bench_returns: pd.Series,
    ) -> Dict[str, Any]:
        """Upside and downside capture ratios vs benchmark."""
        if fund_returns is None or bench_returns is None or len(fund_returns) < 30:
            return {"warning": "insufficient data for capture ratios"}
        up_mask   = bench_returns > 0
        down_mask = bench_returns < 0
        upside = downside = None
        if up_mask.sum() > 5:
            upside = float(fund_returns[up_mask].mean() / bench_returns[up_mask].mean() * 100)
        if down_mask.sum() > 5:
            downside = float(fund_returns[down_mask].mean() / bench_returns[down_mask].mean() * 100)
        return {
            "upside_capture":   round(upside, 2)   if upside   is not None else None,
            "downside_capture": round(downside, 2) if downside is not None else None,
        }

    # ------------------------------------------------------------------
    # 8. Valuation percentile
    # ------------------------------------------------------------------

    @staticmethod
    def compute_valuation_percentile(
        current_value: float,
        history: pd.Series,
    ) -> Dict[str, Any]:
        """Rank current_value against its own history as a percentile.

        Returns percentile (0–100) and a human-readable label.
        """
        if history is None or len(history) < 20:
            return {"warning": "insufficient history for percentile"}
        h = history.dropna()
        pct = float((h < current_value).mean() * 100)
        if pct >= 80:
            label = "historically expensive"
        elif pct >= 60:
            label = "above average"
        elif pct >= 40:
            label = "around average"
        elif pct >= 20:
            label = "below average"
        else:
            label = "historically cheap"
        return {
            "value":      current_value,
            "percentile": round(pct, 1),
            "label":      label,
        }

    # ------------------------------------------------------------------
    # 9. NAV premium / discount
    # ------------------------------------------------------------------

    @staticmethod
    def compute_nav_premium_discount(
        market_price: float,
        nav: float,
        history_30d: Optional[pd.Series] = None,
    ) -> Dict[str, Any]:
        """Compute ETF market-price premium/discount vs NAV."""
        if not nav or nav == 0:
            return {"warning": "NAV is zero or unavailable"}
        premium_pct = round((market_price / nav - 1) * 100, 4)
        avg_30d = None
        if history_30d is not None and len(history_30d) >= 5:
            avg_30d = round(float(history_30d.mean()), 4)
        alert = abs(premium_pct) > 1.0
        return {
            "market_price":        market_price,
            "nav":                 nav,
            "premium_pct":         premium_pct,
            "avg_30d_premium_pct": avg_30d,
            "alert":               alert,
        }

    # ------------------------------------------------------------------
    # 10. Bond duration / DV01 / convexity
    # ------------------------------------------------------------------

    @staticmethod
    def compute_duration(
        coupon_rate: float,
        ytm: float,
        maturity_years: float,
        freq: int = 2,
    ) -> Dict[str, Any]:
        """Macaulay duration, modified duration, DV01, and convexity.

        Args:
            coupon_rate:    annual coupon as a decimal (e.g. 0.07 for 7%)
            ytm:            yield to maturity as decimal
            maturity_years: years to maturity
            freq:           coupon frequency per year (2 = semi-annual)
        """
        if maturity_years <= 0 or ytm <= 0:
            return {"warning": "invalid maturity or YTM"}
        try:
            periods   = int(maturity_years * freq)
            c         = coupon_rate / freq          # coupon per period
            y         = ytm / freq                  # yield per period
            face      = 1.0

            # Price
            cf = [c * face] * periods
            cf[-1] += face
            pv_cf    = [cf[t] / (1 + y) ** (t + 1) for t in range(periods)]
            price    = sum(pv_cf)

            # Macaulay duration
            mac_dur  = sum((t + 1) * pv_cf[t] for t in range(periods)) / price / freq

            # Modified duration
            mod_dur  = mac_dur / (1 + ytm / freq)

            # DV01 (dollar value of a 1bp move, per 100 face)
            dv01     = mod_dur * price / 10000 * 100

            # Convexity
            convexity = sum(
                (t + 1) * (t + 2) * pv_cf[t]
                for t in range(periods)
            ) / price / freq**2 / (1 + y) ** 2

            return {
                "macaulay_duration":  round(mac_dur, 4),
                "modified_duration":  round(mod_dur, 4),
                "dv01":               round(dv01, 6),
                "convexity":          round(convexity, 4),
                "price_per_100":      round(price * 100, 4),
            }
        except Exception as exc:
            return {"warning": f"duration calculation failed: {exc}"}

    # ------------------------------------------------------------------
    # 11. Credit / yield spread percentile
    # ------------------------------------------------------------------

    @staticmethod
    def compute_spread_percentile(
        spread_bps: float,
        history: pd.Series,
    ) -> Dict[str, Any]:
        """Rank the current spread vs its historical distribution."""
        return QuantAnalyzer.compute_valuation_percentile(spread_bps, history)


quant_analyzer = QuantAnalyzer()
# Backward compatibility alias
QuantEngine = QuantAnalyzer
quant_engine = quant_analyzer
