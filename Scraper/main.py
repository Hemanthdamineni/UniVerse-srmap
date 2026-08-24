"""
Career scraper service entry point.

Usage:
    # Via venv (recommended):
    venv/bin/python3 main.py

    # Or after activating venv:
    source venv/bin/activate
    python3 main.py

Delegates to scheduler which runs JobSpy, Devfolio, Unstop, and Internshala
on a configurable interval. Each source is isolated — one failure does not
kill the pipeline.
"""

import sys
import os
import fcntl

# Ensure the Scraper/ directory is on the path regardless of CWD
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scheduler import start_scheduler

INSTANCE_LOCK_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".scraper.lock")


def acquire_instance_lock():
    """Hold an exclusive flock for the process lifetime.

    Returns the lock file handle, or None when another scraper instance
    (e.g. spawned by a second backend process) already holds it. The kernel
    releases the lock automatically on exit, so crashed runs leave no stale
    state.
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
    lock_handle = acquire_instance_lock()
    if lock_handle is None:
        print("Another career scraper instance already holds the lock; exiting.")
        sys.exit(0)
    if "--once" in sys.argv:
        # One-shot pipeline run (used when no scheduler daemon is alive).
        from scheduler import job
        job()
        sys.exit(0)
    start_scheduler()
