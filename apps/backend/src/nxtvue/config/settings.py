"""Configuration — reads all env vars from .env in one place."""

import os


class Settings:
    yfinance_timeout      = int(os.getenv("YFINANCE_TIMEOUT", "30"))
    log_level             = os.getenv("LOG_LEVEL", "INFO")
    fred_api_key          = os.getenv("FRED_API_KEY", "")
    risk_free_rate_india  = float(os.getenv("RISK_FREE_RATE_INDIA", "0.065"))
    risk_free_rate_us     = float(os.getenv("RISK_FREE_RATE_US", "0.05"))

    # API server
    api_host              = os.getenv("API_HOST", "0.0.0.0")
    api_port              = int(os.getenv("API_PORT", "8000"))
    api_reload            = os.getenv("API_RELOAD", "false").lower() == "true"

    # Cache
    cache_ttl_seconds     = int(os.getenv("CACHE_TTL_SECONDS", "3600"))
    indices_cache_ttl     = int(os.getenv("INDICES_CACHE_TTL", "30"))

    # Report generation
    default_projection_year = int(os.getenv("DEFAULT_PROJECTION_YEAR", "2026"))
    reports_dir           = os.getenv("REPORTS_DIR", "reports")

    # Feature flags
    enable_etf_analysis         = os.getenv("ENABLE_ETF_ANALYSIS", "false").lower() == "true"
    enable_mf_analysis          = os.getenv("ENABLE_MF_ANALYSIS", "false").lower() == "true"
    enable_bond_analysis        = os.getenv("ENABLE_BOND_ANALYSIS", "false").lower() == "true"
    enable_portfolio_intelligence = os.getenv("ENABLE_PORTFOLIO_INTELLIGENCE", "false").lower() == "true"


settings = Settings()
