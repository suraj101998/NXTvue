import yfinance as yf
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _safe_df(fn, *args, **kwargs) -> Optional[pd.DataFrame]:
    """Call fn(*args) and return None on any exception instead of raising."""
    try:
        result = fn(*args, **kwargs)
        if result is None:
            return None
        if isinstance(result, pd.DataFrame) and result.empty:
            return None
        return result
    except Exception as exc:
        logger.debug("yfinance call failed (%s): %s", fn.__name__ if hasattr(fn, '__name__') else str(fn), exc)
        return None


def _safe_call(fn, *args, **kwargs):
    """Call fn(*args) and return None on any exception instead of raising."""
    try:
        return fn(*args, **kwargs)
    except Exception as exc:
        logger.debug("yfinance call failed: %s", exc)
        return None


class YFinanceDataLayer:
    def __init__(self, timeout: int = 30):
        self.timeout = timeout

    # ── Raw fetchers (each used at most once per compile_full_dataset call) ──

    def _fetch_all(self, ticker: str) -> Dict[str, Any]:
        """
        Fetch every piece of raw yfinance data for *ticker* exactly once.
        Each sub-fetch is guarded so a single failure never aborts the others.
        Returns a dict of raw DataFrames / lists / dicts keyed by name.
        """
        tk = yf.Ticker(ticker)

        raw: Dict[str, Any] = {}

        raw["info"]              = _safe_call(lambda: tk.info) or {}
        raw["financials_a"]      = _safe_df(lambda: tk.financials)
        raw["financials_q"]      = _safe_df(lambda: tk.quarterly_financials)
        raw["balance_a"]         = _safe_df(lambda: tk.balance_sheet)
        raw["balance_q"]         = _safe_df(lambda: tk.quarterly_balance_sheet)
        raw["cashflow_a"]        = _safe_df(lambda: tk.cashflow)
        raw["cashflow_q"]        = _safe_df(lambda: tk.quarterly_cashflow)
        raw["history_1y"]        = _safe_df(lambda: tk.history(period="1y", interval="1d"))
        raw["history_5y"]        = _safe_df(lambda: tk.history(period="5y", interval="1wk"))
        raw["earnings_dates"]    = _safe_df(lambda: tk.earnings_dates)
        raw["major_holders"]     = _safe_df(lambda: tk.major_holders)
        raw["inst_holders"]      = _safe_df(lambda: tk.institutional_holders)
        raw["options"]           = _safe_call(lambda: tk.options) or []
        raw["recommendations"]   = _safe_df(lambda: tk.recommendations)
        raw["news"]              = _safe_call(lambda: tk.news) or []
        raw["transcripts"]       = _safe_call(lambda: getattr(tk, "earnings_call_transcripts", [])) or []

        # Sector ETF for macro comparison (fetched once here)
        sector = raw["info"].get("sector", "Technology")
        sector_etf = {
            "Technology": "XLK", "Healthcare": "XLV",
            "Financial Services": "XLF", "Consumer Cyclical": "XLY",
            "Consumer Defensive": "XLP", "Energy": "XLE",
            "Industrials": "XLI", "Real Estate": "XLRE",
            "Utilities": "XLU", "Materials": "XLB",
            "Communication Services": "XLC",
        }.get(sector, "SPY")
        raw["sector_etf_name"]  = sector_etf
        raw["spy_history"]      = _safe_df(lambda: yf.Ticker("SPY").history(period="1y", interval="1d"))
        raw["sector_history"]   = _safe_df(lambda: yf.Ticker(sector_etf).history(period="1y", interval="1d"))

        return raw

    # ── Static helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _clean_dict(d: Dict) -> Dict:
        cleaned = {}
        for k, v in d.items():
            if v is not None:
                if isinstance(v, (str, int, float, bool, list, dict)):
                    cleaned[k] = v
                else:
                    cleaned[k] = str(v)
        return cleaned

    @staticmethod
    def _df_to_dict(df: Optional[pd.DataFrame]) -> Dict:
        if df is None or df.empty:
            return {}
        try:
            return df.to_dict(orient="index")
        except Exception:
            return {}

    @staticmethod
    def _safe_get(df: Optional[pd.DataFrame], row: str, col_idx: int = 0) -> Optional[float]:
        try:
            if df is not None and not df.empty and row in df.index:
                val = df.loc[row].iloc[col_idx] if hasattr(df.loc[row], "iloc") else df.loc[row]
                if pd.notna(val):
                    return float(val)
        except Exception:
            pass
        return None

    # ── Compute methods — all accept pre-fetched *raw* dict ──────────────────

    def _compute_fundamental_metrics(self, raw: Dict) -> Dict[str, Any]:
        info        = raw["info"]
        financials_a = raw["financials_a"]
        financials_q = raw["financials_q"]
        balance_a   = raw["balance_a"]
        cashflow_a  = raw["cashflow_a"]

        metrics: Dict[str, Any] = {}

        revenue_a      = self._safe_get(financials_a, "Total Revenue")
        revenue_a_prev = self._safe_get(financials_a, "Total Revenue", 1) if financials_a is not None and financials_a.shape[1] > 1 else None
        if revenue_a and revenue_a_prev:
            metrics["revenue_yoy_growth"] = (revenue_a - revenue_a_prev) / revenue_a_prev

        financials_q_df = financials_q
        revenue_q      = self._safe_get(financials_q_df, "Total Revenue")
        revenue_q_prev = self._safe_get(financials_q_df, "Total Revenue", 1) if financials_q_df is not None and financials_q_df.shape[1] > 1 else None
        if revenue_q and revenue_q_prev:
            metrics["revenue_qoq_growth"] = (revenue_q - revenue_q_prev) / revenue_q_prev

        gross_profit_a = self._safe_get(financials_a, "Gross Profit")
        if revenue_a and gross_profit_a:
            metrics["gross_margin"] = gross_profit_a / revenue_a
        gross_profit_a_prev = self._safe_get(financials_a, "Gross Profit", 1)
        if revenue_a_prev and gross_profit_a_prev:
            metrics["gross_margin_prev"] = gross_profit_a_prev / revenue_a_prev

        op_income_a = self._safe_get(financials_a, "Operating Income")
        if revenue_a and op_income_a:
            metrics["operating_margin"] = op_income_a / revenue_a
        op_income_a_prev = self._safe_get(financials_a, "Operating Income", 1)
        if revenue_a_prev and op_income_a_prev:
            metrics["operating_margin_prev"] = op_income_a_prev / revenue_a_prev

        net_income_a = self._safe_get(financials_a, "Net Income")
        if revenue_a and net_income_a:
            metrics["net_margin"] = net_income_a / revenue_a

        fcf = self._safe_get(cashflow_a, "Free Cash Flow")
        if net_income_a and fcf and net_income_a != 0:
            metrics["fcf_conversion"] = fcf / net_income_a

        ocf = self._safe_get(cashflow_a, "Operating Cash Flow")
        if net_income_a and ocf:
            metrics["ocf_to_net_income"] = ocf / net_income_a
            metrics["accruals"] = (net_income_a - ocf) / net_income_a if net_income_a != 0 else None

        capex = self._safe_get(cashflow_a, "Capital Expenditure")
        if revenue_a and capex:
            metrics["capex_intensity"] = abs(capex) / revenue_a

        total_debt   = self._safe_get(balance_a, "Total Debt") or self._safe_get(balance_a, "Long Term Debt")
        total_equity = self._safe_get(balance_a, "Total Stockholder Equity")
        if total_debt and total_equity:
            metrics["debt_to_equity"] = total_debt / total_equity

        current_assets      = self._safe_get(balance_a, "Total Current Assets")
        current_liabilities = self._safe_get(balance_a, "Total Current Liabilities")
        if current_assets and current_liabilities:
            metrics["current_ratio"] = current_assets / current_liabilities

        interest_expense = self._safe_get(financials_a, "Interest Expense")
        ebit = self._safe_get(financials_a, "EBIT") or op_income_a
        if interest_expense and ebit and interest_expense != 0:
            metrics["interest_coverage"] = ebit / abs(interest_expense)

        if net_income_a and total_equity:
            metrics["roe"] = net_income_a / total_equity

        invested_capital = (total_equity or 0) + (total_debt or 0)
        if ebit and invested_capital:
            metrics["roic"] = ebit * (1 - 0.21) / invested_capital

        shares_a      = self._safe_get(balance_a, "Ordinary Shares Number")
        shares_a_prev = self._safe_get(balance_a, "Ordinary Shares Number", 1)
        if shares_a and shares_a_prev:
            metrics["share_count_change"] = (shares_a - shares_a_prev) / shares_a_prev

        metrics.update({
            "market_cap":                 info.get("marketCap"),
            "enterprise_value":           info.get("enterpriseValue"),
            "pe_ratio":                   info.get("trailingPE"),
            "forward_pe":                 info.get("forwardPE"),
            "peg_ratio":                  info.get("pegRatio"),
            "price_to_book":              info.get("priceToBook"),
            "ev_to_revenue":              info.get("enterpriseToRevenue"),
            "ev_to_ebitda":               info.get("enterpriseToEbitda"),
            "beta":                       info.get("beta"),
            "dividend_yield":             info.get("dividendYield"),
            "payout_ratio":               info.get("payoutRatio"),
            "short_percent_of_float":     info.get("shortPercentOfFloat"),
            "short_ratio":                info.get("shortRatio"),
            "shares_outstanding":         info.get("sharesOutstanding"),
            "float_shares":               info.get("floatShares"),
            "held_percent_insiders":      info.get("heldPercentInsiders"),
            "held_percent_institutions":  info.get("heldPercentInstitutions"),
            "sector":                     info.get("sector"),
            "industry":                   info.get("industry"),
        })

        if financials_q_df is not None and not financials_q_df.empty:
            if "Net Income" in financials_q_df.index:
                quarterly_ni = [
                    self._safe_get(financials_q_df, "Net Income", i)
                    for i in range(min(4, financials_q_df.shape[1]))
                ]
                quarterly_ni = [v for v in quarterly_ni if v is not None]
                if len(quarterly_ni) == 4:
                    ttm_ni = sum(quarterly_ni)
                    shares = info.get("sharesOutstanding")
                    if shares and shares > 0:
                        ttm_eps = ttm_ni / shares
                        metrics["ttm_eps"] = round(ttm_eps, 4)
                        current_price = info.get("currentPrice") or info.get("regularMarketPrice")
                        if current_price and ttm_eps > 0:
                            metrics["ttm_pe"] = round(current_price / ttm_eps, 2)
                        metrics["ttm_net_income"] = round(ttm_ni, 0)

        return metrics

    def _compute_pe_history(self, raw: Dict) -> Dict[str, Any]:
        df_w        = raw["history_5y"]
        financials_a = raw["financials_a"]
        info        = raw["info"]

        result: Dict[str, Any] = {}
        shares = info.get("sharesOutstanding")

        eps_by_year: Dict[int, float] = {}
        if financials_a is not None and not financials_a.empty and shares:
            for col in financials_a.columns:
                ni = self._safe_get(financials_a, "Net Income",
                                    list(financials_a.columns).index(col))
                if ni is not None:
                    year = col.year if hasattr(col, "year") else None
                    if year:
                        eps_by_year[year] = ni / shares

        result["annual_eps"] = {str(k): round(v, 4) for k, v in sorted(eps_by_year.items())}

        if df_w is not None and not df_w.empty and "Close" in df_w.columns and eps_by_year:
            df_w = df_w.sort_index()
            pe_series: Dict[str, Optional[float]] = {}
            for ts, row in df_w.iterrows():
                year = ts.year if hasattr(ts, "year") else None
                if year is None:
                    continue
                eps  = eps_by_year.get(year - 1) or eps_by_year.get(year)
                close = row["Close"]
                if eps and eps > 0 and close and close > 0:
                    pe_series[str(ts.date())] = round(close / eps, 2)
                else:
                    pe_series[str(ts.date())] = None

            result["pe_series_weekly"] = pe_series
            valid = [v for v in pe_series.values() if v is not None]
            if valid:
                result["pe_5y_min"]    = round(min(valid), 2)
                result["pe_5y_max"]    = round(max(valid), 2)
                result["pe_5y_median"] = round(float(pd.Series(valid).median()), 2)
                result["pe_5y_mean"]   = round(float(pd.Series(valid).mean()), 2)
                result["pe_current"]   = valid[-1]

        return result

    def _compute_technical_metrics(self, raw: Dict) -> Dict[str, Any]:
        df   = raw["history_1y"]
        df_w = raw["history_5y"]
        metrics: Dict[str, Any] = {}

        if df is not None and not df.empty and "Close" in df.columns:
            df     = df.sort_index()
            close  = df["Close"]
            volume = df.get("Volume", pd.Series(index=df.index))
            high   = df.get("High", close)
            low    = df.get("Low",  close)
            returns = close.pct_change().dropna()

            metrics["return_1m"] = (close.iloc[-1] / close.iloc[-21]  - 1) if len(close) >= 21  else None
            metrics["return_3m"] = (close.iloc[-1] / close.iloc[-63]  - 1) if len(close) >= 63  else None
            metrics["return_6m"] = (close.iloc[-1] / close.iloc[-126] - 1) if len(close) >= 126 else None
            metrics["return_1y"] = (close.iloc[-1] / close.iloc[0]    - 1) if len(close) >  0   else None

            metrics["vol_1m_ann"] = float(returns.tail(21).std() * np.sqrt(252)) if len(returns) >= 21 else None
            metrics["vol_3m_ann"] = float(returns.tail(63).std() * np.sqrt(252)) if len(returns) >= 63 else None
            metrics["vol_1y_ann"] = float(returns.std() * np.sqrt(252))           if len(returns) >  0 else None

            cum       = (1 + returns).cumprod()
            roll_max  = cum.expanding().max()
            dd        = (cum - roll_max) / roll_max
            metrics["max_dd_1y"] = float(dd.min()) if len(dd) > 0 else None

            metrics["sma_20"]  = float(close.rolling(20).mean().iloc[-1])  if len(close) >= 20  else None
            metrics["sma_50"]  = float(close.rolling(50).mean().iloc[-1])  if len(close) >= 50  else None
            metrics["sma_200"] = float(close.rolling(200).mean().iloc[-1]) if len(close) >= 200 else None
            metrics["price_vs_sma20"]  = (close.iloc[-1] / metrics["sma_20"]  - 1) if metrics["sma_20"]  else None
            metrics["price_vs_sma50"]  = (close.iloc[-1] / metrics["sma_50"]  - 1) if metrics["sma_50"]  else None
            metrics["price_vs_sma200"] = (close.iloc[-1] / metrics["sma_200"] - 1) if metrics["sma_200"] else None

            delta = close.diff()
            gain  = delta.where(delta > 0, 0).rolling(14).mean()
            loss  = -delta.where(delta < 0, 0).rolling(14).mean()
            rs    = gain / loss
            rsi   = 100 - (100 / (1 + rs))
            metrics["rsi_14"] = float(rsi.iloc[-1]) if len(rsi) > 0 and pd.notna(rsi.iloc[-1]) else None

            metrics["avg_volume_1m"] = float(volume.tail(21).mean()) if len(volume) >= 21 else None
            metrics["avg_volume_3m"] = float(volume.tail(63).mean()) if len(volume) >= 63 else None
            metrics["volume_trend"]  = (volume.tail(5).mean() / volume.tail(20).mean() - 1) if len(volume) >= 20 else None

            tr = pd.concat([
                high - low,
                (high - close.shift()).abs(),
                (low  - close.shift()).abs(),
            ], axis=1).max(axis=1)
            metrics["atr_14"] = float(tr.rolling(14).mean().iloc[-1]) if len(tr) >= 14 else None

            metrics["high_52w"]    = float(close.max())
            metrics["low_52w"]     = float(close.min())
            metrics["pct_from_high"] = (close.iloc[-1] / metrics["high_52w"] - 1)
            metrics["pct_from_low"]  = (close.iloc[-1] / metrics["low_52w"]  - 1)

        if df_w is not None and not df_w.empty and "Close" in df_w.columns:
            close_w = df_w["Close"].sort_index()
            if len(close_w) >= 52:
                metrics["return_5y"]   = float(close_w.iloc[-1] / close_w.iloc[0] - 1)
                returns_w = close_w.pct_change().dropna()
                metrics["vol_5y_ann"] = float(returns_w.std() * np.sqrt(52))

        return metrics

    def _compute_chart_signals(self, raw: Dict) -> Dict[str, Any]:
        df = raw["history_1y"]
        signals: Dict[str, Any] = {"patterns": [], "indicators": {}, "summary": {}}

        if df is None or df.empty or "Close" not in df.columns:
            return signals

        df    = df.sort_index()
        close = df["Close"].squeeze()
        high  = df["High"].squeeze()   if "High"   in df.columns else close
        low   = df["Low"].squeeze()    if "Low"    in df.columns else close
        vol   = df["Volume"].squeeze() if "Volume" in df.columns else pd.Series(0, index=df.index)

        price = float(close.iloc[-1])
        ind   = signals["indicators"]

        # MACD
        ema12       = close.ewm(span=12, adjust=False).mean()
        ema26       = close.ewm(span=26, adjust=False).mean()
        macd_line   = ema12 - ema26
        signal_line = macd_line.ewm(span=9, adjust=False).mean()
        histogram   = macd_line - signal_line
        ind["macd"]        = round(float(macd_line.iloc[-1]),   4)
        ind["macd_signal"] = round(float(signal_line.iloc[-1]), 4)
        ind["macd_hist"]   = round(float(histogram.iloc[-1]),   4)
        ind["macd_trend"]  = "bullish" if float(macd_line.iloc[-1]) > float(signal_line.iloc[-1]) else "bearish"
        if len(macd_line) >= 4:
            prev_diff = float(macd_line.iloc[-4]) - float(signal_line.iloc[-4])
            curr_diff = float(macd_line.iloc[-1]) - float(signal_line.iloc[-1])
            if prev_diff < 0 < curr_diff:
                signals["patterns"].append("MACD bullish crossover (last 3 days)")
            elif prev_diff > 0 > curr_diff:
                signals["patterns"].append("MACD bearish crossover (last 3 days)")

        # Bollinger Bands
        sma20    = close.rolling(20).mean()
        std20    = close.rolling(20).std()
        bb_upper = sma20 + 2 * std20
        bb_lower = sma20 - 2 * std20
        ind["bb_upper"]    = round(float(bb_upper.iloc[-1]), 2)
        ind["bb_mid"]      = round(float(sma20.iloc[-1]),    2)
        ind["bb_lower"]    = round(float(bb_lower.iloc[-1]), 2)
        bb_width = float((bb_upper.iloc[-1] - bb_lower.iloc[-1]) / max(float(sma20.iloc[-1]), 1e-9))
        ind["bb_width"]    = round(bb_width, 4)
        ind["bb_position"] = round(
            (price - float(bb_lower.iloc[-1])) /
            max(float(bb_upper.iloc[-1]) - float(bb_lower.iloc[-1]), 1e-9), 3,
        )
        if price >= float(bb_upper.iloc[-1]):
            signals["patterns"].append("Price at/above Bollinger upper band — overbought zone")
        elif price <= float(bb_lower.iloc[-1]):
            signals["patterns"].append("Price at/below Bollinger lower band — oversold / potential reversal")
        bb_width_avg = float(((bb_upper - bb_lower) / sma20).rolling(20).mean().iloc[-1])
        if pd.notna(bb_width_avg) and bb_width < bb_width_avg * 0.7:
            signals["patterns"].append("Bollinger squeeze — low volatility, breakout likely")

        # OBV
        obv       = (np.sign(close.diff()) * vol).fillna(0).cumsum()
        obv_sma20 = obv.rolling(20).mean()
        ind["obv_trend"] = "accumulation" if float(obv.iloc[-1]) > float(obv_sma20.iloc[-1]) else "distribution"
        if len(close) >= 21:
            price_up = float(close.iloc[-1]) > float(close.iloc[-21])
            obv_up   = float(obv.iloc[-1])   > float(obv.iloc[-21])
            if price_up and not obv_up:
                signals["patterns"].append("Bearish OBV divergence — price rising without volume confirmation")
            elif not price_up and obv_up:
                signals["patterns"].append("Bullish OBV divergence — price falling but volume accumulating")

        # Golden / Death Cross
        sma50  = close.rolling(50).mean()
        sma200 = close.rolling(200).mean()
        if len(close) >= 200:
            ind["sma_50"]  = round(float(sma50.iloc[-1]),  2)
            ind["sma_200"] = round(float(sma200.iloc[-1]), 2)
            ind["cross_state"] = (
                "golden_cross" if float(sma50.iloc[-1]) > float(sma200.iloc[-1]) else "death_cross"
            )
            prev_cross = float(sma50.iloc[-10]) - float(sma200.iloc[-10])
            curr_cross = float(sma50.iloc[-1])  - float(sma200.iloc[-1])
            if prev_cross < 0 < curr_cross:
                signals["patterns"].append("Golden Cross formed (SMA50 above SMA200) — strong bullish signal")
            elif prev_cross > 0 > curr_cross:
                signals["patterns"].append("Death Cross formed (SMA50 below SMA200) — strong bearish signal")

        # Double Top / Bottom
        if len(high) >= 60:
            h60 = high.iloc[-60:]
            l60 = low.iloc[-60:]
            peaks = [
                (i, float(h60.iloc[i]))
                for i in range(2, len(h60) - 2)
                if float(h60.iloc[i]) == float(h60.iloc[i - 2: i + 3].max())
            ]
            if len(peaks) >= 2:
                p1, p2 = peaks[-2], peaks[-1]
                if abs(p1[1] - p2[1]) / max(p1[1], 1e-9) < 0.03 and (p2[0] - p1[0]) >= 10:
                    signals["patterns"].append(f"Double Top near {p1[1]:.2f} — potential bearish reversal")
            troughs = [
                (i, float(l60.iloc[i]))
                for i in range(2, len(l60) - 2)
                if float(l60.iloc[i]) == float(l60.iloc[i - 2: i + 3].min())
            ]
            if len(troughs) >= 2:
                t1, t2 = troughs[-2], troughs[-1]
                if abs(t1[1] - t2[1]) / max(t1[1], 1e-9) < 0.03 and (t2[0] - t1[0]) >= 10:
                    signals["patterns"].append(f"Double Bottom near {t1[1]:.2f} — potential bullish reversal")

        # Breakout / Breakdown
        if len(close) >= 21:
            resistance = float(close.iloc[-21:-1].max())
            support    = float(close.iloc[-21:-1].min())
            ind["resistance_20d"] = round(resistance, 2)
            ind["support_20d"]    = round(support,    2)
            if price > resistance * 1.01:
                signals["patterns"].append(f"Breakout above 20-day resistance ({resistance:.2f}) — bullish momentum")
            elif price < support * 0.99:
                signals["patterns"].append(f"Breakdown below 20-day support ({support:.2f}) — bearish momentum")

        # RSI state
        delta_c = close.diff()
        gain_c  = delta_c.where(delta_c > 0, 0).rolling(14).mean()
        loss_c  = -delta_c.where(delta_c < 0, 0).rolling(14).mean()
        rsi_val = float((100 - (100 / (1 + gain_c / loss_c))).iloc[-1])
        ind["rsi_14"] = round(rsi_val, 1)
        if rsi_val >= 70:
            signals["patterns"].append(f"RSI overbought ({rsi_val:.1f}) — potential pullback")
        elif rsi_val <= 30:
            signals["patterns"].append(f"RSI oversold ({rsi_val:.1f}) — potential bounce / accumulation zone")

        # Summary
        above_50  = len(close) >= 50  and price > float(sma50.iloc[-1])
        above_200 = len(close) >= 200 and price > float(sma200.iloc[-1])
        signals["summary"] = {
            "current_price":  round(price, 2),
            "overall_trend":  (
                "uptrend"   if (above_50 and above_200)     else
                "downtrend" if (not above_50 and not above_200) else
                "mixed"
            ),
            "macd_bias":      ind.get("macd_trend"),
            "obv_bias":       ind.get("obv_trend"),
            "rsi_state":      (
                "overbought" if rsi_val >= 70 else
                "oversold"   if rsi_val <= 30 else
                "neutral"
            ),
            "cross_state":    ind.get("cross_state", "insufficient_data"),
            "patterns_found": len(signals["patterns"]),
        }

        return signals

    def _compute_forensic_metrics(self, raw: Dict) -> Dict[str, Any]:
        financials_a = raw["financials_a"]
        balance_a    = raw["balance_a"]
        cashflow_a   = raw["cashflow_a"]

        flags: Dict[str, Any] = {}

        revenue_a      = self._safe_get(financials_a, "Total Revenue")
        revenue_a_prev = self._safe_get(financials_a, "Total Revenue", 1)
        receivables    = self._safe_get(balance_a, "Accounts Receivable")
        receivables_prev = self._safe_get(balance_a, "Accounts Receivable", 1)
        if revenue_a and revenue_a_prev and receivables and receivables_prev:
            rev_growth = (revenue_a - revenue_a_prev) / revenue_a_prev
            rec_growth = (receivables - receivables_prev) / receivables_prev
            flags["receivables_vs_revenue_growth"] = rec_growth - rev_growth
            if rec_growth > rev_growth * 1.5:
                flags["receivables_red_flag"] = "Receivables growing faster than revenue"

        net_income   = self._safe_get(financials_a, "Net Income")
        ocf          = self._safe_get(cashflow_a,   "Operating Cash Flow")
        total_assets = self._safe_get(balance_a,    "Total Assets")
        if net_income and ocf and total_assets:
            accruals = (net_income - ocf) / total_assets
            flags["sloan_accrual_ratio"] = accruals
            if accruals > 0.1:
                flags["high_accruals_red_flag"] = f"High accruals ratio: {accruals:.2%}"

        ni_3yr, ocf_3yr = [], []
        n_cols_f = financials_a.shape[1] if financials_a is not None else 0
        n_cols_c = cashflow_a.shape[1]   if cashflow_a  is not None else 0
        for i in range(min(3, n_cols_f)):
            ni = self._safe_get(financials_a, "Net Income", i)
            if ni is not None:
                ni_3yr.append(ni)
        for i in range(min(3, n_cols_c)):
            ocf_val = self._safe_get(cashflow_a, "Operating Cash Flow", i)
            if ocf_val is not None:
                ocf_3yr.append(ocf_val)
        if len(ni_3yr) >= 2 and len(ocf_3yr) >= 2:
            ni_trend  = np.polyfit(range(len(ni_3yr)),  ni_3yr,  1)[0]
            ocf_trend = np.polyfit(range(len(ocf_3yr)), ocf_3yr, 1)[0]
            flags["ni_ocf_divergence"] = ni_trend - ocf_trend
            if ni_trend > 0 and ocf_trend < 0:
                flags["ni_ocf_divergence_red_flag"] = "Net income rising but OCF falling"

        inventory      = self._safe_get(balance_a, "Inventory")
        inventory_prev = self._safe_get(balance_a, "Inventory", 1)
        cogs           = self._safe_get(financials_a, "Cost Of Revenue")
        if inventory and inventory_prev and cogs:
            inv_t = cogs / inventory if inventory != 0 else None
            inv_t_prev = cogs / inventory_prev if inventory_prev != 0 else None
            flags["inventory_turnover"]      = inv_t
            flags["inventory_turnover_prev"] = inv_t_prev
            if inv_t_prev and inv_t and inv_t < inv_t_prev * 0.8:
                flags["inventory_buildup_red_flag"] = "Inventory turnover declining significantly"

        capex       = self._safe_get(cashflow_a, "Capital Expenditure")
        depreciation = (
            self._safe_get(cashflow_a,   "Depreciation And Amortization") or
            self._safe_get(financials_a, "Depreciation And Amortization")
        )
        if capex and depreciation and depreciation != 0:
            flags["capex_to_depreciation"] = abs(capex) / depreciation
            if abs(capex) < depreciation * 0.5:
                flags["underinvesting_red_flag"] = "Capex well below depreciation"

        goodwill    = self._safe_get(balance_a, "Goodwill")
        total_assets2 = self._safe_get(balance_a, "Total Assets")
        if goodwill and total_assets2:
            flags["goodwill_to_assets"] = goodwill / total_assets2
            if goodwill / total_assets2 > 0.3:
                flags["high_goodwill_red_flag"] = "Goodwill > 30% of assets"

        fcf_vals = []
        for i in range(min(5, n_cols_c)):
            fcf = self._safe_get(cashflow_a, "Free Cash Flow", i)
            if fcf is not None:
                fcf_vals.append(fcf)
        if len(fcf_vals) >= 3:
            neg = sum(1 for v in fcf_vals if v < 0)
            flags["fcf_negative_years"] = neg
            if neg >= 2:
                flags["inconsistent_fcf_red_flag"] = f"Negative FCF in {neg} of last 5 years"

        sbc = self._safe_get(cashflow_a, "Stock Based Compensation")
        if sbc and net_income and net_income != 0:
            flags["sbc_to_net_income"] = sbc / net_income
            if sbc > net_income:
                flags["excessive_sbc_red_flag"] = "Stock-based comp exceeds net income"

        deferred_rev      = self._safe_get(balance_a, "Deferred Revenue")
        deferred_rev_prev = self._safe_get(balance_a, "Deferred Revenue", 1)
        if deferred_rev and deferred_rev_prev:
            flags["deferred_revenue_growth"] = (deferred_rev - deferred_rev_prev) / deferred_rev_prev

        return flags

    def _compute_macro_sector(self, raw: Dict) -> Dict[str, Any]:
        info        = raw["info"]
        sector      = info.get("sector", "Technology")
        industry    = info.get("industry", "")
        sector_etf  = raw["sector_etf_name"]
        spy_df      = raw["spy_history"]
        sector_df   = raw["sector_history"]

        macro: Dict[str, Any] = {
            "sector":     sector,
            "industry":   industry,
            "sector_etf": sector_etf,
        }

        if sector_df is not None and not sector_df.empty and spy_df is not None and not spy_df.empty:
            sector_close = sector_df["Close"].sort_index()
            spy_close    = spy_df["Close"].sort_index()
            sector_ret   = sector_close.iloc[-1] / sector_close.iloc[0] - 1
            spy_ret      = spy_close.iloc[-1]    / spy_close.iloc[0]    - 1
            macro["sector_vs_spy"]      = sector_ret - spy_ret
            macro["sector_return_1y"]   = sector_ret
            macro["spy_return_1y"]      = spy_ret
            macro["sector_momentum"]    = "positive" if sector_ret > spy_ret else "negative"

        return macro

    def _compute_analyst_consensus(self, raw: Dict) -> Dict[str, Any]:
        rec_df = raw["recommendations"]
        info   = raw["info"]
        result: Dict[str, Any] = {
            "target_high":         info.get("targetHighPrice"),
            "target_low":          info.get("targetLowPrice"),
            "target_mean":         info.get("targetMeanPrice"),
            "target_median":       info.get("targetMedianPrice"),
            "number_of_analysts":  info.get("numberOfAnalystOpinions"),
            "recommendation_key":  info.get("recommendationKey"),
            "recommendation_mean": info.get("recommendationMean"),
        }

        if rec_df is not None and not rec_df.empty:
            cols = [c for c in ["strongBuy", "buy", "hold", "sell", "strongSell"] if c in rec_df.columns]
            if cols:
                recent  = rec_df.iloc[:3]
                totals  = recent[cols].sum().to_dict()
                result["ratings_last_3_periods"] = {k: int(v) for k, v in totals.items()}
                total_votes = sum(totals.values())
                if total_votes > 0:
                    bullish = totals.get("strongBuy", 0) + totals.get("buy", 0)
                    result["bullish_pct"] = round(bullish / total_votes * 100, 1)
                    result["bearish_pct"] = round(
                        (totals.get("sell", 0) + totals.get("strongSell", 0)) / total_votes * 100, 1
                    )
                    result["neutral_pct"] = round(totals.get("hold", 0) / total_votes * 100, 1)

        return result

    # ── Public entry point ────────────────────────────────────────────────────

    def compile_full_dataset(self, ticker: str) -> Dict[str, Any]:
        """
        Fetch all yfinance data for *ticker* in one pass (each endpoint called
        exactly once) then compute derived metrics from the cached results.
        Any single failing sub-call returns an empty result rather than
        aborting the whole fetch.
        """
        logger.info("Compiling full dataset for %s", ticker)

        raw = self._fetch_all(ticker)
        info = raw["info"]

        data: Dict[str, Any] = {
            "source":                    "yFinance",
            "source_url":                f"https://finance.yahoo.com/quote/{ticker.upper()}/",
            "info":                      info,
            "financials_annual":         self._df_to_dict(raw["financials_a"]),
            "financials_quarterly":      self._df_to_dict(raw["financials_q"]),
            "balance_sheet_annual":      self._df_to_dict(raw["balance_a"]),
            "balance_sheet_quarterly":   self._df_to_dict(raw["balance_q"]),
            "cashflow_annual":           self._df_to_dict(raw["cashflow_a"]),
            "cashflow_quarterly":        self._df_to_dict(raw["cashflow_q"]),
            "price_history_1y":          self._df_to_dict(raw["history_1y"]),
            "price_history_5y":          self._df_to_dict(raw["history_5y"]),
            "earnings_dates":            self._df_to_dict(raw["earnings_dates"]),
            "major_holders":             self._df_to_dict(raw["major_holders"]),
            "institutional_holders":     self._df_to_dict(raw["inst_holders"]),
            "options_expirations":       raw["options"],
            "recommendations":           self._df_to_dict(raw["recommendations"]),
            "news":                      raw["news"],
            "earnings_transcripts":      raw["transcripts"],
        }

        # Derived metrics — all use the already-fetched *raw* dict
        data["fundamental_metrics"] = self._compute_fundamental_metrics(raw)
        data["technical_metrics"]   = self._compute_technical_metrics(raw)
        data["chart_signals"]       = self._compute_chart_signals(raw)
        data["forensic_metrics"]    = self._compute_forensic_metrics(raw)
        data["macro_sector"]        = self._compute_macro_sector(raw)
        data["pe_history"]          = self._compute_pe_history(raw)
        data["analyst_consensus"]   = self._compute_analyst_consensus(raw)

        data["key_metrics"] = {
            "current_price":            info.get("currentPrice") or info.get("regularMarketPrice"),
            "market_cap":               info.get("marketCap"),
            "pe_ratio":                 info.get("trailingPE"),
            "ttm_pe":                   data["fundamental_metrics"].get("ttm_pe"),
            "forward_pe":               info.get("forwardPE"),
            "peg_ratio":                info.get("pegRatio"),
            "price_to_book":            info.get("priceToBook"),
            "debt_to_equity":           info.get("debtToEquity"),
            "current_ratio":            info.get("currentRatio"),
            "return_on_equity":         info.get("returnOnEquity"),
            "return_on_assets":         info.get("returnOnAssets"),
            "profit_margins":           info.get("profitMargins"),
            "operating_margins":        info.get("operatingMargins"),
            "revenue_growth":           info.get("revenueGrowth"),
            "earnings_growth":          info.get("earningsGrowth"),
            "free_cashflow":            info.get("freeCashflow"),
            "operating_cashflow":       info.get("operatingCashflow"),
            "short_percent_of_float":   info.get("shortPercentOfFloat"),
            "short_ratio":              info.get("shortRatio"),
            "beta":                     info.get("beta"),
            "dividend_yield":           info.get("dividendYield"),
            "sector":                   info.get("sector"),
            "industry":                 info.get("industry"),
            "full_time_employees":      info.get("fullTimeEmployees"),
            "long_business_summary":    info.get("longBusinessSummary"),
        }

        return data


    def search_tickers(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search for tickers matching the query using Yahoo Finance Search API & curated database.
        Returns a list of matching tickers with basic info (ticker, name, market, type, price, change_pct).
        """
        import requests

        q = query.strip()
        if not q:
            return []

        curated_db = [
            # Top Indian Equities & ETFs
            {"ticker": "RELIANCE", "name": "Reliance Industries Ltd", "market": "india", "type": "Equity", "price": 2980.50, "change_pct": 1.45},
            {"ticker": "TCS", "name": "Tata Consultancy Services Ltd", "market": "india", "type": "Equity", "price": 4150.20, "change_pct": 0.62},
            {"ticker": "HDFCBANK", "name": "HDFC Bank Limited", "market": "india", "type": "Equity", "price": 1685.40, "change_pct": -0.35},
            {"ticker": "ICICIBANK", "name": "ICICI Bank Limited", "market": "india", "type": "Equity", "price": 1145.80, "change_pct": 1.15},
            {"ticker": "INFY", "name": "Infosys Limited", "market": "india", "type": "Equity", "price": 1780.00, "change_pct": 0.85},
            {"ticker": "BHARTIARTL", "name": "Bharti Airtel Ltd", "market": "india", "type": "Equity", "price": 1420.30, "change_pct": 2.10},
            {"ticker": "SBIN", "name": "State Bank of India", "market": "india", "type": "Equity", "price": 845.50, "change_pct": 0.40},
            {"ticker": "ITC", "name": "ITC Limited", "market": "india", "type": "Equity", "price": 435.60, "change_pct": -0.10},
            {"ticker": "LT", "name": "Larsen & Toubro Ltd", "market": "india", "type": "Equity", "price": 3620.00, "change_pct": 1.30},
            {"ticker": "BAJFINANCE", "name": "Bajaj Finance Ltd", "market": "india", "type": "Equity", "price": 7240.00, "change_pct": 1.80},
            {"ticker": "TATAMOTORS", "name": "Tata Motors Ltd", "market": "india", "type": "Equity", "price": 995.20, "change_pct": 2.40},
            {"ticker": "SUNPHARMA", "name": "Sun Pharmaceutical Industries", "market": "india", "type": "Equity", "price": 1640.00, "change_pct": 0.75},
            {"ticker": "MARUTI", "name": "Maruti Suzuki India Ltd", "market": "india", "type": "Equity", "price": 12850.00, "change_pct": -0.45},
            {"ticker": "TITAN", "name": "Titan Company Ltd", "market": "india", "type": "Equity", "price": 3480.00, "change_pct": 0.90},
            {"ticker": "WIPRO", "name": "Wipro Limited", "market": "india", "type": "Equity", "price": 540.20, "change_pct": 0.20},
            {"ticker": "NIFTYBEES", "name": "Nippon India ETF Nifty 50 BeES", "market": "india", "type": "ETF", "price": 272.50, "change_pct": 0.55},
            {"ticker": "GOLDBEES", "name": "Nippon India ETF Gold BeES", "market": "india", "type": "ETF", "price": 64.20, "change_pct": 0.30},
            {"ticker": "MON100", "name": "Motilal Oswal Nasdaq 100 ETF", "market": "india", "type": "ETF", "price": 145.80, "change_pct": 1.05},
            {"ticker": "HDFCSMALLCAP", "name": "HDFC Small Cap Mutual Fund", "market": "india", "type": "Mutual Fund", "price": 138.40, "change_pct": 1.10},
            {"ticker": "SBILARGEMID", "name": "SBI Large & Midcap Mutual Fund", "market": "india", "type": "Mutual Fund", "price": 492.10, "change_pct": 0.80},
            
            # Top US Equities & ETFs
            {"ticker": "AAPL", "name": "Apple Inc.", "market": "us", "type": "Equity", "price": 224.50, "change_pct": 1.25},
            {"ticker": "MSFT", "name": "Microsoft Corporation", "market": "us", "type": "Equity", "price": 448.20, "change_pct": 0.95},
            {"ticker": "NVDA", "name": "NVIDIA Corporation", "market": "us", "type": "Equity", "price": 128.80, "change_pct": 3.40},
            {"ticker": "GOOGL", "name": "Alphabet Inc. (Google)", "market": "us", "type": "Equity", "price": 182.40, "change_pct": 0.65},
            {"ticker": "AMZN", "name": "Amazon.com Inc.", "market": "us", "type": "Equity", "price": 186.50, "change_pct": 1.10},
            {"ticker": "META", "name": "Meta Platforms Inc.", "market": "us", "type": "Equity", "price": 505.60, "change_pct": 1.75},
            {"ticker": "TSLA", "name": "Tesla Inc.", "market": "us", "type": "Equity", "price": 248.30, "change_pct": 2.80},
            {"ticker": "AMD", "name": "Advanced Micro Devices", "market": "us", "type": "Equity", "price": 156.40, "change_pct": 1.90},
            {"ticker": "NFLX", "name": "Netflix Inc.", "market": "us", "type": "Equity", "price": 680.50, "change_pct": 0.40},
            {"ticker": "SPY", "name": "SPDR S&P 500 ETF Trust", "market": "us", "type": "ETF", "price": 558.20, "change_pct": 0.45},
            {"ticker": "QQQ", "name": "Invesco QQQ Trust (Nasdaq 100)", "market": "us", "type": "ETF", "price": 485.60, "change_pct": 0.85},
            {"ticker": "VOO", "name": "Vanguard S&P 500 ETF", "market": "us", "type": "ETF", "price": 512.40, "change_pct": 0.46},
        ]

        results: List[Dict[str, Any]] = []
        seen_tickers = set()

        # 1. Try Yahoo Finance Search API
        try:
            url = f"https://query2.finance.yahoo.com/v1/finance/search?q={requests.utils.quote(q)}&quotesCount={limit * 2}&newsCount=0"
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            resp = requests.get(url, headers=headers, timeout=4)
            if resp.status_code == 200:
                data = resp.json()
                quotes = data.get("quotes", [])
                for item in quotes:
                    raw_symbol = item.get("symbol", "")
                    if not raw_symbol or "^" in raw_symbol:
                        continue
                    
                    shortname = item.get("shortname") or item.get("longname") or raw_symbol
                    quote_type = item.get("quoteType", "EQUITY").upper()
                    exchange = (item.get("exchange") or "").upper()
                    
                    # Detect market
                    is_india = raw_symbol.endswith(".NS") or raw_symbol.endswith(".BO") or exchange in ["NSI", "BOM", "NSE", "BSE"]
                    market = "india" if is_india else "us"
                    clean_ticker = raw_symbol.replace(".NS", "").replace(".BO", "")
                    
                    if clean_ticker in seen_tickers:
                        continue
                    seen_tickers.add(clean_ticker)

                    type_label = "Equity"
                    if "ETF" in quote_type or "ETF" in shortname.upper():
                        type_label = "ETF"
                    elif "MUTUALFUND" in quote_type:
                        type_label = "Mutual Fund"
                    elif "INDEX" in quote_type:
                        type_label = "Index"

                    results.append({
                        "ticker": clean_ticker,
                        "name": shortname,
                        "market": market,
                        "type": type_label,
                        "price": None,
                        "change_pct": None,
                    })
                    if len(results) >= limit:
                        break
        except Exception as exc:
            logger.debug("Live yfinance search request failed: %s", exc)

        # 2. Add / match from curated database for instant high-quality results
        q_lower = q.lower()
        for item in curated_db:
            if item["ticker"] not in seen_tickers:
                if q_lower in item["ticker"].lower() or q_lower in item["name"].lower():
                    results.append(item)
                    seen_tickers.add(item["ticker"])
                    if len(results) >= limit:
                        break

        # 3. For any top results lacking prices, attempt quick fast_info lookup if list is short
        if results and any(r.get("price") is None for r in results[:5]):
            try:
                symbols_to_fetch = []
                for r in results[:5]:
                    if r.get("price") is None:
                        sym = f"{r['ticker']}.NS" if r['market'] == 'india' else r['ticker']
                        symbols_to_fetch.append((r, sym))
                
                if symbols_to_fetch:
                    tickers_str = " ".join([s[1] for s in symbols_to_fetch])
                    batch = yf.Tickers(tickers_str)
                    for r, sym in symbols_to_fetch:
                        try:
                            t = batch.tickers.get(sym)
                            if t and hasattr(t, "fast_info"):
                                price = float(getattr(t.fast_info, "last_price", 0) or 0)
                                prev = float(getattr(t.fast_info, "previous_close", price) or price)
                                if price > 0:
                                    r["price"] = round(price, 2)
                                    if prev > 0:
                                        r["change_pct"] = round(((price - prev) / prev) * 100, 2)
                        except Exception:
                            pass
            except Exception as exc:
                logger.debug("Quick price fetch during search failed: %s", exc)

        return results[:limit]


yfinance_layer = YFinanceDataLayer()
