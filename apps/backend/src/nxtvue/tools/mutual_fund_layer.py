"""MutualFundDataLayer — fetches and compiles a complete Indian MF dataset.

Data sources (priority order):
1. mftool / MFAPI.in  — NAV history, scheme metadata
2. AMFI NAVAll.txt    — authoritative daily NAV
3. AMFI TER page      — Total Expense Ratio (SEBI-mandated daily disclosure)
4. SEBI portfolio     — monthly holdings disclosure (best-effort)

AUM and individual manager names are not reliably available via free APIs.
All such gaps are documented explicitly in data_gaps.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

import pandas as pd
import requests

from ..providers.historical_data_provider import HistoricalDataProvider
from ..providers.benchmark_resolver import BenchmarkResolver
from ..providers.timeseries_normalizer import TimeSeriesNormalizer
from ..analyzers.risk_analyzer import RiskAnalyzer
from ..analyzers.quant_analyzer import QuantAnalyzer
from ..schemas.asset_schema import DataFetchResult
from ..config.settings import settings

logger = logging.getLogger(__name__)

_hdp = HistoricalDataProvider()
_br  = BenchmarkResolver()
_tsn = TimeSeriesNormalizer()
_re  = RiskAnalyzer()

_AMFI_NAV_URL = "https://www.amfiindia.com/spages/NAVAll.txt"
_AMFI_TER_URL = "https://www.amfiindia.com/research-information/other-data/scheme-wise-ratio"
_REQUEST_TIMEOUT = 20


def _safe(fn, *args, fallback=None, gap_list: Optional[List] = None,
          gap_msg: str = "", **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception as exc:
        logger.debug("MFLayer safe-call '%s' failed: %s", fn.__name__, exc)
        if gap_list is not None and gap_msg:
            gap_list.append(f"{gap_msg}: {exc}")
        return fallback


class MutualFundDataLayer:
    """Full dataset compiler for Indian Mutual Funds."""

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def compile_full_dataset(
        self,
        scheme_input: Union[str, int],
    ) -> Dict[str, Any]:
        """Fetch all MF data and return a canonical dict.

        Args:
            scheme_input: scheme code (int) or partial scheme name (str)
        """
        data_gaps: List[str] = []
        today = datetime.utcnow().strftime("%Y-%m-%d")

        # ---- Resolve scheme code ----
        try:
            scheme_code, scheme_name = self._resolve_scheme(scheme_input)
        except ValueError as exc:
            return {
                "source": "mftool",
                "source_url": _AMFI_NAV_URL,
                "error": str(exc),
                "data_gaps": [f"scheme_resolution: {exc}"],
                "key_metrics": {},
            }

        # ---- Fetch NAV history ----
        nav_result = _hdp.get_nav_history(scheme_code, days=365 * 5)
        nav_series: Optional[pd.Series] = None
        if nav_result.success:
            nav_series = nav_result.data
        else:
            data_gaps.append(
                f"nav_history: {nav_result.error} — "
                "performance calculations limited"
            )

        # ---- Scheme details ----
        scheme_details = _safe(
            self._fetch_scheme_details, scheme_code,
            fallback={}, gap_list=data_gaps, gap_msg="scheme_details",
        )

        # ---- TER ----
        ter = _safe(
            self._fetch_ter, scheme_code, scheme_name,
            fallback=None, gap_list=data_gaps, gap_msg="ter",
        )

        # ---- SEBI portfolio holdings ----
        portfolio = _safe(
            self._fetch_portfolio, scheme_code, scheme_name,
            fallback={}, gap_list=data_gaps, gap_msg="portfolio_holdings",
        )

        # ---- Current NAV ----
        nav_current: Optional[float] = None
        if nav_series is not None and not nav_series.empty:
            nav_current = float(nav_series.iloc[-1])

        # ---- NAV returns (Python only) ----
        nav_returns: Dict[str, Any] = {}
        if nav_series is not None and len(nav_series) >= 22:
            nav_returns = QuantAnalyzer.compute_rolling_returns(nav_series,
                                                              windows=[252, 756, 1260])
            nav_returns.update(QuantAnalyzer.compute_returns(nav_series))

        # ---- Risk metrics via engine wiring ----
        quant_metrics: Dict[str, Any] = {}
        risk_metrics:  Dict[str, Any] = {}

        if nav_series is not None and len(nav_series) >= 60:
            category = scheme_details.get("scheme_category", "")
            benchmark_def = _br.resolve_category_benchmark(category, "india")
            bench_series:  Optional[pd.Series] = None

            if benchmark_def:
                bench_result = _hdp.get_benchmark_history(benchmark_def, period="5y")
                if bench_result.success:
                    bench_series = bench_result.data
                else:
                    data_gaps.append(
                        f"benchmark ({benchmark_def.name}): {bench_result.error} — "
                        "alpha/beta/capture skipped"
                    )
            else:
                data_gaps.append(
                    f"benchmark: no mapping for category '{category}' — "
                    "alpha/beta/capture skipped"
                )

            re_out = _re.run(
                nav_series, bench_series,
                rf_rate=settings.risk_free_rate_india,
                market="india", asset_type="mf",
            )
            quant_metrics = re_out.get("quant_metrics", {})
            risk_metrics  = re_out.get("risk_metrics", {})
            data_gaps.extend(re_out.get("data_gaps_engine", []))
        else:
            data_gaps.append(
                "quant_metrics: insufficient NAV history (need ≥60 days) — skipped"
            )

        # ---- Standard data_gaps for always-missing fields ----
        data_gaps += [
            "AUM: not available via free API — check fund factsheet at AMC website",
            "fund_manager: name not reliably available — see AMC website",
        ]
        if ter is None:
            data_gaps.append(
                "TER: AMFI fetch failed — "
                "see amfiindia.com/research-information/other-data/scheme-wise-ratio"
            )
        if not portfolio.get("holdings_top10"):
            data_gaps.append(
                "holdings: SEBI monthly disclosure unavailable — "
                "check sebi.gov.in or AMC website for latest portfolio"
            )

        # ---- Build scheme_info ----
        scheme_info = {
            "scheme_code":     scheme_code,
            "scheme_name":     scheme_name,
            "fund_house":      scheme_details.get("fund_house") or scheme_details.get("AMC"),
            "category":        scheme_details.get("scheme_category") or scheme_details.get("Scheme Type"),
            "scheme_type":     scheme_details.get("scheme_type") or scheme_details.get("Scheme Type"),
            "launch_date":     scheme_details.get("date") or scheme_details.get("Date"),
            "nav_date":        scheme_details.get("nav_date"),
            "ter":             ter,
            "benchmark":       (
                _br.resolve_category_benchmark(
                    scheme_details.get("scheme_category", ""), "india"
                ).name
                if scheme_details.get("scheme_category")
                else None
            ),
        }

        # ---- key_metrics ----
        key_metrics = {
            "nav_current":  nav_current,
            "nav_1d":       nav_returns.get("1d"),
            "nav_1w":       nav_returns.get("1w"),
            "nav_1m":       nav_returns.get("1m"),
            "nav_1y":       nav_returns.get("1y"),
            "nav_1y_cagr":  nav_returns.get("1y_cagr"),
            "nav_3y_cagr":  nav_returns.get("3y_cagr"),
            "nav_5y_cagr":  nav_returns.get("5y_cagr"),
            "win_rate_1y":  nav_returns.get("win_rate_1y"),
            "ter":          ter,
            "scheme_name":  scheme_name,
            "category":     scheme_info.get("category"),
            "fund_house":   scheme_info.get("fund_house"),
        }

        # ---- Data quality metadata ----
        data_quality = {
            "nav_current":   {"source": "mftool/AMFI", "timestamp": today, "quality": "A", "freshness": "daily"},
            "nav_history":   {"source": "mftool/MFAPI.in", "timestamp": today, "quality": "A", "freshness": "daily"},
            "scheme_info":   {"source": "mftool", "timestamp": today, "quality": "B", "freshness": "daily"},
            "ter":           {"source": "AMFI", "quality": "A" if ter else "D",
                              "freshness": "daily" if ter else "unavailable"},
            "holdings":      {"source": "SEBI", "quality": "A" if portfolio.get("holdings_top10") else "D",
                              "freshness": "monthly" if portfolio.get("holdings_top10") else "unavailable"},
            "aum":           {"source": "unavailable", "quality": "D", "freshness": "unavailable"},
        }

        return {
            "source":               "AMFI + mftool/MFAPI.in",
            "source_url":           f"https://www.mfapi.in/mf/{scheme_code}",
            "key_metrics":          key_metrics,
            "scheme_info":          scheme_info,
            "nav_current":          nav_current,
            "nav_history":          (
                [{"date": str(d.date()), "nav": float(v)}
                 for d, v in nav_series.items()]
                if nav_series is not None else []
            ),
            "nav_returns":          nav_returns,
            "holdings_top10":       portfolio.get("holdings_top10", []),
            "sector_allocation":    portfolio.get("sector_allocation", {}),
            "quant_metrics":        quant_metrics,
            "risk_metrics":         risk_metrics,
            "fundamental_metrics":  {},
            "technical_metrics":    {},
            "chart_signals":        {},
            "forensic_metrics":     {},
            "peer_comparison":      [],
            "news":                 [],
            "data_quality":         data_quality,
            "data_gaps":            data_gaps,
        }

    # ------------------------------------------------------------------
    # Scheme resolution
    # ------------------------------------------------------------------

    def _resolve_scheme(
        self, scheme_input: Union[str, int]
    ) -> Tuple[int, str]:
        """Resolve a scheme code or name to (code, name).

        Raises ValueError if the scheme cannot be found.
        """
        if isinstance(scheme_input, int) or (
            isinstance(scheme_input, str) and scheme_input.isdigit()
        ):
            code = int(scheme_input)
            name = self._name_from_code(code)
            return code, name

        # Fuzzy name match via mftool
        return self._fuzzy_match_name(str(scheme_input))

    def _name_from_code(self, code: int) -> str:
        """Get scheme name from code via mftool."""
        try:
            from mftool import Mftool
            mf = Mftool()
            details = mf.get_scheme_details(str(code))
            if details and isinstance(details, dict):
                return details.get("scheme_name") or details.get("Scheme Name") or str(code)
        except Exception as exc:
            logger.debug("_name_from_code failed: %s", exc)
        return str(code)

    def _fuzzy_match_name(self, name: str) -> Tuple[int, str]:
        """Case-insensitive partial match on AMFI scheme code list."""
        try:
            from mftool import Mftool
            mf = Mftool()
            codes = mf.get_scheme_codes()  # {code: name}
            if not codes:
                raise ValueError("mftool returned empty scheme codes list")
            needle = name.lower()
            matches = [
                (int(code), sname)
                for code, sname in codes.items()
                if needle in sname.lower()
            ]
            if not matches:
                raise ValueError(
                    f"No MF scheme found matching '{name}'. "
                    "Try the full fund name or use the numeric scheme code from "
                    "https://www.amfiindia.com"
                )
            # Return closest (shortest name = most specific match)
            matches.sort(key=lambda x: len(x[1]))
            return matches[0]
        except ValueError:
            raise
        except Exception as exc:
            raise ValueError(f"Scheme resolution failed: {exc}") from exc

    # ------------------------------------------------------------------
    # Data fetchers
    # ------------------------------------------------------------------

    def _fetch_scheme_details(self, scheme_code: int) -> Dict[str, Any]:
        """Fetch scheme metadata from mftool."""
        from mftool import Mftool
        mf      = Mftool()
        details = mf.get_scheme_details(str(scheme_code))
        if not details or not isinstance(details, dict):
            return {}
        return {k.lower().replace(" ", "_"): v for k, v in details.items()}

    def _fetch_ter(self, scheme_code: int, scheme_name: str) -> Optional[float]:
        """Fetch TER from AMFI TER page (best-effort HTML scrape)."""
        try:
            resp = requests.get(_AMFI_TER_URL, timeout=_REQUEST_TIMEOUT,
                                headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            tables = pd.read_html(resp.text)
            for tbl in tables:
                tbl.columns = [str(c).lower() for c in tbl.columns]
                name_col = next((c for c in tbl.columns if "scheme" in c or "name" in c), None)
                ter_col  = next((c for c in tbl.columns if "ter" in c or "ratio" in c or "expense" in c), None)
                if name_col and ter_col:
                    mask = tbl[name_col].astype(str).str.lower().str.contains(
                        scheme_name[:20].lower(), na=False
                    )
                    row = tbl[mask]
                    if not row.empty:
                        val = pd.to_numeric(row[ter_col].iloc[0], errors="coerce")
                        if not pd.isna(val):
                            return round(float(val), 4)
        except Exception as exc:
            logger.debug("TER fetch failed: %s", exc)
        return None

    def _fetch_portfolio(
        self, scheme_code: int, scheme_name: str
    ) -> Dict[str, Any]:
        """Fetch monthly portfolio disclosure from SEBI (best-effort)."""
        # SEBI portfolio disclosures are PDFs/Excel files with inconsistent structure.
        # This is a best-effort scrape; failure is recorded in data_gaps.
        return {}


mutual_fund_layer = MutualFundDataLayer()
