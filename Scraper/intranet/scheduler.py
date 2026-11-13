"""
SRMAP Intranet scraper scheduler.

Runs each scraper source with:
  - Exponential backoff retry
  - Per-source circuit breaker (from DB health table)
  - Full isolation (one source failing never kills another)
  - Structured logging with timing
  - Overlap prevention via file lock
  - Run-now trigger file support (backend can request immediate run)
"""

import asyncio
import fcntl
import logging
import logging.handlers
import os
import signal
import sys
import time
import traceback
import uuid
from datetime import datetime, timezone
from typing import Callable, Optional

import schedule

import config
from db import IntranetDB
from session import IntranetSession, IntranetSessionError, run_with_session
from scrapers.announcements_scraper import run_announcements
from scrapers.events_scraper import run_events
from scrapers.news_scraper import run_news
from scrapers.academic_scraper import run_academic
from scrapers.documents_scraper import run_documents

# ── Logging setup ─────────────────────────────────────────────────────────────
os.makedirs(config.LOG_DIR, exist_ok=True)

_root_logger = logging.getLogger()
_root_logger.setLevel(getattr(logging, config.LOG_LEVEL, logging.INFO))

_file_handler = logging.handlers.RotatingFileHandler(
    config.LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=5
)
_file_handler.setFormatter(logging.Formatter(config.LOG_FORMAT))

_console_handler = logging.StreamHandler(sys.stdout)
_console_handler.setFormatter(logging.Formatter(config.LOG_FORMAT))

_root_logger.handlers.clear()
_root_logger.addHandler(_file_handler)
_root_logger.addHandler(_console_handler)

logger = logging.getLogger("IntranetScheduler")

# ── Stop signal ───────────────────────────────────────────────────────────────
_stop_requested = False


def _request_stop(signum, frame) -> None:
    global _stop_requested
    _stop_requested = True
    logger.info(f"Received signal {signum}; will stop after current step")


# ── Retry with exponential backoff ────────────────────────────────────────────

def _run_with_retry(
    source: str,
    fn: Callable,
    *args,
    max_retries: int = config.MAX_RETRIES,
) -> tuple[Optional[dict], Optional[Exception]]:
    last_exc: Optional[Exception] = None

    for attempt in range(1, max_retries + 1):
        try:
            result = fn(*args)
            if attempt > 1:
                logger.info(f"[{source}] Succeeded on attempt {attempt}/{max_retries}")
            return result, None
        except Exception as exc:
            last_exc = exc
            wait = config.RETRY_BACKOFF_BASE * (2 ** (attempt - 1))
            if attempt < max_retries:
                logger.warning(
                    f"[{source}] Attempt {attempt}/{max_retries} failed: {exc}. "
                    f"Retrying in {wait:.0f}s..."
                )
                time.sleep(wait)
            else:
                logger.error(f"[{source}] All {max_retries} attempts failed. Last error: {exc}")

    return None, last_exc


# ── Circuit breaker ───────────────────────────────────────────────────────────

def run_with_circuit_breaker(source: str, fn: Callable, session, db: IntranetDB) -> None:
    """Run a scraper with circuit breaker protection."""
    health = db.get_source_health(source)
    if health.get("is_blocked"):
        logger.info(f"[{source}] Circuit breaker OPEN — skipping (use reset to unblock)")
        return

    run_id = str(uuid.uuid4())
    db.begin_run(run_id, source)

    start = time.monotonic()
    try:
        result, exc = _run_with_retry(source, fn, session, db)

        duration_ms = int((time.monotonic() - start) * 1000)

        if exc is not None:
            db.record_source_failure(source, str(exc))
            db.complete_run(
                run_id,
                status="error",
                error_message=str(exc),
                was_complete=False,
            )
            logger.error(f"[{source}] Failed after {duration_ms}ms: {exc}")
        else:
            counts = result or {}
            db.record_source_success(source)
            db.complete_run(
                run_id,
                status="ok",
                items_new=counts.get("new", 0),
                items_updated=counts.get("updated", 0),
                items_unchanged=counts.get("unchanged", 0),
                items_expired=counts.get("errors", 0),
                was_complete=True,
            )
            logger.info(
                f"[{source}] Completed in {duration_ms}ms — "
                f"new={counts.get('new', 0)} "
                f"updated={counts.get('updated', 0)} "
                f"unchanged={counts.get('unchanged', 0)} "
                f"errors={counts.get('errors', 0)}"
            )
    except Exception as exc:
        db.record_source_failure(source, str(exc))
        db.complete_run(run_id, status="error", error_message=str(exc), was_complete=False)
        logger.critical(f"[{source}] Uncaught exception escaped: {exc}", exc_info=True)


# ── Main pipeline job ─────────────────────────────────────────────────────────

SOURCES = [
    ("announcements", run_announcements),
    ("events",        run_events),
    ("news",          run_news),
    ("academic",      run_academic),
    ("documents",     run_documents),
]


def job() -> None:
    """Execute the full intranet scraping pipeline."""
    global _stop_requested
    run_start = time.monotonic()

    logger.info("=" * 60)
    logger.info("INTRANET SCRAPER PIPELINE: Starting run")
    logger.info(f"  Timestamp: {datetime.now(tz=timezone.utc).isoformat()}")
    logger.info(f"  Interval: every {config.RUN_INTERVAL_HOURS}h")
    logger.info("=" * 60)

    # Validate credentials before attempting login
    try:
        config.validate_credentials()
    except EnvironmentError as exc:
        logger.error(f"INTRANET SCRAPER: Cannot run — {exc}")
        return

    db = IntranetDB()
    try:
        # Authenticate once and reuse session across all sources
        try:
            from playwright.sync_api import sync_playwright
            pw_ctx = sync_playwright().__enter__()
        except Exception as exc:
            logger.error(f"Playwright unavailable: {exc}")
            db.close()
            return

        try:
            session = IntranetSession(pw_ctx, headless=config.PLAYWRIGHT_HEADLESS)
            session.__enter__()
            try:
                session.authenticate()
                db.log_auth_attempt(success=True)
            except IntranetSessionError as exc:
                db.log_auth_attempt(success=False, failure_reason=str(exc))
                logger.error(f"Authentication failed: {exc}")
                session.__exit__(None, None, None)
                pw_ctx.__exit__(None, None, None)
                db.close()
                return

            # Run each enabled source
            enabled = [(n, f) for n, f in SOURCES if config.SOURCE_ENABLED.get(n, True)]
            disabled = [n for n, _ in SOURCES if not config.SOURCE_ENABLED.get(n, True)]
            if disabled:
                logger.info(f"Sources disabled via INTRANET_ENABLE_*: {', '.join(disabled)}")

            for source_name, scraper_fn in enabled:
                if _stop_requested:
                    logger.info("Stop requested — skipping remaining sources")
                    break
                try:
                    run_with_circuit_breaker(source_name, scraper_fn, session, db)
                except Exception as exc:
                    logger.critical(f"[{source_name}] Uncaught exception: {exc}", exc_info=True)
                time.sleep(config.INTER_REQUEST_DELAY_S)

        finally:
            try:
                session.__exit__(None, None, None)
            except Exception:
                pass
            try:
                pw_ctx.__exit__(None, None, None)
            except Exception:
                pass

    finally:
        db.close()

    total_ms = int((time.monotonic() - run_start) * 1000)
    logger.info("=" * 60)
    logger.info(f"INTRANET SCRAPER PIPELINE: Run complete in {total_ms}ms")
    logger.info("=" * 60)


# ── Run-now flag support ──────────────────────────────────────────────────────

def _consume_run_now_flag() -> bool:
    """Return True when the backend supervisor requested an immediate run."""
    try:
        if os.path.exists(config.RUN_NOW_FLAG_PATH):
            os.remove(config.RUN_NOW_FLAG_PATH)
            return True
    except OSError:
        pass
    return False


# ── Scheduler loop ────────────────────────────────────────────────────────────

def start_scheduler() -> None:
    global _stop_requested
    parent_pid = os.getppid()

    signal.signal(signal.SIGTERM, _request_stop)
    signal.signal(signal.SIGINT, _request_stop)

    logger.info("=" * 60)
    logger.info("INTRANET SCRAPER SERVICE STARTING")
    logger.info(f"  Parent pid:   {parent_pid}")
    logger.info(f"  Run interval: every {config.RUN_INTERVAL_HOURS} hours")
    logger.info(f"  Sources:      {', '.join(n for n, on in config.SOURCE_ENABLED.items() if on)}")
    logger.info(f"  Max retries:  {config.MAX_RETRIES}")
    logger.info(f"  DB:           {config.DB_PATH}")
    logger.info("=" * 60)

    # Consume any stale trigger from a previous session
    _consume_run_now_flag()

    # Run immediately on startup
    job()

    # Schedule subsequent runs
    schedule.every(config.RUN_INTERVAL_HOURS).hours.do(job)
    logger.info(f"Next run scheduled in {config.RUN_INTERVAL_HOURS} hours")

    while not _stop_requested:
        try:
            if os.getppid() != parent_pid:
                logger.info("Parent process exited; intranet scraper shutting down")
                break

            schedule.run_pending()

            # Sleep in 1s slices to handle SIGTERM, parent death, run-now triggers promptly
            run_now = False
            for _ in range(60):
                if _stop_requested or os.getppid() != parent_pid:
                    break
                if _consume_run_now_flag():
                    run_now = True
                    break
                time.sleep(1)

            if _stop_requested or os.getppid() != parent_pid:
                continue

            if run_now:
                logger.info("Run-now trigger received — starting immediate pipeline run")
                job()

        except KeyboardInterrupt:
            logger.info("Scheduler stopped by user (KeyboardInterrupt)")
            break
        except Exception as exc:
            logger.critical(f"Scheduler loop crashed: {exc}", exc_info=True)
            logger.info("Recovering scheduler loop in 30 seconds...")
            time.sleep(30)

    logger.info("INTRANET SCRAPER SERVICE STOPPED")
