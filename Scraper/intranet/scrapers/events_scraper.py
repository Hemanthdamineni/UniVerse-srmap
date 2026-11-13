"""
Scraper for intranet events and calendar items.

Audience: events are classified as shared (university-wide) unless they
explicitly target a specific department/programme (cohort).

Student-specific: registrations, waitlists, personal reminders are NOT collected.
"""

import logging
import re
import time
from typing import Optional

import config
from scrapers.base import (
    extract_document_links,
    get_attr,
    get_text,
    paginate,
    parse_meta_date,
)
from normalizer import clean_text, normalize_url, make_summary

logger = logging.getLogger("IntranetEvents")

SOURCE_KEY = "events"

_CANDIDATE_PATHS = [
    "/events",
    "/event",
    "/calendar",
    "/activities",
    "/university-events",
    "/category/events",
    "/category/event",
    "/?post_type=event",
]

_EVENT_ITEM_SELECTORS = [
    ".event-item",
    "article.event",
    ".event",
    "article.type-tribe_events",
    ".tribe-event-url",
    ".events-archive article",
    ".event-listing",
    "article",
]

_DATE_SELECTORS_EVENT = [
    ".event-date",
    ".tribe-event-date",
    ".event-time",
    "time",
    ".date",
    "abbr.dtstart",
]

_VENUE_SELECTORS = [
    ".event-venue",
    ".venue",
    ".tribe-venue",
    ".location",
    ".event-location",
]


def _discover_events_url(session) -> Optional[str]:
    base = config.INTRANET_BASE_URL.rstrip("/")
    page = session.get_page()

    for path in _CANDIDATE_PATHS:
        url = base + path
        try:
            resp = session.navigate(url, wait_until="domcontentloaded")
            if resp and resp.status < 400:
                for sel in _EVENT_ITEM_SELECTORS:
                    try:
                        items = page.query_selector_all(sel)
                        if len(items) >= 1:
                            logger.info(f"Found events at: {page.url}")
                            return page.url
                    except Exception:
                        continue
        except Exception:
            continue

    # Try navigation links
    try:
        session.navigate(base, wait_until="domcontentloaded")
        links = page.query_selector_all("nav a, .menu a, header a, .navigation a")
        for link in links:
            text = get_text(link).lower()
            if any(kw in text for kw in ["event", "calendar", "activity", "activities"]):
                href = normalize_url(get_attr(link, "href"), base)
                if href and session.is_same_origin(href):
                    return href
    except Exception:
        pass

    return None


def _parse_event_dates(el) -> dict:
    """Extract start/end dates from an event element."""
    result = {"event_start": None, "event_end": None, "published_at": None}

    for sel in _DATE_SELECTORS_EVENT:
        try:
            date_el = el.query_selector(sel)
            if date_el:
                val = get_text(date_el) or get_attr(date_el, "datetime") or get_attr(date_el, "content")
                if val:
                    # Look for date range pattern: "12 Nov - 14 Nov 2026"
                    range_match = re.search(
                        r"(\d{1,2}\s+\w+(?:\s+\d{4})?)\s*[-–—to]+\s*(\d{1,2}\s+\w+\s+\d{4})",
                        val, re.IGNORECASE
                    )
                    if range_match:
                        result["event_start"] = range_match.group(1)
                        result["event_end"] = range_match.group(2)
                    else:
                        result["event_start"] = val
                        result["published_at"] = val
                    break
        except Exception:
            continue

    return result


def _extract_event_from_element(el, page_url: str) -> Optional[dict]:
    title_text = ""
    source_url = None

    for sel in ["h1", "h2", "h3", ".event-title", ".tribe-event-url a", "a", ".title"]:
        try:
            title_el = el.query_selector(sel)
            if title_el:
                title_text = get_text(title_el)
                href = get_attr(title_el, "href") if sel == "a" else None
                if not href:
                    link_el = el.query_selector("a[href]")
                    if link_el:
                        href = get_attr(link_el, "href")
                if href:
                    source_url = normalize_url(href, config.INTRANET_BASE_URL)
                if title_text:
                    break
        except Exception:
            continue

    if not title_text:
        return None

    dates = _parse_event_dates(el)

    description = ""
    for sel in [".event-description", ".tribe-event-description", ".description", ".summary", "p"]:
        try:
            desc_el = el.query_selector(sel)
            if desc_el:
                description = get_text(desc_el)
                if description:
                    break
        except Exception:
            continue

    venue = ""
    for sel in _VENUE_SELECTORS:
        try:
            venue_el = el.query_selector(sel)
            if venue_el:
                venue = get_text(venue_el)
                if venue:
                    break
        except Exception:
            continue

    dept = ""
    for sel in [".department", ".category", ".dept"]:
        try:
            dept_el = el.query_selector(sel)
            if dept_el:
                dept = get_text(dept_el)
                if dept:
                    break
        except Exception:
            continue

    audience = config.AUDIENCE_COHORT if dept else config.AUDIENCE_SHARED

    return {
        "source_key": SOURCE_KEY,
        "content_type": "event",
        "audience": audience,
        "title": clean_text(title_text),
        "summary": make_summary(description),
        "body": clean_text(description) or None,
        "published_at": dates.get("published_at"),
        "event_start": dates.get("event_start"),
        "event_end": dates.get("event_end"),
        "source_url": source_url or page_url,
        "department": clean_text(dept) or None,
        "metadata": {"venue": clean_text(venue)} if venue else None,
    }


def run_events(session, db) -> dict:
    """Scrape events/calendar section and upsert into DB."""
    counts = {"new": 0, "updated": 0, "unchanged": 0, "errors": 0}

    events_url = _discover_events_url(session)
    if not events_url:
        logger.warning("Could not discover events URL on intranet")
        return counts

    logger.info(f"Scraping events from: {events_url}")
    items_by_url: dict[str, dict] = {}

    for page_obj in paginate(session, events_url):
        for sel in _EVENT_ITEM_SELECTORS:
            try:
                items = page_obj.query_selector_all(sel)
                if not items:
                    continue
                for el in items:
                    item = _extract_event_from_element(el, page_obj.url)
                    if item and item.get("title"):
                        url = item.get("source_url", page_obj.url)
                        items_by_url[url] = item
                if items_by_url:
                    break
            except Exception as exc:
                logger.warning(f"Event extraction error: {exc}")
        time.sleep(config.INTER_REQUEST_DELAY_S)

    logger.info(f"Discovered {len(items_by_url)} event items")

    for url, item in items_by_url.items():
        try:
            from normalizer import normalize_item
            normalized = normalize_item(item, SOURCE_KEY)
            if not normalized:
                counts["errors"] += 1
                continue
            result = db.upsert_item(normalized)
            counts[result] += 1
        except Exception as exc:
            logger.error(f"Failed to upsert event {url}: {exc}")
            counts["errors"] += 1

    return counts
