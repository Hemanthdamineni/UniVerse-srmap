import asyncio
import logging
from typing import Optional

from playwright.async_api import async_playwright, Page, BrowserContext, TimeoutError as PWTimeout

import config
from normalizer import from_devfolio
from db import CareerDB

logger = logging.getLogger("Scraper.Devfolio")

# ── Strategy overview ─────────────────────────────────────────────────────────
#
# Devfolio is a React/GraphQL SPA (api.devfolio.co/v1/graphql).
# The DOM uses styled-components — hashed class names change per deploy,
# but the component-level class name `CompactHackathonCard` is stable.
#
# We scrape MULTIPLE pages for better coverage:
#   /hackathons         → Featured + trending
#   /hackathons/open    → All actively running hackathons (most valuable)
#   /hackathons/upcoming → Future hackathons
#
# Each page shares a single browser context to reduce overhead.
# Titles are deduplicated globally across all pages.
#
# ─────────────────────────────────────────────────────────────────────────────

# Pages to scrape, ordered by priority
HACKATHON_PAGES = [
    ("https://devfolio.co/hackathons/open",     "open"),
    ("https://devfolio.co/hackathons",           "featured"),
    ("https://devfolio.co/hackathons/upcoming",  "upcoming"),
]

# GraphQL hydration wait — Devfolio calls api.devfolio.co/v1/graphql after load
_HYDRATION_WAIT_MS = 6000

# Stable component class selector (styled-component name survives deploys)
_CARD_SELECTOR = "[class*='CompactHackathonCard']"

# Fallback selectors
_FALLBACK_SELECTORS = [
    "[class*='HackathonCard']",
    "[class*='hackathon-card']",
    "[data-testid='hackathon-card']",
]

# Nav / section heading titles to skip (appear as text in some card positions)
_SKIP_TITLES = frozenset({
    "your hackathons", "all open hackathons", "all upcoming hackathons",
    "all past hackathons", "featured", "open", "upcoming", "past",
    "see projects", "discover", "hackathons", "builders", "live",
    "all hackathons",
})

# Nav link paths to exclude when searching for hackathon microsite links
_NAV_PATHS = ("/hackathons", "/builders", "/blog", "/login", "/signup", "/join", "/projects")


async def _find_cards(page: Page) -> list:
    """Find hackathon card elements, trying primary then fallback selectors."""
    try:
        await page.wait_for_selector(_CARD_SELECTOR, timeout=10000)
        cards = await page.query_selector_all(_CARD_SELECTOR)
        if cards:
            logger.debug(f"Found {len(cards)} cards via primary selector")
            return cards
    except PWTimeout:
        logger.debug("Primary selector timed out, trying fallbacks...")

    for selector in _FALLBACK_SELECTORS:
        try:
            await page.wait_for_selector(selector, timeout=5000)
            cards = await page.query_selector_all(selector)
            if cards:
                logger.debug(f"Found {len(cards)} cards via fallback: {selector!r}")
                return cards
        except (PWTimeout, Exception):
            continue

    return []


async def _extract_card(card) -> Optional[dict]:
    """Extract hackathon data from a CompactHackathonCard DOM element."""
    try:
        card_text = await card.inner_text()
        lines = [l.strip() for l in card_text.split("\n") if l.strip()]
        if not lines:
            return None

        title = lines[0]
        if not title or len(title) < 3 or title.lower() in _SKIP_TITLES:
            return None

        # Detect mode from card text
        text_lower = card_text.lower()
        is_online = "online" in text_lower or "virtual" in text_lower

        # Build description from secondary lines (exclude status/mode keywords)
        _noise = {"hackathon", "live", "open", "upcoming", "past", "featured",
                  "see projects", "online", "offline", "in-person", "hybrid"}
        desc_parts = [l for l in lines[1:] if l.lower() not in _noise]

        # Find the hackathon microsite URL (devfolio.co/<slug>, not /hackathons/*)
        url = ""
        links = await card.query_selector_all("a[href]")
        for link in links:
            href = await link.get_attribute("href") or ""
            if not href:
                continue
            if any(nav in href for nav in _NAV_PATHS):
                continue
            if href.startswith("http") and "devfolio.co" in href:
                url = href
                break
            if href.startswith("/") and href.count("/") == 1 and len(href) > 3:
                url = f"https://devfolio.co{href}"
                break

        # Fallback URL from title slug
        if not url:
            slug = (title.lower()
                    .replace(" ", "-")
                    .replace("'", "")
                    .replace(":", "")
                    .replace(".", "")
                    [:60])
            url = f"https://devfolio.co/{slug}"

        return {
            "title": title,
            "organizer": None,
            "url": url,
            "description": f"Hackathon on Devfolio: {'. '.join(desc_parts[:3])}".strip(),
            "is_online": is_online,
        }
    except Exception as e:
        logger.error(f"Error extracting Devfolio card: {e}")
        return None


async def _scrape_page(
    context: BrowserContext,
    url: str,
    label: str,
    seen_titles: set[str],
) -> list[dict]:
    """Scrape a single Devfolio page URL and return raw hackathon dicts.

    Args:
        context: Reused browser context (shares cookies/UA).
        url: Page URL to scrape.
        label: Human label for logging (e.g. 'open', 'featured').
        seen_titles: Global dedup set shared across all pages.
    """
    page = await context.new_page()
    page.set_default_timeout(config.PAGE_NAVIGATION_TIMEOUT_MS)
    raw_items: list[dict] = []

    try:
        logger.info(f"Devfolio [{label}] → {url}")
        await page.goto(url, wait_until="domcontentloaded")

        # Wait for GraphQL hydration
        await page.wait_for_timeout(_HYDRATION_WAIT_MS)

        # Scroll to trigger lazy-loaded cards
        prev_count = 0
        for _ in range(4):
            await page.evaluate("window.scrollBy(0, window.innerHeight * 1.5)")
            await page.wait_for_timeout(1200)
            cards_now = await page.query_selector_all(_CARD_SELECTOR)
            if len(cards_now) == prev_count and prev_count > 0:
                break  # No new cards loaded — stop scrolling
            prev_count = len(cards_now)

        cards = await _find_cards(page)

        if not cards:
            logger.warning(f"Devfolio [{label}]: no cards found (page may need auth or changed)")
            logger.debug(f"Devfolio [{label}] page title: {await page.title()}")
            return []

        logger.info(f"Devfolio [{label}]: processing {len(cards)} cards")
        for card in cards:
            raw = await _extract_card(card)
            if not raw or not raw.get("title") or not raw.get("url"):
                continue
            title_key = raw["title"].lower().strip()
            if title_key in seen_titles:
                continue
            seen_titles.add(title_key)
            raw_items.append(raw)

    except PWTimeout as e:
        logger.warning(f"Devfolio [{label}]: page timed out — {e}")
    except Exception as e:
        logger.error(f"Devfolio [{label}]: error — {e}")
    finally:
        await page.close()

    return raw_items


async def run_devfolio(db: CareerDB) -> dict:
    """Scrape hackathons from Devfolio across open, featured, and upcoming pages."""
    logger.info("Starting Devfolio scraper (multi-page)...")
    counts = {"new": 0, "updated": 0, "skipped": 0, "errors": 0}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=config.PLAYWRIGHT_HEADLESS)
        context = await browser.new_context(
            user_agent=config.PLAYWRIGHT_USER_AGENT,
            viewport={"width": 1280, "height": 800},
        )

        try:
            seen_titles: set[str] = set()
            all_raw: list[dict] = []

            # Scrape each page sequentially (share context, avoid hammering)
            for page_url, label in HACKATHON_PAGES:
                try:
                    page_items = await _scrape_page(context, page_url, label, seen_titles)
                    all_raw.extend(page_items)
                    logger.info(f"Devfolio [{label}]: {len(page_items)} unique items collected")
                    # Brief pause between pages
                    await asyncio.sleep(2)
                except Exception as e:
                    # One page failing must not stop the others
                    logger.error(f"Devfolio [{label}]: page scrape failed — {e}")
                    continue

            if not all_raw:
                logger.warning("Devfolio: no hackathons collected across any page.")
                return counts

            logger.info(f"Devfolio: processing {len(all_raw)} total unique hackathons...")
            for raw in all_raw:
                try:
                    opp = from_devfolio(raw)
                    if opp is None:
                        counts["skipped"] += 1
                        continue
                    result = db.upsert_opportunity(opp)
                    counts[result] = counts.get(result, 0) + 1
                except Exception as e:
                    logger.error(f"Error inserting Devfolio hackathon '{raw.get('title', '?')}': {e}")
                    counts["errors"] += 1

        finally:
            await browser.close()

    logger.info(
        f"Devfolio completed. New: {counts['new']}, Updated: {counts['updated']}, "
        f"Skipped: {counts['skipped']}, Errors: {counts['errors']}"
    )
    return counts
