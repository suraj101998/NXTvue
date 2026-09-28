"""Load a holdings spreadsheet and compute portfolio-level analytics."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

# Expected column names (case-insensitive) in the holdings file
_COL_TICKER   = {"ticker", "symbol", "stock"}
_COL_QTY      = {"qty", "quantity", "shares", "units"}
_COL_AVG_COST = {"avg_cost", "avg cost", "average_cost", "average cost", "cost", "buy_price", "buy price"}
_COL_MARKET   = {"market", "exchange", "country"}


def _match_col(df: pd.DataFrame, candidates: set) -> Optional[str]:
    for col in df.columns:
        if col.strip().lower() in candidates:
            return col
    return None


def load_holdings(path: str) -> pd.DataFrame:
    """
    Load a holdings file (.xlsx or .csv).

    Required columns (any case/spelling):
      ticker   — stock symbol (e.g. NETWEB, AAPL)
      qty      — number of shares held
      avg_cost — average purchase price per share

    Optional column:
      market   — "india" or "us" (defaults to "india" if missing)

    Returns a DataFrame with normalised columns:
      ticker, qty, avg_cost, market
    """
    path = str(path)
    if path.endswith(".csv"):
        df = pd.read_csv(path)
    else:
        df = pd.read_excel(path)

    df.columns = [str(c).strip() for c in df.columns]

    col_ticker   = _match_col(df, _COL_TICKER)
    col_qty      = _match_col(df, _COL_QTY)
    col_avg_cost = _match_col(df, _COL_AVG_COST)
    col_market   = _match_col(df, _COL_MARKET)

    missing = [name for name, col in [("ticker", col_ticker), ("qty", col_qty), ("avg_cost", col_avg_cost)] if col is None]
    if missing:
        raise ValueError(
            f"Holdings file is missing required column(s): {missing}. "
            f"Found columns: {list(df.columns)}"
        )

    result = pd.DataFrame({
        "ticker":   df[col_ticker].astype(str).str.strip().str.upper(),
        "qty":      pd.to_numeric(df[col_qty],      errors="coerce").fillna(0),
        "avg_cost": pd.to_numeric(df[col_avg_cost], errors="coerce").fillna(0),
        "market":   df[col_market].astype(str).str.strip().str.lower() if col_market is not None
                    else pd.Series(["india"] * len(df)),
    })

    result = result[result["ticker"].notna() & (result["ticker"] != "") & (result["ticker"] != "NAN")]
    result = result.reset_index(drop=True)
    return result


def fetch_current_prices(holdings: pd.DataFrame) -> pd.DataFrame:
    """Fetch current prices for all tickers in one batched yfinance call."""
    import yfinance as yf

    # Build the mapping: original ticker → yfinance symbol
    sym_map = {
        row["ticker"]: (f"{row['ticker']}.NS" if row["market"] == "india" else row["ticker"])
        for _, row in holdings.iterrows()
    }

    # Batch download — one network call for all tickers
    yf_symbols = list(sym_map.values())
    price_map: dict = {}
    name_map: dict = {}
    try:
        if len(yf_symbols) == 1:
            # yf.download with a single ticker still works but returns a plain DataFrame
            df = yf.download(yf_symbols[0], period="2d", progress=False, auto_adjust=True)
            if not df.empty and "Close" in df.columns:
                close = df["Close"]
                if isinstance(close, pd.DataFrame):
                    close = close.iloc[:, 0]
                price_map[yf_symbols[0]] = float(close.iloc[-1])
        else:
            df = yf.download(yf_symbols, period="2d", progress=False, auto_adjust=True)
            if not df.empty and "Close" in df.columns:
                close = df["Close"]
                if isinstance(close, pd.DataFrame):
                    for sym in yf_symbols:
                        if sym in close.columns:
                            last = close[sym].dropna()
                            if not last.empty:
                                price_map[sym] = float(last.iloc[-1])
                else:
                    # single-ticker fallback inside multi-download
                    price_map[yf_symbols[0]] = float(close.dropna().iloc[-1])
    except Exception as exc:
        logger.warning("Batch price fetch failed: %s. Falling back to per-ticker.", exc)

    # Fetch company names individually only for tickers where batch didn't return price
    missing_tickers = [t for t, sym in sym_map.items() if sym not in price_map]
    for ticker in missing_tickers:
        sym = sym_map[ticker]
        try:
            info = yf.Ticker(sym).fast_info
            price_map[sym] = float(getattr(info, "last_price", None) or getattr(info, "previous_close", None) or 0) or None
        except Exception:
            price_map[sym] = None

    # Fetch company names in bulk via Tickers (single network session)
    try:
        tickers_obj = yf.Tickers(" ".join(yf_symbols))
        for sym in yf_symbols:
            try:
                info = tickers_obj.tickers[sym].info
                name_map[sym] = info.get("longName") or info.get("shortName") or sym
            except Exception:
                name_map[sym] = sym
    except Exception:
        pass

    rows = []
    for _, row in holdings.iterrows():
        ticker = row["ticker"]
        sym    = sym_map[ticker]
        rows.append({
            "ticker":       ticker,
            "current_price": price_map.get(sym),
            "company_name": name_map.get(sym, ticker),
        })

    prices_df = pd.DataFrame(rows)
    return holdings.merge(prices_df, on="ticker", how="left")


def compute_portfolio_metrics(holdings: pd.DataFrame) -> Dict[str, Any]:
    """
    Given a holdings DataFrame (with current_price populated), compute:
      - per-holding P&L, weight, gain %
      - portfolio totals
      - sector/market concentration
      - top gainers / losers
      - rebalancing signals
    """
    h = holdings.copy()

    h["invested"]       = h["qty"] * h["avg_cost"]
    h["current_value"]  = h["qty"] * h["current_price"].fillna(h["avg_cost"])
    h["unrealised_pnl"] = h["current_value"] - h["invested"]
    h["gain_pct"]       = (h["unrealised_pnl"] / h["invested"].replace(0, float("nan"))) * 100

    total_invested = float(h["invested"].sum())
    total_value    = float(h["current_value"].sum())
    total_pnl      = float(h["unrealised_pnl"].sum())
    total_gain_pct = (total_pnl / total_invested * 100) if total_invested else 0.0

    h["weight_pct"] = (h["current_value"] / total_value * 100).round(2) if total_value else 0.0

    holdings_list: List[Dict[str, Any]] = []
    for _, row in h.iterrows():
        holdings_list.append({
            "ticker":          row["ticker"],
            "company_name":    row.get("company_name", row["ticker"]),
            "market":          row["market"],
            "qty":             float(row["qty"]),
            "avg_cost":        float(row["avg_cost"]),
            "current_price":   float(row["current_price"]) if pd.notna(row["current_price"]) else None,
            "invested":        round(float(row["invested"]), 2),
            "current_value":   round(float(row["current_value"]), 2),
            "unrealised_pnl":  round(float(row["unrealised_pnl"]), 2),
            "gain_pct":        round(float(row["gain_pct"]), 2) if pd.notna(row["gain_pct"]) else None,
            "weight_pct":      float(row["weight_pct"]),
        })

    # Market concentration
    market_alloc = (
        h.groupby("market")["current_value"].sum() / total_value * 100
    ).round(2).to_dict() if total_value else {}

    # Top 3 gainers / losers by gain %
    sorted_h = h.dropna(subset=["gain_pct"]).sort_values("gain_pct", ascending=False)
    top_gainers = sorted_h.head(3)[["ticker", "gain_pct"]].to_dict(orient="records")
    top_losers  = sorted_h.tail(3)[["ticker", "gain_pct"]].to_dict(orient="records")

    # Concentration risk: any single holding > 25% of portfolio
    concentration_flags = [
        f"{row['ticker']} is {row['weight_pct']:.1f}% of portfolio — high concentration"
        for row in holdings_list
        if row["weight_pct"] > 25
    ]

    # Rebalancing suggestions (simple rule-based)
    rebalancing: List[str] = []
    for row in holdings_list:
        if row["weight_pct"] > 30:
            rebalancing.append(f"TRIM {row['ticker']} — weight {row['weight_pct']:.1f}% exceeds 30% threshold")
        elif row["gain_pct"] is not None and row["gain_pct"] < -20:
            rebalancing.append(f"REVIEW {row['ticker']} — down {row['gain_pct']:.1f}%, reassess thesis")

    return {
        "summary": {
            "total_invested":  round(total_invested, 2),
            "total_value":     round(total_value, 2),
            "total_pnl":       round(total_pnl, 2),
            "total_gain_pct":  round(total_gain_pct, 2),
            "num_holdings":    len(holdings_list),
        },
        "holdings":             holdings_list,
        "market_allocation":    market_alloc,
        "top_gainers":          top_gainers,
        "top_losers":           top_losers,
        "concentration_flags":  concentration_flags,
        "rebalancing_signals":  rebalancing,
    }
