"""BondDataLayer — fetches and compiles bond / yield instrument data.

Handles three cases:
1. Bond ETF (TLT, AGG, LIQUIDBEES) — delegates to ETFDataLayer + appends yield context
2. US benchmark yields (us-10y, us-treasury, us-tips) — US Treasury XML + FRED fallback
3. India benchmark yields (india-10y, india-gsec, india-tbill) — FBIL + RBI

Individual CUSIP-level corporate bonds are out of scope (Phase 2 / FINRA API).
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd
import requests

from .etf_layer import etf_layer
from ..providers.historical_data_provider import HistoricalDataProvider
from ..analyzers.quant_analyzer import QuantAnalyzer
from ..config.settings import settings

logger = logging.getLogger(__name__)

_hdp = HistoricalDataProvider()

_REQUEST_TIMEOUT = 15

# Keywords that identify a benchmark string vs an ETF ticker
_BENCHMARK_KEYWORDS = {
    "india-10y", "india-gsec", "india-tbill", "india-sdl", "india-treasury",
    "us-10y", "us-treasury", "us-tips", "us-tbill", "us-30y", "us-2y",
}

# US Treasury XML feed (daily par yield curve)
_TREASURY_BASE = (
    "https://home.treasury.gov/resource-center/data-chart-center/"
    "interest-rates/pages/xml"
)
# FRED CMT series IDs
_FRED_CMT = {
    "1m": "DGS1MO", "3m": "DGS3MO", "6m": "DGS6MO",
    "1y": "DGS1",   "2y": "DGS2",   "5y": "DGS5",
    "10y": "DGS10", "20y": "DGS20", "30y": "DGS30",
}
_FRED_TIPS = {
    "5y_real":  "DFII5",
    "10y_real": "DFII10",
    "30y_real": "DFII30",
    "10y_breakeven": "T10YIE",
}


def _safe(fn, *args, fallback=None, gap_list: Optional[List] = None,
          gap_msg: str = "", **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception as exc:
        logger.debug("BondLayer safe-call '%s' failed: %s", fn.__name__, exc)
        if gap_list is not None and gap_msg:
            gap_list.append(f"{gap_msg}: {exc}")
        return fallback


class BondDataLayer:
    """Full dataset compiler for bond instruments and yield benchmarks."""

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def compile_full_dataset(
        self,
        instrument: str,
        market: str = "us",
    ) -> Dict[str, Any]:
        """Compile a bond dataset.

        Args:
            instrument: ETF ticker ('TLT') or benchmark key ('us-10y', 'india-10y')
            market:     'us' or 'india'
        """
        instrument_lc = instrument.lower().strip()
        if self._is_etf(instrument_lc):
            return self._compile_bond_etf(instrument, market)
        return self._compile_benchmark(instrument_lc, market)

    # ------------------------------------------------------------------
    # ETF path
    # ------------------------------------------------------------------

    def _compile_bond_etf(
        self, ticker: str, market: str
    ) -> Dict[str, Any]:
        """Delegate to ETFDataLayer then append yield context."""
        data_gaps: List[str] = []
        dataset = etf_layer.compile_full_dataset(ticker, market)
        data_gaps.extend(dataset.get("data_gaps") or [])

        # Append yield context based on market
        yield_context: Dict[str, Any] = {}
        if market == "us":
            yc = _safe(self._fetch_us_treasury_curve, fallback={},
                       gap_list=data_gaps, gap_msg="yield_curve_context")
            if yc:
                curve_yields = {k: v.get("yield") for k, v in yc.items() if v.get("yield")}
                spread       = _safe(self._compute_spread_analysis, curve_yields,
                                     fallback={}, gap_list=data_gaps, gap_msg="spread_analysis")
                real         = _safe(self._fetch_us_real_yield, fallback={},
                                     gap_list=data_gaps, gap_msg="real_yield")
                yield_context = {
                    "yield_curve":     yc,
                    "spread_analysis": spread,
                    "real_yield":      real,
                    "macro_context":   self._build_macro_context(
                        curve_yields, real, market
                    ),
                }
        else:
            yc = _safe(self._fetch_india_yield_curve, fallback={},
                       gap_list=data_gaps, gap_msg="yield_curve_context")
            if yc:
                curve_yields = {k: v.get("yield") for k, v in yc.items() if v.get("yield")}
                spread       = _safe(self._compute_spread_analysis, curve_yields,
                                     fallback={}, gap_list=data_gaps, gap_msg="spread_analysis")
                yield_context = {
                    "yield_curve":     yc,
                    "spread_analysis": spread,
                    "real_yield":      {},
                    "macro_context":   self._build_macro_context(curve_yields, {}, market),
                }

        dataset.update(yield_context)
        dataset["instrument_type"] = {
            "asset_class": "bond",
            "sub_type":    "etf",
            "market":      market,
        }
        dataset["data_gaps"] = data_gaps
        return dataset

    # ------------------------------------------------------------------
    # Benchmark path
    # ------------------------------------------------------------------

    def _compile_benchmark(
        self, instrument: str, market: str
    ) -> Dict[str, Any]:
        """Compile a yield benchmark dataset (no price/NAV — yields only)."""
        data_gaps: List[str] = []
        today = datetime.utcnow().strftime("%Y-%m-%d")

        yield_curve:     Dict[str, Any] = {}
        real_yield:      Dict[str, Any] = {}
        spread_analysis: Dict[str, Any] = {}
        current_yields:  Dict[str, Any] = {}
        yield_changes:   Dict[str, Any] = {}
        macro_context:   str            = ""

        if market == "us":
            # Primary: US Treasury XML
            yc_raw = _safe(self._fetch_us_treasury_curve, fallback={},
                           gap_list=data_gaps, gap_msg="us_treasury_curve")
            if not yc_raw:
                # Fallback: FRED
                yc_raw = _safe(self._fetch_fred_curve, fallback={},
                               gap_list=data_gaps, gap_msg="fred_curve")
            yield_curve   = yc_raw or {}
            real_yield    = _safe(self._fetch_us_real_yield, fallback={},
                                  gap_list=data_gaps, gap_msg="real_yield")
            if "tips" in instrument:
                real_yield["note"] = "TIPS real yield fetched — see real_yield keys"

        else:  # india
            yc_raw = _safe(self._fetch_india_yield_curve, fallback={},
                           gap_list=data_gaps, gap_msg="india_yield_curve")
            yield_curve = yc_raw or {}
            if not yield_curve:
                data_gaps.append(
                    "india_yield_curve: FBIL fetch failed — "
                    "check fbil.org.in for current G-Sec benchmark rates"
                )

        # Snapshot of key maturities
        if yield_curve:
            curve_yields = {k: v.get("yield") for k, v in yield_curve.items() if v.get("yield")}
            current_yields  = curve_yields
            spread_analysis = _safe(
                self._compute_spread_analysis, curve_yields,
                fallback={}, gap_list=data_gaps, gap_msg="spread_analysis",
            )
            macro_context = self._build_macro_context(curve_yields, real_yield, market)

            # Yield history for percentile — FRED for US
            if market == "us" and settings.fred_api_key:
                hist_result = _hdp.get_yield_history("DGS10", "us", "5y")
                if hist_result.success and current_yields.get("10y"):
                    pct = QuantAnalyzer.compute_valuation_percentile(
                        current_yields["10y"], hist_result.data
                    )
                    if yield_curve.get("10y"):
                        yield_curve["10y"]["5y_percentile"] = pct

        # Bond risk metrics for benchmark instruments
        bond_risk_metrics: Dict[str, Any] = {}
        maturity_map = {"india-10y": 10, "us-10y": 10, "india-gsec": 10,
                        "us-30y": 30, "us-2y": 2, "india-tbill": 0.25}
        maturity = maturity_map.get(instrument)
        ytm_key  = {"india-10y": "10y", "us-10y": "10y", "us-30y": "30y",
                    "us-2y": "2y"}.get(instrument, "10y")
        ytm = current_yields.get(ytm_key)
        if ytm and maturity:
            coupon = ytm  # approximate coupon ≈ YTM for newly issued bonds
            bond_risk_metrics = QuantAnalyzer.compute_duration(
                coupon, ytm, maturity, freq=2
            )

        data_quality = {
            "yield_curve": {
                "source":    "U.S. Treasury" if market == "us" else "FBIL/RBI",
                "timestamp": today,
                "quality":   "A",
                "freshness": "same_day" if yield_curve else "unavailable",
            },
            "real_yield": {
                "source":    "U.S. Treasury (TIPS)" if market == "us" else "unavailable",
                "timestamp": today,
                "quality":   "A" if real_yield else "D",
                "freshness": "same_day" if real_yield else "unavailable",
            },
        }

        return {
            "source":            "U.S. Treasury / FRED" if market == "us" else "FBIL / RBI",
            "source_url":        (
                "https://home.treasury.gov/resource-center/data-chart-center/interest-rates"
                if market == "us"
                else "https://www.fbil.org.in"
            ),
            "instrument":        instrument,
            "market":            market,
            "instrument_type": {
                "asset_class": "bond",
                "sub_type":    "government",
                "market":      market,
            },
            "key_metrics":       current_yields,
            "yield_curve":       yield_curve,
            "current_yields":    current_yields,
            "yield_changes":     yield_changes,
            "spread_analysis":   spread_analysis,
            "real_yield":        real_yield,
            "macro_context":     macro_context,
            "bond_risk_metrics": bond_risk_metrics,
            "fundamental_metrics": {},
            "technical_metrics":   {},
            "chart_signals":       {},
            "forensic_metrics":    {},
            "peer_comparison":     [],
            "news":                [],
            "quant_metrics":       {},
            "risk_metrics":        {},
            "data_quality":        data_quality,
            "data_gaps":           data_gaps,
        }

    # ------------------------------------------------------------------
    # Routing helper
    # ------------------------------------------------------------------

    @staticmethod
    def _is_etf(instrument: str) -> bool:
        return instrument.lower().strip() not in _BENCHMARK_KEYWORDS

    # ------------------------------------------------------------------
    # US Treasury curve (primary source)
    # ------------------------------------------------------------------

    def _fetch_us_treasury_curve(self) -> Dict[str, Any]:
        """Fetch US Treasury par yield curve from Treasury XML API."""
        import xml.etree.ElementTree as ET
        today = datetime.utcnow()
        year  = today.year
        url   = f"{_TREASURY_BASE}?data=daily_treasury_yield_curve&field_tdr_date_value={year}"
        try:
            resp = requests.get(url, timeout=_REQUEST_TIMEOUT,
                                headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            root = ET.fromstring(resp.text)
            ns   = {"m": "http://schemas.microsoft.com/ado/2007/08/dataservices/metadata",
                    "d": "http://schemas.microsoft.com/ado/2007/08/dataservices"}
            entries = root.findall(".//{http://www.w3.org/2005/Atom}entry")
            if not entries:
                return {}
            # Get the latest entry
            latest   = entries[-1]
            props    = latest.find(".//{%s}properties" % "http://schemas.microsoft.com/ado/2007/08/dataservices/metadata")
            if props is None:
                return {}

            tag_map = {
                "BC_1MONTH": "1m", "BC_3MONTH": "3m", "BC_6MONTH": "6m",
                "BC_1YEAR": "1y",  "BC_2YEAR": "2y",  "BC_3YEAR": "3y",
                "BC_5YEAR": "5y",  "BC_7YEAR": "7y",  "BC_10YEAR": "10y",
                "BC_20YEAR": "20y","BC_30YEAR": "30y",
            }
            result: Dict[str, Any] = {}
            date_el = latest.find(".//{%s}NEW_DATE" % "http://schemas.microsoft.com/ado/2007/08/dataservices")
            date_str = date_el.text[:10] if date_el is not None and date_el.text else str(today.date())

            for el in (props or []):
                tag = el.tag.split("}")[-1] if "}" in el.tag else el.tag
                label = tag_map.get(tag)
                if label and el.text:
                    try:
                        result[label] = {"yield": float(el.text), "date": date_str,
                                         "source": "U.S. Treasury"}
                    except ValueError:
                        pass
            return result
        except Exception as exc:
            logger.debug("US Treasury XML fetch failed: %s", exc)
            return {}

    # ------------------------------------------------------------------
    # FRED fallback
    # ------------------------------------------------------------------

    def _fetch_fred_curve(self) -> Dict[str, Any]:
        """Fetch US yield curve from FRED as fallback."""
        if not settings.fred_api_key:
            return {}
        try:
            from fredapi import Fred
            fred   = Fred(api_key=settings.fred_api_key)
            result = {}
            for label, sid in _FRED_CMT.items():
                try:
                    s = fred.get_series(sid)
                    if s is not None and not s.empty:
                        last = float(s.dropna().iloc[-1])
                        result[label] = {"yield": last, "source": "FRED", "series_id": sid}
                except Exception:
                    pass
            return result
        except Exception as exc:
            logger.debug("FRED curve fetch failed: %s", exc)
            return {}

    # ------------------------------------------------------------------
    # US real yield (TIPS)
    # ------------------------------------------------------------------

    def _fetch_us_real_yield(self) -> Dict[str, Any]:
        """Fetch US TIPS real yield curve and breakeven inflation from FRED."""
        if not settings.fred_api_key:
            return {"note": "FRED_API_KEY not set — real yield data unavailable"}
        try:
            from fredapi import Fred
            fred   = Fred(api_key=settings.fred_api_key)
            result = {}
            for label, sid in _FRED_TIPS.items():
                try:
                    s = fred.get_series(sid)
                    if s is not None and not s.empty:
                        result[label] = float(s.dropna().iloc[-1])
                except Exception:
                    pass
            # Derive approximate real yield if not directly available
            if "10y_breakeven" in result and result.get("10y_breakeven"):
                result["note"] = (
                    f"10Y breakeven inflation = {result['10y_breakeven']:.2f}% "
                    f"(nominal − TIPS implied)"
                )
            return result
        except Exception as exc:
            logger.debug("TIPS/real yield fetch failed: %s", exc)
            return {}

    # ------------------------------------------------------------------
    # India yield curve (FBIL)
    # ------------------------------------------------------------------

    def _fetch_india_yield_curve(self) -> Dict[str, Any]:
        """Fetch India G-Sec benchmark rates from FBIL."""
        try:
            url  = "https://www.fbil.org.in/fbil_rates.php"
            resp = requests.get(url, timeout=_REQUEST_TIMEOUT,
                                headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            tables = pd.read_html(resp.text)
            result: Dict[str, Any] = {}
            today_str = datetime.utcnow().strftime("%Y-%m-%d")
            maturity_keywords = {
                "91": "3m", "91-day": "3m",
                "182": "6m", "182-day": "6m",
                "364": "1y", "364-day": "1y",
                "1 year": "1y", "2 year": "2y", "3 year": "3y",
                "5 year": "5y", "7 year": "7y",
                "10 year": "10y", "10-year": "10y",
                "14 year": "14y", "15 year": "15y",
                "20 year": "20y", "30 year": "30y",
            }
            for tbl in tables:
                tbl.columns = [str(c).lower().strip() for c in tbl.columns]
                for _, row in tbl.iterrows():
                    for col in tbl.columns:
                        cell = str(row[col]).lower().strip()
                        for kw, label in maturity_keywords.items():
                            if kw in cell:
                                # Find numeric yield in the same row
                                for vcol in tbl.columns:
                                    try:
                                        val = float(str(row[vcol]).replace(",", ""))
                                        if 0.1 < val < 25:  # sanity: valid yield range
                                            result[label] = {
                                                "yield": val,
                                                "date": today_str,
                                                "source": "FBIL",
                                            }
                                            break
                                    except (ValueError, TypeError):
                                        pass
            return result
        except Exception as exc:
            logger.debug("FBIL fetch failed: %s", exc)
            return {}

    # ------------------------------------------------------------------
    # Spread analysis
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_spread_analysis(curve_yields: Dict[str, Optional[float]]) -> Dict[str, Any]:
        """Compute 2s10s, 10s30s spreads and inversion flags."""
        y2   = curve_yields.get("2y")
        y5   = curve_yields.get("5y")
        y10  = curve_yields.get("10y")
        y30  = curve_yields.get("30y")

        spread_2s10s  = round(y10 - y2,  4) if y10 and y2  else None
        spread_10s30s = round(y30 - y10, 4) if y30 and y10 else None
        slope_5s10s   = round(y10 - y5,  4) if y10 and y5  else None

        inverted = False
        if spread_2s10s is not None and spread_2s10s < 0:
            inverted = True

        if spread_2s10s is not None:
            if spread_2s10s > 1.5:
                curve_shape = "steeply normal (long-term rates well above short-term)"
            elif spread_2s10s > 0.5:
                curve_shape = "normal (positive slope)"
            elif spread_2s10s > -0.1:
                curve_shape = "flat"
            else:
                curve_shape = "inverted (short rates above long rates — recession signal)"
        else:
            curve_shape = "unknown (insufficient data)"

        return {
            "2s10s_spread":   spread_2s10s,
            "10s30s_spread":  spread_10s30s,
            "5s10s_slope":    slope_5s10s,
            "inverted":       inverted,
            "curve_shape":    curve_shape,
        }

    # ------------------------------------------------------------------
    # Macro context builder
    # ------------------------------------------------------------------

    @staticmethod
    def _build_macro_context(
        curve_yields: Dict[str, Optional[float]],
        real_yield:   Dict[str, Any],
        market:       str,
    ) -> str:
        y10 = curve_yields.get("10y")
        lines: List[str] = []

        if y10 is not None:
            if y10 > 7:
                lines.append(f"10Y yield {y10:.2f}% is elevated — bonds offer high income.")
            elif y10 > 5:
                lines.append(f"10Y yield {y10:.2f}% is moderate — balanced income outlook.")
            else:
                lines.append(f"10Y yield {y10:.2f}% is low — limited income from government bonds.")

        inverted = (curve_yields.get("2y") or 0) > (y10 or 99)
        if inverted:
            lines.append(
                "Yield curve is inverted (2Y > 10Y) — historically associated with "
                "slowing growth and potential rate cuts ahead."
            )

        if market == "us":
            breakeven = real_yield.get("10y_breakeven")
            real_10y  = real_yield.get("10y_real")
            if breakeven:
                lines.append(f"10Y breakeven inflation = {breakeven:.2f}% (market's implied CPI expectation).")
            if real_10y:
                if real_10y > 0:
                    lines.append(f"10Y real yield = {real_10y:.2f}% (positive) — bonds are attractive in real terms.")
                else:
                    lines.append(f"10Y real yield = {real_10y:.2f}% (negative) — holding bonds costs in real terms.")

        return " ".join(lines) if lines else "Yield context unavailable."


bond_layer = BondDataLayer()
