"""
SRMAP Intranet scraper entry point.

Usage:
    # Via venv (recommended):
    ../venv/bin/python3 main.py

    # One-shot run (no scheduler daemon):
    ../venv/bin/python3 main.py --once

    # Test credentials only:
    ../venv/bin/python3 main.py --auth-check

Shares the existing Scraper/venv (all dependencies already installed via
Scraper/requirements.txt + playwright).
"""

import sys
import os
import fcntl

# Ensure the intranet/ directory is on the path regardless of CWD
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scheduler import job, start_scheduler

INSTANCE_LOCK_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".intranet.lock")


def acquire_instance_lock():
    """Hold an exclusive flock for the process lifetime.

    Returns the lock file handle, or None when another instance holds it.
    The kernel releases the lock automatically on exit.
    """
    handle = open(INSTANCE_LOCK_PATH, "w")
    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        handle.write(str(os.getpid()))
        handle.flush()
        return handle
    except OSError:
        handle.close()
        return None


if __name__ == "__main__":
    if "--auth-check" in sys.argv:
        # Quick credential and connectivity check
        import config
        try:
            config.validate_credentials()
            print(f"[AUTH-CHECK] Credentials configured for: {config.INTRANET_STUDENT_ID}")
        except EnvironmentError as exc:
            print(f"[AUTH-CHECK] FAILED: {exc}")
            sys.exit(1)

        from session import IntranetSession, IntranetSessionError
        from playwright.sync_api import sync_playwright

        try:
            with sync_playwright() as pw:
                with IntranetSession(pw, headless=True) as session:
                    session.authenticate()
                    page = session.get_page()
                    print(f"[AUTH-CHECK] SUCCESS — authenticated at: {page.url}")
        except IntranetSessionError as exc:
            print(f"[AUTH-CHECK] AUTH FAILED: {exc}")
            sys.exit(1)
        except Exception as exc:
            print(f"[AUTH-CHECK] ERROR: {exc}")
            sys.exit(1)
        sys.exit(0)

    lock_handle = acquire_instance_lock()
    if lock_handle is None:
        print("Another intranet scraper instance already holds the lock; exiting.")
        sys.exit(0)

    if "--once" in sys.argv:
        # One-shot pipeline run (used by the backend supervisor for manual triggers)
        job()
        sys.exit(0)

    start_scheduler()
