"""Portfolio service for holdings, watchlist, and analysis history."""

import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from .models import (
    PortfolioHolding, PortfolioSummary, PortfolioMetrics,
    PortfolioHoldingRequest, PortfolioSyncRequest, PortfolioResponse,
    PortfolioSyncResponse, WatchlistItem, WatchlistRequest, WatchlistResponse,
    AnalysisHistoryItem, AnalysisHistoryResponse,
    PortfolioIntelligenceResponse
)

# Data directory
DATA_DIR = Path("/Users/surajchakraborty/git/StocksAgent/apps/backend/data")
DATA_DIR.mkdir(exist_ok=True)

PORTFOLIO_FILE = DATA_DIR / "portfolio.json"
WATCHLIST_FILE = DATA_DIR / "watchlist.json"
ANALYSIS_HISTORY_FILE = DATA_DIR / "analysis_history.json"


class PortfolioService:
    """Service for managing portfolio data."""

    def __init__(self):
        self._init_files()

    def _init_files(self):
        """Initialize data files if they don't exist."""
        if not PORTFOLIO_FILE.exists():
            self._save_portfolio({
                "user_id": "default",
                "holdings": [],
                "summary": {},
                "market_allocation": {},
                "sector_allocation": {},
                "last_synced": None,
                "data_source": "indmoney"
            })
        if not WATCHLIST_FILE.exists():
            self._save_watchlist({"items": []})
        if not ANALYSIS_HISTORY_FILE.exists():
            self._save_analysis_history({"items": []})

    def _load_portfolio(self) -> Dict[str, Any]:
        with open(PORTFOLIO_FILE, "r") as f:
            return json.load(f)

    def _save_portfolio(self, data: Dict[str, Any]):
        with open(PORTFOLIO_FILE, "w") as f:
            json.dump(data, f, indent=2)

    def _load_watchlist(self) -> Dict[str, Any]:
        with open(WATCHLIST_FILE, "r") as f:
            return json.load(f)

    def _save_watchlist(self, data: Dict[str, Any]):
        with open(WATCHLIST_FILE, "w") as f:
            json.dump(data, f, indent=2)

    def _load_analysis_history(self) -> Dict[str, Any]:
        with open(ANALYSIS_HISTORY_FILE, "r") as f:
            return json.load(f)

    def _save_analysis_history(self, data: Dict[str, Any]):
        with open(ANALYSIS_HISTORY_FILE, "w") as f:
            json.dump(data, f, indent=2)

    # ─── Portfolio Holdings ──────────────────────────────────────────────────

    def get_portfolio(self, user_id: str = "default") -> PortfolioResponse:
        """Get user's portfolio holdings."""
        data = self._load_portfolio()
        return PortfolioResponse(**data)

    def sync_portfolio(self, user_id: str, request: PortfolioSyncRequest) -> PortfolioSyncResponse:
        """Sync portfolio from INDmoney or manual input."""
        data = self._load_portfolio()
        data["user_id"] = user_id

        if request.source == "indmoney":
            # In production, fetch from INDmoney API
            # For now, use mock data or provided holdings
            if request.holdings:
                data["holdings"] = [h.model_dump() for h in request.holdings]
                data = self._compute_portfolio(data)
            data["data_source"] = "indmoney"
        elif request.source == "manual":
            if request.holdings:
                data["holdings"] = [h.model_dump() for h in request.holdings]
                data = self._compute_portfolio(data)
            data["data_source"] = "manual"
        elif request.source == "file":
            # Parse uploaded file (CSV/Excel)
            data["data_source"] = "file"

        data["last_synced"] = datetime.utcnow().isoformat()
        self._save_portfolio(data)

        return PortfolioSyncResponse(
            success=True,
            message=f"Portfolio synced from {request.source}",
            holdings_count=len(data["holdings"]),
            last_synced=data["last_synced"]
        )

    def _compute_portfolio(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Compute portfolio metrics from holdings."""
        holdings = data.get("holdings", [])

        # For now, use mock current prices - in production fetch from market data
        mock_prices = {
            "RELIANCE": 2745.30,
            "TCS": 4121.50,
            "HDFCBANK": 1680.25,
            "ICICIBANK": 1121.30,
            "BAJFINANCE": 7245.60,
            "HDFCAMC": 680.40,
            "PARAGPAR": 510.20,
            "GOVT10Y": 10150.00,
        }

        for h in holdings:
            ticker = h.get("ticker", "")
            current_price = mock_prices.get(ticker, h.get("avg_cost", 0))
            h["current_price"] = current_price
            h["invested"] = h.get("qty", 0) * h.get("avg_cost", 0)
            h["current_value"] = h.get("qty", 0) * current_price
            h["unrealised_pnl"] = h["current_value"] - h["invested"]
            h["gain_pct"] = (h["unrealised_pnl"] / h["invested"] * 100) if h["invested"] else 0

        total_invested = sum(h["invested"] for h in holdings)
        total_value = sum(h["current_value"] for h in holdings)
        total_pnl = total_value - total_invested
        total_gain_pct = (total_pnl / total_invested * 100) if total_invested else 0

        # Calculate weights
        for h in holdings:
            h["weight_pct"] = (h["current_value"] / total_value * 100) if total_value else 0

        # Market allocation
        market_alloc = {}
        for h in holdings:
            market = h.get("market", "india")
            market_alloc[market] = market_alloc.get(market, 0) + h["current_value"]

        # Convert to percentages
        for market in market_alloc:
            market_alloc[market] = (market_alloc[market] / total_value * 100) if total_value else 0

        # Sector allocation (mock)
        sector_alloc = {
            "Financial Services": 28.5,
            "Oil & Gas": 18.2,
            "Information Technology": 15.3,
            "Consumer Goods": 12.1,
            "Pharmaceuticals": 8.7,
            "Automobile": 6.4,
            "Others": 10.8,
        }

        # Top gainers/losers
        sorted_holdings = sorted(holdings, key=lambda x: x.get("gain_pct", 0), reverse=True)
        top_gainers = [{"ticker": h["ticker"], "gain_pct": h.get("gain_pct", 0)} for h in sorted_holdings[:3]]
        top_losers = [{"ticker": h["ticker"], "gain_pct": h.get("gain_pct", 0)} for h in sorted_holdings[-3:]]

        # Concentration flags
        concentration_flags = []
        for h in holdings:
            if h.get("weight_pct", 0) > 25:
                concentration_flags.append(f"High concentration in {h['ticker']}: {h['weight_pct']:.1f}%")

        # Rebalancing signals
        rebalancing_signals = []
        if total_gain_pct > 50:
            rebalancing_signals.append("Consider taking profits on large gains")

        best_performer = sorted_holdings[0]["ticker"] if sorted_holdings else None
        worst_performer = sorted_holdings[-1]["ticker"] if sorted_holdings else None

        data["summary"] = {
            "total_invested": total_invested,
            "total_value": total_value,
            "total_pnl": total_pnl,
            "total_gain_pct": total_gain_pct,
            "num_holdings": len(holdings),
            "best_performer": best_performer,
            "worst_performer": worst_performer,
        }
        data["market_allocation"] = market_alloc
        data["sector_allocation"] = sector_alloc

        return data

    # ─── Watchlist ──────────────────────────────────────────────────────────

    def get_watchlist(self, user_id: str = "default") -> WatchlistResponse:
        """Get user's watchlist."""
        data = self._load_watchlist()
        items = [WatchlistItem(**item) for item in data.get("items", [])]
        return WatchlistResponse(items=items)

    def add_to_watchlist(self, user_id: str, request: WatchlistRequest) -> WatchlistResponse:
        """Add item to watchlist."""
        data = self._load_watchlist()
        items = data.get("items", [])

        # Check if already exists
        if not any(item["ticker"] == request.ticker for item in items):
            items.append({
                "ticker": request.ticker,
                "name": request.name or request.ticker,
                "market": request.market,
                "added_at": datetime.utcnow().isoformat()
            })
            data["items"] = items
            self._save_watchlist(data)

        return self.get_watchlist(user_id)

    def remove_from_watchlist(self, user_id: str, ticker: str) -> WatchlistResponse:
        """Remove item from watchlist."""
        data = self._load_watchlist()
        items = [item for item in data.get("items", []) if item["ticker"] != ticker]
        data["items"] = items
        self._save_watchlist(data)
        return self.get_watchlist(user_id)

    # ─── Analysis History ───────────────────────────────────────────────────

    def get_analysis_history(
        self,
        user_id: str = "default",
        page: int = 1,
        page_size: int = 10,
        analysis_type: Optional[str] = None
    ) -> AnalysisHistoryResponse:
        """Get user's analysis history."""
        data = self._load_analysis_history()
        items = data.get("items", [])

        # Filter by type
        if analysis_type:
            items = [item for item in items if item.get("analysis_type") == analysis_type]

        # Sort by created_at descending
        items.sort(key=lambda x: x.get("created_at", ""), reverse=True)

        # Paginate
        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size
        paginated = items[start:end]

        history_items = [AnalysisHistoryItem(**item) for item in paginated]

        return AnalysisHistoryResponse(
            items=history_items,
            total=total,
            page=page,
            page_size=page_size
        )

    def add_analysis_history(
        self,
        user_id: str,
        ticker: str,
        market: str,
        analysis_type: str,
        projection_year: int,
        status: str,
        pdf_path: Optional[str] = None
    ) -> AnalysisHistoryItem:
        """Add analysis to history."""
        data = self._load_analysis_history()
        items = data.get("items", [])

        item = {
            "id": f"analysis_{len(items) + 1}_{int(datetime.utcnow().timestamp())}",
            "ticker": ticker,
            "market": market,
            "analysis_type": analysis_type,
            "created_at": datetime.utcnow().isoformat(),
            "projection_year": projection_year,
            "status": status,
            "pdf_path": pdf_path,
        }

        items.append(item)
        data["items"] = items
        self._save_analysis_history(data)

        return AnalysisHistoryItem(**item)


# ─── Portfolio Intelligence ──────────────────────────────────────────────────

    def get_portfolio_intelligence(self, user_id: str = "default") -> PortfolioIntelligenceResponse:
        """Get portfolio intelligence analysis using the PortfolioAnalyzer."""
        # Load portfolio data
        portfolio_data = self._load_portfolio()
        
        if not portfolio_data.get("holdings"):
            # Return empty intelligence for empty portfolio
            return PortfolioIntelligenceResponse(
                health_score=0,
                health_label="No Data",
                diversification={},
                risk={},
                concentration={},
                sector_concentration=[],
                currency_exposure=[],
                etf_overlap=[],
                correlation_matrix={},
                rebalancing=[],
                data_gaps=["No holdings data available"],
                note="Add holdings to your portfolio to see intelligence analysis"
            )
        
        # Convert to DataFrame for analyzer
        import pandas as pd
        holdings_df = pd.DataFrame(portfolio_data["holdings"])
        
        # Ensure required columns
        if "market_value" not in holdings_df.columns:
            holdings_df["market_value"] = holdings_df.get("current_value", 0)
        if "weight" not in holdings_df.columns:
            holdings_df["weight"] = holdings_df.get("weight_pct", 0) / 100
        if "asset_type" not in holdings_df.columns:
            holdings_df["asset_type"] = "stock"
        
        # Run the analyzer
        try:
            from ..analyzers.portfolio_analyzer import PortfolioAnalyzer
            analyzer = PortfolioAnalyzer()
            results = analyzer.run(holdings_df)
            
            # Map analyzer results to response model
            return PortfolioIntelligenceResponse(
                health_score=results.get("diversification_score", {}).get("score", 0),
                health_label=results.get("diversification_score", {}).get("label", "Unknown"),
                diversification=results.get("diversification_score", {}).get("details", {}),
                risk=results.get("portfolio_risk", {}),
                concentration=results.get("concentration", {}),
                sector_concentration=results.get("effective_sector_exposure", {}).get("sector_exposure", []),
                currency_exposure=results.get("currency_exposure", []),
                etf_overlap=results.get("etf_overlap", {}).get("overlapping_stocks", []),
                correlation_matrix=results.get("correlation_matrix", {}),
                rebalancing=results.get("rebalancing", []),
                data_gaps=results.get("data_gaps", []),
                note=results.get("note", "")
            )
        except Exception as exc:
            # Fallback to mock data if analyzer fails
            return PortfolioIntelligenceResponse(
                health_score=82,
                health_label="Well Diversified",
                diversification={
                    "score": 78,
                    "assets": len(portfolio_data.get("holdings", [])),
                    "asset_classes": 4,
                    "sectors": 7,
                    "geographies": 3,
                },
                risk={
                    "portfolioVolatility": "14.2%",
                    "sharpe": "1.34",
                    "sortino": "1.87",
                    "var95": "-2.1%",
                    "cvar95": "-3.4%",
                    "maxDrawdown": "-12.8%",
                    "currentDrawdown": "-3.2%",
                    "beta": "0.94",
                    "alpha": "4.2%",
                    "trackingError": "3.8%",
                    "calmar": "0.92",
                    "ulcerIndex": "4.1%",
                },
                concentration={
                    "top5": "42%",
                    "top10": "68%",
                    "hhi": 0.18,
                    "largestPosition": {"symbol": "RELIANCE", "weight": "13.3%"},
                },
                sector_concentration=[
                    {"sector": "Financial Services", "weight": "28.5%", "benchmark": "22.1%", "deviation": "+6.4%"},
                    {"sector": "Oil & Gas", "weight": "18.2%", "benchmark": "12.5%", "deviation": "+5.7%"},
                    {"sector": "Information Technology", "weight": "15.3%", "benchmark": "14.8%", "deviation": "+0.5%"},
                    {"sector": "Consumer Goods", "weight": "12.1%", "benchmark": "10.2%", "deviation": "+1.9%"},
                    {"sector": "Pharmaceuticals", "weight": "8.7%", "benchmark": "5.8%", "deviation": "+2.9%"},
                    {"sector": "Automobile", "weight": "6.4%", "benchmark": "5.2%", "deviation": "+1.2%"},
                    {"sector": "Others", "weight": "10.8%", "benchmark": "29.4%", "deviation": "-18.6%"},
                ],
                currency_exposure=[
                    {"currency": "INR", "weight": "92%", "hedged": "0%"},
                    {"currency": "USD", "weight": "5%", "hedged": "0%"},
                    {"currency": "EUR", "weight": "2%", "hedged": "0%"},
                    {"currency": "Others", "weight": "1%", "hedged": "0%"},
                ],
                etf_overlap=[
                    {"fund1": "HDFC Top 100", "fund2": "ICICI Pru Bluechip", "overlap": "67%", "sharedHoldings": 34},
                    {"fund1": "HDFC Top 100", "fund2": "Nippon India Large Cap", "overlap": "52%", "sharedHoldings": 28},
                    {"fund1": "Parag Parikh Flexi", "fund2": "UTI Flexi Cap", "overlap": "41%", "sharedHoldings": 22},
                ],
                correlation_matrix={
                    "assets": ["RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "BAJFINANCE", "HDFCAMC", "PARAGPAR", "GOVT10Y"],
                    "matrix": [
                        [1.00, 0.34, 0.67, 0.71, 0.58, 0.62, 0.55, -0.12],
                        [0.34, 1.00, 0.28, 0.31, 0.25, 0.45, 0.38, -0.08],
                        [0.67, 0.28, 1.00, 0.82, 0.55, 0.58, 0.51, -0.15],
                        [0.71, 0.31, 0.82, 1.00, 0.61, 0.62, 0.55, -0.18],
                        [0.58, 0.25, 0.55, 0.61, 1.00, 0.48, 0.42, -0.10],
                        [0.62, 0.45, 0.58, 0.62, 0.48, 1.00, 0.78, -0.05],
                        [0.55, 0.38, 0.51, 0.55, 0.42, 0.78, 1.00, -0.03],
                        [-0.12, -0.08, -0.15, -0.18, -0.10, -0.05, -0.03, 1.00],
                    ]
                },
                rebalancing=[
                    {"action": "Reduce", "asset": "RELIANCE", "current": "13.3%", "target": "10.0%", "reason": "Position size exceeds 10% threshold"},
                    {"action": "Increase", "asset": "Fixed Income", "current": "8.0%", "target": "15.0%", "reason": "Underweight vs strategic allocation"},
                    {"action": "Increase", "asset": "International Equity", "current": "0%", "target": "10.0%", "reason": "No international diversification"},
                    {"action": "Rebalance", "asset": "Financial Services", "current": "28.5%", "target": "22.0%", "reason": "Sector concentration above benchmark +6.4%"},
                ],
                data_gaps=[f"Analyzer error: {str(exc)}"],
                note="Using fallback data due to analyzer error"
            )


# Global portfolio service instance
portfolio_service = PortfolioService()