"""Public API for the investment report generator."""

from .report_generator import (
    run_investment_analysis,
    run_compare_analysis,
    run_portfolio_analysis,
)
from .config import settings

__all__ = [
    "run_investment_analysis",
    "run_compare_analysis",
    "run_portfolio_analysis",
    "settings",
]
