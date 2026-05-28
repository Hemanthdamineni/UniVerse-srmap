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

# Ensure the Scraper/ directory is on the path regardless of CWD
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scheduler import start_scheduler

if __name__ == "__main__":
    start_scheduler()
