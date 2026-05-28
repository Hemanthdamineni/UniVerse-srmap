import logging
import time
from typing import Optional

import pandas as pd

import config
from normalizer import from_jobspy
from db import CareerDB

logger = logging.getLogger("Scraper.JobSpy")


def run_jobspy(db: CareerDB) -> dict:
    """Scrape jobs via python-jobspy across configured search terms.

    Each search term is independent; a failure in one term does not
    abort the entire scraper. Returns aggregated counts.
    """
    logger.info("Starting JobSpy scraper...")
    counts = {"new": 0, "updated": 0, "skipped": 0, "errors": 0}
    terms_succeeded = 0
    terms_failed = 0

    for term in config.SEARCH_TERMS:
        try:
            logger.info(f"Scraping jobs for: {term}")

            # Lazy import to avoid top-level crash if jobspy changes
            from jobspy import scrape_jobs

            jobs: pd.DataFrame = scrape_jobs(
                # Glassdoor intentionally excluded: aggressive anti-bot, frequent 403s,
                # captcha walls, and IP throttling make it unreliable at pipeline scale.
                # Reintroduce only after proxy rotation + retry pools are in place.
                site_name=["linkedin", "indeed"],
                search_term=term,
                location=config.COUNTRY,
                results_wanted=config.RESULTS_WANTED,
                hours_old=config.HOURS_OLD,
                country_indeed=config.COUNTRY,
            )

            if jobs is None or jobs.empty:
                logger.info(f"No jobs found for '{term}'")
                terms_succeeded += 1
                continue

            term_count = 0
            for _, row in jobs.iterrows():
                try:
                    opp = from_jobspy(row)
                    if opp is None:
                        counts["skipped"] += 1
                        continue
                    result = db.upsert_opportunity(opp)
                    counts[result] = counts.get(result, 0) + 1
                    term_count += 1
                except Exception as e:
                    logger.error(f"Error processing job row: {e}")
                    counts["errors"] += 1

            logger.info(f"  '{term}': processed {term_count} opportunities")
            terms_succeeded += 1

            # Polite delay between search terms
            time.sleep(2)

        except Exception as e:
            logger.error(f"Error scraping '{term}' with JobSpy: {e}")
            terms_failed += 1
            counts["errors"] += 1
            time.sleep(5)  # Backoff on failure

    logger.info(
        f"JobSpy completed. Terms: {terms_succeeded} ok, {terms_failed} failed. "
        f"New: {counts['new']}, Updated: {counts['updated']}, "
        f"Skipped: {counts['skipped']}, Errors: {counts['errors']}"
    )

    # Only raise if ALL terms failed (total failure)
    if terms_failed > 0 and terms_succeeded == 0:
        raise RuntimeError(f"JobSpy: all {terms_failed} search terms failed")

    return counts
