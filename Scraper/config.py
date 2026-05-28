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
]

RESULTS_WANTED: int = 50
HOURS_OLD: int = 24
COUNTRY: str = "India"

# ── Schedule ─────────────────────────────────────────────────────────────────
RUN_INTERVAL_HOURS: int = 6

# ── Resilience ───────────────────────────────────────────────────────────────
MAX_RETRIES: int = 3
RETRY_BACKOFF_BASE: float = 2.0  # seconds; exponential: base * 2^attempt
CIRCUIT_BREAKER_THRESHOLD: int = 5  # consecutive failures before blocking
CIRCUIT_BREAKER_COOLDOWN_HOURS: int = 24
SCRAPER_TIMEOUT_SECONDS: int = 120  # per-scraper hard timeout
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
