"""Devpost hackathon scraper — official frontend JSON feed.

Devpost's own SPA consumes https://devpost.com/api/hackathons, which is a
public, stable JSON feed covering open and upcoming hackathons worldwide.
Pure HTTP (aiohttp), no browser needed.
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Optional
from urllib.parse import urlencode

import aiohttp

import config
from normalizer import normalize_opportunity
from db import CareerDB
from scrapers.net import pool, throttled_get

logger = logging.getLogger("Scraper.Devpost")

_API_URL = "https://devpost.com/api/hackathons"
_MAX_PAGES: int = int(os.environ.get("SCRAPER_DEVPOST_MAX_PAGES", "5"))

_HEADERS = {
    "User-Agent": config.PLAYWRIGHT_USER_AGENT,
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://devpost.com/hackathons",
}


def parse_deadline_end(period_text: str) -> Optional[str]:
    """Extract the submission-close date from Devpost's period string.

    'Jul 31 - Oct 01, 2026' → 'Oct 01, 2026' (normalizer._safe_date parses it).
    """
    if not period_text or "-" not in period_text:
        return None
    end_part = period_text.rsplit("-", 1)[1].strip()
    # Year may only appear once at the very end ('Jul 31 - Oct 01, 2026')
    if "," not in end_part and "," in period_text:
        year = period_text.rstrip()[-4:]
        end_part = f"{end_part}, {year}"
    return end_part.strip()


def clean_prize(prize_html: str) -> Optional[str]:
    """'$<span data-currency-value>740,000</span>' → '$740,000'."""
    if not prize_html:
        return None
    out = []
    skip = False
    for ch in prize_html:
        if ch == "<":
            skip = True
        elif ch == ">":
            skip = False
        elif not skip:
            out.append(ch)
    return "".join(out).strip()


def parse_hackathon(item: dict) -> Optional[dict]:
    """Map one Devpost feed entry into normalizer-ready raw data."""
    if not isinstance(item, dict):
        return None

    title = (item.get("title") or "").strip()
    url = (item.get("url") or "").strip()
    if not title or not url:
        return None
    if not url.startswith("http"):
        url = f"https://{url.lstrip('/')}"

    location_info = item.get("displayed_location") or {}
    location_name = (location_info.get("location") or "").strip()
    is_online = location_name.lower() == "online"

    org = (item.get("organization_name") or "").strip()
    themes = [t.get("name") for t in (item.get("themes") or []) if isinstance(t, dict)]
    desc_bits = []
    if org:
        desc_bits.append(f"Hosted by {org}")
    if themes:
        desc_bits.append(f"Themes: {', '.join(themes)}")
    regs = item.get("registrations_count")
    if isinstance(regs, int) and regs > 0:
        desc_bits.append(f"{regs} registered participants")

    return {
        "type": "hackathon",
        "title": title,
        "organizer": org or None,
        "description": ". ".join(desc_bits) or "Hackathon on Devpost",
        "location": None if is_online else (location_name or None),
        "mode": "online" if is_online else "offline",
        "sourceUrl": url,
        "deadline": parse_deadline_end(item.get("submission_period_dates") or ""),
        "prize": clean_prize(item.get("prize_amount") or ""),
    }


async def _fetch_page(session: aiohttp.ClientSession, page_num: int, proxy: Optional[str] = None) -> list[dict]:
    query = urlencode([
        ("status[]", "open"),
        ("status[]", "upcoming"),
        ("page", str(page_num)),
    ])
    try:
        resp = await throttled_get(session, f"{_API_URL}?{query}", proxy=proxy)
        if resp is None:
            logger.warning(f"Devpost API page {page_num} request failed")
            return []
        async with resp:
            if resp.status != 200:
                logger.warning(f"Devpost API page {page_num} returned {resp.status}")
                return []
            body = await resp.json(content_type=None)
            return body.get("hackathons") or []
    except asyncio.TimeoutError:
        logger.warning(f"Devpost API page {page_num} timed out")
    except Exception as exc:
        logger.warning(f"Error fetching Devpost page {page_num}: {exc}")
    return []


async def run_devpost(db: CareerDB) -> dict:
    """Scrape open/upcoming hackathons from Devpost's JSON feed."""
    logger.info("Starting Devpost scraper...")
    counts = {"new": 0, "updated": 0, "skipped": 0, "errors": 0}

    timeout = aiohttp.ClientTimeout(total=30)
    seen_urls: set[str] = set()
    proxy = pool.next()
    if proxy:
        logger.info("Using proxy from SCRAPER_PROXIES pool")

    async with aiohttp.ClientSession(headers=_HEADERS, timeout=timeout) as session:
        for page_num in range(1, _MAX_PAGES + 1):
            items = await _fetch_page(session, page_num, proxy=proxy)
            if not items:
                break
            logger.info(f"Devpost page {page_num}: {len(items)} hackathons")

            for item in items:
                raw = parse_hackathon(item)
                if not raw:
                    counts["skipped"] += 1
                    continue
                if raw["sourceUrl"] in seen_urls:
                    counts["skipped"] += 1
                    continue
                seen_urls.add(raw["sourceUrl"])

                opp = normalize_opportunity(raw, "devpost")
                if opp is None:
                    counts["skipped"] += 1
                    continue
                result = db.upsert_opportunity(opp)
                counts[result] = counts.get(result, 0) + 1

            if len(items) < 10:
                break
            await asyncio.sleep(1)

    logger.info(
        f"Devpost completed. New: {counts['new']}, Updated: {counts['updated']}, "
        f"Skipped: {counts['skipped']}, Errors: {counts['errors']}"
    )
    return counts
