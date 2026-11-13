"""
Scraper for intranet academic information.

Collects: academic calendar, examination schedules, deadlines.
Audience: shared (academic content is university-wide unless dept-specific).
"""

import logging
import time
from typing import Optional

import config
from scrapers.base import (
    extract_document_links,
    get_attr,
    get_text,
    paginate,
)
from normalizer import clean_text, normalize_url, make_summary

logger = logging.getLogger("IntranetAcademic")

SOURCE_KEY = "academic"

_CANDIDATE_PATHS = [
    "/academics",
    "/academic-calendar",
    "/examination",
    "/exam-schedule",
    "/timetable",
    "/schedules",
    "/academic",
    "/semester",
    "/academic-announcements",
    "/student-affairs",
    "/registrar",
]

_DOC_ITEM_SELECTORS = [
    ".academic-item",
    ".schedule-item",
    "article",
    ".post",
    "li",
    "tr",
]


def _discover_academic_url(session) -> Optional[str]:
    base = config.INTRANET_BASE_URL.rstrip("/")
    page = session.get_page()

    for path in _CANDIDATE_PATHS:
        url = base + path
        try:
            resp = session.navigate(url, wait_until="domcontentloaded")
            if resp and resp.status < 400:
                current = page.url
                # Look for tables, lists, or items with academic content
                content_selectors = ["table", "ul li a[href*='pdf']", "ul li a", ".schedule"]
                for sel in content_selectors:
                    try:
                        items = page.query_selector_all(sel)
                        if len(items) >= 1:
                            logger.info(f"Found academic content at: {current}")
                            return current
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
            if any(kw in text for kw in ["academic", "exam", "schedule", "calendar", "registrar"]):
                href = normalize_url(get_attr(link, "href"), base)
                if href and session.is_same_origin(href):
                    return href
    except Exception:
        pass

    return None


def _extract_academic_item(el, page_url: str) -> Optional[dict]:
    """Extract academic item from an element (supports tables, list items, articles)."""
    # Try to get a link+title combination
    title_text = ""
    source_url = None

    try:
        link_el = el.query_selector("a[href]")
        if link_el:
            title_text = get_text(link_el)
            href = get_attr(link_el, "href")
            source_url = normalize_url(href, config.INTRANET_BASE_URL)
    except Exception:
        pass

    if not title_text:
        # Fallback: use cell/row text
        title_text = clean_text(get_text(el))

    if not title_text or len(title_text) < 5:
        return None

    date_text = None
    for sel in ["td:nth-child(1)", "td:nth-child(2)", ".date", "time"]:
        try:
            date_el = el.query_selector(sel)
            if date_el:
                date_text = get_text(date_el)
                if date_text:
                    break
        except Exception:
            continue

    doc_links = extract_document_links(el, config.INTRANET_BASE_URL)

    return {
        "source_key": SOURCE_KEY,
        "content_type": "academic",
        "audience": config.AUDIENCE_SHARED,
        "title": clean_text(title_text),
        "published_at": date_text,
        "source_url": source_url or page_url,
        "document_links": doc_links,
    }


def run_academic(session, db) -> dict:
    """Scrape academic information and upsert into DB."""
    counts = {"new": 0, "updated": 0, "unchanged": 0, "errors": 0}

    academic_url = _discover_academic_url(session)
    if not academic_url:
        logger.warning("Could not discover academic info URL on intranet")
        return counts

    logger.info(f"Scraping academic info from: {academic_url}")
    items_by_url: dict[str, dict] = {}

    for page_obj in paginate(session, academic_url, max_pages=5):
        # Try table rows first (common for academic schedules)
        try:
            rows = page_obj.query_selector_all("table tbody tr")
            if rows:
                for row in rows:
                    item = _extract_academic_item(row, page_obj.url)
                    if item:
                        items_by_url[item["source_url"]] = item
        except Exception:
            pass

        # Then try list items
        for sel in _DOC_ITEM_SELECTORS:
            try:
                items = page_obj.query_selector_all(sel)
                for el in items:
                    item = _extract_academic_item(el, page_obj.url)
                    if item and item["source_url"] not in items_by_url:
                        items_by_url[item["source_url"]] = item
            except Exception:
                continue

        # Also collect PDF/document links directly on the page
        doc_links = extract_document_links(page_obj, page_obj.url)
        for dl in doc_links:
            url = dl["url"]
            if url not in items_by_url:
                label = dl.get("label") or url.split("/")[-1]
                items_by_url[url] = {
                    "source_key": SOURCE_KEY,
                    "content_type": "document",
                    "audience": config.AUDIENCE_SHARED,
                    "title": clean_text(label),
                    "source_url": url,
                    "document_links": [dl],
                }

        time.sleep(config.INTER_REQUEST_DELAY_S)

    logger.info(f"Discovered {len(items_by_url)} academic items")

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
            logger.error(f"Failed to upsert academic item {url}: {exc}")
            counts["errors"] += 1

    return counts
