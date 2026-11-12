"""Loads the trader-* skill scripts (``.agents/skills``) as modules and shares helpers.

The skills are standard-library Python files with module-level pure functions, so the
backend imports them directly instead of re-implementing their rules.
"""

import datetime
import importlib.util
import json
import os
import re
import sys
import threading
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Optional

_ROOT = Path(__file__).resolve().parents[5]
SKILLS_DIR = Path(os.environ.get("TRADER_SKILLS_DIR") or _ROOT / ".agents" / "skills")
TRADER_DIR = Path(os.environ.get("TRADER_DIR") or _ROOT / "trader")

SKILL_FILES = {
    "alerts": "trader-alerts/alerts.py",
    "news": "trader-news/news.py",
    "entry": "trader-entry/entry.py",
    "exit": "trader-exit/exit.py",
    "timemachine": "trader-timemachine/timemachine.py",
    "budget": "trader-budget/size.py",
    "risk": "trader-risk/check.py",
    "scanner": "trader-scanner/scan.py",
    "analyst": "trader-analyst/facts.py",
    "pelosi": "trader-pelosi/ptr.py",
}

_loaded: Dict[str, Any] = {}
_lock = threading.Lock()

# US tickers the NYSE skills understand (BRK.B, BF-B)
US_TICKER = re.compile(r"^[A-Z]{1,5}([.\-][A-Z]{1,2})?$")


def skill(name: str, market: str = "us") -> Any:
    """Import a skill module once and reuse it.

    ``market="india"`` returns a separate copy of the module rebound to the NSE session
    (see ``desk_india``); the US copy is never touched. Calling it also refreshes the NSE calendar.
    """
    key = name if market == "us" else f"{market}:{name}"
    mod = _loaded.get(key)
    if mod is None:
        with _lock:
            mod = _loaded.get(key)
            if mod is None:
                path = SKILLS_DIR / SKILL_FILES[name]
                spec = importlib.util.spec_from_file_location(f"nxtvue_skill_{key.replace(':', '_')}", path)
                if spec is None or spec.loader is None:
                    raise RuntimeError(f"cannot load skill {name} from {path}")
                mod = importlib.util.module_from_spec(spec)
                sys.modules[spec.name] = mod
                spec.loader.exec_module(mod)
                _loaded[key] = mod
    if market == "india":
        from . import desk_india

        desk_india.patch(name, mod)
    return mod


def utc_now() -> datetime.datetime:
    """Naive UTC, the clock every skill function takes."""
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0, tzinfo=None)


def trader_config(market: str = "us") -> Dict[str, Any]:
    """``trader/config.json`` (India: ``config.india.json``, rupee limits) if the user made one;
    otherwise each skill's own defaults apply."""
    path = TRADER_DIR / ("config.json" if market == "us" else f"config.{market}.json")
    if path.is_file():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except (OSError, ValueError):
            return {}
    return {}


def sec_user_agent() -> Optional[str]:
    """SEC EDGAR requires a contact User-Agent: env SEC_USER_AGENT or trader/config.json."""
    ua = (os.environ.get("SEC_USER_AGENT") or "").strip()
    if not ua:
        ua = str(trader_config().get("sec_user_agent") or "").strip()
    if not ua or "@" not in ua or "you@example.com" in ua:
        return None
    return ua


def plain(obj: Any) -> Any:
    """Make skill output JSON-safe: Decimal to float, dates to ISO, sets to sorted lists."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {str(k): plain(v) for k, v in obj.items() if not str(k).startswith("_")}
    if isinstance(obj, (list, tuple)):
        return [plain(v) for v in obj]
    if isinstance(obj, (set, frozenset)):
        return sorted(plain(v) for v in obj)
    return obj
