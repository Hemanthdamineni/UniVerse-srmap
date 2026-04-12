import asyncio
import logging
from playwright.async_api import async_playwright
from normalizer import normalize_opportunity
from db import CareerDB

logger = logging.getLogger(__name__)

async def extract_unstop_card(card):
    try:
        title_el = await card.query_selector(".opportunity_title")
        title = await title_el.inner_text() if title_el else "Unknown Event"
        
        organizer_el = await card.query_selector(".organization_name")
        organizer = await organizer_el.inner_text() if organizer_el else "Unknown"
        
        link_el = await card.query_selector("a")
        url = await link_el.get_attribute("href") if link_el else ""
        if url and not url.startswith("http"):
            url = f"https://unstop.com{url}"
            
        type_el = await card.query_selector(".opportunity_type")
        opp_type = await type_el.inner_text() if type_el else "competition"
        
        # Normalize type
        opp_type = opp_type.lower()
        if "workshop" in opp_type: normalized_type = "workshop"
        elif "hackathon" in opp_type: normalized_type = "hackathon"
        else: normalized_type = "competition"
            
        return {
            "title": title,
            "organizer": organizer,
            "url": url,
            "type": normalized_type,
            "description": f"{normalized_type.capitalize()} on Unstop",
            "is_online": True # Most are online initially
        }
    except Exception as e:
        logger.error(f"Error extracting Unstop card: {e}")
        return None

async def run_unstop(db: CareerDB):
    logger.info("Starting Unstop scraper...")
    total_new = 0
    
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto("https://unstop.com/competitions", wait_until="networkidle")
            
            # Wait for cards to load
            await page.wait_for_selector(".opportunity_card", timeout=15000)
            cards = await page.query_selector_all(".opportunity_card")
            
            logger.info(f"Found {len(cards)} cards on Unstop")
            
            for card in cards:
                raw = await extract_unstop_card(card)
                if raw and raw['url']:
                    # Use common normalizer
                    opp_data = {
                        "type": raw["type"],
                        "title": raw["title"],
                        "organizer": raw["organizer"],
                        "sourceUrl": raw["url"],
                        "description": raw["description"],
                        "mode": "online" if raw["is_online"] else "offline"
                    }
                    opp = normalize_opportunity(opp_data, "unstop")
                    if db.upsert_opportunity(opp):
                        total_new += 1
            
            await browser.close()
        except Exception as e:
            logger.error(f"Error in Unstop scraper: {e}")
            raise e

    logger.info(f"Unstop run completed. Processed {total_new} opportunities.")
    return {"new": total_new}
