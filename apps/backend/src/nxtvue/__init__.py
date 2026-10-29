"""Public API for the investment report generator."""

from .report_generator import (
    run_investment_analysis,
    run_compare_analysis,
    run_portfolio_analysis,
)
from .wealth_manager import generate_wealth_management_plan
from .config import settings

__all__ = [
    "run_investment_analysis",
    "run_compare_analysis",
    "run_portfolio_analysis",
    "generate_wealth_management_plan",
    "settings",
]
