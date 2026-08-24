import os
import logging

# ── Logging ──────────────────────────────────────────────────────────────────
LOG_LEVEL = os.environ.get("SCRAPER_LOG_LEVEL", "INFO").upper()
LOG_FORMAT = "%(asctime)s | %(name)-20s | %(levelname)-7s | %(message)s"

# ── Database path (relative to Scraper/ directory) ───────────────────────────
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend", "data", "career.sqlite"))

# ── Scraper Settings ─────────────────────────────────────────────────────────
SEARCH_TERMS: list[str] = [
    "Software Engineer Intern",
    "Data Science Intern",
    "Full Stack Developer",
    "Frontend Engineer",
    "Backend Engineer",
    "Product Management Intern",
    "Cybersecurity Intern",
    "UI/UX Designer",
    "Mobile Developer Intern",
    "SDE Intern",
    "Machine Learning Intern",
    "Data Analyst",
    "Data Engineer",
    "DevOps Engineer",
    "Cloud Engineer",
    "Site Reliability Engineer",
    "Associate Software Engineer",
]

RESULTS_WANTED: int = int(os.environ.get("SCRAPER_RESULTS_WANTED", "100"))
HOURS_OLD: int = int(os.environ.get("SCRAPER_HOURS_OLD", "72"))
COUNTRY: str = "India"

# ── Source enable flags (SCRAPER_ENABLE_<NAME>=0 to turn a source off) ──────
def _source_enabled(env_name: str) -> bool:
    return os.environ.get(env_name, "1") not in ("0", "false", "False")

SOURCE_ENABLED: dict[str, bool] = {
    "jobspy": _source_enabled("SCRAPER_ENABLE_JOBSPY"),
    "devfolio": _source_enabled("SCRAPER_ENABLE_DEVFOLIO"),
    "unstop": _source_enabled("SCRAPER_ENABLE_UNSTOP"),
    "internshala": _source_enabled("SCRAPER_ENABLE_INTERNSHALA"),
    "devpost": _source_enabled("SCRAPER_ENABLE_DEVPOST"),
    "ats": _source_enabled("SCRAPER_ENABLE_ATS"),
    "remoteok": _source_enabled("SCRAPER_ENABLE_REMOTEOK"),
    "remotive": _source_enabled("SCRAPER_ENABLE_REMOTIVE"),
}

# ── Company ATS boards (public Greenhouse / Lever JSON APIs) ────────────────
# Slugs verified live 2026-08-24. Add/remove freely; dead slugs are skipped
# per-company without failing the source.
GREENHOUSE_BOARDS: list[str] = [
    "okta",        # ~115 India postings
    "mongodb",     # ~67
    "zscaler",     # ~57
    "twilio",      # ~15
    "postman",     # ~9
    "cloudflare",  # ~3
]
LEVER_BOARDS: list[str] = [
    "zeta",  # ~21 India postings
    "cred",  # ~13
]
ATS_LOCATION_KEYWORDS: list[str] = [
    "india", "bengal", "bangalore", "bengaluru", "hyderabad", "chennai",
    "pune", "mumbai", "noida", "gurgaon", "gurugram", "delhi",
]
# Location filter keeps India postings only. Title filtering is OFF by
# default (jobspy also mixes jobs and internships); set
# SCRAPER_ATS_INCLUDE_ALL_ROLES=0 to keep only intern/trainee/graduate roles.
ATS_TITLE_FILTER: list[str] = [
    "intern", "trainee", "graduate", "co-op", "apprentice", "campus",
]
ATS_INCLUDE_ALL_ROLES: bool = os.environ.get("SCRAPER_ATS_INCLUDE_ALL_ROLES", "1") == "1"

# ── Network: proxy pool + adaptive host throttle ────────────────────────────
# Comma-separated proxy URLs (e.g. "http://user:pass@host:port,socks5://host:port").
# Empty = direct connections.
SCRAPER_PROXIES: str = os.environ.get("SCRAPER_PROXIES", "")
SCRAPER_BLOCK_STRIKES: int = int(os.environ.get("SCRAPER_BLOCK_STRIKES", "2"))
SCRAPER_COOLDOWN_BASE_S: float = float(os.environ.get("SCRAPER_COOLDOWN_BASE_S", "120"))
SCRAPER_COOLDOWN_MAX_S: float = float(os.environ.get("SCRAPER_COOLDOWN_MAX_S", "1800"))

# ── Schedule ─────────────────────────────────────────────────────────────────
RUN_INTERVAL_HOURS: int = int(os.environ.get("SCRAPER_RUN_INTERVAL_HOURS", "6"))
# Written by the backend supervisor ("Run now" trigger); the running
# scheduler picks it up within ~1s and starts an immediate pipeline run.
RUN_NOW_FLAG_PATH: str = os.path.join(os.path.dirname(__file__), ".run-now")

# ── Resilience ───────────────────────────────────────────────────────────────
MAX_RETRIES: int = 3
RETRY_BACKOFF_BASE: float = 2.0  # seconds; exponential: base * 2^attempt
CIRCUIT_BREAKER_THRESHOLD: int = 5  # consecutive failures before blocking
CIRCUIT_BREAKER_COOLDOWN_HOURS: int = 24
SCRAPER_TIMEOUT_SECONDS: int = int(os.environ.get("SCRAPER_TIMEOUT_SECONDS", "240"))
PAGE_NAVIGATION_TIMEOUT_MS: int = 30_000  # Playwright page navigation timeout

# ── Playwright ───────────────────────────────────────────────────────────────
# Use system Chromium if available, otherwise Playwright-managed
PLAYWRIGHT_HEADLESS: bool = True
PLAYWRIGHT_USER_AGENT: str = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# ── Intelligence ─────────────────────────────────────────────────────────────
TECH_SKILLS: set[str] = {
    "python", "javascript", "typescript", "react", "node.js", "express",
    "machine learning", "deep learning", "data science", "sql", "mongodb",
    "aws", "docker", "kubernetes", "git", "java", "c++", "c", "rust",
    "tensorflow", "pytorch", "pandas", "numpy", "scikit-learn",
    "flutter", "android", "ios", "swift", "kotlin", "django", "flask",
    "graphql", "rest api", "linux", "networking", "next.js", "tailwind",
    "firebase", "gcp", "azure", "jenkins", "terraform", "ansible",
    "solidity", "blockchain", "figma", "sketch", "adobe xd",
}

BRANCH_KEYWORDS: dict[str, list[str]] = {
    "CSE": ["computer science", "cse", "it", "information technology", "software"],
    "ECE": ["electronics", "communication", "ece", "embedded", "vlsi"],
    "EEE": ["electrical", "eee", "power systems"],
    "ME": ["mechanical", "me", "robotics", "automation"],
    "CIVIL": ["civil", "construction", "structural"],
}
