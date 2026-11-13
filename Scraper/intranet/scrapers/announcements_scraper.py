"""
Scraper for intranet announcements and notices.

Audience classification:
  - Announcements on the main feed → shared (visible to all students)
  - Department-specific notices → cohort
  - Personal/individual notifications → student_specific (not collected)
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
    parse_meta_date,
)
from normalizer import clean_text, normalize_url, make_summary

logger = logging.getLogger("IntranetAnnouncements")

SOURCE_KEY = "announcements"

# Likely announcement/notice section paths on the intranet
_CANDIDATE_PATHS = [
    "/announcements",
    "/notices",
    "/circulars",
    "/notifications",
    "/news-and-announcements",
    "/category/announcements",
    "/category/notices",
    "/noticeboard",
    "/notice-board",
    "/?page_id=announcements",
]

# CSS selectors for announcement list items (tried in order, first match wins)
_LIST_ITEM_SELECTORS = [
    ".announcement-item",
    ".notice-item",
    ".post-item",
    "article.post",
    "article",
    ".entry",
    "li.announcement",
    "li.notice",
    ".news-item",
    ".item",
    ".post",
]

_TITLE_SELECTORS = ["h1", "h2", "h3", "h4", ".title", ".post-title", ".entry-title", "a"]
_DATE_SELECTORS = [".date", ".post-date", "time", ".published", ".entry-date", "span.date"]
_BODY_SELECTORS = [".content", ".post-content", ".entry-content", ".body", ".description", "p"]
_DEPT_SELECTORS = [".department", ".dept", ".category", "span.dept"]


def _discover_announcement_url(session) -> Optional[str]:
    """Find the main announcements URL on the intranet."""
    base = config.INTRANET_BASE_URL.rstrip("/")
    page = session.get_page()

    # Try known paths
    for path in _CANDIDATE_PATHS:
        url = base + path
        try:
            resp = session.navigate(url, wait_until="domcontentloaded")
            if resp and resp.status < 400:
                current = page.url
                # Verify the page looks like an announcement list
                for sel in _LIST_ITEM_SELECTORS:
                    try:
                        items = page.query_selector_all(sel)
                        if len(items) >= 2:
                            logger.info(f"Found announcements at: {current}")
                            return current
                    except Exception:
                        continue
        except Exception:
            continue

    # Try navigation links from homepage
    try:
        resp = session.navigate(base, wait_until="domcontentloaded")
        if resp and resp.status < 400:
            links = page.query_selector_all("nav a, .menu a, header a, .navigation a")
            for link in links:
                text = get_text(link).lower()
                if any(kw in text for kw in ["announcement", "notice", "circular", "notification"]):
                    href = normalize_url(get_attr(link, "href"), base)
                    if href and session.is_same_origin(href):
                        logger.info(f"Found announcements link in nav: {href}")
                        return href
    except Exception:
        pass

    return None


def _extract_item_from_element(el, page_url: str, session) -> Optional[dict]:
    """Extract a single announcement from a list item element."""
    # Title
    title_text = ""
    title_url = None
    for sel in _TITLE_SELECTORS:
        try:
            title_el = el.query_selector(sel)
            if title_el:
                title_text = get_text(title_el)
                if sel == "a":
                    title_url = get_attr(title_el, "href")
                else:
                    link_el = el.query_selector("a[href]")
                    if link_el:
                        title_url = get_attr(link_el, "href")
                if title_text:
                    break
        except Exception:
            continue

    if not title_text:
        return None

    # Source URL
    source_url = normalize_url(title_url, config.INTRANET_BASE_URL) or page_url

    # Date
    date_text = None
    for sel in _DATE_SELECTORS:
        try:
            date_el = el.query_selector(sel)
            if date_el:
                date_text = get_text(date_el) or get_attr(date_el, "datetime")
                if date_text:
                    break
        except Exception:
            continue

    # Body / summary
    body_text = ""
    for sel in _BODY_SELECTORS:
        try:
            body_el = el.query_selector(sel)
            if body_el:
                body_text = get_text(body_el)
                if body_text:
                    break
        except Exception:
            continue

    # Department (may indicate cohort-specific)
    dept = ""
    for sel in _DEPT_SELECTORS:
        try:
            dept_el = el.query_selector(sel)
            if dept_el:
                dept = get_text(dept_el)
                if dept:
                    break
        except Exception:
            continue

    # Document links in the item
    try:
        doc_links = extract_document_links(el, config.INTRANET_BASE_URL)
    except Exception:
        doc_links = []

    audience = config.AUDIENCE_COHORT if dept else config.AUDIENCE_SHARED

    return {
        "source_key": SOURCE_KEY,
        "content_type": "announcement",
        "audience": audience,
        "title": clean_text(title_text),
        "summary": make_summary(body_text),
        "body": clean_text(body_text) or None,
        "published_at": date_text,
        "source_url": source_url,
        "department": clean_text(dept) or None,
        "document_links": doc_links,
    }


def _extract_detail_page(session, url: str) -> Optional[dict]:
    """Extract the full content of an announcement detail page."""
    try:
        session.navigate(url)
        page = session.get_page()
    except Exception as exc:
        logger.warning(f"Cannot load detail page {url}: {exc}")
        return None

    title = ""
    for sel in ["h1", "h2.post-title", ".entry-title", ".page-title"]:
        try:
            el = page.query_selector(sel)
            if el:
                title = get_text(el)
                if title:
                    break
        except Exception:
            continue

    if not title:
        return None

    body = ""
    for sel in [".entry-content", ".post-content", ".content", "article", "main", ".body"]:
        try:
            el = page.query_selector(sel)
            if el:
                body = get_text(el)
                if body:
                    break
        except Exception:
            continue

    published_at = parse_meta_date(page)
    doc_links = extract_document_links(page, url)

    return {
        "source_key": SOURCE_KEY,
        "content_type": "announcement",
        "audience": config.AUDIENCE_SHARED,
        "title": clean_text(title),
        "summary": make_summary(body),
        "body": clean_text(body) or None,
        "published_at": published_at,
        "source_url": url,
        "document_links": doc_links,
    }


def run_announcements(session, db) -> dict:
    """Scrape announcement/notice section and upsert into DB.

    Returns counts: {new, updated, unchanged, errors}.
    """
    counts = {"new": 0, "updated": 0, "unchanged": 0, "errors": 0}

    ann_url = _discover_announcement_url(session)
    if not ann_url:
        logger.warning("Could not discover announcements URL on intranet")
        return counts

    logger.info(f"Scraping announcements from: {ann_url}")
    seen_urls: set[str] = set()
    items_by_url: dict[str, dict] = {}

    # Phase 1: collect list items across pages
    for page_obj in paginate(session, ann_url):
        for sel in _LIST_ITEM_SELECTORS:
            try:
                items = page_obj.query_selector_all(sel)
                if not items:
                    continue
                for el in items:
                    item = _extract_item_from_element(el, page_obj.url, session)
                    if item and item.get("source_url"):
                        items_by_url[item["source_url"]] = item
                if items_by_url:
                    break  # found working selector
            except Exception as exc:
                logger.warning(f"Element extraction error ({sel}): {exc}")

        time.sleep(config.INTER_REQUEST_DELAY_S)

    logger.info(f"Discovered {len(items_by_url)} announcement items")

    # Phase 2: upsert collected items
    for url, item in items_by_url.items():
        seen_urls.add(url)
        try:
            from normalizer import normalize_item
            normalized = normalize_item(item, SOURCE_KEY)
            if not normalized:
                counts["errors"] += 1
                continue
            result = db.upsert_item(normalized)
            counts[result] += 1
        except Exception as exc:
            logger.error(f"Failed to upsert announcement {url}: {exc}")
            counts["errors"] += 1

    return counts
