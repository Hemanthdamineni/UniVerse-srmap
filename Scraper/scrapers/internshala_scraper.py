import asyncio
import logging
from typing import Optional

from playwright.async_api import async_playwright, Page, Browser, TimeoutError as PWTimeout

import config
from normalizer import normalize_opportunity
from db import CareerDB

logger = logging.getLogger("Scraper.Internshala")

# Internshala is a server-rendered (SSR) site, so basic selectors
# usually work. However the class names have shifted over time.
# Strategy: multiple fallback selectors per data field.

INTERNSHALA_URL = "https://internshala.com/internships/computer-science-internship,web-development-internship,software-development-internship"

# Selectors to find each internship card container
CARD_SELECTORS = [
    ".internship_meta",
    ".individual_internship",
    ".internship-card",
    "[id^='internship_']",
    ".container-fluid.internship",
]


async def _find_cards(page: Page) -> list:
    """Try multiple selector strategies to find internship cards."""
    for selector in CARD_SELECTORS:
        try:
            await page.wait_for_selector(selector, timeout=12000)
            cards = await page.query_selector_all(selector)
            if cards:
                logger.info(f"Found {len(cards)} internship cards using selector: {selector!r}")
                return cards
        except PWTimeout:
            continue
        except Exception as e:
            logger.debug(f"Selector {selector!r} failed: {e}")
    return []


async def _extract_card(card) -> Optional[dict]:
    """Extract internship data from a single card with multiple fallback selectors."""
    try:
        # ── Title ──────────────────────────────────────────────────────
        title = None
        for sel in [
            ".profile",           # Classic selector
            ".heading_4_5 a",     # Newer structure
            "h3.heading_4_5",
            ".job-internship-name",
            "h3 a",
            "h4 a",
            "[class*='profile']",
        ]:
            el = await card.query_selector(sel)
            if el:
                title = (await el.inner_text()).strip()
                if title:
                    break

        if not title:
            return None

        # ── Company ────────────────────────────────────────────────────
        company = "Unknown Company"
        for sel in [
            ".company_name a",
            ".company_name",
            ".company-name",
            "[class*='company']",
        ]:
            el = await card.query_selector(sel)
            if el:
                company = (await el.inner_text()).strip()
                if company:
                    break

        # ── URL ────────────────────────────────────────────────────────
        url = ""
        for sel in [
            "a.view_detail_button",
            "h3.heading_4_5 a",
            ".heading_4_5 a",
            "a[href*='/internship/detail/']",
            "a[href*='/internship/']",
        ]:
            el = await card.query_selector(sel)
            if el:
                url = await el.get_attribute("href") or ""
                if url:
                    break

        if not url:
            # Fallback: find any link pointing to an internship
            links = await card.query_selector_all("a[href]")
            for link in links:
                href = await link.get_attribute("href") or ""
                if "/internship/" in href:
                    url = href
                    break

        if not url:
            return None

        if not url.startswith("http"):
            url = f"https://internshala.com{url}"

        # ── Location ───────────────────────────────────────────────────
        location = "India"
        for sel in [
            ".location_link",
            ".locations",
            "[class*='location']",
            ".location",
        ]:
            el = await card.query_selector(sel)
            if el:
                location = (await el.inner_text()).strip()
                if location:
                    break

        # ── Stipend ────────────────────────────────────────────────────
        stipend = None
        for sel in [
            ".stipend",
            "[class*='stipend']",
            ".salary",
        ]:
            el = await card.query_selector(sel)
            if el:
                stipend = (await el.inner_text()).strip()
                if stipend and stipend not in ("Unpaid", "-"):
                    break
                stipend = None

        # ── Duration ───────────────────────────────────────────────────
        duration = None
        for sel in [
            ".item_body",
            "[class*='duration']",
            ".internship_other_details_container .item_body",
        ]:
            el = await card.query_selector(sel)
            if el:
                duration = (await el.inner_text()).strip()
                if duration:
                    break

        return {
            "title": title,
            "company": company,
            "url": url,
            "location": location,
            "stipend": stipend,
            "duration": duration,
        }

    except Exception as e:
        logger.error(f"Error extracting Internshala card: {e}")
        return None


async def run_internshala(db: CareerDB) -> dict:
    """Scrape internships from Internshala."""
    logger.info("Starting Internshala scraper...")
    counts = {"new": 0, "updated": 0, "skipped": 0, "errors": 0}

    browser: Optional[Browser] = None
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(
                headless=config.PLAYWRIGHT_HEADLESS,
            )
            context = await browser.new_context(
                user_agent=config.PLAYWRIGHT_USER_AGENT,
                viewport={"width": 1280, "height": 900},
                # Set Accept-Language to appear more human
                extra_http_headers={
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                }
            )
            page = await context.new_page()
            page.set_default_timeout(config.PAGE_NAVIGATION_TIMEOUT_MS)

            logger.info(f"Navigating to {INTERNSHALA_URL}")
            await page.goto(INTERNSHALA_URL, wait_until="domcontentloaded")

            # Wait for server-rendered content to appear
            await page.wait_for_timeout(2000)

            cards = await _find_cards(page)

            if not cards:
                logger.warning("No internship cards found. Retrying with generic URL...")
                # Fallback to the generic internships page
                await page.goto(
                    "https://internshala.com/internships",
                    wait_until="domcontentloaded",
                )
                await page.wait_for_timeout(2000)
                cards = await _find_cards(page)

            if not cards:
                logger.warning(
                    "Still no cards found on Internshala. "
                    "Page structure may have changed significantly."
                )
                logger.info(f"Page title: {await page.title()}")
                return counts

            logger.info(f"Processing {len(cards)} internship cards from Internshala")

            for card in cards:
                try:
                    raw = await _extract_card(card)
                    if not raw or not raw.get("url"):
                        counts["skipped"] += 1
                        continue

                    location_str = raw.get("location", "")
                    is_remote = "work from home" in location_str.lower() or "remote" in location_str.lower()

                    opp_data = {
                        "type": "internship",
                        "title": raw["title"],
                        "company": raw["company"],
                        "sourceUrl": raw["url"],
                        "location": location_str if not is_remote else "Remote",
                        "stipend": raw.get("stipend"),
                        "duration": raw.get("duration"),
                        "mode": "remote" if is_remote else "onsite",
                        "isPanIndia": True,
                    }
                    opp = normalize_opportunity(opp_data, "internshala")
                    if opp is None:
                        counts["skipped"] += 1
                        continue
                    result = db.upsert_opportunity(opp)
                    counts[result] = counts.get(result, 0) + 1

                except Exception as e:
                    logger.error(f"Error processing Internshala card: {e}")
                    counts["errors"] += 1

        except PWTimeout as e:
            logger.error(f"Timeout in Internshala scraper: {e}")
            raise
        except Exception as e:
            logger.error(f"Error in Internshala scraper: {e}")
            raise
        finally:
            if browser:
                await browser.close()

    logger.info(
        f"Internshala completed. New: {counts['new']}, Updated: {counts['updated']}, "
        f"Skipped: {counts['skipped']}, Errors: {counts['errors']}"
    )
    return counts
