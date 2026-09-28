"""ETFDataLayer — fetches and compiles a complete ETF dataset for Indian and US ETFs.

Indian ETFs: yfinance with .NS / .BO suffix.
US ETFs:     yfinance with raw ticker.

Inherits YFinanceDataLayer for OHLCV, chart signals, and technical metrics.
Adds ETF-specific fields: profile, holdings, allocations, tracking, NAV premium,
liquidity score, quant/risk metrics via the engine wiring pattern.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd
import yfinance as yf

from .yfinance_layer import YFinanceDataLayer
from ..providers.historical_data_provider import HistoricalDataProvider
from ..providers.benchmark_resolver import BenchmarkResolver
from ..providers.timeseries_normalizer import TimeSeriesNormalizer
from ..analyzers.risk_analyzer import RiskAnalyzer
from ..analyzers.quant_analyzer import QuantAnalyzer
from ..schemas.asset_schema import DataFetchResult
from ..config.settings import settings

logger = logging.getLogger(__name__)

_hdp  = HistoricalDataProvider()
_br   = BenchmarkResolver()
_tsn  = TimeSeriesNormalizer()
_re   = RiskAnalyzer()


def _safe(fn, *args, fallback=None, gap_list: Optional[List] = None,
          gap_msg: str = "", **kwargs):
    """Call fn(*args); on exception return fallback and append gap_msg to gap_list."""
    try:
        return fn(*args, **kwargs)
    except Exception as exc:
        logger.debug("ETFDataLayer safe-call '%s' failed: %s", fn.__name__, exc)
        if gap_list is not None and gap_msg:
            gap_list.append(f"{gap_msg}: {exc}")
        return fallback


class ETFDataLayer(YFinanceDataLayer):
    """Full dataset compiler for Indian and US ETFs."""

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def compile_full_dataset(self, ticker: str, market: str = "us") -> Dict[str, Any]:  # type: ignore[override]
        """Fetch all ETF data and return a canonical dict.

        Args:
            ticker: raw ticker (e.g. 'SPY', 'NIFTYBEES')
            market: 'us' or 'india'
        """
        data_gaps: List[str] = []
        dq:        Dict[str, Any] = {}  # data_quality
        today = datetime.utcnow().strftime("%Y-%m-%d")

        # ---- Resolve exchange ticker ----
        resolved = self._resolve_etf_ticker(ticker, market)

        # ---- Base data from YFinanceDataLayer ----
        base = super().compile_full_dataset(resolved)
        # Merge any data gaps from the base layer
        if base.get("data_gaps"):
            data_gaps.extend(base["data_gaps"] if isinstance(base["data_gaps"], list) else [])

        info = base.get("info") or {}

        # ---- ETF-specific fields ----
        etf_profile        = _safe(self._extract_etf_profile, info, resolved,
                                   fallback={}, gap_list=data_gaps,
                                   gap_msg="etf_profile")
        holdings_top10     = _safe(self._extract_holdings, resolved,
                                   fallback=[], gap_list=data_gaps,
                                   gap_msg="holdings_top10")
        asset_allocation   = _safe(self._extract_asset_allocation, resolved,
                                   fallback={}, gap_list=data_gaps,
                                   gap_msg="asset_allocation")
        sector_allocation  = _safe(self._extract_sector_allocation, resolved,
                                   fallback={}, gap_list=data_gaps,
                                   gap_msg="sector_allocation")

        # ---- NAV premium / discount ----
        nav_premium_discount = _safe(
            self._compute_nav_premium_discount, info,
            fallback={}, gap_list=data_gaps, gap_msg="nav_premium_discount",
        )

        # ---- Liquidity score ----
        liquidity_score = _safe(
            self._compute_liquidity_score, info,
            fallback={}, gap_list=data_gaps, gap_msg="liquidity_score",
        )

        # ---- Engine wiring (blueprint §5.3) ----
        quant_metrics: Dict[str, Any] = {}
        risk_metrics:  Dict[str, Any] = {}
        tracking_difference: Dict[str, Any] = {}
        valuation_percentile: Dict[str, Any] = {}

        price_result = _hdp.get_price_history(ticker, market, period="3y")
        if price_result.success:
            price_series   = price_result.data
            benchmark_def  = _br.resolve(ticker, asset_type="etf", market=market)
            bench_series: Optional[pd.Series] = None

            if benchmark_def:
                bench_result = _hdp.get_benchmark_history(benchmark_def, period="3y")
                if bench_result.success:
                    bench_series = bench_result.data
                else:
                    data_gaps.append(
                        f"benchmark ({benchmark_def.name}): {bench_result.error} — "
                        "tracking calculations skipped"
                    )
                    if benchmark_def.return_type == "price_return":
                        data_gaps.append(
                            f"benchmark_return_type: {benchmark_def.name} uses price return, "
                            "not total return — tracking difference is approximate"
                        )
            else:
                data_gaps.append(
                    f"benchmark: no mapping for {ticker} — "
                    "tracking difference, alpha/beta skipped"
                )

            # RiskEngine full pass
            re_out = _re.run(
                price_series, bench_series,
                rf_rate=settings.risk_free_rate_india if market == "india"
                        else settings.risk_free_rate_us,
                market=market, asset_type="etf",
            )
            quant_metrics = re_out.get("quant_metrics", {})
            risk_metrics  = re_out.get("risk_metrics", {})
            data_gaps.extend(re_out.get("data_gaps_engine", []))

            # Tracking difference (price series already aligned inside RiskEngine)
            if bench_series is not None:
                try:
                    p_al, b_al = _tsn.align(price_series, bench_series, market)
                    tracking_difference = QuantAnalyzer.compute_tracking_difference(p_al, b_al)
                except Exception as exc:
                    data_gaps.append(f"tracking_difference: {exc}")

            # Valuation percentile for P/E
            pe_hist = base.get("pe_history") or {}
            if pe_hist:
                try:
                    pe_vals  = [v for v in pe_hist.values() if isinstance(v, (int, float))]
                    curr_pe  = info.get("trailingPE") or info.get("forwardPE")
                    if curr_pe and pe_vals:
                        valuation_percentile["pe"] = QuantAnalyzer.compute_valuation_percentile(
                            curr_pe, pd.Series(pe_vals)
                        )
                except Exception as exc:
                    data_gaps.append(f"valuation_percentile.pe: {exc}")
        else:
            data_gaps.append(f"price_history: {price_result.error} — risk calculations skipped")

        # ---- Data quality metadata ----
        dq = self._build_data_quality(info, today, market,
                                      holdings_available=bool(holdings_top10),
                                      sector_available=bool(sector_allocation))

        # ---- Merge everything into base dict ----
        base.update({
            "source":               f"Yahoo Finance (yfinance) — {resolved}",
            "etf_profile":          etf_profile,
            "holdings_top10":       holdings_top10,
            "asset_allocation":     asset_allocation,
            "sector_allocation":    sector_allocation,
            "tracking_difference":  tracking_difference,
            "nav_premium_discount": nav_premium_discount,
            "liquidity_score":      liquidity_score,
            "quant_metrics":        quant_metrics,
            "risk_metrics":         risk_metrics,
            "valuation_percentile": valuation_percentile,
            "data_quality":         dq,
            "data_gaps":            data_gaps,
        })
        return base

    # ------------------------------------------------------------------
    # ETF-specific extractors
    # ------------------------------------------------------------------

    @staticmethod
    def _resolve_etf_ticker(ticker: str, market: str) -> str:
        t = ticker.upper().strip()
        if market == "india" and not t.endswith((".NS", ".BO")):
            return t + ".NS"
        return t

    @staticmethod
    def _extract_etf_profile(info: Dict, ticker: str) -> Dict[str, Any]:
        def _g(key):
            v = info.get(key)
            return v if v not in (None, "N/A", "None", "") else None

        return {
            "ticker":               ticker,
            "long_name":            _g("longName"),
            "fund_family":          _g("fundFamily"),
            "category":             _g("category"),
            "legal_type":           _g("legalType"),
            "index_tracked":        _g("indexName") or _g("category"),
            "aum_usd":              _g("totalAssets"),
            "expense_ratio":        _g("annualReportExpenseRatio") or _g("expenseRatio"),
            "nav":                  _g("navPrice"),
            "yield_ttm":            _g("yield"),
            "ytd_return":           _g("ytdReturn"),
            "3y_avg_return":        _g("threeYearAverageReturn"),
            "5y_avg_return":        _g("fiveYearAverageReturn"),
            "beta_3y":              _g("beta3Year"),
            "inception_date":       _g("fundInceptionDate"),
        }

    @staticmethod
    def _extract_holdings(ticker: str) -> List[Dict]:
        """Extract top-10 holdings from yfinance funds_data (US) or info (India)."""
        try:
            t = yf.Ticker(ticker)
            # US ETFs — funds_data attribute
            fd = getattr(t, "funds_data", None)
            if fd is not None:
                top = getattr(fd, "top_holdings", None)
                if top is not None and not (isinstance(top, pd.DataFrame) and top.empty):
                    if isinstance(top, pd.DataFrame):
                        records = []
                        for _, row in top.head(10).iterrows():
                            records.append({
                                "name":       str(row.get("holdingName", row.name)),
                                "weight_pct": round(float(row.get("holdingPercent", 0)) * 100, 4),
                                "isin":       str(row.get("holdingIsin", "")),
                            })
                        return records
        except Exception as exc:
            logger.debug("ETFDataLayer._extract_holdings failed: %s", exc)
        return []

    @staticmethod
    def _extract_asset_allocation(ticker: str) -> Dict[str, Any]:
        try:
            t  = yf.Ticker(ticker)
            fd = getattr(t, "funds_data", None)
            if fd is not None:
                aa = getattr(fd, "asset_classes", None)
                if aa is not None and not (isinstance(aa, pd.DataFrame) and aa.empty):
                    if isinstance(aa, pd.DataFrame):
                        result = {}
                        for _, row in aa.iterrows():
                            cls = str(row.get("assetClass", "")).lower()
                            wt  = row.get("netAssetsPercent", row.get("longPercent", 0))
                            result[cls] = round(float(wt), 4)
                        return result
        except Exception as exc:
            logger.debug("ETFDataLayer._extract_asset_allocation failed: %s", exc)
        return {}

    @staticmethod
    def _extract_sector_allocation(ticker: str) -> Dict[str, Any]:
        try:
            t  = yf.Ticker(ticker)
            fd = getattr(t, "funds_data", None)
            if fd is not None:
                sa = getattr(fd, "sector_weightings", None)
                if sa is not None and not (isinstance(sa, pd.DataFrame) and sa.empty):
                    if isinstance(sa, pd.DataFrame):
                        return {
                            str(row.get("sector", i)): round(float(row.get("weightPercent", 0)), 4)
                            for i, (_, row) in enumerate(sa.iterrows())
                        }
                    if isinstance(sa, dict):
                        return {k: round(float(v), 4) for k, v in sa.items()}
        except Exception as exc:
            logger.debug("ETFDataLayer._extract_sector_allocation failed: %s", exc)
        return {}

    @staticmethod
    def _compute_nav_premium_discount(info: Dict) -> Dict[str, Any]:
        nav          = info.get("navPrice") or info.get("regularMarketPreviousClose")
        market_price = info.get("regularMarketPrice") or info.get("currentPrice")
        if not nav or not market_price:
            return {"warning": "NAV or market price unavailable"}
        return QuantAnalyzer.compute_nav_premium_discount(market_price, nav)

    @staticmethod
    def _compute_liquidity_score(info: Dict) -> Dict[str, Any]:
        avg_vol   = info.get("averageVolume") or info.get("averageDailyVolume10Day") or 0
        aum       = info.get("totalAssets") or 0
        ask       = info.get("ask") or 0
        bid       = info.get("bid") or 0
        price     = info.get("regularMarketPrice") or info.get("currentPrice") or 1
        spread_pct = abs(ask - bid) / price * 100 if (ask and bid and price) else None

        # Score 0–100: volume (40pts), AUM (40pts), spread (20pts)
        vol_score  = min(40, avg_vol / 1_000_000 * 4)    # 10M vol → 40pts
        aum_score  = min(40, (aum or 0) / 1e9 * 4)       # $10B AUM → 40pts
        spd_score  = max(0, 20 - (spread_pct or 5) * 4)  # 0% spread → 20pts

        score = round(vol_score + aum_score + spd_score, 1)
        return {
            "score_0_100":        score,
            "avg_daily_volume":   int(avg_vol),
            "bid_ask_spread_pct": round(spread_pct, 4) if spread_pct is not None else None,
            "aum_usd":            aum,
        }

    @staticmethod
    def _build_data_quality(
        info: Dict,
        today: str,
        market: str,
        holdings_available: bool,
        sector_available: bool,
    ) -> Dict[str, Any]:
        src  = "Yahoo Finance (yfinance)"
        qual = "B"  # third-party
        dq: Dict[str, Any] = {
            "price":       {"source": src, "timestamp": today, "quality": qual, "freshness": "same_day"},
            "etf_profile": {"source": src, "timestamp": today, "quality": qual, "freshness": "same_day"},
        }
        if holdings_available:
            dq["holdings_top10"] = {"source": src, "timestamp": today, "quality": qual, "freshness": "latest_disclosure"}
        else:
            dq["holdings_top10"] = {"source": "unavailable", "quality": "D", "freshness": "unavailable"}
        if sector_available:
            dq["sector_allocation"] = {"source": src, "timestamp": today, "quality": qual, "freshness": "latest_disclosure"}
        else:
            dq["sector_allocation"] = {"source": "unavailable", "quality": "D", "freshness": "unavailable"}
        return dq


etf_layer = ETFDataLayer()
