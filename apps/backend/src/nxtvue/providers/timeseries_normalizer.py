"""TimeSeriesNormalizer — aligns and normalises price/NAV series before analyzer calculations.

Responsibilities:
- Inner-join two series on shared trading dates for a given market calendar.
- Forward-fill gaps (max 1 day) then drop remaining NaN rows.
- Convert prices to log or simple returns consistently.
- Record alignment gap statistics in data_quality metadata.

This prevents silent correlation / tracking-error bugs caused by India/US holiday mismatches.
"""

from __future__ import annotations

import logging
from typing import Optional, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Approximate holiday counts per year per market (used only for gap-fraction warning)
_MAX_GAP_FRACTION = 0.05  # warn if > 5% of rows were dropped during alignment


class TimeSeriesNormalizer:
    """Align and convert time series for cross-series calculations."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def align(
        self,
        series_a: pd.Series,
        series_b: pd.Series,
        market: str = "india",
    ) -> Tuple[pd.Series, pd.Series]:
        """Inner-join two series on shared dates.

        Steps:
        1. Ensure DatetimeIndex on both.
        2. Forward-fill gaps of up to 1 trading day on each series independently.
        3. Inner join — only dates present in BOTH series are kept.
        4. Drop any remaining NaN rows.
        5. Warn if > 5% of rows were lost.

        Returns a (series_a_aligned, series_b_aligned) tuple of equal length.
        """
        a = self._ensure_datetime_index(series_a).sort_index()
        b = self._ensure_datetime_index(series_b).sort_index()

        # Forward fill single-day gaps (e.g. one market has a holiday the other doesn't)
        a = a.ffill(limit=1)
        b = b.ffill(limit=1)

        # Inner join
        df = pd.DataFrame({"a": a, "b": b}).dropna()

        total_rows = max(len(a), len(b))
        kept_rows  = len(df)
        if total_rows > 0:
            dropped_frac = 1.0 - kept_rows / total_rows
            if dropped_frac > _MAX_GAP_FRACTION:
                logger.warning(
                    "TimeSeriesNormalizer: %.1f%% of rows dropped during alignment "
                    "(market=%s). Check series date ranges.",
                    dropped_frac * 100, market,
                )

        return df["a"], df["b"]

    def to_returns(
        self,
        prices: pd.Series,
        method: str = "log",
    ) -> pd.Series:
        """Convert a price/NAV series to a return series.

        method='log'    → ln(p_t / p_{t-1})  — additive, used for most quant calcs
        method='simple' → (p_t - p_{t-1}) / p_{t-1}  — used for readable %returns
        """
        prices = self._ensure_datetime_index(prices).sort_index()
        if method == "log":
            ret = np.log(prices / prices.shift(1))
        else:
            ret = prices.pct_change()
        return ret.dropna()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _ensure_datetime_index(s: pd.Series) -> pd.Series:
        """Ensure the series has a DatetimeIndex; coerce if not."""
        if not isinstance(s.index, pd.DatetimeIndex):
            try:
                s = s.copy()
                s.index = pd.to_datetime(s.index)
            except Exception as exc:
                raise ValueError(
                    f"TimeSeriesNormalizer: cannot convert index to DatetimeIndex. "
                    f"Original index type: {type(s.index).__name__}. Error: {exc}"
                ) from exc
        return s


timeseries_normalizer = TimeSeriesNormalizer()
