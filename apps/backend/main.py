#!/usr/bin/env python3
"""Generate detailed investment reports for Indian or US stocks."""

import argparse
import logging
import os
import sys
import threading
import time
from typing import Dict, List, Tuple

from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from nxtvue import (
    run_investment_analysis,
    run_compare_analysis,
    run_portfolio_analysis,
    settings,
)
from nxtvue.pdf_writer import save_pdf

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

_REPORTS_DIR = os.path.join(os.path.dirname(__file__), "reports")
_DEFAULT_MARKET = "india"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _pdf_path(name: str) -> str:
    """Return the auto-named PDF path inside reports/, creating the dir if needed."""
    os.makedirs(_REPORTS_DIR, exist_ok=True)
    return os.path.join(_REPORTS_DIR, f"{name.upper()}.pdf")


def _parse_ticker_market(token: str, fallback_market: str) -> Tuple[str, str]:
    """
    Parse a token that may carry an explicit market suffix.
    Formats accepted:
        NETWEB           → ("NETWEB", fallback_market)
        AAPL:us          → ("AAPL", "us")
        LUPIN:india      → ("LUPIN", "india")
    """
    if ":" in token:
        parts = token.split(":", 1)
        ticker = parts[0].strip().upper()
        market = parts[1].strip().lower()
        if market not in ("india", "us"):
            raise ValueError(f"Unknown market '{market}' in '{token}'. Use 'india' or 'us'.")
        return ticker, market
    return token.strip().upper(), fallback_market


# ── Progress indicator ────────────────────────────────────────────────────────

_SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]


def _spin_dynamic(label: list, stop_event: threading.Event) -> None:
    """Spinner that reads label[0] on every tick — caller can update the message live."""
    t0 = time.monotonic()
    i = 0
    while not stop_event.is_set():
        elapsed = int(time.monotonic() - t0)
        frame = _SPINNER[i % len(_SPINNER)]
        line = f"\r  {frame}  {label[0]}  ({elapsed}s) …"
        sys.stdout.write(line.ljust(80))
        sys.stdout.flush()
        i += 1
        time.sleep(0.1)
    sys.stdout.write("\r" + " " * 80 + "\r")
    sys.stdout.flush()


def _run_single(
    ticker: str,
    market: str,
    projection_year: int,
    output_path: str,
) -> Dict:
    """Analyse one ticker; show progress; save PDF. Returns summary row."""
    t0 = time.monotonic()

    # ── Stage 1 + 2: fetch data & generate report (both happen inside run_investment_analysis)
    # Split into two visible phases using a callback approach:
    # Phase A — data fetch (fast, ~5–15s)
    # Phase B — Bob LLM generation (slow, ~60–180s)
    # We wrap the whole call in a spinner that switches message mid-way via a shared list.
    _label = [f"[{ticker}] Fetching financial data"]
    stop = threading.Event()
    spinner = threading.Thread(target=_spin_dynamic, args=(_label, stop), daemon=True)
    spinner.start()
    t_fetch = time.monotonic()

    try:
        # Fetch data first so we can update the label before Bob starts
        from nxtvue.report_generator import _load_data, _compact_data, REPORT_SYSTEM_PROMPT, _run_bob
        data = _load_data(ticker.upper(), market.lower())
        t_data_done = time.monotonic()
        _label[0] = f"[{ticker}] Generating AI report  (this takes ~1–3 min)"

        prompt = (
            f"{REPORT_SYSTEM_PROMPT}\n\n"
            f"Ticker: {ticker.upper()}\nMarket: {market.title()}\n"
            f"Projection year: {projection_year}\n"
            f"Source data (JSON):\n{_compact_data(data)}"
        )
        memo = _run_bob(prompt)
    finally:
        stop.set(); spinner.join()

    fetch_s = int(t_data_done - t_fetch)
    llm_s   = int(time.monotonic() - t_data_done)
    print(f"  ✓  [{ticker}] Data fetched ({fetch_s}s)  │  AI report generated ({llm_s}s)", flush=True)

    # ── Stage 3: save PDF ─────────────────────────────────────────────────────
    result = {
        "ticker": ticker.upper(), "market": market.lower(),
        "projection_year": projection_year,
        "final_memo": memo.strip(),
        "key_metrics": data.get("key_metrics", {}),
    }
    saved = save_pdf(result["final_memo"], ticker, output_path)
    elapsed = time.monotonic() - t0
    print(f"  ✓  [{ticker}] PDF saved → {saved}  (total {elapsed:.0f}s)\n", flush=True)

    km = result.get("key_metrics") or {}
    return {
        "ticker": ticker,
        "market": market,
        "price":  km.get("current_price"),
        "pe":     km.get("ttm_pe") or km.get("pe_ratio"),
        "roce":   km.get("roce"),
        "pdf":    saved,
        "status": "✓",
    }


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate detailed investment reports for Indian or US stocks.",
        formatter_class=argparse.RawTextHelpFormatter,
    )

    # Positional: zero-or-more so --watchlist / --portfolio can be used alone
    parser.add_argument(
        "tickers",
        nargs="*",
        metavar="TICKER[:market]",
        help=(
            "One or more tickers. Optionally append :market to override the default.\n"
            "Examples: NETWEB  AAPL:us  LUPIN:india"
        ),
    )
    parser.add_argument(
        "--market",
        choices=("india", "us"),
        default=_DEFAULT_MARKET,
        help="Default market for tickers that don't carry a :market suffix (default: india).",
    )
    parser.add_argument("--year", type=int, default=2026, dest="projection_year")

    # Output
    parser.add_argument(
        "--output",
        metavar="FILE",
        nargs="?",
        const="",
        default=None,
        help=(
            "Save report(s) as PDF.\n"
            "• No value  → reports/<TICKER>.pdf for each ticker (auto-named, overwrites).\n"
            "• With path → used only when a single ticker or --portfolio is given."
        ),
    )

    # Watchlist (now supports TICKER:market syntax per line)
    parser.add_argument(
        "--watchlist",
        metavar="FILE",
        default=None,
        help=(
            "Path to a plain-text file with one TICKER[:market] per line.\n"
            "Lines starting with # are ignored. Generates one PDF per ticker.\n"
            "Example line:  AAPL:us"
        ),
    )

    # Compare
    parser.add_argument(
        "--compare",
        action="store_true",
        help="Compare exactly two tickers side-by-side. Requires exactly 2 TICKER arguments.",
    )

    # Portfolio
    parser.add_argument(
        "--portfolio",
        metavar="FILE",
        default=None,
        help=(
            "Path to a holdings file (.xlsx or .csv) with columns:\n"
            "  ticker, qty, avg_cost, market (optional, defaults to 'india')\n"
            "Generates one combined portfolio analysis PDF."
        ),
    )

    # Holdings template generator
    parser.add_argument(
        "--create-holdings-template",
        action="store_true",
        dest="create_template",
        help="Create a correctly formatted holdings.xlsx template in the current directory and exit.",
    )

    args = parser.parse_args()

    # ── Holdings template (no API key needed) ─────────────────────────────────
    if args.create_template:
        _create_holdings_template()
        return

    if not os.environ.get("BOB_API_KEY"):
        parser.error("BOB_API_KEY is not set. Add it to .env or export it before running.")

    # ── Portfolio mode ────────────────────────────────────────────────────────
    if args.portfolio:
        port_path = os.path.expanduser(args.portfolio)
        if not os.path.isfile(port_path):
            parser.error(f"Portfolio file not found: {port_path}")
        out = args.output if args.output else os.path.join(_REPORTS_DIR, "PORTFOLIO.pdf")
        os.makedirs(_REPORTS_DIR, exist_ok=True)
        print(f"\nBuilding portfolio report from {port_path} …\n", flush=True)
        try:
            result = run_portfolio_analysis(port_path, projection_year=args.projection_year)
            saved = save_pdf(result["final_memo"], "PORTFOLIO", out)
            summary = result["metrics"]["summary"]
            print(
                f"  ✓ {summary['num_holdings']} holdings | "
                f"Invested: {summary['total_invested']:,.0f} | "
                f"Value: {summary['total_value']:,.0f} | "
                f"P&L: {summary['total_pnl']:+,.0f} ({summary['total_gain_pct']:+.1f}%)"
            )
            print(f"\nPortfolio report → {saved}\n")
        except Exception as exc:
            logger.error("Portfolio analysis failed: %s", exc)
            raise SystemExit(1) from exc
        return

    # ── Collect tickers ───────────────────────────────────────────────────────
    ticker_market: Dict[str, str] = {}  # ticker → market (last one wins on duplicates)

    for token in args.tickers:
        try:
            t, m = _parse_ticker_market(token, args.market)
            ticker_market[t] = m
        except ValueError as exc:
            parser.error(str(exc))

    if args.watchlist:
        wl_path = os.path.expanduser(args.watchlist)
        if not os.path.isfile(wl_path):
            parser.error(f"Watchlist file not found: {wl_path}")
        with open(wl_path) as fh:
            for line in fh:
                raw_line = line.strip()
                if not raw_line or raw_line.startswith("#"):
                    continue
                # Validate: warn on multi-word or obviously invalid tickers
                token_part = raw_line.split(":")[0].strip()
                if " " in token_part:
                    logger.warning(
                        "Watchlist line '%s' looks like a multi-word name, not a ticker — "
                        "use the NSE symbol (e.g. ASTRAMICRO instead of 'Astra Micro Wave'). Skipping.",
                        raw_line,
                    )
                    continue
                try:
                    t, m = _parse_ticker_market(raw_line, args.market)
                    if t not in ticker_market:   # positional args take priority
                        ticker_market[t] = m
                except ValueError as exc:
                    logger.warning("Skipping watchlist line '%s': %s", raw_line, exc)

    if not ticker_market:
        parser.error("Provide at least one TICKER, use --watchlist, or use --portfolio.")

    tickers = list(ticker_market.keys())

    # ── Compare mode ──────────────────────────────────────────────────────────
    if args.compare:
        if len(tickers) != 2:
            parser.error("--compare requires exactly 2 tickers.")
        a, b = tickers
        # For compare, both tickers use the same market (use ticker_market[a] as the one)
        market_a = ticker_market[a]
        market_b = ticker_market[b]
        if market_a != market_b:
            logger.warning(
                "--compare: %s is '%s' and %s is '%s'. Using '%s' for both.",
                a, market_a, b, market_b, market_a,
            )
        print(f"\nComparing {a} vs {b} ({market_a.title()} vs {market_b.title()}, {args.projection_year}) …", flush=True)
        try:
            result = run_compare_analysis(
                a, b,
                market=market_a,
                market_b=market_b,
                projection_year=args.projection_year,
            )
            out = args.output if args.output else os.path.join(_REPORTS_DIR, f"{a}_vs_{b}.pdf")
            saved = save_pdf(result["final_memo"], f"{a} vs {b}", out)
            print(f"✓ Comparison report → {saved}\n")
        except Exception as exc:
            logger.error("Comparison failed: %s", exc)
            raise SystemExit(1) from exc
        return

    # ── Single / batch mode ───────────────────────────────────────────────────
    if len(tickers) == 1 and args.output and args.output != "":
        output_paths = {tickers[0]: args.output}
    else:
        output_paths = {t: _pdf_path(t) for t in tickers}

    print(f"\nRunning analysis for {len(tickers)} ticker(s): {', '.join(tickers)}\n")
    summary_rows: List[Dict] = []
    errors: List[str] = []

    for ticker in tickers:
        try:
            row = _run_single(
                ticker, ticker_market[ticker], args.projection_year,
                output_paths[ticker],
            )
            summary_rows.append(row)
        except Exception as exc:
            logger.error("Failed for %s: %s", ticker, exc)
            errors.append(ticker)
            summary_rows.append({
                "ticker": ticker, "market": ticker_market[ticker],
                "price": None, "pe": None, "roce": None,
                "pdf": None, "status": "✗ FAILED",
            })

    # ── Batch summary table ───────────────────────────────────────────────────
    if len(summary_rows) > 1:
        _print_batch_summary(summary_rows)

    print()
    if errors:
        print(f"⚠  Failed: {', '.join(errors)}")
        raise SystemExit(1)
    else:
        print(f"All {len(tickers)} report(s) saved to {_REPORTS_DIR}/")


# ── Utility functions ─────────────────────────────────────────────────────────

def _print_batch_summary(rows: List[Dict]) -> None:
    """Print a compact summary table after a batch run."""
    if not rows:
        return
    print("\n" + "─" * 72)
    print(f"  {'TICKER':<10} {'MARKET':<7} {'PRICE':>10} {'TTM P/E':>8} {'ROCE':>7}  STATUS")
    print("─" * 72)
    for r in rows:
        price = f"{r['price']:,.0f}" if r.get("price") else "  N/A"
        pe    = f"{r['pe']:.1f}x"   if r.get("pe")    else "  N/A"
        roce  = f"{r['roce']*100:.1f}%" if r.get("roce") else "  N/A"
        print(f"  {r['ticker']:<10} {r['market']:<7} {price:>10} {pe:>8} {roce:>7}  {r['status']}")
    print("─" * 72)


def _create_holdings_template() -> None:
    """Create a sample holdings.xlsx in the current directory."""
    try:
        import pandas as pd
        df = pd.DataFrame([
            {"ticker": "NETWEB",  "qty": 10,  "avg_cost": 3200,  "market": "india"},
            {"ticker": "LUPIN",   "qty": 20,  "avg_cost": 1500,  "market": "india"},
            {"ticker": "TCS",     "qty": 5,   "avg_cost": 3800,  "market": "india"},
            {"ticker": "AAPL",    "qty": 3,   "avg_cost": 175,   "market": "us"},
            {"ticker": "MSFT",    "qty": 2,   "avg_cost": 310,   "market": "us"},
        ])
        path = os.path.join(os.getcwd(), "holdings.xlsx")
        df.to_excel(path, index=False)
        print(f"✓ Holdings template created: {path}")
        print("  Edit the file with your actual tickers, quantities, and average costs.")
        print("  Columns: ticker | qty | avg_cost | market (india or us)")
    except ImportError:
        print("Error: openpyxl is required. Run: pip install openpyxl")


if __name__ == "__main__":
    main()
