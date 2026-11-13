"""
SRMAP Intranet scraper configuration.

All credentials are read from environment variables — never hardcoded.
"""

import os
import logging

# ── Authentication ────────────────────────────────────────────────────────────
INTRANET_BASE_URL: str = os.environ.get("INTRANET_BASE_URL", "https://intranet.srmap.edu.in")
INTRANET_STUDENT_ID: str = os.environ.get("INTRANET_STUDENT_ID", "")
INTRANET_PASSWORD: str = os.environ.get("INTRANET_PASSWORD", "")

# ── Database path (relative to Scraper/intranet/ directory) ──────────────────
DB_PATH: str = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__), "..", "..", "Backend", "data", "intranet.sqlite"
    )
)

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_LEVEL: str = os.environ.get("INTRANET_SCRAPER_LOG_LEVEL", "INFO").upper()
LOG_FORMAT: str = "%(asctime)s | %(name)-24s | %(levelname)-7s | %(message)s"
LOG_DIR: str = os.path.join(os.path.dirname(__file__), "logs")
LOG_FILE: str = os.path.join(LOG_DIR, "intranet_scraper.log")

# ── Schedule ──────────────────────────────────────────────────────────────────
# Interval between pipeline runs (default: 24 hours; configure with env).
RUN_INTERVAL_HOURS: int = int(os.environ.get("INTRANET_SCRAPER_RUN_INTERVAL_HOURS", "24"))
# Timezone for scheduled runs (informational; scheduler uses UTC intervals).
RUN_TIMEZONE: str = os.environ.get("INTRANET_SCRAPER_TIMEZONE", "Asia/Kolkata")
# Lock file — prevents overlapping runs.
LOCK_FILE: str = os.path.join(os.path.dirname(__file__), ".intranet.lock")
# Run-now trigger file (backend drops this; scraper picks it up within ~1s).
RUN_NOW_FLAG_PATH: str = os.path.join(os.path.dirname(__file__), ".intranet-run-now")

# ── Network ───────────────────────────────────────────────────────────────────
REQUEST_TIMEOUT_S: int = int(os.environ.get("INTRANET_SCRAPER_TIMEOUT_SECONDS", "30"))
# Total hard timeout for a single scraper source run.
SOURCE_TIMEOUT_S: int = int(os.environ.get("INTRANET_SCRAPER_SOURCE_TIMEOUT_SECONDS", "120"))
PAGE_NAVIGATION_TIMEOUT_MS: int = 30_000
# Small delay between page requests to avoid hammering the intranet.
INTER_REQUEST_DELAY_S: float = float(os.environ.get("INTRANET_SCRAPER_INTER_REQUEST_DELAY", "0.5"))
MAX_PAGINATION_PAGES: int = int(os.environ.get("INTRANET_SCRAPER_MAX_PAGINATION_PAGES", "20"))

# ── Playwright ────────────────────────────────────────────────────────────────
PLAYWRIGHT_HEADLESS: bool = True
PLAYWRIGHT_USER_AGENT: str = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# ── Resilience ────────────────────────────────────────────────────────────────
MAX_RETRIES: int = 3
RETRY_BACKOFF_BASE: float = 2.0  # exponential: base * 2^attempt
CIRCUIT_BREAKER_THRESHOLD: int = 5  # consecutive failures before blocking
CIRCUIT_BREAKER_COOLDOWN_HOURS: int = 24

# ── Source enable flags (INTRANET_ENABLE_<NAME>=0 to disable) ─────────────────
def _source_enabled(env_name: str) -> bool:
    return os.environ.get(env_name, "1") not in ("0", "false", "False")


SOURCE_ENABLED: dict[str, bool] = {
    "announcements": _source_enabled("INTRANET_ENABLE_ANNOUNCEMENTS"),
    "events":        _source_enabled("INTRANET_ENABLE_EVENTS"),
    "news":          _source_enabled("INTRANET_ENABLE_NEWS"),
    "notices":       _source_enabled("INTRANET_ENABLE_NOTICES"),
    "documents":     _source_enabled("INTRANET_ENABLE_DOCUMENTS"),
    "academic":      _source_enabled("INTRANET_ENABLE_ACADEMIC"),
    "facilities":    _source_enabled("INTRANET_ENABLE_FACILITIES"),
    "directory":     _source_enabled("INTRANET_ENABLE_DIRECTORY"),
    "links":         _source_enabled("INTRANET_ENABLE_LINKS"),
}

# ── Content audience classification ──────────────────────────────────────────
# See task spec §3: shared | cohort | student-specific | restricted
AUDIENCE_SHARED = "shared"
AUDIENCE_COHORT = "cohort"
AUDIENCE_STUDENT_SPECIFIC = "student_specific"
AUDIENCE_RESTRICTED = "restricted"

# ── Validation ────────────────────────────────────────────────────────────────
def validate_credentials() -> None:
    """Raise EnvironmentError if credentials are not configured."""
    missing = []
    if not INTRANET_STUDENT_ID:
        missing.append("INTRANET_STUDENT_ID")
    if not INTRANET_PASSWORD:
        missing.append("INTRANET_PASSWORD")
    if missing:
        raise EnvironmentError(
            f"Intranet scraper: required environment variables not set: {', '.join(missing)}. "
            "Set them in Backend/.env or the process environment."
        )
