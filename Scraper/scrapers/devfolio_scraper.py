import asyncio
import logging
from playwright.async_api import async_playwright
from normalizer import from_devfolio
from db import CareerDB

logger = logging.getLogger(__name__)

async def extract_card_data(card):
    # This is a placeholder for the actual extraction logic
    # In a real scenario, we would use CSS selectors to get data from the card
    try:
        title_el = await card.query_selector("h3")
        title = await title_el.inner_text() if title_el else "Unknown Hackathon"
        
        organizer_el = await card.query_selector(".organizer-name") # Example selector
        organizer = await organizer_el.inner_text() if organizer_el else "Unknown"
        
        link_el = await card.query_selector("a")
        url = await link_el.get_attribute("href") if link_el else ""
        if url and not url.startswith("http"):
            url = f"https://devfolio.co{url}"
            
        return {
            "title": title,
            "organizer": organizer,
            "url": url,
            "description": "Hackathon on Devfolio",
            "is_online": True # Most Devfolio ones are
        }
    except Exception as e:
        logger.error(f"Error extracting card data: {e}")
        return None

async def run_devfolio(db: CareerDB):
    logger.info("Starting Devfolio scraper...")
    total_new = 0
    
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto("https://devfolio.co/hackathons", wait_until="networkidle")
            
            # Wait for cards to load
            await page.wait_for_selector("[data-testid='hackathon-card']", timeout=10000)
            cards = await page.query_selector_all("[data-testid='hackathon-card']")
            
            logger.info(f"Found {len(cards)} hackathon cards on Devfolio")
            
            for card in cards:
                raw = await extract_card_data(card)
                if raw and raw['url']:
                    opp = from_devfolio(raw)
                    if db.upsert_opportunity(opp):
                        total_new += 1
            
            await browser.close()
        except Exception as e:
            logger.error(f"Error in Devfolio scraper: {e}")
            raise e

    logger.info(f"Devfolio run completed. Processed {total_new} opportunities.")
    return {"new": total_new}
