import logging
import time
import schedule
import asyncio
from datetime import datetime
import config
from db import CareerDB
from scrapers.jobspy_scraper import run_jobspy
from scrapers.devfolio_scraper import run_devfolio
from scrapers.unstop_scraper import run_unstop
from scrapers.internshala_scraper import run_internshala

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("Scheduler")

def run_with_circuit_breaker(source: str, fn, db: CareerDB):
    health = db.get_source_health(source)
    
    # Check if blocked
    if health.get("isBlocked"):
        last_attempt = datetime.fromisoformat(health["lastAttempt"])
        hours_since = (datetime.now() - last_attempt).total_seconds() / 3600
        if hours_since < 24:
            logger.warning(f"Source {source} is currently blocked. Skipping. (Blocked {hours_since:.1f}h ago)")
            return

    run_id = db.start_run(source)
    if not run_id:
        return

    try:
        if asyncio.iscoroutinefunction(fn):
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            counts = loop.run_until_complete(fn(db))
            loop.close()
        else:
            counts = fn(db)
            
        db.complete_run(run_id, status="completed", counts=counts)
        db.update_source_health(source, success=True)
        logger.info(f"Successfully finished run for {source}")
    except Exception as e:
        logger.error(f"Error during run for {source}: {e}")
        db.complete_run(run_id, status="failed", error=str(e))
        db.update_source_health(source, success=False, notes=str(e))

def job():
    logger.info("--- Starting Scheduled Scraper Run ---")
    db = CareerDB()
    
    # Run scrapers
    run_with_circuit_breaker("jobspy", run_jobspy, db)
    run_with_circuit_breaker("devfolio", run_devfolio, db)
    run_with_circuit_breaker("unstop", run_unstop, db)
    run_with_circuit_breaker("internshala", run_internshala, db)
    
    # Expiry logic
    logger.info("Running expiry logic...")
    db.expire_old_opportunities()
    
    db.close()
    logger.info("--- Scheduled Scraper Run Finished ---")

def start_scheduler():
    logger.info(f"Starting scheduler. Runs every {config.RUN_INTERVAL_HOURS} hours.")
    
    # Run once immediately on start
    job()
    
    schedule.every(config.RUN_INTERVAL_HOURS).hours.do(job)
    
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    start_scheduler()
