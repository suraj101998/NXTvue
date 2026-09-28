"""Generate a source-grounded investment report through Bob Shell."""

import concurrent.futures
import json
import logging
import os
import shutil
import subprocess
from typing import Any, Dict, List, Optional

from .tools.screener_layer import screener_layer
from .tools.yfinance_layer import yfinance_layer
from .tools.etf_layer import etf_layer
from .tools.mutual_fund_layer import mutual_fund_layer
from .tools.bond_layer import bond_layer

logger = logging.getLogger(__name__)

REPORT_SYSTEM_PROMPT = """You are a senior financial analyst, senior risk manager, and senior investment manager.
Write the final answer directly for the user in plain text with simple headings and tables. Do not add a preamble, metadata block, workflow summary, separator banner, or XML.

The user wants a detailed report in exactly this order:
[Ticker company name]: [projection year] Investment View
My judgement: [direct judgement]. I would classify it as:

Business outlook: ...

Stock valuation: ...

Risk-adjusted view: ...

...low-risk conclusion...

Then write sections 1 through 12 and Final investment judgement:
1. Business quality and sector positioning
2. Financial performance
3. Balance-sheet analysis
4. Order book and revenue visibility
5. Shareholding pattern
6. Valuation
7. My end-[year] projection
8. Does the company still have potential to grow?
9. Key risks
10. What would make me more bullish?
11. What would make me bearish?
12. Technical trading signals
   Use the chart_signals data (patterns, indicators, summary). Write as an expert trader would:
   - State the overall trend (uptrend / downtrend / mixed) and what is driving it
   - List each detected pattern and what it implies for the next move
   - Summarise MACD bias, RSI state, OBV trend, Bollinger position, and SMA cross state
   - Give a specific near-term trader's view: likely direction, key support/resistance levels, and what to watch
   - If chart_signals data is unavailable or empty, state that technical data could not be retrieved and what the investor should check manually
Final investment judgement

Use the supplied data as the only factual source. Never invent order-book values, events, news, customers, guidance, financial figures, or price targets. If the source does not provide something, say that it is unavailable and explain what the investor should monitor. Clearly distinguish reported facts, assumptions, scenarios, and judgement.

For the projection, provide bear/base/bull cases with assumptions, earnings logic where available, valuation multiples, and implied price ranges. Make clear that these are scenarios, not promises. Separate business potential from expected stock returns. Use the source currency and units. End with practical stances for existing holders, fresh investors, aggressive investors, and conservative investors, followed by a concise best overall judgement and a non-financial-advice disclaimer.
"""

COMPARE_SYSTEM_PROMPT = """You are a senior financial analyst, senior risk manager, and senior investment manager.
Write the final answer directly for the user in plain text with simple headings and tables. Do not add a preamble, metadata block, workflow summary, separator banner, or XML.

The user wants a side-by-side comparison report for two stocks in exactly this structure:

[Ticker A] vs [Ticker B]: [projection year] Comparative Investment View

## Summary verdict
One-paragraph overall judgement: which stock is the better investment today and why.

## Head-to-head scorecard
A table comparing both stocks across: Business quality, Revenue growth, Profitability (margins), Balance sheet health, Valuation (P/E, P/B), Dividend yield, ROCE/ROE, 52-week performance, Risk level.
Score each cell as Better / Neutral / Worse relative to the other stock.

## 1. Business quality and sector positioning
## 2. Financial performance
## 3. Balance-sheet analysis
## 4. Valuation comparison
## 5. Shareholding and ownership quality
## 6. Key risks for each stock
## 7. End-[year] projection (bear/base/bull for each)
## 8. Which stock for which investor?
A table: rows = investor type (Fresh / Existing / Aggressive / Conservative), columns = recommendation for A and B.

## Final verdict
Which one wins and under what conditions would the other be preferred.

Non-financial-advice disclaimer at the end.

Use only the supplied data. Never invent figures. If data is missing for one stock, say so and note what the investor should verify.
"""

PORTFOLIO_SYSTEM_PROMPT = """You are a senior portfolio manager, financial analyst, and risk manager.
Write the final answer directly for the user in plain text with simple headings and tables. Do not add a preamble, metadata block, workflow summary, separator banner, or XML.

The user wants a comprehensive portfolio analysis report in exactly this structure:

Portfolio Analysis: [projection year] View
Overall portfolio status: [one-line verdict — e.g. "Well-diversified with strong gains but high concentration in X"]

## Portfolio Snapshot
A table with columns: Ticker | Company | Market | Qty | Avg Cost | Current Price | Invested | Current Value | Unrealised P&L | Gain % | Weight %
Include a TOTAL row at the bottom.

## Key Statistics
- Total invested, total current value, total unrealised P&L, total return %
- Number of holdings, best performer, worst performer
- India vs US allocation breakdown

## Allocation Analysis
- Pie-in-words: which tickers make up the portfolio by weight
- Any concentration flags (single holding > 25%)
- Market mix assessment

## Risk Assessment
- Concentration risk: identify overweight positions
- Any holdings in loss territory and their significance
- Overall portfolio risk profile (conservative / balanced / aggressive)

## Individual Stock Summary
For each holding, write 2–3 sentences: current stance (hold / trim / add), reason based on its weight and gain/loss, and what to watch.

## Rebalancing Recommendations
Specific, actionable suggestions:
- Which positions to trim (overweight / large gains)
- Which to review (significant losses)
- Any gaps in the portfolio (sectors / markets missing)

## Final Portfolio Verdict
One paragraph summary: is this a healthy portfolio? What is the single most important action the investor should take now?

Non-financial-advice disclaimer at the end.

Use only the supplied data. Never invent prices, company details, or financial figures not provided. If current price is unavailable for a holding, say so and note it needs manual verification.
"""


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value if isinstance(value, (str, int, float, bool)) or value is None else str(value)


def _compact_data(data: Dict[str, Any]) -> str:
    """Select and serialise the canonical keys to pass to Bob."""
    selected = {
        "source":                data.get("source"),
        "source_url":            data.get("source_url"),
        "key_metrics":           data.get("key_metrics", {}),
        "fundamental_metrics":   data.get("fundamental_metrics", {}),
        "technical_metrics":     data.get("technical_metrics", {}),
        "chart_signals":         data.get("chart_signals", {}),
        "forensic_metrics":      data.get("forensic_metrics", {}),
        "debt_breakdown":        data.get("debt_breakdown", {}),
        "annual_financials":     data.get("financials_annual", {}),
        "quarterly_financials":  data.get("financials_quarterly", {}),
        "balance_sheet":         data.get("balance_sheet_annual", {}),
        "cash_flow":             data.get("cashflow_annual", {}),
        "shareholding":          data.get("shareholding", {}),
        "peer_comparison":       data.get("peer_comparison", {}),
        "major_holders":         data.get("major_holders", {}),
        "institutional_holders": data.get("institutional_holders", {}),
        "pe_history":            data.get("pe_history", {}),
        "analyst_consensus":     data.get("analyst_consensus", {}),
        "news":                  data.get("news", []),
        "macro_sector":          data.get("macro_sector", {}),
    }
    selected = {k: v for k, v in selected.items() if v is not None}
    return json.dumps(_json_safe(selected), ensure_ascii=False, default=str)


def _load_data(ticker: str, market: str) -> Dict[str, Any]:
    if market == "india":
        return screener_layer.compile_full_dataset(ticker)
    if market == "us":
        return yfinance_layer.compile_full_dataset(ticker)
    raise ValueError("market must be 'india' or 'us'")


def _mcp_config_path() -> Optional[str]:
    """Return the path to the global Bob MCP config file, or None if not found."""
    candidate = os.path.join(os.path.expanduser("~"), ".bob", "settings", "mcp.json")
    return candidate if os.path.isfile(candidate) else None


def _disable_global_mcp() -> Optional[dict]:
    """
    Temporarily mark every MCP server in ~/.bob/settings/mcp.json as disabled.
    Bob v2+ initialises the global MCP hub at startup even when --disable-mcp is
    passed; servers with multi-hour timeouts cause bob run to hang indefinitely.
    Returns the original config dict so the caller can restore it afterwards.
    """
    path = _mcp_config_path()
    if not path:
        return None
    try:
        with open(path) as fh:
            original = json.load(fh)
        patched = json.loads(json.dumps(original))          # deep copy
        for srv in patched.get("mcpServers", {}).values():
            srv["disabled"] = True
        with open(path, "w") as fh:
            json.dump(patched, fh, indent=2)
        return original
    except Exception as exc:
        logger.debug("Could not patch MCP config: %s", exc)
        return None


def _restore_global_mcp(original: Optional[dict]) -> None:
    """Restore the global MCP config to its original state."""
    if original is None:
        return
    path = _mcp_config_path()
    if not path:
        return
    try:
        with open(path, "w") as fh:
            json.dump(original, fh, indent=2)
    except Exception as exc:
        logger.debug("Could not restore MCP config: %s", exc)


def _run_bob(prompt: str) -> str:
    """Run Bob Shell and return only its assistant response."""
    if not shutil.which("bob"):
        raise RuntimeError(
            "Bob Shell is not installed or not on PATH. Install it, then retry."
        )
    if not os.environ.get("BOB_API_KEY"):
        raise RuntimeError(
            "BOB_API_KEY is not set. Export it before running the analysis."
        )

    command = [
        "bob", "run", "--accept-license",
        "--workspace", os.getcwd(), "--max-turns", "1", "--format", "json", prompt,
    ]

    original_mcp = _disable_global_mcp()
    try:
        result = subprocess.run(
            command, capture_output=True, text=True, timeout=600, check=False
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Bob Shell timed out while generating the report.") from exc
    finally:
        _restore_global_mcp(original_mcp)

    if result.returncode != 0:
        details = (result.stderr or result.stdout).strip()
        raise RuntimeError(
            f"Bob Shell failed. Check authentication and network access. "
            f"Details: {details[-1000:]}"
        )

    raw = result.stdout.strip()
    if not raw:
        raise RuntimeError("Bob Shell returned an empty report.")

    try:
        parsed = json.loads(raw)
        output: Optional[str] = parsed.get("last_message")
    except json.JSONDecodeError:
        output = raw

    if not output:
        raise RuntimeError("Bob Shell returned an empty report.")
    return output


def run_investment_analysis(
    ticker: str, market: str = "india", projection_year: int = 2026
) -> Dict[str, Any]:
    """Fetch market data and generate one detailed investment report with Bob Shell."""
    normalized_market = market.lower()
    normalized_ticker = ticker.upper()
    data = _load_data(normalized_ticker, normalized_market)
    prompt = (
        f"{REPORT_SYSTEM_PROMPT}\n\n"
        f"Ticker: {normalized_ticker}\nMarket: {normalized_market.title()}\n"
        f"Projection year: {projection_year}\n"
        f"Source data (JSON):\n{_compact_data(data)}"
    )
    return {
        "ticker":          normalized_ticker,
        "market":          normalized_market,
        "projection_year": projection_year,
        "final_memo":      _run_bob(prompt).strip(),
        "key_metrics":     data.get("key_metrics", {}),
        "source":          data.get("source"),
        "source_url":      data.get("source_url"),
    }


def run_compare_analysis(
    ticker_a: str,
    ticker_b: str,
    market: str = "india",
    projection_year: int = 2026,
    market_b: Optional[str] = None,
) -> Dict[str, Any]:
    """Fetch data for two tickers concurrently and generate a side-by-side comparison report.

    Args:
        ticker_a: First ticker symbol.
        ticker_b: Second ticker symbol.
        market:   Market for ticker_a (also used for ticker_b when market_b is None).
        projection_year: Forward-looking projection year.
        market_b: Optional separate market for ticker_b (e.g. 'us' when ticker_a is 'india').
    """
    norm_market_a = market.lower()
    norm_market_b = (market_b or market).lower()
    a = ticker_a.upper()
    b = ticker_b.upper()

    # Fetch both datasets concurrently — each is a ~5–15s network operation
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        fut_a = pool.submit(_load_data, a, norm_market_a)
        fut_b = pool.submit(_load_data, b, norm_market_b)
        data_a = fut_a.result()
        data_b = fut_b.result()

    prompt = (
        f"{COMPARE_SYSTEM_PROMPT}\n\n"
        f"Ticker A: {a}\nTicker B: {b}\n"
        f"Market A: {norm_market_a.title()}\nMarket B: {norm_market_b.title()}\n"
        f"Projection year: {projection_year}\n\n"
        f"--- Data for {a} ---\n{_compact_data(data_a)}\n\n"
        f"--- Data for {b} ---\n{_compact_data(data_b)}"
    )
    return {
        "ticker_a":        a,
        "ticker_b":        b,
        "market_a":        norm_market_a,
        "market_b":        norm_market_b,
        "projection_year": projection_year,
        "final_memo":      _run_bob(prompt).strip(),
    }


def run_portfolio_analysis(
    holdings_path: str,
    projection_year: int = 2026,
) -> Dict[str, Any]:
    """Load a holdings file, fetch current prices, and generate a portfolio report."""
    from .portfolio_analyser import load_holdings, fetch_current_prices, compute_portfolio_metrics

    holdings_df = load_holdings(holdings_path)
    holdings_with_prices = fetch_current_prices(holdings_df)
    metrics = compute_portfolio_metrics(holdings_with_prices)

    prompt = (
        f"{PORTFOLIO_SYSTEM_PROMPT}\n\n"
        f"Projection year: {projection_year}\n"
        f"Portfolio data (JSON):\n"
        f"{json.dumps(_json_safe(metrics), ensure_ascii=False, default=str)}"
    )

    return {
        "type":            "portfolio",
        "projection_year": projection_year,
        "metrics":         metrics,
        "final_memo":      _run_bob(prompt).strip(),
    }
