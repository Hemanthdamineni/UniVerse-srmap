"""Company ATS board scraper — Greenhouse & Lever public job APIs.

Both platforms expose unauthenticated JSON job-board endpoints:
  Greenhouse: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
  Lever:      https://api.lever.co/v0/postings/{slug}?mode=json

Postings are filtered to India locations and (by default) student-relevant
titles (intern/trainee/graduate). Each company board is isolated — one dead
or empty slug never fails the source.
"""

import asyncio
import logging
from datetime import datetime, timezone
from html import unescape
from typing import Optional

import aiohttp

import config
from normalizer import normalize_opportunity
from db import CareerDB
from scrapers.net import pool, throttled_get

logger = logging.getLogger("Scraper.ATS")

_GREENHOUSE_URL = "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
_LEVER_URL = "https://api.lever.co/v0/postings/{slug}?mode=json"

_HEADERS = {
    "User-Agent": config.PLAYWRIGHT_USER_AGENT,
    "Accept": "application/json",
}

_DESCRIPTION_CAP = 4000


def strip_html(text: str) -> str:
    """Cheap HTML→text for ATS description blobs."""
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


def is_india_location(location_text: str) -> bool:
    lowered = (location_text or "").lower()
    return any(kw in lowered for kw in config.ATS_LOCATION_KEYWORDS)


def passes_title_filter(title: str) -> bool:
    if config.ATS_INCLUDE_ALL_ROLES:
        return True
    lowered = (title or "").lower()
    return any(kw in lowered for kw in config.ATS_TITLE_FILTER)


def ms_to_iso(ms: Optional[int]) -> Optional[str]:
    if not isinstance(ms, (int, float)):
        return None
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()


def map_greenhouse_job(job: dict, company: str) -> Optional[dict]:
    """Map a Greenhouse posting into normalizer-ready raw data."""
    title = (job.get("title") or "").strip()
    url = (job.get("absolute_url") or "").strip()
    location = ((job.get("location") or {}).get("name") or "").strip()

    if not title or not url or not is_india_location(location):
        return None
    if not passes_title_filter(title):
        return None

    description = strip_html(job.get("content") or "")[:_DESCRIPTION_CAP]
    departments = ", ".join(
        d.get("name", "") for d in (job.get("departments") or []) if isinstance(d, dict)
    ).strip(", ")

    return {
        "type": "internship" if "intern" in title.lower() else "job",
        "title": title,
        "company": company,
        "description": description or f"{title} at {company}",
        "requirements": departments or None,
        "location": location,
        "mode": "remote" if "remote" in location.lower() else "onsite",
        "sourceUrl": url,
        "postedAt": job.get("updated_at"),
    }


def map_lever_posting(posting: dict, company: str) -> Optional[dict]:
    """Map a Lever posting into normalizer-ready raw data."""
    title = (posting.get("text") or "").strip()
    url = (posting.get("hostedUrl") or posting.get("applyUrl") or "").strip()
    categories = posting.get("categories") or {}
    location = (categories.get("location") or "").strip()

    if not title or not url or not is_india_location(location):
        return None
    if not passes_title_filter(title):
        return None

    description = strip_html(posting.get("descriptionPlain") or "")[:_DESCRIPTION_CAP]
    commitment = (categories.get("commitment") or "").strip()

    return {
        "type": "internship" if "intern" in title.lower() else "job",
        "title": title,
        "company": company,
        "description": description or f"{title} at {company}",
        "requirements": commitment or None,
        "location": location.title() or None,
        "mode": "remote" if "remote" in location.lower() else "onsite",
        "sourceUrl": url,
        "postedAt": ms_to_iso(posting.get("createdAt")),
    }


async def _fetch_json(session: aiohttp.ClientSession, url: str, proxy: Optional[str] = None) -> Optional[object]:
    try:
        resp = await throttled_get(session, url, proxy=proxy)
        if resp is None:
            logger.warning(f"Request failed: {url}")
            return None
        async with resp:
            if resp.status != 200:
                logger.debug(f"{url} → {resp.status}")
                return None
            return await resp.json(content_type=None)
    except asyncio.TimeoutError:
        logger.warning(f"Timeout fetching {url}")
    except Exception as exc:
        logger.warning(f"Error fetching {url}: {exc}")
    return None


async def run_ats(db: CareerDB) -> dict:
    """Scrape India postings from configured Greenhouse/Lever boards."""
    total_boards = len(config.GREENHOUSE_BOARDS) + len(config.LEVER_BOARDS)
    logger.info(f"Starting ATS scraper ({total_boards} company boards)...")

    counts = {"new": 0, "updated": 0, "skipped": 0, "errors": 0}
    timeout = aiohttp.ClientTimeout(total=30)
    raw_items: list[dict] = []
    proxy = pool.next()
    if proxy:
        logger.info("Using proxy from SCRAPER_PROXIES pool")

    async with aiohttp.ClientSession(headers=_HEADERS, timeout=timeout) as session:
        for slug in config.GREENHOUSE_BOARDS:
            data = await _fetch_json(session, _GREENHOUSE_URL.format(slug=slug), proxy=proxy)
            jobs = (data or {}).get("jobs") if isinstance(data, dict) else None
            if not jobs:
                logger.info(f"[greenhouse/{slug}] no postings (board may be empty)")
                continue
            kept = [r for j in jobs if (r := map_greenhouse_job(j, slug.title()))]
            logger.info(f"[greenhouse/{slug}] {len(jobs)} postings → {len(kept)} India/student matches")
            raw_items.extend(kept)

        for slug in config.LEVER_BOARDS:
            data = await _fetch_json(session, _LEVER_URL.format(slug=slug), proxy=proxy)
            postings = data if isinstance(data, list) else None
            if not postings:
                logger.info(f"[lever/{slug}] no postings (board may be empty)")
                continue
            kept = [r for p in postings if (r := map_lever_posting(p, slug.upper()))]
            logger.info(f"[lever/{slug}] {len(postings)} postings → {len(kept)} India/student matches")
            raw_items.extend(kept)

    seen_urls: set[str] = set()
    for raw in raw_items:
        if raw["sourceUrl"] in seen_urls:
            counts["skipped"] += 1
            continue
        seen_urls.add(raw["sourceUrl"])
        try:
            opp = normalize_opportunity(raw, "ats")
            if opp is None:
                counts["skipped"] += 1
                continue
            result = db.upsert_opportunity(opp)
            counts[result] = counts.get(result, 0) + 1
        except Exception as exc:
            logger.error(f"Error processing ATS item '{raw.get('title', '?')}': {exc}")
            counts["errors"] += 1

    logger.info(
        f"ATS completed. New: {counts['new']}, Updated: {counts['updated']}, "
        f"Skipped: {counts['skipped']}, Errors: {counts['errors']}"
    )
    return counts
