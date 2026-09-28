import yfinance as yf
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, List
from tenacity import retry, stop_after_attempt, wait_exponential
import logging

logger = logging.getLogger(__name__)


class YFinanceDataLayer:
    def __init__(self, timeout: int = 30):
        self.timeout = timeout

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def get_ticker_info(self, ticker: str) -> Dict[str, Any]:
        """Get comprehensive ticker info including ratios, metadata."""
        tk = yf.Ticker(ticker)
        info = tk.info
        return self._clean_dict(info)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def get_financials(self, ticker: str, quarterly: bool = False) -> pd.DataFrame:
        """Get income statement (annual or quarterly)."""
        tk = yf.Ticker(ticker)
        if quarterly:
            return tk.quarterly_financials
        return tk.financials

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def get_balance_sheet(self, ticker: str, quarterly: bool = False) -> pd.DataFrame:
        """Get balance sheet (annual or quarterly)."""
        tk = yf.Ticker(ticker)
        if quarterly:
            return tk.quarterly_balance_sheet
        return tk.balance_sheet

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def get_cash_flow(self, ticker: str, quarterly: bool = False) -> pd.DataFrame:
        """Get cash flow statement (annual or quarterly)."""
        tk = yf.Ticker(ticker)
        if quarterly:
            return tk.quarterly_cashflow
        return tk.cashflow

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def get_price_history(
        self, 
        ticker: str, 
        period: str = "1y", 
        interval: str = "1d"
    ) -> pd.DataFrame:
        """Get historical price data for technical analysis."""
        tk = yf.Ticker(ticker)
        return tk.history(period=period, interval=interval)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def get_earnings_dates(self, ticker: str) -> pd.DataFrame:
        """Get earnings calendar."""
        tk = yf.Ticker(ticker)
        return tk.earnings_dates

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def get_major_holders(self, ticker: str) -> pd.DataFrame:
        """Get institutional and major holders."""
        tk = yf.Ticker(ticker)
        return tk.major_holders

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def get_institutional_holders(self, ticker: str) -> pd.DataFrame:
        """Get institutional holders."""
        tk = yf.Ticker(ticker)
        return tk.institutional_holders

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def get_options_chain(self, ticker: str) -> List[str]:
        """Get available options expiration dates."""
        tk = yf.Ticker(ticker)
        return tk.options

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def get_recommendations(self, ticker: str) -> pd.DataFrame:
        """Get analyst recommendations."""
        tk = yf.Ticker(ticker)
        return tk.recommendations

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def get_news(self, ticker: str) -> List[Dict]:
        """Get recent news."""
        tk = yf.Ticker(ticker)
        return tk.news

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def get_earnings_transcripts(self, ticker: str) -> List[Dict]:
        """Get earnings call transcripts (limited availability in yfinance)."""
        tk = yf.Ticker(ticker)
        return getattr(tk, 'earnings_call_transcripts', [])

    def _clean_dict(self, d: Dict) -> Dict:
        """Clean dictionary by removing None values and converting non-serializable types."""
        cleaned = {}
        for k, v in d.items():
            if v is not None:
                if isinstance(v, (str, int, float, bool, list, dict)):
                    cleaned[k] = v
                else:
                    cleaned[k] = str(v)
        return cleaned

    def _df_to_dict(self, df: pd.DataFrame) -> Dict:
        """Convert DataFrame to JSON-serializable dict."""
        if df is None or df.empty:
            return {}
        return df.to_dict(orient="index")

    def _safe_get(self, df: pd.DataFrame, row: str, col_idx: int = 0) -> Optional[float]:
        """Safely get value from DataFrame."""
        try:
            if df is not None and not df.empty and row in df.index:
                val = df.loc[row].iloc[col_idx] if hasattr(df.loc[row], 'iloc') else df.loc[row]
                if pd.notna(val):
                    return float(val)
        except Exception:
            pass
        return None

    def compute_fundamental_metrics(self, ticker: str) -> Dict[str, Any]:
        """Compute key fundamental metrics for Equity Analyst."""
        info = self.get_ticker_info(ticker)
        financials_a = self.get_financials(ticker, quarterly=False)
        financials_q = self.get_financials(ticker, quarterly=True)
        balance_a = self.get_balance_sheet(ticker, quarterly=False)
        balance_q = self.get_balance_sheet(ticker, quarterly=True)
        cashflow_a = self.get_cash_flow(ticker, quarterly=False)
        cashflow_q = self.get_cash_flow(ticker, quarterly=True)

        metrics = {}

        # Revenue growth (YoY, QoQ)
        revenue_a = self._safe_get(financials_a, "Total Revenue")
        revenue_a_prev = self._safe_get(financials_a, "Total Revenue", 1) if financials_a is not None and financials_a.shape[1] > 1 else None
        if revenue_a and revenue_a_prev:
            metrics["revenue_yoy_growth"] = (revenue_a - revenue_a_prev) / revenue_a_prev

        revenue_q = self._safe_get(financials_q, "Total Revenue")
        revenue_q_prev = self._safe_get(financials_q, "Total Revenue", 1) if financials_q is not None and financials_q.shape[1] > 1 else None
        if revenue_q and revenue_q_prev:
            metrics["revenue_qoq_growth"] = (revenue_q - revenue_q_prev) / revenue_q_prev

        # Gross margin trend
        gross_profit_a = self._safe_get(financials_a, "Gross Profit")
        if revenue_a and gross_profit_a:
            metrics["gross_margin"] = gross_profit_a / revenue_a
        gross_profit_a_prev = self._safe_get(financials_a, "Gross Profit", 1)
        if revenue_a_prev and gross_profit_a_prev:
            metrics["gross_margin_prev"] = gross_profit_a_prev / revenue_a_prev

        # Operating margin trend
        op_income_a = self._safe_get(financials_a, "Operating Income")
        if revenue_a and op_income_a:
            metrics["operating_margin"] = op_income_a / revenue_a
        op_income_a_prev = self._safe_get(financials_a, "Operating Income", 1)
        if revenue_a_prev and op_income_a_prev:
            metrics["operating_margin_prev"] = op_income_a_prev / revenue_a_prev

        # Net margin
        net_income_a = self._safe_get(financials_a, "Net Income")
        if revenue_a and net_income_a:
            metrics["net_margin"] = net_income_a / revenue_a

        # FCF conversion
        fcf = self._safe_get(cashflow_a, "Free Cash Flow")
        if net_income_a and fcf and net_income_a != 0:
            metrics["fcf_conversion"] = fcf / net_income_a

        # Operating cash flow vs net income (accruals)
        ocf = self._safe_get(cashflow_a, "Operating Cash Flow")
        if net_income_a and ocf:
            metrics["ocf_to_net_income"] = ocf / net_income_a
            metrics["accruals"] = (net_income_a - ocf) / net_income_a if net_income_a != 0 else None

        # Capex intensity
        capex = self._safe_get(cashflow_a, "Capital Expenditure")
        if revenue_a and capex:
            metrics["capex_intensity"] = abs(capex) / revenue_a

        # Debt metrics
        total_debt = self._safe_get(balance_a, "Total Debt") or self._safe_get(balance_a, "Long Term Debt")
        total_equity = self._safe_get(balance_a, "Total Stockholder Equity")
        if total_debt and total_equity:
            metrics["debt_to_equity"] = total_debt / total_equity

        current_assets = self._safe_get(balance_a, "Total Current Assets")
        current_liabilities = self._safe_get(balance_a, "Total Current Liabilities")
        if current_assets and current_liabilities:
            metrics["current_ratio"] = current_assets / current_liabilities

        # Interest coverage
        interest_expense = self._safe_get(financials_a, "Interest Expense")
        ebit = self._safe_get(financials_a, "EBIT") or op_income_a
        if interest_expense and ebit and interest_expense != 0:
            metrics["interest_coverage"] = ebit / abs(interest_expense)

        # ROE / ROIC
        if net_income_a and total_equity:
            metrics["roe"] = net_income_a / total_equity

        invested_capital = total_equity
        if total_debt:
            invested_capital = (total_equity or 0) + total_debt
        if ebit and invested_capital:
            tax_rate = 0.21
            metrics["roic"] = ebit * (1 - tax_rate) / invested_capital

        # Shares outstanding trend
        shares_a = self._safe_get(balance_a, "Ordinary Shares Number")
        shares_a_prev = self._safe_get(balance_a, "Ordinary Shares Number", 1)
        if shares_a and shares_a_prev:
            metrics["share_count_change"] = (shares_a - shares_a_prev) / shares_a_prev

        # Add raw info metrics
        metrics.update({
            "market_cap": info.get("marketCap"),
            "enterprise_value": info.get("enterpriseValue"),
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "peg_ratio": info.get("pegRatio"),
            "price_to_book": info.get("priceToBook"),
            "ev_to_revenue": info.get("enterpriseToRevenue"),
            "ev_to_ebitda": info.get("enterpriseToEbitda"),
            "beta": info.get("beta"),
            "dividend_yield": info.get("dividendYield"),
            "payout_ratio": info.get("payoutRatio"),
            "short_percent_of_float": info.get("shortPercentOfFloat"),
            "short_ratio": info.get("shortRatio"),
            "shares_outstanding": info.get("sharesOutstanding"),
            "float_shares": info.get("floatShares"),
            "held_percent_insiders": info.get("heldPercentInsiders"),
            "held_percent_institutions": info.get("heldPercentInstitutions"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
        })

        # TTM EPS + TTM P/E from quarterly financials
        if financials_q is not None and not financials_q.empty:
            ttm_ni = None
            if "Net Income" in financials_q.index:
                quarterly_ni = []
                for i in range(min(4, financials_q.shape[1])):
                    v = self._safe_get(financials_q, "Net Income", i)
                    if v is not None:
                        quarterly_ni.append(v)
                if len(quarterly_ni) == 4:
                    ttm_ni = sum(quarterly_ni)
            if ttm_ni is not None:
                shares = info.get("sharesOutstanding")
                if shares and shares > 0:
                    ttm_eps = ttm_ni / shares
                    metrics["ttm_eps"] = round(ttm_eps, 4)
                    current_price = info.get("currentPrice") or info.get("regularMarketPrice")
                    if current_price and ttm_eps > 0:
                        metrics["ttm_pe"] = round(current_price / ttm_eps, 2)
                    metrics["ttm_net_income"] = round(ttm_ni, 0)

        return metrics

    def compute_pe_history(self, ticker: str) -> Dict[str, Any]:
        """Build a trailing P/E time-series from 5-year weekly price and annual EPS."""
        df_w = self.get_price_history(ticker, "5y", "1wk")
        financials_a = self.get_financials(ticker, quarterly=False)

        result: Dict[str, Any] = {}

        # Collect up to 5 years of annual EPS (net income / shares outstanding)
        info = self.get_ticker_info(ticker)
        shares = info.get("sharesOutstanding")

        eps_by_year: Dict[int, float] = {}
        if financials_a is not None and not financials_a.empty and shares:
            for col in financials_a.columns:
                ni = self._safe_get(financials_a, "Net Income",
                                    list(financials_a.columns).index(col))
                if ni is not None and shares:
                    year = col.year if hasattr(col, "year") else None
                    if year:
                        eps_by_year[year] = ni / shares

        result["annual_eps"] = {str(k): round(v, 4) for k, v in sorted(eps_by_year.items())}

        # Build weekly trailing P/E series using the most-recent prior fiscal-year EPS
        if df_w is not None and not df_w.empty and "Close" in df_w.columns and eps_by_year:
            df_w = df_w.sort_index()
            pe_series: Dict[str, Optional[float]] = {}
            for ts, row in df_w.iterrows():
                year = ts.year if hasattr(ts, "year") else None
                if year is None:
                    continue
                # Use prior fiscal year EPS (most recent year <= current year - 1)
                eps = eps_by_year.get(year - 1) or eps_by_year.get(year)
                close = row["Close"]
                if eps and eps > 0 and close and close > 0:
                    pe_series[str(ts.date())] = round(close / eps, 2)
                else:
                    pe_series[str(ts.date())] = None

            result["pe_series_weekly"] = pe_series

            # Summary stats
            valid = [v for v in pe_series.values() if v is not None]
            if valid:
                result["pe_5y_min"] = round(min(valid), 2)
                result["pe_5y_max"] = round(max(valid), 2)
                result["pe_5y_median"] = round(float(pd.Series(valid).median()), 2)
                result["pe_5y_mean"] = round(float(pd.Series(valid).mean()), 2)
                result["pe_current"] = valid[-1]

        return result

    def compute_technical_metrics(self, ticker: str) -> Dict[str, Any]:
        """Compute technical indicators for Red Team / Quant analysis."""
        df = self.get_price_history(ticker, "1y", "1d")
        df_w = self.get_price_history(ticker, "5y", "1wk")

        metrics = {}

        if df is not None and not df.empty and "Close" in df.columns:
            df = df.sort_index()
            close = df["Close"]
            volume = df.get("Volume", pd.Series(index=df.index))
            high = df.get("High", close)
            low = df.get("Low", close)

            returns = close.pct_change().dropna()

            # Returns
            metrics["return_1m"] = (close.iloc[-1] / close.iloc[-21] - 1) if len(close) >= 21 else None
            metrics["return_3m"] = (close.iloc[-1] / close.iloc[-63] - 1) if len(close) >= 63 else None
            metrics["return_6m"] = (close.iloc[-1] / close.iloc[-126] - 1) if len(close) >= 126 else None
            metrics["return_1y"] = (close.iloc[-1] / close.iloc[0] - 1) if len(close) > 0 else None

            # Volatility
            metrics["vol_1m_ann"] = float(returns.tail(21).std() * np.sqrt(252)) if len(returns) >= 21 else None
            metrics["vol_3m_ann"] = float(returns.tail(63).std() * np.sqrt(252)) if len(returns) >= 63 else None
            metrics["vol_1y_ann"] = float(returns.std() * np.sqrt(252)) if len(returns) > 0 else None

            # Max drawdown
            cum = (1 + returns).cumprod()
            roll_max = cum.expanding().max()
            dd = (cum - roll_max) / roll_max
            metrics["max_dd_1y"] = float(dd.min()) if len(dd) > 0 else None

            # Moving averages
            metrics["sma_20"] = float(close.rolling(20).mean().iloc[-1]) if len(close) >= 20 else None
            metrics["sma_50"] = float(close.rolling(50).mean().iloc[-1]) if len(close) >= 50 else None
            metrics["sma_200"] = float(close.rolling(200).mean().iloc[-1]) if len(close) >= 200 else None
            metrics["price_vs_sma20"] = (close.iloc[-1] / metrics["sma_20"] - 1) if metrics["sma_20"] else None
            metrics["price_vs_sma50"] = (close.iloc[-1] / metrics["sma_50"] - 1) if metrics["sma_50"] else None
            metrics["price_vs_sma200"] = (close.iloc[-1] / metrics["sma_200"] - 1) if metrics["sma_200"] else None

            # RSI (14)
            delta = close.diff()
            gain = delta.where(delta > 0, 0).rolling(14).mean()
            loss = -delta.where(delta < 0, 0).rolling(14).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            metrics["rsi_14"] = float(rsi.iloc[-1]) if len(rsi) > 0 and pd.notna(rsi.iloc[-1]) else None

            # Volume
            metrics["avg_volume_1m"] = float(volume.tail(21).mean()) if len(volume) >= 21 else None
            metrics["avg_volume_3m"] = float(volume.tail(63).mean()) if len(volume) >= 63 else None
            metrics["volume_trend"] = (volume.tail(5).mean() / volume.tail(20).mean() - 1) if len(volume) >= 20 else None

            # ATR (14)
            tr = pd.concat([
                high - low,
                (high - close.shift()).abs(),
                (low - close.shift()).abs()
            ], axis=1).max(axis=1)
            metrics["atr_14"] = float(tr.rolling(14).mean().iloc[-1]) if len(tr) >= 14 else None

            # 52-week range
            metrics["high_52w"] = float(close.max())
            metrics["low_52w"] = float(close.min())
            metrics["pct_from_high"] = (close.iloc[-1] / metrics["high_52w"] - 1)
            metrics["pct_from_low"] = (close.iloc[-1] / metrics["low_52w"] - 1)

        # Weekly data for longer-term
        if df_w is not None and not df_w.empty and "Close" in df_w.columns:
            close_w = df_w["Close"].sort_index()
            if len(close_w) >= 52:
                metrics["return_5y"] = float(close_w.iloc[-1] / close_w.iloc[0] - 1)
                returns_w = close_w.pct_change().dropna()
                metrics["vol_5y_ann"] = float(returns_w.std() * np.sqrt(52))

        return metrics

    def compute_chart_signals(self, ticker: str) -> Dict[str, Any]:
        """Detect chart patterns and compute momentum indicators for trader-level analysis."""
        df = self.get_price_history(ticker, "1y", "1d")
        signals: Dict[str, Any] = {"patterns": [], "indicators": {}, "summary": {}}

        if df is None or df.empty or "Close" not in df.columns:
            return signals

        df = df.sort_index()
        close = df["Close"].squeeze()
        high  = df["High"].squeeze()   if "High"   in df.columns else close
        low   = df["Low"].squeeze()    if "Low"    in df.columns else close
        vol   = df["Volume"].squeeze() if "Volume" in df.columns else pd.Series(0, index=df.index)

        price = float(close.iloc[-1])
        ind   = signals["indicators"]

        # ── MACD (12 / 26 / 9) ──────────────────────────────────────────────
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

        # ── Bollinger Bands (20, 2σ) ─────────────────────────────────────────
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

        # ── OBV (On-Balance Volume) ──────────────────────────────────────────
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

        # ── Golden / Death Cross (SMA50 vs SMA200) ───────────────────────────
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

        # ── Double Top / Double Bottom (last 60 days) ────────────────────────
        if len(high) >= 60:
            h60 = high.iloc[-60:]
            l60 = low.iloc[-60:]
            peaks = [
                (i, float(h60.iloc[i]))
                for i in range(2, len(h60) - 2)
                if float(h60.iloc[i]) == float(h60.iloc[i - 2 : i + 3].max())
            ]
            if len(peaks) >= 2:
                p1, p2 = peaks[-2], peaks[-1]
                if abs(p1[1] - p2[1]) / max(p1[1], 1e-9) < 0.03 and (p2[0] - p1[0]) >= 10:
                    signals["patterns"].append(
                        f"Double Top near {p1[1]:.2f} — potential bearish reversal"
                    )
            troughs = [
                (i, float(l60.iloc[i]))
                for i in range(2, len(l60) - 2)
                if float(l60.iloc[i]) == float(l60.iloc[i - 2 : i + 3].min())
            ]
            if len(troughs) >= 2:
                t1, t2 = troughs[-2], troughs[-1]
                if abs(t1[1] - t2[1]) / max(t1[1], 1e-9) < 0.03 and (t2[0] - t1[0]) >= 10:
                    signals["patterns"].append(
                        f"Double Bottom near {t1[1]:.2f} — potential bullish reversal"
                    )

        # ── Resistance Breakout / Support Breakdown ──────────────────────────
        if len(close) >= 21:
            resistance = float(close.iloc[-21:-1].max())
            support    = float(close.iloc[-21:-1].min())
            ind["resistance_20d"] = round(resistance, 2)
            ind["support_20d"]    = round(support,    2)
            if price > resistance * 1.01:
                signals["patterns"].append(
                    f"Breakout above 20-day resistance ({resistance:.2f}) — bullish momentum"
                )
            elif price < support * 0.99:
                signals["patterns"].append(
                    f"Breakdown below 20-day support ({support:.2f}) — bearish momentum"
                )

        # ── RSI (14) state ───────────────────────────────────────────────────
        delta_c = close.diff()
        gain_c  = delta_c.where(delta_c > 0, 0).rolling(14).mean()
        loss_c  = -delta_c.where(delta_c < 0, 0).rolling(14).mean()
        rsi_val = float((100 - (100 / (1 + gain_c / loss_c))).iloc[-1])
        ind["rsi_14"] = round(rsi_val, 1)
        if rsi_val >= 70:
            signals["patterns"].append(f"RSI overbought ({rsi_val:.1f}) — potential pullback")
        elif rsi_val <= 30:
            signals["patterns"].append(f"RSI oversold ({rsi_val:.1f}) — potential bounce / accumulation zone")

        # ── Trend summary ────────────────────────────────────────────────────
        above_50  = len(close) >= 50  and price > float(sma50.iloc[-1])
        above_200 = len(close) >= 200 and price > float(sma200.iloc[-1])
        signals["summary"] = {
            "current_price":  round(price, 2),
            "overall_trend":  (
                "uptrend"   if (above_50 and above_200) else
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

    def compute_forensic_metrics(self, ticker: str) -> Dict[str, Any]:
        """Compute forensic accounting red flags."""
        financials_a = self.get_financials(ticker, quarterly=False)
        financials_q = self.get_financials(ticker, quarterly=True)
        balance_a = self.get_balance_sheet(ticker, quarterly=False)
        balance_q = self.get_balance_sheet(ticker, quarterly=True)
        cashflow_a = self.get_cash_flow(ticker, quarterly=False)

        flags = {}

        # Revenue vs Receivables
        revenue_a = self._safe_get(financials_a, "Total Revenue")
        revenue_a_prev = self._safe_get(financials_a, "Total Revenue", 1)
        receivables = self._safe_get(balance_a, "Accounts Receivable")
        receivables_prev = self._safe_get(balance_a, "Accounts Receivable", 1)

        if revenue_a and revenue_a_prev and receivables and receivables_prev:
            rev_growth = (revenue_a - revenue_a_prev) / revenue_a_prev
            rec_growth = (receivables - receivables_prev) / receivables_prev
            flags["receivables_vs_revenue_growth"] = rec_growth - rev_growth
            if rec_growth > rev_growth * 1.5:
                flags["receivables_red_flag"] = "Receivables growing faster than revenue"

        # Net Income vs Operating Cash Flow (Sloan accrual anomaly)
        net_income = self._safe_get(financials_a, "Net Income")
        ocf = self._safe_get(cashflow_a, "Operating Cash Flow")
        total_assets = self._safe_get(balance_a, "Total Assets")

        if net_income and ocf and total_assets:
            accruals = (net_income - ocf) / total_assets
            flags["sloan_accrual_ratio"] = accruals
            if accruals > 0.1:
                flags["high_accruals_red_flag"] = f"High accruals ratio: {accruals:.2%}"

        # Cash flow vs Net Income trend (3yr)
        ni_3yr = []
        ocf_3yr = []
        for i in range(min(3, financials_a.shape[1] if financials_a is not None else 0)):
            ni = self._safe_get(financials_a, "Net Income", i)
            ocf_val = self._safe_get(cashflow_a, "Operating Cash Flow", i)
            if ni is not None:
                ni_3yr.append(ni)
            if ocf_val is not None:
                ocf_3yr.append(ocf_val)

        if len(ni_3yr) >= 2 and len(ocf_3yr) >= 2:
            ni_trend = np.polyfit(range(len(ni_3yr)), ni_3yr, 1)[0]
            ocf_trend = np.polyfit(range(len(ocf_3yr)), ocf_3yr, 1)[0]
            flags["ni_ocf_divergence"] = ni_trend - ocf_trend
            if ni_trend > 0 and ocf_trend < 0:
                flags["ni_ocf_divergence_red_flag"] = "Net income rising but OCF falling"

        # Inventory buildup
        inventory = self._safe_get(balance_a, "Inventory")
        inventory_prev = self._safe_get(balance_a, "Inventory", 1)
        cogs = self._safe_get(financials_a, "Cost Of Revenue")
        if inventory and inventory_prev and cogs:
            inv_turnover = cogs / inventory if inventory != 0 else None
            inv_turnover_prev = cogs / inventory_prev if inventory_prev != 0 else None
            flags["inventory_turnover"] = inv_turnover
            flags["inventory_turnover_prev"] = inv_turnover_prev
            if inv_turnover_prev and inv_turnover and inv_turnover < inv_turnover_prev * 0.8:
                flags["inventory_buildup_red_flag"] = "Inventory turnover declining significantly"

        # Capex vs Depreciation (maintenance vs growth)
        capex = self._safe_get(cashflow_a, "Capital Expenditure")
        depreciation = self._safe_get(cashflow_a, "Depreciation And Amortization") or self._safe_get(financials_a, "Depreciation And Amortization")
        if capex and depreciation and depreciation != 0:
            flags["capex_to_depreciation"] = abs(capex) / depreciation
            if abs(capex) < depreciation * 0.5:
                flags["underinvesting_red_flag"] = "Capex well below depreciation"

        # Goodwill / Intangibles ratio
        goodwill = self._safe_get(balance_a, "Goodwill")
        intangibles = self._safe_get(balance_a, "Intangible Assets")
        total_assets = self._safe_get(balance_a, "Total Assets")
        if goodwill and total_assets:
            flags["goodwill_to_assets"] = goodwill / total_assets
            if goodwill / total_assets > 0.3:
                flags["high_goodwill_red_flag"] = "Goodwill > 30% of assets"

        # Free cash flow consistency
        fcf_vals = []
        for i in range(min(5, cashflow_a.shape[1] if cashflow_a is not None else 0)):
            fcf = self._safe_get(cashflow_a, "Free Cash Flow", i)
            if fcf is not None:
                fcf_vals.append(fcf)
        if len(fcf_vals) >= 3:
            fcf_negative_years = sum(1 for v in fcf_vals if v < 0)
            flags["fcf_negative_years"] = fcf_negative_years
            if fcf_negative_years >= 2:
                flags["inconsistent_fcf_red_flag"] = f"Negative FCF in {fcf_negative_years} of last 5 years"

        # Stock-based compensation
        sbc = self._safe_get(cashflow_a, "Stock Based Compensation")
        if sbc and net_income and net_income != 0:
            flags["sbc_to_net_income"] = sbc / net_income
            if sbc > net_income:
                flags["excessive_sbc_red_flag"] = "Stock-based comp exceeds net income"

        # Deferred revenue trend (good for SaaS)
        deferred_rev = self._safe_get(balance_a, "Deferred Revenue")
        deferred_rev_prev = self._safe_get(balance_a, "Deferred Revenue", 1)
        if deferred_rev and deferred_rev_prev:
            flags["deferred_revenue_growth"] = (deferred_rev - deferred_rev_prev) / deferred_rev_prev

        return flags

    def compute_macro_sector_data(self, ticker: str) -> Dict[str, Any]:
        """Get sector/industry context for Macro Strategist."""
        info = self.get_ticker_info(ticker)
        sector = info.get("sector", "Technology")
        industry = info.get("industry", "")

        # Sector ETFs for comparison
        sector_etfs = {
            "Technology": "XLK",
            "Healthcare": "XLV",
            "Financial Services": "XLF",
            "Consumer Cyclical": "XLY",
            "Consumer Defensive": "XLP",
            "Energy": "XLE",
            "Industrials": "XLI",
            "Real Estate": "XLRE",
            "Utilities": "XLU",
            "Materials": "XLB",
            "Communication Services": "XLC",
        }

        sector_etf = sector_etfs.get(sector, "SPY")

        # Get sector ETF performance
        spy_df = self.get_price_history("SPY", "1y", "1d")
        sector_df = self.get_price_history(sector_etf, "1y", "1d")

        macro = {
            "sector": sector,
            "industry": industry,
            "sector_etf": sector_etf,
        }

        if sector_df is not None and not sector_df.empty and spy_df is not None and not spy_df.empty:
            sector_close = sector_df["Close"].sort_index()
            spy_close = spy_df["Close"].sort_index()

            # Sector vs SPY
            sector_ret = sector_close.iloc[-1] / sector_close.iloc[0] - 1
            spy_ret = spy_close.iloc[-1] / spy_close.iloc[0] - 1
            macro["sector_vs_spy"] = sector_ret - spy_ret
            macro["sector_return_1y"] = sector_ret
            macro["spy_return_1y"] = spy_ret

            # Sector breadth (how many stocks above SMA200)
            # Simplified: just sector momentum
            macro["sector_momentum"] = "positive" if sector_ret > spy_ret else "negative"

        return macro

    def compile_full_dataset(self, ticker: str) -> Dict[str, Any]:
        """Compile all data used by the report generator."""
        logger.info(f"Compiling full dataset for {ticker}")

        # Base data
        info = self.get_ticker_info(ticker)

        data = {
            "source": "yFinance",
            "source_url": f"https://finance.yahoo.com/quote/{ticker.upper()}/",
            "info": info,
            "financials_annual": self._df_to_dict(self.get_financials(ticker, quarterly=False)),
            "financials_quarterly": self._df_to_dict(self.get_financials(ticker, quarterly=True)),
            "balance_sheet_annual": self._df_to_dict(self.get_balance_sheet(ticker, quarterly=False)),
            "balance_sheet_quarterly": self._df_to_dict(self.get_balance_sheet(ticker, quarterly=True)),
            "cashflow_annual": self._df_to_dict(self.get_cash_flow(ticker, quarterly=False)),
            "cashflow_quarterly": self._df_to_dict(self.get_cash_flow(ticker, quarterly=True)),
            "price_history_1y": self._df_to_dict(self.get_price_history(ticker, "1y", "1d")),
            "price_history_5y": self._df_to_dict(self.get_price_history(ticker, "5y", "1wk")),
            "earnings_dates": self._df_to_dict(self.get_earnings_dates(ticker)),
            "major_holders": self._df_to_dict(self.get_major_holders(ticker)),
            "institutional_holders": self._df_to_dict(self.get_institutional_holders(ticker)),
            "options_expirations": self.get_options_chain(ticker),
            "recommendations": self._df_to_dict(self.get_recommendations(ticker)),
            "news": self.get_news(ticker),
            "earnings_transcripts": self.get_earnings_transcripts(ticker),
        }

        # Agent-specific computed metrics
        data["fundamental_metrics"] = self.compute_fundamental_metrics(ticker)
        data["technical_metrics"] = self.compute_technical_metrics(ticker)
        data["chart_signals"] = self.compute_chart_signals(ticker)
        data["forensic_metrics"] = self.compute_forensic_metrics(ticker)
        data["macro_sector"] = self.compute_macro_sector_data(ticker)
        data["pe_history"] = self.compute_pe_history(ticker)
        data["analyst_consensus"] = self.compute_analyst_consensus(ticker)

        # Key metrics for quick access
        key_metrics = {
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "peg_ratio": info.get("pegRatio"),
            "price_to_book": info.get("priceToBook"),
            "debt_to_equity": info.get("debtToEquity"),
            "current_ratio": info.get("currentRatio"),
            "return_on_equity": info.get("returnOnEquity"),
            "return_on_assets": info.get("returnOnAssets"),
            "profit_margins": info.get("profitMargins"),
            "operating_margins": info.get("operatingMargins"),
            "revenue_growth": info.get("revenueGrowth"),
            "earnings_growth": info.get("earningsGrowth"),
            "free_cashflow": info.get("freeCashflow"),
            "operating_cashflow": info.get("operatingCashflow"),
            "short_percent_of_float": info.get("shortPercentOfFloat"),
            "short_ratio": info.get("shortRatio"),
            "beta": info.get("beta"),
            "dividend_yield": info.get("dividendYield"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "full_time_employees": info.get("fullTimeEmployees"),
            "long_business_summary": info.get("longBusinessSummary"),
        }
        data["key_metrics"] = key_metrics

        return data

    def compute_analyst_consensus(self, ticker: str) -> Dict[str, Any]:
        """Summarise analyst recommendations into a clean consensus block."""
        rec_df = self.get_recommendations(ticker)
        info = self.get_ticker_info(ticker)
        result: Dict[str, Any] = {}

        # Current price targets from info
        result["target_high"] = info.get("targetHighPrice")
        result["target_low"] = info.get("targetLowPrice")
        result["target_mean"] = info.get("targetMeanPrice")
        result["target_median"] = info.get("targetMedianPrice")
        result["number_of_analysts"] = info.get("numberOfAnalystOpinions")
        result["recommendation_key"] = info.get("recommendationKey")  # e.g. "buy", "hold"
        result["recommendation_mean"] = info.get("recommendationMean")  # 1=Strong Buy … 5=Sell

        if rec_df is not None and not rec_df.empty:
            # Aggregate most-recent 3 months of ratings
            df = rec_df.copy()
            if hasattr(df.index, "tz_localize"):
                pass  # already datetime index
            cols = [c for c in ["strongBuy", "buy", "hold", "sell", "strongSell"] if c in df.columns]
            if cols:
                recent = df.iloc[:3]  # most recent periods first
                totals = recent[cols].sum().to_dict()
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


yfinance_layer = YFinanceDataLayer()