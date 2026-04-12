import logging
import pandas as pd
from jobspy import scrape_jobs
import config
from normalizer import from_jobspy
from db import CareerDB

logger = logging.getLogger(__name__)

def run_jobspy(db: CareerDB):
    logger.info("Starting JobSpy scraper...")
    total_new = 0
    
    for term in config.SEARCH_TERMS:
        try:
            logger.info(f"Scraping jobs for: {term}")
            jobs: pd.DataFrame = scrape_jobs(
                site_name=["linkedin", "indeed", "glassdoor"],
                search_term=term,
                location=config.COUNTRY,
                results_wanted=config.RESULTS_WANTED,
                hours_old=config.HOURS_OLD,
                country_indeed=config.COUNTRY,
            )
            
            if jobs.empty:
                logger.info(f"No jobs found for {term}")
                continue

            for _, row in jobs.iterrows():
                try:
                    opp = from_jobspy(row)
                    if db.upsert_opportunity(opp):
                        total_new += 1
                except Exception as e:
                    logger.error(f"Error processing job row: {e}")
                    
        except Exception as e:
            logger.error(f"Error scraping {term} with JobSpy: {e}")
            raise e # Let the circuit breaker handle it

    logger.info(f"JobSpy run completed. Processed {total_new} opportunities.")
    return {"new": total_new}
