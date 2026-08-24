import asyncio
import logging
import os
import json
from html import unescape
from typing import Optional

import aiohttp
from playwright.async_api import async_playwright, Page, Browser, TimeoutError as PWTimeout

import config
from normalizer import normalize_opportunity
from db import CareerDB
from scrapers.browser import launch_stealth_browser
from scrapers.net import pool, throttled_get

logger = logging.getLogger("Scraper.Unstop")

# ── Strategy overview ─────────────────────────────────────────────────────────
#
# Unstop uses Cloudflare protection + Angular SPA.
#
# PRIMARY (Strategy 1): API pagination via direct HTTP requests.
#   The XHR endpoint is publicly accessible without auth — we can call it
#   directly using requests/aiohttp with our UA, paginating through all results.
#   This is FASTER, MORE COMPLETE, and more ROBUST than DOM scraping.
#
# FALLBACK (Strategy 2): Playwright XHR intercept on the live page.
#   Used when direct HTTP requests fail (e.g., headers change, rate limit).
#
# FALLBACK (Strategy 3): DOM scraping via Playwright.
#   Last resort if API is totally inaccessible.
#
# ─────────────────────────────────────────────────────────────────────────────

# API endpoints discovered from XHR inspection
_SEARCH_API = "https://unstop.com/api/public/opportunity/search-result"
_OPPORTUNITY_TYPES = ["competitions", "hackathons", "workshops", "internships", "jobs"]

# Max pages to fetch per opportunity type (18 items/page; 5 types × 8 pages
# ≈ up to 720 raw items per run)
MAX_PAGES: int = int(os.environ.get("SCRAPER_UNSTOP_MAX_PAGES", "8"))
PER_PAGE = 18

# Only intercept from these endpoints in Strategy 2
_INTERCEPT_ENDPOINTS = (
    "/api/public/opportunity/search-result",
)

# DOM fallback selectors (Strategy 3)
_CARD_SELECTORS = [
    ".single_card",
    ".opportunity-card",
    "[class*='OpportunityCard']",
    ".single-oppor-card",
    "app-opportunity-card",
]


# ── Strategy 1: Direct API pagination ────────────────────────────────────────

async def _fetch_all_via_api(proxy: Optional[str] = None) -> list[dict]:
    """Directly paginate Unstop's search API without a browser.

    Returns all raw opportunity dicts from all pages and types.
    This avoids Playwright entirely when the API is accessible.
    """
    all_items: list[dict] = []

    headers = {
        "User-Agent": config.PLAYWRIGHT_USER_AGENT,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://unstop.com/competitions",
        "Origin": "https://unstop.com",
    }

    timeout = aiohttp.ClientTimeout(total=30)

    try:
        async with aiohttp.ClientSession(headers=headers, timeout=timeout) as session:
            for opp_type in _OPPORTUNITY_TYPES:
                type_items: list[dict] = []
                for page_num in range(1, MAX_PAGES + 1):
                    params = {
                        "opportunity": opp_type,
                        "page": page_num,
                        "per_page": PER_PAGE,
                        "oppstatus": "open",
                    }
                    try:
                        resp = await throttled_get(session, _SEARCH_API, params=params, proxy=proxy)
                        if resp is None:
                            logger.warning(f"Request error fetching {opp_type} page {page_num}")
                            break
                        async with resp:
                            if resp.status != 200:
                                logger.debug(f"API returned {resp.status} for {opp_type} page {page_num}")
                                break
                            body = await resp.json(content_type=None)
                            data = body.get("data") or {}
                            if isinstance(data, dict):
                                items = data.get("data") or []
                            else:
                                items = data if isinstance(data, list) else []

                            if not items:
                                logger.debug(f"No more items for {opp_type} at page {page_num}")
                                break

                            type_items.extend(items)
                            logger.debug(f"Fetched {len(items)} {opp_type} from page {page_num}")

                            # Stop if we got fewer than a full page (last page)
                            if len(items) < PER_PAGE:
                                break

                            # Polite delay between pages
                            await asyncio.sleep(1)

                    except asyncio.TimeoutError:
                        logger.warning(f"Timeout fetching {opp_type} page {page_num}")
                        break
                    except Exception as e:
                        logger.warning(f"Error fetching {opp_type} page {page_num}: {e}")
                        break

                logger.info(f"API fetched {len(type_items)} total items for type={opp_type}")
                all_items.extend(type_items)

    except Exception as e:
        logger.warning(f"Direct API fetch failed entirely: {e}")
        return []

    return all_items


# ── Strategy 2: Playwright XHR intercept ─────────────────────────────────────

async def _intercept_via_playwright(page: Page) -> list[dict]:
    """Capture opportunity items from XHR responses during page load.

    Registered before navigation — captures all API calls the Angular
    app makes on load. Returns empty list if nothing captured.
    """
    captured: list[dict] = []

    async def handle_response(response):
        try:
            url = response.url
            if not any(ep in url for ep in _INTERCEPT_ENDPOINTS):
                return
            if response.status != 200:
                return
            ct = response.headers.get("content-type", "")
            if "json" not in ct:
                return
            body = await response.json()
            data = body.get("data") or {}
            items = (data.get("data") or []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
            if items:
                captured.extend(items)
                logger.info(f"XHR intercepted {len(items)} items from: {url[:100]}")
        except Exception:
            pass

    page.on("response", handle_response)
    return captured  # Mutable list — populated asynchronously as responses arrive


# ── Strategy 3: DOM fallback ──────────────────────────────────────────────────

async def _scrape_dom(page: Page) -> list[dict]:
    """Last-resort DOM scraping when API and XHR intercept both fail."""
    raw_items: list[dict] = []
    for selector in _CARD_SELECTORS:
        try:
            cards = await page.query_selector_all(selector)
            if not cards:
                continue
            logger.info(f"DOM fallback: {len(cards)} cards via {selector!r}")
            for card in cards:
                try:
                    title = None
                    for sel in ["h3", "h4", ".title", "[class*='title']"]:
                        el = await card.query_selector(sel)
                        if el:
                            title = (await el.inner_text()).strip()
                            if title:
                                break
                    if not title:
                        continue

                    url = ""
                    link = await card.query_selector("a[href]")
                    if link:
                        href = await link.get_attribute("href") or ""
                        url = href if href.startswith("http") else f"https://unstop.com{href}"
                    if not url:
                        continue

                    card_text = (await card.inner_text()).lower()
                    norm_type = "hackathon" if "hackathon" in card_text else "competition"

                    raw_items.append({
                        "title": title, "url": url, "type": norm_type,
                        "description": f"{norm_type.capitalize()} on Unstop",
                        "is_online": True,
                    })
                except Exception:
                    continue
            if raw_items:
                break
        except Exception:
            continue
    return raw_items


# ── Item normalizer ───────────────────────────────────────────────────────────

def _strip_html(text: str) -> str:
    """Cheap HTML→text for API description blobs (no external deps)."""
    if not text:
        return ""
    text = text.replace("<br>", "\n").replace("</p>", "\n").replace("</li>", "\n")
    out = []
    skip = True
    for ch in text:
        if ch == "<":
            skip = True
        elif ch == ">":
            skip = False
        elif not skip:
            out.append(ch)
    return unescape("".join(out)).strip()


def _parse_api_item(item: dict) -> Optional[dict]:
    """Convert a raw API item dict into a normalizer-ready dict.

    Validates that the item is a real opportunity, not a category/blog post.
    """
    if not isinstance(item, dict):
        return None

    title = item.get("title") or item.get("name")
    if not title:
        return None

    slug = item.get("seo_url") or item.get("slug") or ""
    opp_id = item.get("id") or ""

    # Reject non-opportunity items (categories have no numeric ID or no slug)
    if not opp_id and not slug:
        return None

    # Build URL — seo_url from Unstop is already fully-qualified
    raw_type = (item.get("type") or item.get("opportunity_type") or "competition").lower()
    subtype = (item.get("subtype") or "").lower()
    combined = f"{raw_type} {subtype}"
    if "hackathon" in combined:
        norm_type, url_prefix = "hackathon", "hackathons"
    elif "workshop" in combined:
        norm_type, url_prefix = "workshop", "workshops"
    elif "internship" in combined:
        norm_type, url_prefix = "internship", "internships"
    elif "job" in raw_type or subtype == "jobs":
        norm_type, url_prefix = "job", "jobs"
    else:
        norm_type, url_prefix = "competition", "competitions"

    if slug and slug.startswith("http"):
        url = slug
    elif slug:
        url = f"https://unstop.com/{url_prefix}/{slug}-{opp_id}" if opp_id else f"https://unstop.com/{url_prefix}/{slug}"
    elif opp_id:
        url = f"https://unstop.com/o/{opp_id}"
    else:
        return None

    org = item.get("organisation") or item.get("organization") or {}
    organizer = org.get("name") if isinstance(org, dict) else None

    deadline = None
    regn = item.get("regnRequirements") or {}
    if isinstance(regn, dict):
        deadline = regn.get("end_regn_dt") or regn.get("end_date")
    deadline = deadline or item.get("end_date")

    description = _strip_html(
        item.get("short_desc") or item.get("description") or item.get("details") or ""
    ) or f"{norm_type.capitalize()} on Unstop"

    stipend = (
        item.get("stipend_amount")
        or item.get("stipend")
        or (f"₹{item['stipend_min']}-{item['stipend_max']}" if item.get("stipend_min") and item.get("stipend_max") else None)
    )

    region = (item.get("region") or "").lower()
    mode = "online" if ("online" in region or norm_type in ("hackathon", "competition")) else "offline"

    return {
        "type": norm_type,
        "title": title,
        "organizer": organizer,
        "url": url,
        "description": description,
        "is_online": mode == "online",
        "deadline": str(deadline) if deadline else None,
        "prize": item.get("prizes_worth"),
        "stipend": str(stipend) if stipend else None,
    }


def _items_to_raw(api_items: list[dict]) -> list[dict]:
    """Parse and filter a list of raw API items, returning valid raw opportunity dicts."""
    result = []
    for item in api_items:
        parsed = _parse_api_item(item)
        if parsed:
            result.append(parsed)
    return result


# ── Main runner ───────────────────────────────────────────────────────────────

async def run_unstop(db: CareerDB) -> dict:
    """Scrape competitions/hackathons from Unstop across all pages.

    Tries three strategies in order:
    1. Direct API pagination (fastest, most complete)
    2. Playwright XHR intercept (if direct HTTP is blocked)
    3. DOM scraping (last resort)
    """
    logger.info("Starting Unstop scraper...")
    counts = {"new": 0, "updated": 0, "skipped": 0, "errors": 0}
    raw_items: list[dict] = []
    proxy = pool.next()
    if proxy:
        logger.info("Using proxy from SCRAPER_PROXIES pool")

    # ── Strategy 1: Direct API (no browser needed) ────────────────────────────
    logger.info("Trying direct API pagination (Strategy 1)...")
    api_items = await _fetch_all_via_api(proxy=proxy)
    if api_items:
        raw_items = _items_to_raw(api_items)
        logger.info(f"Strategy 1 succeeded: {len(api_items)} raw → {len(raw_items)} valid items")

    # ── Strategy 2 & 3: Playwright (browser needed) ───────────────────────────
    if not raw_items:
        logger.info("Direct API failed or empty, launching browser (Strategy 2/3)...")
        browser: Optional[Browser] = None
        async with async_playwright() as p:
            try:
                browser, context = await launch_stealth_browser(p, proxy=proxy)
                page = await context.new_page()
                page.set_default_timeout(config.PAGE_NAVIGATION_TIMEOUT_MS)

                # Register XHR intercept BEFORE navigation
                xhr_items = await _intercept_via_playwright(page)

                logger.info("Navigating to Unstop competitions page...")
                try:
                    await page.goto("https://unstop.com/competitions", wait_until="domcontentloaded")
                    await page.wait_for_timeout(6000)
                except PWTimeout:
                    logger.warning("Unstop page load timed out, continuing with what was captured...")

                # Check for Cloudflare challenge
                page_title = await page.title()
                if "cloudflare" in page_title.lower() or "just a moment" in page_title.lower():
                    raise RuntimeError("Unstop blocked by Cloudflare challenge page")

                # Strategy 2: use XHR intercept
                if xhr_items:
                    raw_items = _items_to_raw(xhr_items)
                    logger.info(f"Strategy 2 (XHR intercept): {len(xhr_items)} raw → {len(raw_items)} valid items")

                # Strategy 3: DOM fallback
                if not raw_items:
                    dom_items = await _scrape_dom(page)
                    raw_items = dom_items
                    logger.info(f"Strategy 3 (DOM scrape): {len(raw_items)} items")

            except RuntimeError:
                raise
            except Exception as e:
                logger.error(f"Browser strategy failed: {e}")
                raise
            finally:
                if browser:
                    await context.close()
                    await browser.close()

    if not raw_items:
        logger.warning("All Unstop strategies exhausted with no results.")
        return counts

    # ── Process all collected items ───────────────────────────────────────────
    logger.info(f"Processing {len(raw_items)} Unstop opportunities...")
    seen_urls: set[str] = set()
    for raw in raw_items:
        try:
            url = raw.get("url", "")
            if not url or url in seen_urls:
                counts["skipped"] += 1
                continue
            seen_urls.add(url)

            opp = normalize_opportunity({
                "type": raw["type"],
                "title": raw["title"],
                "organizer": raw.get("organizer"),
                "sourceUrl": url,
                "description": raw.get("description", ""),
                "mode": "online" if raw.get("is_online") else "offline",
                "deadline": raw.get("deadline"),
                "prize": raw.get("prize"),
                "stipend": raw.get("stipend"),
            }, "unstop")

            if opp is None:
                counts["skipped"] += 1
                continue
            result = db.upsert_opportunity(opp)
            counts[result] = counts.get(result, 0) + 1

        except Exception as e:
            logger.error(f"Error processing Unstop item '{raw.get('title', '?')}': {e}")
            counts["errors"] += 1

    logger.info(
        f"Unstop completed. New: {counts['new']}, Updated: {counts['updated']}, "
        f"Skipped: {counts['skipped']}, Errors: {counts['errors']}"
    )
    return counts
