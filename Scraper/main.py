"""
Career scraper service entry point (plan: Scraper/main.py).
Delegates to scheduler which runs JobSpy, Devfolio, Unstop, and Internshala on an interval.
"""
from scheduler import start_scheduler

if __name__ == "__main__":
    start_scheduler()
