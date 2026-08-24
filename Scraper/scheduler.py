"""
Career scraper scheduler.

Runs each scraper source with:
  - Exponential backoff retry
  - Per-source circuit breaker (from DB health table)
  - Full isolation (one source failing never kills another)
  - Structured logging with timing
"""

import asyncio
import logging
import os
import random
import signal
import time
import traceback
from datetime import datetime
from typing import Callable, Optional

import schedule

import config
from db import CareerDB
from scrapers.jobspy_scraper import run_jobspy
from scrapers.devfolio_scraper import run_devfolio
from scrapers.unstop_scraper import run_unstop
from scrapers.internshala_scraper import run_internshala
from scrapers.devpost_scraper import run_devpost
from scrapers.ats_scraper import run_ats
from scrapers.remote_scraper import run_remoteok, run_remotive

# Set by the SIGTERM/SIGINT handler; checked between sources and in the
# scheduler loop so a supervisor stop never starts new work.
_stop_requested = False


def _request_stop(signum, frame) -> None:
    global _stop_requested
    _stop_requested = True
    logger.info(f"Received signal {signum}; will stop after current step")


import logging.handlers

# ── Logging Setup ─────────────────────────────────────────────────────────────
import os
os.makedirs("logs", exist_ok=True)

logger = logging.getLogger("Scheduler")
logger.setLevel(getattr(logging, config.LOG_LEVEL, logging.INFO))

# Add RotatingFileHandler to prevent unbounded log growth
file_handler = logging.handlers.RotatingFileHandler(
    "logs/scraper.log", maxBytes=10 * 1024 * 1024, backupCount=5
)
file_handler.setFormatter(logging.Formatter(config.LOG_FORMAT))

# Add console handler
console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter(config.LOG_FORMAT))

# Configure root logger
logging.basicConfig(level=getattr(logging, config.LOG_LEVEL, logging.INFO), handlers=[file_handler, console_handler])


# ── Retry with Exponential Backoff ────────────────────────────────────────────

def _run_with_retry(
    source: str,
    fn: Callable,
    db: CareerDB,
    max_retries: int = config.MAX_RETRIES,
) -> tuple[Optional[dict], Optional[Exception]]:
    """Execute a scraper function with exponential backoff retries.

    Returns (counts, None) on success, (None, exception) on total failure.
    The caller decides what to do with total failure.
    """
    last_exc: Optional[Exception] = None

    for attempt in range(1, max_retries + 1):
        try:
            if asyncio.iscoroutinefunction(fn):
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    # Guard async scrapers with a hard timeout
                    counts = loop.run_until_complete(
                        asyncio.wait_for(fn(db), timeout=config.SCRAPER_TIMEOUT_SECONDS)
                    )
                finally:
                    loop.close()
                    asyncio.set_event_loop(None)
            else:
                counts = fn(db)

            if attempt > 1:
                logger.info(f"[{source}] Succeeded on attempt {attempt}/{max_retries}")
            return counts, None

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
                logger.error(
                    f"[{source}] All {max_retries} attempts failed. Last error: {exc}"
                )

    return None, last_exc


# ── Circuit Breaker + Driver ──────────────────────────────────────────────────

def run_with_circuit_breaker(source: str, fn: Callable, db: CareerDB) -> None:
    """Run a scraper with circuit breaker protection.

    Checks DB health to see if source is blocked. If blocked, skip.
    On total failure, updates health (incrementing consecutive fails).
    On success, resets health.
    """
    health = db.get_source_health(source)

    if health.get("isBlocked"):
        last_attempt = health.get("lastAttempt")
        if last_attempt:
            try:
                last_dt = datetime.fromisoformat(last_attempt)
                hours_since = (datetime.now() - last_dt).total_seconds() / 3600
                # Jitter ±20% so multiple sources failing together don't all
                # retry in lockstep after the same cooldown.
                cooldown_hours = config.CIRCUIT_BREAKER_COOLDOWN_HOURS * random.uniform(0.8, 1.2)
                if hours_since < cooldown_hours:
                    logger.warning(
                        f"[{source}] Circuit breaker OPEN. "
                        f"Blocked {hours_since:.1f}h ago. Skipping for now."
                    )
                    return
                else:
                    # Cooldown expired — reset block and try again
                    logger.info(f"[{source}] Circuit breaker cooldown expired. Attempting recovery.")
            except (ValueError, TypeError):
                pass

    run_id = db.start_run(source)
    if not run_id:
        logger.error(f"[{source}] Failed to register run in DB. Skipping.")
        return

    start_ts = time.monotonic()
    logger.info(f"[{source}] ── Starting scraper run (run_id={run_id}) ──")

    counts, exc = _run_with_retry(source, fn, db)

    elapsed_ms = int((time.monotonic() - start_ts) * 1000)

    if exc is not None:
        # Total failure after all retries
        logger.error(
            f"[{source}] FAILED after all retries ({elapsed_ms}ms). "
            f"Error: {exc}\n{traceback.format_exc()}"
        )
        db.complete_run(run_id, status="failed", error=str(exc), duration_ms=elapsed_ms)
        db.update_source_health(source, success=False, notes=str(exc))
    else:
        counts = counts or {}
        logger.info(
            f"[{source}] ✓ Completed in {elapsed_ms}ms — "
            f"new={counts.get('new', 0)}, "
            f"updated={counts.get('updated', 0)}, "
            f"skipped={counts.get('skipped', 0)}, "
            f"errors={counts.get('errors', 0)}"
        )
        db.complete_run(run_id, status="completed", counts=counts, duration_ms=elapsed_ms)
        db.update_source_health(source, success=True)


# ── Scheduled Job ─────────────────────────────────────────────────────────────

def job() -> None:
    """Run all scrapers, isolating failures per source."""
    run_start = time.monotonic()
    logger.info("=" * 60)
    logger.info("SCRAPER PIPELINE: Starting scheduled run")
    logger.info(f"  DB path: {config.DB_PATH}")
    logger.info(f"  Timestamp: {datetime.now().isoformat()}")
    logger.info("=" * 60)

    db = CareerDB()
    try:
        sources = [
            ("jobspy", run_jobspy),
            ("devfolio", run_devfolio),
            ("unstop", run_unstop),
            ("internshala", run_internshala),
            ("devpost", run_devpost),
            ("ats", run_ats),
            ("remoteok", run_remoteok),
            ("remotive", run_remotive),
        ]
        enabled = [(n, f) for n, f in sources if config.SOURCE_ENABLED.get(n, True)]
        disabled = [n for n, _ in sources if not config.SOURCE_ENABLED.get(n, True)]
        if disabled:
            logger.info(f"Sources disabled via SCRAPER_ENABLE_*: {', '.join(disabled)}")

        for source_name, scraper_fn in enabled:
            if _stop_requested:
                logger.info("Stop requested — skipping remaining sources")
                break
            try:
                run_with_circuit_breaker(source_name, scraper_fn, db)
            except Exception as e:
                # Should never reach here (circuit breaker catches), but belt-and-suspenders
                logger.critical(
                    f"[{source_name}] Uncaught exception escaped circuit breaker: {e}",
                    exc_info=True,
                )

        # Expiry pass
        logger.info("Running opportunity expiry pass...")
        expired = db.expire_old_opportunities()
        logger.info(f"Expiry pass complete: {expired} opportunities deactivated")

    finally:
        db.close()

    total_ms = int((time.monotonic() - run_start) * 1000)
    logger.info("=" * 60)
    logger.info(f"SCRAPER PIPELINE: Run complete in {total_ms}ms")
    logger.info("=" * 60)


# ── Scheduler Loop ────────────────────────────────────────────────────────────

def _consume_run_now_flag() -> bool:
    """True when the backend supervisor requested an immediate run."""
    try:
        if os.path.exists(config.RUN_NOW_FLAG_PATH):
            os.remove(config.RUN_NOW_FLAG_PATH)
            return True
    except OSError:
        pass
    return False


def start_scheduler() -> None:
    global _stop_requested
    parent_pid = os.getppid()

    signal.signal(signal.SIGTERM, _request_stop)
    signal.signal(signal.SIGINT, _request_stop)

    logger.info("=" * 60)
    logger.info("SCRAPER SERVICE STARTING")
    logger.info(f"  Parent pid: {parent_pid}")
    logger.info(f"  Run interval: every {config.RUN_INTERVAL_HOURS} hours")
    logger.info(f"  Sources enabled: {', '.join(n for n, on in config.SOURCE_ENABLED.items() if on)}")
    logger.info(f"  Max retries per source: {config.MAX_RETRIES}")
    logger.info(f"  Circuit breaker threshold: {config.CIRCUIT_BREAKER_THRESHOLD} consecutive fails")
    logger.info(f"  DB: {config.DB_PATH}")
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
                # Original parent (backend server or shell) died and this
                # process was re-parented — shut down instead of orphaning.
                logger.info("Parent process exited; scraper shutting down")
                break

            schedule.run_pending()

            # Sleep in short slices so SIGTERM, parent death, and run-now
            # triggers all land within ~1s instead of after a full sleep.
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
        except Exception as e:
            logger.critical(f"Scheduler loop crashed unexpectedly: {e}", exc_info=True)
            logger.info("Recovering scheduler loop in 30 seconds...")
            time.sleep(30)

    logger.info("SCRAPER SERVICE STOPPED")


if __name__ == "__main__":
    start_scheduler()
