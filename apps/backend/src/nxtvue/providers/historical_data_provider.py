"""HistoricalDataProvider — canonical data acquisition for prices, NAV, yields, benchmarks.

All methods return a pd.Series with a DatetimeIndex.
NaN entries represent genuine missing values (holidays, data gaps).
On failure each method returns a DataFetchResult with success=False rather than raising.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import yfinance as yf
from tenacity import retry, stop_after_attempt, wait_exponential

from ..schemas.asset_schema import DataFetchResult
from ..config.settings import settings

logger = logging.getLogger(__name__)

_EMPTY = pd.Series(dtype=float)


def _period_to_start(period: str) -> str:
    """Convert period string like '3y', '1y', '5y', '10y' to a start-date string."""
    now = datetime.utcnow()
    mapping = {
        "1m": 30, "3m": 90, "6m": 180,
        "1y": 365, "2y": 730, "3y": 1095,
        "5y": 1825, "7y": 2555, "10y": 3650,
        "max": 7300,
    }
    days = mapping.get(period.lower(), 1095)
    return (now - timedelta(days=days)).strftime("%Y-%m-%d")


class HistoricalDataProvider:
    """Centralised history fetcher — one place for all price/NAV/yield history."""

    # ------------------------------------------------------------------
    # Equity / ETF price history
    # ------------------------------------------------------------------

    def get_price_history(
        self,
        asset: str,
        market: str = "india",
        period: str = "3y",
    ) -> DataFetchResult:
        """Return daily adjusted close price history as a pd.Series.

        Adds .NS suffix for Indian assets if not already present.
        """
        ticker = self._resolve_ticker(asset, market)
        try:
            raw = self._fetch_yf_close(ticker, period)
            if raw.empty:
                return DataFetchResult(
                    success=False, source="yfinance",
                    error=f"Empty price history for {ticker}",
                )
            return DataFetchResult(success=True, data=raw, source="yfinance")
        except Exception as exc:
            return DataFetchResult(
                success=False, source="yfinance",
                error=str(exc), retryable=True,
            )

    # ------------------------------------------------------------------
    # Benchmark history
    # ------------------------------------------------------------------

    def get_benchmark_history(
        self,
        benchmark,          # BenchmarkDef
        period: str = "3y",
    ) -> DataFetchResult:
        """Return benchmark price/index history.

        For benchmarks of type 'etf', fetches via yfinance.
        For benchmarks of type 'index', fetches via yfinance using the symbol.
        Returns DataFetchResult with success=False if symbol is not a real yfinance symbol.
        """
        if benchmark is None:
            return DataFetchResult(
                success=False, source="benchmark_resolver",
                error="No benchmark resolved for this asset.",
            )
        try:
            raw = self._fetch_yf_close(benchmark.symbol, period)
            if raw.empty:
                return DataFetchResult(
                    success=False, source="yfinance",
                    error=f"Empty benchmark history for {benchmark.symbol}",
                )
            return DataFetchResult(success=True, data=raw, source="yfinance",)
        except Exception as exc:
            return DataFetchResult(
                success=False, source="yfinance",
                error=str(exc), retryable=True,
            )

    # ------------------------------------------------------------------
    # Mutual fund NAV history (via mftool)
    # ------------------------------------------------------------------

    def get_nav_history(
        self,
        scheme_code: int,
        days: int = 365,
    ) -> DataFetchResult:
        """Return a date-indexed NAV pd.Series from mftool."""
        try:
            from mftool import Mftool
            mf = Mftool()
            raw = mf.get_historical_nav(str(scheme_code), as_Dataframe=True)
            if raw is None or (isinstance(raw, pd.DataFrame) and raw.empty):
                return DataFetchResult(
                    success=False, source="mftool",
                    error=f"No NAV history for scheme {scheme_code}",
                )
            # mftool returns a DataFrame with 'date' and 'nav' columns (or similar)
            if isinstance(raw, pd.DataFrame):
                # Normalise column names
                raw.columns = [c.lower().strip() for c in raw.columns]
                date_col = next((c for c in raw.columns if "date" in c), None)
                nav_col  = next((c for c in raw.columns if "nav" in c), None)
                if date_col and nav_col:
                    series = pd.to_numeric(raw[nav_col], errors="coerce")
                    series.index = pd.to_datetime(raw[date_col], dayfirst=True,
                                                  errors="coerce")
                    series = series.sort_index().dropna()
                    if days:
                        cutoff = pd.Timestamp.utcnow().tz_localize(None) - pd.Timedelta(days=days)
                        series = series[series.index >= cutoff]
                    return DataFetchResult(success=True, data=series, source="mftool")
            return DataFetchResult(
                success=False, source="mftool",
                error="Unexpected mftool response format",
            )
        except ImportError:
            return DataFetchResult(
                success=False, source="mftool",
                error="mftool not installed — run: pip install mftool",
            )
        except Exception as exc:
            return DataFetchResult(
                success=False, source="mftool",
                error=str(exc), retryable=True,
            )

    # ------------------------------------------------------------------
    # Yield history (FRED for US, RBI/FBIL for India)
    # ------------------------------------------------------------------

    def get_yield_history(
        self,
        series_id: str,
        market: str = "us",
        period: str = "5y",
    ) -> DataFetchResult:
        """Return a yield history pd.Series.

        For US: series_id is a FRED series ID (e.g. 'DGS10').
        For India: series_id is a label (e.g. 'india-10y') — fetches from FBIL/RBI.
        """
        if market == "us":
            return self._fetch_fred_series(series_id, period)
        return self._fetch_india_yield_series(series_id, period)

    # ------------------------------------------------------------------
    # Inflation history
    # ------------------------------------------------------------------

    def get_inflation_history(
        self,
        market: str = "us",
        period: str = "5y",
    ) -> DataFetchResult:
        """Return CPI inflation history for the given market."""
        if market == "us":
            return self._fetch_fred_series("CPIAUCSL", period)
        # India: RBI CPI — best-effort only
        return self._fetch_india_yield_series("india-cpi", period)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _resolve_ticker(asset: str, market: str) -> str:
        a = asset.upper().strip()
        if market == "india" and not a.endswith((".NS", ".BO")):
            return a + ".NS"
        return a

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8),
           reraise=True)
    def _fetch_yf_close(self, symbol: str, period: str) -> pd.Series:
        start = _period_to_start(period)
        end   = datetime.utcnow().strftime("%Y-%m-%d")
        df    = yf.download(symbol, start=start, end=end,
                            progress=False, auto_adjust=True)
        if df.empty:
            return _EMPTY
        close = df["Close"]
        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]
        close = close.dropna()
        close.index = pd.to_datetime(close.index)
        if hasattr(close.index, "tz") and close.index.tz is not None:
            close.index = close.index.tz_localize(None)
        return close

    def _fetch_fred_series(self, series_id: str, period: str) -> DataFetchResult:
        if not settings.fred_api_key:
            return DataFetchResult(
                success=False, source="FRED",
                error="FRED_API_KEY not set in .env — add it to enable US yield data.",
            )
        try:
            from fredapi import Fred
            fred  = Fred(api_key=settings.fred_api_key)
            start = _period_to_start(period)
            raw   = fred.get_series(series_id, observation_start=start)
            if raw is None or raw.empty:
                return DataFetchResult(
                    success=False, source="FRED",
                    error=f"Empty FRED series: {series_id}",
                )
            raw.index = pd.to_datetime(raw.index)
            if hasattr(raw.index, "tz") and raw.index.tz is not None:
                raw.index = raw.index.tz_localize(None)
            return DataFetchResult(success=True, data=raw.dropna(), source="FRED")
        except Exception as exc:
            return DataFetchResult(
                success=False, source="FRED",
                error=str(exc), retryable=True,
            )

    def _fetch_india_yield_series(
        self, series_id: str, period: str
    ) -> DataFetchResult:
        """Fetch India G-Sec yield history from FBIL.
        Returns a DataFetchResult — best-effort; records failure in error field.
        """
        try:
            import requests
            # FBIL publishes rates but has no programmatic history endpoint.
            # We fall back to yfinance proxy tickers for G-Sec yields if available.
            # For now return failure with an informative message — callers record data_gap.
            return DataFetchResult(
                success=False, source="FBIL",
                error=(
                    "India historical yield series not available via free API. "
                    "Current yields are fetched live from FBIL in the bond layer."
                ),
            )
        except Exception as exc:
            return DataFetchResult(
                success=False, source="FBIL",
                error=str(exc), retryable=False,
            )


historical_data_provider = HistoricalDataProvider()
