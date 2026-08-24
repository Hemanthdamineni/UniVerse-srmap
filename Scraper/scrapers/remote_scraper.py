"""Remote-job feed scrapers — RemoteOK and Remotive public APIs.

Both are documented, unauthenticated JSON feeds of remote roles. Postings
are filtered to locations relevant to Indian students (worldwide/remote or
India-specific); region-locked listings for other continents are skipped.
"""

import asyncio
import logging
import re
from html import unescape
from typing import Optional

import aiohttp

import config
from normalizer import normalize_opportunity
from db import CareerDB
from scrapers.net import pool, throttled_get

logger = logging.getLogger("Scraper.Remote")

_HEADERS = {
    "User-Agent": config.PLAYWRIGHT_USER_AGENT,
    "Accept": "application/json",
}

_REMOTEOK_URL = "https://remoteok.com/api"
_REMOTIVE_URL = "https://remotive.com/api/remote-jobs"

_DESCRIPTION_CAP = 4000

# Locations that make a posting relevant to an Indian student audience:
# open-to-anywhere remote roles, or explicitly India-eligible ones.
_LOCATION_ALLOWLIST = [
    "worldwide", "global", "anywhere", "remote", "india",
]


def location_allowed(location: str) -> bool:
    lowered = (location or "").lower().strip()
    if not lowered:
        return True  # unspecified = usually worldwide
    return any(token in lowered for token in _LOCATION_ALLOWLIST)


def strip_html(text: str) -> str:
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


def map_remoteok(item: dict) -> Optional[dict]:
    """Map one RemoteOK feed entry (legal-notice element is rejected)."""
    title = (item.get("position") or "").strip()
    url = (item.get("url") or item.get("apply_url") or "").strip()
    company = (item.get("company") or "").strip()

    if not title or not url or not company:
        return None
    if not location_allowed(item.get("location")):
        return None

    description = strip_html(item.get("description") or "")[:_DESCRIPTION_CAP]
    tags = item.get("tags")
    if isinstance(tags, str):
        try:
            import json as _json
            tags = _json.loads(tags.replace("'", '"'))
        except Exception:
            tags = [t.strip() for t in tags.strip("[]").split(",") if t.strip()]
    skills_line = f"Skills: {', '.join(str(t) for t in tags)}" if tags else ""

    return {
        "type": "internship" if "intern" in title.lower() else "job",
        "title": title,
        "company": company,
        "description": f"{description}\n{skills_line}".strip(),
        "location": None,
        "mode": "remote",
        "sourceUrl": url,
        "postedAt": item.get("date"),
    }


def map_remotive(job: dict) -> Optional[dict]:
    """Map one Remotive feed entry."""
    title = (job.get("title") or "").strip()
    url = (job.get("url") or "").strip()
    company = (job.get("company_name") or "").strip()

    if not title or not url or not company:
        return None
    if not location_allowed(job.get("candidate_required_location")):
        return None

    description = strip_html(job.get("description") or "")[:_DESCRIPTION_CAP]
    job_type = (job.get("job_type") or "").strip().replace("_", "-")
    salary = (job.get("salary") or "").strip()

    extra = []
    if job_type:
        extra.append(f"Commitment: {job_type}")
    # Salary stays a display string; numeric stipend parsing is INR-only.
    if salary:
        extra.append(f"Salary: {salary}")

    return {
        "type": "internship" if "intern" in title.lower() else "job",
        "title": title,
        "company": company,
        "description": "\n".join(filter(None, [description, *extra])),
        "location": None,
        "mode": "remote",
        "sourceUrl": url,
        "postedAt": job.get("publication_date"),
    }


async def _fetch_json(session: aiohttp.ClientSession, url: str, proxy: Optional[str] = None) -> Optional[object]:
    try:
        resp = await throttled_get(session, url, proxy=proxy)
        if resp is None:
            logger.warning(f"Request failed: {url}")
            return None
        async with resp:
            if resp.status != 200:
                logger.warning(f"{url} → {resp.status}")
                return None
            return await resp.json(content_type=None)
    except asyncio.TimeoutError:
        logger.warning(f"Timeout fetching {url}")
    except Exception as exc:
        logger.warning(f"Error fetching {url}: {exc}")
    return None


def _upsert_all(db: CareerDB, raw_items: list[dict], source: str) -> dict:
    counts = {"new": 0, "updated": 0, "skipped": 0, "errors": 0}
    seen_urls: set[str] = set()
    for raw in raw_items:
        if raw["sourceUrl"] in seen_urls:
            counts["skipped"] += 1
            continue
        seen_urls.add(raw["sourceUrl"])
        try:
            opp = normalize_opportunity(raw, source)
            if opp is None:
                counts["skipped"] += 1
                continue
            result = db.upsert_opportunity(opp)
            counts[result] = counts.get(result, 0) + 1
        except Exception as exc:
            logger.error(f"Error processing [{source}] '{raw.get('title', '?')}': {exc}")
            counts["errors"] += 1
    return counts


async def run_remoteok(db: CareerDB) -> dict:
    """Scrape RemoteOK's public feed."""
    logger.info("Starting RemoteOK scraper...")
    proxy = pool.next()
    if proxy:
        logger.info("Using proxy from SCRAPER_PROXIES pool")
    timeout = aiohttp.ClientTimeout(total=30)

    async with aiohttp.ClientSession(headers=_HEADERS, timeout=timeout) as session:
        data = await _fetch_json(session, _REMOTEOK_URL, proxy=proxy)

    entries = data if isinstance(data, list) else []
    kept = [r for e in entries if isinstance(e, dict) and (r := map_remoteok(e))]
    counts = _upsert_all(db, kept, "remoteok")
    logger.info(
        f"RemoteOK completed. New: {counts['new']}, Updated: {counts['updated']}, "
        f"Skipped: {counts['skipped']}, Errors: {counts['errors']}"
    )
    return counts


async def run_remotive(db: CareerDB) -> dict:
    """Scrape Remotive's public feed."""
    logger.info("Starting Remotive scraper...")
    proxy = pool.next()
    if proxy:
        logger.info("Using proxy from SCRAPER_PROXIES pool")
    timeout = aiohttp.ClientTimeout(total=30)

    async with aiohttp.ClientSession(headers=_HEADERS, timeout=timeout) as session:
        data = await _fetch_json(session, _REMOTIVE_URL, proxy=proxy)

    jobs = (data or {}).get("jobs") if isinstance(data, dict) else None
    kept = [r for j in (jobs or []) if isinstance(j, dict) and (r := map_remotive(j))]
    counts = _upsert_all(db, kept, "remotive")
    logger.info(
        f"Remotive completed. New: {counts['new']}, Updated: {counts['updated']}, "
        f"Skipped: {counts['skipped']}, Errors: {counts['errors']}"
    )
    return counts
