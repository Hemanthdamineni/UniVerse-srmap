import asyncio
import logging
from playwright.async_api import async_playwright
from normalizer import normalize_opportunity
from db import CareerDB

logger = logging.getLogger(__name__)

async def extract_internshala_card(card):
    try:
        title_el = await card.query_selector(".profile")
        title = await title_el.inner_text() if title_el else "Unknown Internship"
        
        company_el = await card.query_selector(".company_name")
        company = await company_el.inner_text() if company_el else "Unknown"
        
        link_el = await card.query_selector("a.view_detail_button")
        url = await link_el.get_attribute("href") if link_el else ""
        if url and not url.startswith("http"):
            url = f"https://internshala.com{url}"
            
        location_el = await card.query_selector(".location_link")
        location = await location_el.inner_text() if location_el else "Remote"
        
        stipend_el = await card.query_selector(".stipend")
        stipend = await stipend_el.inner_text() if stipend_el else None
        
        duration_el = await card.query_selector(".item_body") # Simplified, actual selector is complex
        duration = await duration_el.inner_text() if duration_el else None
            
        return {
            "title": title,
            "company": company,
            "url": url,
            "location": location,
            "stipend": stipend,
            "duration": duration,
            "type": "internship"
        }
    except Exception as e:
        logger.error(f"Error extracting Internshala card: {e}")
        return None

async def run_internshala(db: CareerDB):
    logger.info("Starting Internshala scraper...")
    total_new = 0
    
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            # Internship search page for students
            await page.goto("https://internshala.com/internships", wait_until="networkidle")
            
            # Wait for internship list cards
            await page.wait_for_selector(".internship_meta", timeout=15000)
            cards = await page.query_selector_all(".internship_meta")
            
            logger.info(f"Found {len(cards)} cards on Internshala")
            
            for card in cards:
                raw = await extract_internshala_card(card)
                if raw and raw['url']:
                    # Use common normalizer
                    opp_data = {
                        "type": "internship",
                        "title": raw["title"],
                        "company": raw["company"],
                        "sourceUrl": raw["url"],
                        "location": raw["location"],
                        "stipend": raw["stipend"],
                        "duration": raw["duration"],
                        "mode": "remote" if "work from home" in raw["location"].lower() else "onsite"
                    }
                    opp = normalize_opportunity(opp_data, "internshala")
                    if db.upsert_opportunity(opp):
                        total_new += 1
            
            await browser.close()
        except Exception as e:
            logger.error(f"Error in Internshala scraper: {e}")
            raise e

    logger.info(f"Internshala run completed. Processed {total_new} opportunities.")
    return {"new": total_new}
