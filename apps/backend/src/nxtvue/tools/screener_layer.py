"""Read publicly available Indian equity data from Screener.in."""

import logging
import re
from io import StringIO
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import requests

logger = logging.getLogger(__name__)

# ── NSE sector → benchmark index mapping (for sector context) ──────────────
_NSE_SECTOR_INDEX = {
    "nifty it":            "NIFTY IT",
    "nifty pharma":        "NIFTY PHARMA",
    "nifty bank":          "NIFTY BANK",
    "nifty auto":          "NIFTY AUTO",
    "nifty fmcg":          "NIFTY FMCG",
    "nifty metal":         "NIFTY METAL",
    "nifty realty":        "NIFTY REALTY",
    "nifty energy":        "NIFTY ENERGY",
    "nifty infra":         "NIFTY INFRA",
    "nifty media":         "NIFTY MEDIA",
    "nifty psu bank":      "NIFTY PSU BANK",
    "nifty financial":     "NIFTY FINANCIAL SERVICES",
    "nifty consumer":      "NIFTY INDIA CONSUMPTION",
    "nifty defence":       "NIFTY INDIA DEFENCE",
    "nifty healthcare":    "NIFTY HEALTHCARE",
    "nifty oil":           "NIFTY OIL & GAS",
    "nifty telecom":       "NIFTY INDIA DIGITAL",
}

# ── Screener field label → canonical name ──────────────────────────────────
_FIELD_MAP = {
    "market cap":          "market_cap",
    "current price":       "current_price",
    "high / low":          "high_low",          # parsed separately
    "stock p/e":           "pe_ratio",
    "book value":          "book_value",
    "face value":          "face_value",
    "intrinsic value":     "intrinsic_value",
    "debt to equity":      "debt_to_equity",
    "dividend yield":      "dividend_yield",
    "roce":                "roce",
    "roe":                 "roe",
    "eps in rs":           "eps",
    "sales growth (3yrs)": "sales_growth_3y",
    "profit growth (3yrs)":"profit_growth_3y",
    "sales growth (5yrs)": "sales_growth_5y",
    "profit growth (5yrs)":"profit_growth_5y",
}

# Pledge row label variants seen on Screener
_PLEDGE_LABELS = {"pledged percentage", "pledged %", "pledge %", "% of pledged shares"}


class ScreenerDataLayer:
    """Small, read-only Screener.in adapter for Indian listed companies."""

    def __init__(self, timeout: int = 30):
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        })

    # ── Public API ─────────────────────────────────────────────────────────

    def compile_full_dataset(self, ticker: str) -> Dict[str, Any]:
        symbol = ticker.upper().replace(".NS", "").replace(".BO", "")
        url    = f"https://www.screener.in/company/{symbol}/"

        response = self.session.get(url, timeout=self.timeout)
        response.raise_for_status()
        html = response.text

        tables      = self._safe_read_html(html)
        named_tables = self._name_tables(tables)
        metrics     = self._extract_metrics(html)

        # Validate — warn but never crash
        missing = _validate_metrics(metrics)
        if missing:
            logger.warning("%s: key metrics missing from Screener — %s", symbol, missing)
            metrics["_missing_fields"] = missing

        technical_metrics = self._build_technical_metrics(metrics, named_tables)
        forensic_metrics  = self._compute_forensic_metrics(named_tables)

        # Enrich: TTM EPS + TTM P/E from quarterly table
        ttm_data = _compute_ttm(named_tables, metrics)
        metrics.update(ttm_data)

        # Debt breakdown
        debt_breakdown = _compute_debt_breakdown(named_tables)

        # Clean peer comparison
        peer = _clean_peer_table(named_tables.get("peer_comparison", []))

        # Sector context
        sector_info = _resolve_sector(metrics, html)

        company_name = metrics.get("company_name", symbol)
        news = self._fetch_google_news(symbol, company_name) or self._extract_announcements(html)

        # India P/E history + chart signals via yfinance (.NS first, .BO fallback)
        pe_history: Dict[str, Any]    = {}
        chart_signals: Dict[str, Any] = {}
        try:
            from .yfinance_layer import yfinance_layer as _yf
            for suffix in (".NS", ".BO"):
                try:
                    yt = f"{symbol}{suffix}"
                    pe_history    = _yf.compute_pe_history(yt)
                    chart_signals = _yf.compute_chart_signals(yt)
                    if chart_signals.get("summary"):
                        break          # got valid data, stop trying
                except Exception:
                    continue
        except Exception:
            pass

        return {
            "source":               "Screener.in",
            "source_url":           url,
            "symbol":               symbol,
            "info":                 metrics,
            "key_metrics":          metrics,
            "screener_tables":      named_tables,
            "financials_annual":    named_tables.get("profit_loss", {}),
            "financials_quarterly": named_tables.get("quarterly_results", {}),
            "balance_sheet_annual": named_tables.get("balance_sheet", {}),
            "cashflow_annual":      named_tables.get("cash_flows", {}),
            "shareholding":         named_tables.get("shareholding", {}),
            "peer_comparison":      peer,
            "news":                 news,
            "fundamental_metrics":  metrics,
            "technical_metrics":    technical_metrics,
            "chart_signals":        chart_signals,
            "forensic_metrics":     forensic_metrics,
            "debt_breakdown":       debt_breakdown,
            "pe_history":           pe_history,
            "macro_sector":         sector_info,
        }

    # ── HTML parsing ────────────────────────────────────────────────────────

    @staticmethod
    def _safe_read_html(html: str) -> List[pd.DataFrame]:
        """Parse all tables; return empty list on failure."""
        try:
            return pd.read_html(StringIO(html))
        except Exception as exc:
            logger.warning("pd.read_html failed: %s", exc)
            return []

    @staticmethod
    def _name_tables(tables: List[pd.DataFrame]) -> Dict[str, Any]:
        """
        Identify each table by its row labels.
        Quarterly vs annual P&L detection uses date-column parsing, not column count.
        """
        result: Dict[str, Any] = {}
        for table in tables:
            if table.empty:
                continue
            labels = " ".join(
                str(v) for v in table.iloc[:, 0].head(5).tolist()
            ).lower()

            if "sales" in labels and "operating profit" in labels:
                # Date-based: quarterly columns look like "Jun 24", "Sep 24"
                col_names = " ".join(str(c) for c in table.columns[1:5])
                is_quarterly = bool(
                    re.search(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{2}\b",
                               col_names, re.IGNORECASE)
                )
                name = "quarterly_results" if is_quarterly else "profit_loss"
            elif "equity capital" in labels and "borrowings" in labels:
                name = "balance_sheet"
            elif "cash from operating" in labels:
                name = "cash_flows"
            elif "promoters" in labels and ("fiis" in labels or "dii" in labels):
                name = "shareholding"
            elif "compounded sales growth" in labels:
                name = "growth_summary"
            elif "cmp" in labels or ("p/e" in labels and "name" in labels):
                name = "peer_comparison"
            else:
                continue

            result[name] = table.where(pd.notna(table), None).to_dict(orient="records")
        return result

    @staticmethod
    def _extract_metrics(html: str) -> Dict[str, Any]:
        """
        Extract key-value pairs from Screener's #top-ratios / company-info sections.
        Uses structured label→value scanning on stripped text — more resilient than
        positional regex.
        """
        metrics: Dict[str, Any] = {}

        # ── Structured scan: find label, grab next numeric token ────────────
        # Strip tags but preserve spacing so labels stay readable
        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"\s+", " ", text).strip()

        for raw_label, canon_key in _FIELD_MAP.items():
            if canon_key == "high_low":
                continue  # handled separately below
            # Case-insensitive search for the label followed by a number
            pat = re.escape(raw_label) + r"\s*[:\s₹]*\s*([\d,]+(?:\.\d+)?)\s*(%|Cr|Rs|₹)?"
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                val = float(m.group(1).replace(",", ""))
                pct_keys = {"dividend_yield", "roce", "roe",
                            "sales_growth_3y", "profit_growth_3y",
                            "sales_growth_5y", "profit_growth_5y"}
                metrics[canon_key] = val / 100 if canon_key in pct_keys else val

        # ── 52-week High / Low ───────────────────────────────────────────────
        m52 = re.search(
            r"High\s*/\s*Low\s+₹?\s*([\d,]+(?:\.\d+)?)\s*/\s*₹?\s*([\d,]+(?:\.\d+)?)",
            text, re.IGNORECASE
        )
        if m52:
            metrics["high_52w"] = float(m52.group(1).replace(",", ""))
            metrics["low_52w"]  = float(m52.group(2).replace(",", ""))

        # ── market_cap: may be in thousands-of-crore (e.g. "1,23,456 Cr") ──
        if "market_cap" not in metrics:
            mc = re.search(r"Market Cap\s+₹\s*([\d,]+(?:\.\d+)?)\s*Cr", text, re.IGNORECASE)
            if mc:
                metrics["market_cap"] = float(mc.group(1).replace(",", ""))

        # ── current_price fallback ───────────────────────────────────────────
        if "current_price" not in metrics:
            cp = re.search(r"Current Price\s+₹\s*([\d,]+(?:\.\d+)?)", text, re.IGNORECASE)
            if cp:
                metrics["current_price"] = float(cp.group(1).replace(",", ""))

        # ── price_to_book derived ────────────────────────────────────────────
        if "current_price" in metrics and "book_value" in metrics and metrics["book_value"]:
            metrics["price_to_book"] = round(
                metrics["current_price"] / metrics["book_value"], 2
            )

        # ── Company name from <title> ────────────────────────────────────────
        title = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        if title:
            metrics["company_name"] = (
                re.sub(r"\s+", " ", title.group(1))
                .split(" share price")[0]
                .split(" Stock")[0]
                .strip()
            )

        return metrics

    # ── Technical summary ──────────────────────────────────────────────────

    @staticmethod
    def _build_technical_metrics(
        metrics: Dict[str, Any], named_tables: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Derive technical summary from scraped Screener metrics and growth table."""
        tech: Dict[str, Any] = {}

        current  = metrics.get("current_price")
        high_52w = metrics.get("high_52w")
        low_52w  = metrics.get("low_52w")

        if current and high_52w:
            tech["high_52w"]          = high_52w
            tech["pct_from_52w_high"] = round((current / high_52w - 1) * 100, 2)
        if current and low_52w:
            tech["low_52w"]          = low_52w
            tech["pct_from_52w_low"] = round((current / low_52w - 1) * 100, 2)
        if high_52w and low_52w and high_52w != low_52w and current:
            tech["52w_range_position"] = round(
                (current - low_52w) / (high_52w - low_52w) * 100, 1
            )

        growth = named_tables.get("growth_summary", [])
        for row in growth:
            label = str(row.get("Unnamed: 0", "")).strip()
            v3  = row.get("3 Years")  or row.get("3 years")
            v5  = row.get("5 Years")  or row.get("5 years")
            v10 = row.get("10 Years") or row.get("10 years")
            if "Sales" in label:
                tech["sales_cagr_3y"]  = v3
                tech["sales_cagr_5y"]  = v5
                tech["sales_cagr_10y"] = v10
            elif "Profit" in label:
                tech["profit_cagr_3y"]  = v3
                tech["profit_cagr_5y"]  = v5
                tech["profit_cagr_10y"] = v10
            elif "Stock Price" in label:
                tech["price_cagr_3y"]  = v3
                tech["price_cagr_5y"]  = v5
                tech["price_cagr_10y"] = v10

        return tech

    # ── Forensic metrics ───────────────────────────────────────────────────

    @staticmethod
    def _compute_forensic_metrics(named_tables: Dict[str, Any]) -> Dict[str, Any]:
        """Derive forensic red-flag signals from Screener P&L and balance-sheet tables."""
        flags: Dict[str, Any] = {}

        pl = named_tables.get("profit_loss", [])
        bs = named_tables.get("balance_sheet", [])
        cf = named_tables.get("cash_flows", [])

        def _row(table: list, label: str) -> Dict[str, Any]:
            for row in table:
                key = str(row.get("Unnamed: 0", "")).strip().lower()
                if label.lower() in key:
                    return row
            return {}

        def _last_two(row: Dict[str, Any]) -> Tuple[Optional[float], Optional[float]]:
            vals = []
            for k, v in row.items():
                if k == "Unnamed: 0" or v is None:
                    continue
                try:
                    vals.append(float(str(v).replace(",", "")))
                except (ValueError, TypeError):
                    pass
            return (vals[-1], vals[-2]) if len(vals) >= 2 else (None, None)

        # 1. Revenue vs Debtors growth
        s_curr, s_prev = _last_two(_row(pl, "sales"))
        d_curr, d_prev = _last_two(_row(bs, "debtor"))
        if s_curr and s_prev and s_prev != 0 and d_curr and d_prev and d_prev != 0:
            rev_g = (s_curr - s_prev) / abs(s_prev)
            rec_g = (d_curr - d_prev) / abs(d_prev)
            flags["revenue_growth_yoy"]     = round(rev_g, 4)
            flags["receivables_growth_yoy"] = round(rec_g, 4)
            if rec_g > rev_g * 1.5 and rec_g > 0.2:
                flags["receivables_red_flag"] = (
                    f"Receivables grew {rec_g:.1%} vs revenue {rev_g:.1%} — possible collection issues"
                )

        # 2. Profit vs OCF divergence
        p_curr, _ = _last_two(_row(pl, "net profit"))
        o_curr, _ = _last_two(_row(cf, "cash from operating"))
        if p_curr is not None and o_curr is not None:
            flags["net_profit_latest"]        = p_curr
            flags["operating_cashflow_latest"] = o_curr
            if p_curr > 0 and o_curr < p_curr * 0.5:
                flags["low_ocf_red_flag"] = (
                    f"Operating cash flow (₹{o_curr:.0f} Cr) < 50% of net profit (₹{p_curr:.0f} Cr)"
                )

        # 3. Borrowings surge
        b_curr, b_prev = _last_two(_row(bs, "borrowings"))
        if b_curr is not None and b_prev is not None and b_prev != 0:
            bc = (b_curr - b_prev) / abs(b_prev)
            flags["borrowings_change_yoy"] = round(bc, 4)
            if bc > 0.5 and b_curr > 0:
                flags["borrowings_surge_flag"] = (
                    f"Borrowings rose {bc:.1%} YoY — review if working capital or debt build-up"
                )

        # 4. Promoter pledge — check multiple label variants
        sh = named_tables.get("shareholding", [])
        for row in sh:
            key = str(row.get("Unnamed: 0", "")).strip().lower()
            if any(lbl in key for lbl in _PLEDGE_LABELS):
                p_val, _ = _last_two(row)
                if p_val is not None:
                    flags["promoter_pledged_pct"] = p_val
                    if p_val > 20:
                        flags["pledge_red_flag"] = (
                            f"Promoter pledging at {p_val:.1f}% — financial stress signal"
                        )
                break

        return flags

    # ── News ───────────────────────────────────────────────────────────────

    @staticmethod
    def _fetch_google_news(symbol: str, company_name: str = "") -> List[str]:
        """Fetch recent headlines from Google News RSS — deduplicated and cleaned."""
        import urllib.parse
        import urllib.request
        import xml.etree.ElementTree as ET

        query = f"{company_name or symbol} NSE India"
        url = (
            "https://news.google.com/rss/search?q="
            + urllib.parse.quote(query)
            + "&hl=en-IN&gl=IN&ceid=IN:en"
        )
        headlines: List[str] = []
        seen: set = set()
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "Mozilla/5.0 (Investment Research)"}
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                tree = ET.parse(resp)
            for item in tree.findall(".//item")[:20]:
                title_el = item.find("title")
                pub_el   = item.find("pubDate")
                if title_el is None or not title_el.text:
                    continue
                # Strip source suffix like " - Economic Times"
                raw = title_el.text.strip()
                clean = re.sub(r"\s+-\s+[\w\s]+$", "", raw).strip()
                if not clean or clean in seen:
                    continue
                # Skip clearly unrelated titles (no mention of company or symbol)
                needle = (company_name or symbol).split()[0].lower()
                if needle not in clean.lower() and symbol.lower() not in clean.lower():
                    continue
                seen.add(clean)
                date_str = pub_el.text[:16] if pub_el is not None and pub_el.text else ""
                headlines.append(f"[{date_str}] {clean}")
                if len(headlines) >= 10:
                    break
        except Exception:
            pass
        return headlines

    @staticmethod
    def _extract_announcements(html: str) -> List[str]:
        text = re.sub(r"<[^>]+>", " ", html)
        return [
            line.strip()
            for line in re.split(r"\s{2,}", text)
            if "Announcement" in line
        ][:20]


# ── Module-level helpers ───────────────────────────────────────────────────

def _validate_metrics(metrics: Dict[str, Any]) -> List[str]:
    """Return list of critical fields that are missing or None."""
    critical = ["market_cap", "current_price", "pe_ratio", "roce", "roe"]
    return [f for f in critical if not metrics.get(f)]


def _compute_ttm(
    named_tables: Dict[str, Any], metrics: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Compute TTM (Trailing Twelve Months) Net Profit and P/E from quarterly table.
    Sums last 4 quarters of Net Profit; divides current price by TTM EPS.
    """
    result: Dict[str, Any] = {}
    q_table = named_tables.get("quarterly_results", [])
    if not q_table:
        return result

    # Find the Net Profit row
    pat_row: Optional[Dict] = None
    for row in q_table:
        label = str(row.get("Unnamed: 0", "")).strip().lower()
        if "net profit" in label:
            pat_row = row
            break
    if pat_row is None:
        return result

    # Collect numeric values (skip label column, take last 4)
    vals = []
    for k, v in pat_row.items():
        if k == "Unnamed: 0" or v is None:
            continue
        try:
            vals.append(float(str(v).replace(",", "")))
        except (ValueError, TypeError):
            pass

    if len(vals) < 4:
        return result

    ttm_profit = sum(vals[-4:])
    result["ttm_net_profit_cr"] = round(ttm_profit, 2)

    # TTM EPS: need shares outstanding from key_metrics
    shares_cr = None  # try to get equity capital and face value
    for row in named_tables.get("balance_sheet", []):
        label = str(row.get("Unnamed: 0", "")).strip().lower()
        if "equity capital" in label:
            cap_vals = []
            for k, v in row.items():
                if k == "Unnamed: 0" or v is None:
                    continue
                try:
                    cap_vals.append(float(str(v).replace(",", "")))
                except (ValueError, TypeError):
                    pass
            if cap_vals:
                shares_cr = cap_vals[-1]  # in ₹ Cr
            break

    face_val = metrics.get("face_value", 10)
    if shares_cr and face_val:
        # shares_outstanding = equity_capital_cr * 1e7 / face_value
        shares_outstanding = (shares_cr * 1e7) / face_val
        if shares_outstanding > 0:
            ttm_eps = (ttm_profit * 1e7) / shares_outstanding  # in ₹
            result["ttm_eps"] = round(ttm_eps, 2)
            current_price = metrics.get("current_price")
            if current_price and ttm_eps > 0:
                result["ttm_pe"] = round(current_price / ttm_eps, 2)

    return result


def _compute_debt_breakdown(named_tables: Dict[str, Any]) -> Dict[str, Any]:
    """Extract short-term and long-term debt separately from balance sheet."""
    breakdown: Dict[str, Any] = {}
    bs = named_tables.get("balance_sheet", [])

    def _latest(table: list, label: str) -> Optional[float]:
        for row in table:
            if label.lower() in str(row.get("Unnamed: 0", "")).lower():
                vals = []
                for k, v in row.items():
                    if k == "Unnamed: 0" or v is None:
                        continue
                    try:
                        vals.append(float(str(v).replace(",", "")))
                    except (ValueError, TypeError):
                        pass
                return vals[-1] if vals else None
        return None

    breakdown["total_borrowings"]     = _latest(bs, "borrowings")
    breakdown["short_term_borrowings"] = _latest(bs, "short term borrowing")
    breakdown["long_term_borrowings"]  = (
        _latest(bs, "long term borrowing") or
        _latest(bs, "long-term borrowing")
    )
    breakdown["other_liabilities"]    = _latest(bs, "other liabilities")
    breakdown["trade_payables"]       = _latest(bs, "trade payable")

    # Implied long-term if not split explicitly
    if (breakdown["total_borrowings"] and
            breakdown["short_term_borrowings"] and
            breakdown["long_term_borrowings"] is None):
        breakdown["long_term_borrowings_implied"] = round(
            breakdown["total_borrowings"] - breakdown["short_term_borrowings"], 2
        )

    return {k: v for k, v in breakdown.items() if v is not None}


def _clean_peer_table(raw: List[Dict]) -> List[Dict]:
    """
    Rename generic Screener peer-table columns (like 'Unnamed: 0', 'CMP', 'P/E')
    to human-readable names Bob can use directly.
    """
    if not raw:
        return raw

    # Detect columns from the first row
    if not raw:
        return raw
    sample = raw[0]
    col_map: Dict[str, str] = {}
    for col in sample.keys():
        cl = str(col).strip().lower()
        if "unnamed" in cl or cl == "":
            col_map[col] = "Company"
        elif cl in {"cmp", "price", "ltp"}:
            col_map[col] = "CMP (₹)"
        elif cl in {"p/e", "pe", "p/e ratio"}:
            col_map[col] = "P/E"
        elif cl in {"mar cap", "market cap", "mcap"}:
            col_map[col] = "Market Cap (Cr)"
        elif cl in {"div yld %", "div yield", "dividend yield"}:
            col_map[col] = "Div Yield %"
        elif cl in {"np qtr", "net profit qtr", "profit qtr"}:
            col_map[col] = "Net Profit (Qtr Cr)"
        elif cl in {"qtr profit var %", "qtr profit growth"}:
            col_map[col] = "Profit Growth QoQ %"
        elif cl in {"sales qtr", "revenue qtr"}:
            col_map[col] = "Sales (Qtr Cr)"
        elif cl in {"qtr sales var %", "qtr sales growth"}:
            col_map[col] = "Sales Growth QoQ %"
        elif cl in {"roce %", "roce"}:
            col_map[col] = "ROCE %"
        else:
            col_map[col] = col  # keep as-is

    cleaned = []
    for row in raw:
        cleaned.append({col_map.get(k, k): v for k, v in row.items()})
    return cleaned


def _resolve_sector(metrics: Dict[str, Any], html: str) -> Dict[str, Any]:
    """
    Try to identify the NSE sector of the stock from the Screener page
    and map it to the closest NIFTY sector index.
    """
    sector_info: Dict[str, Any] = {
        "market": "India",
        "exchange": "NSE / BSE",
    }

    # Look for sector breadcrumb or industry tag in HTML
    m = re.search(
        r'(?:sector|industry)["\s:>]+([A-Za-z &/]+?)(?:<|,|"|\.|and)',
        html, re.IGNORECASE
    )
    if m:
        raw_sector = m.group(1).strip()
        sector_info["sector_raw"] = raw_sector
        # Try to match to NSE index
        rl = raw_sector.lower()
        for key, index_name in _NSE_SECTOR_INDEX.items():
            if key in rl or any(w in rl for w in key.split()):
                sector_info["nse_sector_index"] = index_name
                sector_info["sector_note"] = (
                    f"Benchmark this stock against {index_name} for relative performance"
                )
                break
        else:
            sector_info["sector_note"] = (
                f"Sector identified as '{raw_sector}'. "
                "Compare against NIFTY 500 or closest NIFTY sector index."
            )
    else:
        sector_info["sector_note"] = (
            "Sector could not be auto-detected. "
            "Check Screener.in page for sector classification."
        )

    return sector_info


screener_layer = ScreenerDataLayer()
