"""
Shared utilities for all intranet scrapers.

Provides HTML parsing helpers, link extraction, and pagination support.
All scrapers receive an authenticated IntranetSession.
"""

import logging
import re
import time
from typing import Generator, Optional
from urllib.parse import urljoin, urlparse

import config
from normalizer import clean_text, normalize_url, is_intranet_url

logger = logging.getLogger("IntranetScraper")


def get_text(el) -> str:
    """Safe inner_text() with fallback to empty string."""
    try:
        return el.inner_text().strip() if el else ""
    except Exception:
        return ""


def get_attr(el, attr: str, default: str = "") -> str:
    """Safe get_attribute() with fallback."""
    try:
        val = el.get_attribute(attr) if el else None
        return str(val).strip() if val else default
    except Exception:
        return default


def extract_links(page, base_url: str, selector: str = "a[href]",
                  same_origin_only: bool = True) -> list[dict]:
    """Extract links from the current page matching selector."""
    links = []
    try:
        elements = page.query_selector_all(selector)
        for el in elements:
            href = get_attr(el, "href")
            if not href:
                continue
            abs_url = normalize_url(href, base_url)
            if not abs_url:
                continue
            if same_origin_only and not is_intranet_url(abs_url):
                continue
            links.append({
                "url": abs_url,
                "label": get_text(el),
            })
    except Exception as exc:
        logger.warning(f"extract_links error: {exc}")
    return links


def find_next_page(page, base_url: str) -> Optional[str]:
    """Detect pagination and return the URL of the next page, or None."""
    next_selectors = [
        "a.next",
        "a[rel='next']",
        "a:has-text('Next')",
        "a:has-text('»')",
        "a:has-text('→')",
        ".pagination a:last-child",
        "nav.navigation a.next",
        ".nav-links a.next",
        ".page-numbers.next",
    ]
    for sel in next_selectors:
        try:
            el = page.query_selector(sel)
            if el and el.is_visible():
                href = get_attr(el, "href")
                if href:
                    return normalize_url(href, base_url)
        except Exception:
            continue
    return None


def paginate(session, start_url: str, *, max_pages: int = None) -> Generator[object, None, None]:
    """Navigate pages and yield each page object until no next page is found."""
    if max_pages is None:
        max_pages = config.MAX_PAGINATION_PAGES

    current_url = start_url
    for page_num in range(1, max_pages + 1):
        try:
            session.navigate(current_url)
        except Exception as exc:
            logger.error(f"Pagination: navigation failed for {current_url}: {exc}")
            break

        page = session.get_page()
        yield page

        next_url = find_next_page(page, current_url)
        if not next_url or next_url == current_url:
            break

        current_url = next_url
        time.sleep(config.INTER_REQUEST_DELAY_S)


def extract_document_links(page, base_url: str) -> list[dict]:
    """Extract document/attachment links (PDF, DOCX, etc.) from the page."""
    doc_extensions = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".zip"}
    links = []
    try:
        elements = page.query_selector_all("a[href]")
        for el in elements:
            href = get_attr(el, "href")
            if not href:
                continue
            abs_url = normalize_url(href, base_url)
            if not abs_url:
                continue
            parsed = urlparse(abs_url)
            path_lower = parsed.path.lower()
            if any(path_lower.endswith(ext) for ext in doc_extensions):
                links.append({
                    "url": abs_url,
                    "label": get_text(el) or parsed.path.split("/")[-1],
                })
    except Exception as exc:
        logger.warning(f"extract_document_links error: {exc}")
    return links


def parse_meta_date(page) -> Optional[str]:
    """Extract publication date from common meta tags."""
    meta_selectors = [
        "meta[property='article:published_time']",
        "meta[name='date']",
        "meta[name='pubdate']",
        "meta[property='og:published_time']",
        "meta[itemprop='datePublished']",
        "time[datetime]",
    ]
    for sel in meta_selectors:
        try:
            el = page.query_selector(sel)
            if el:
                val = el.get_attribute("content") or el.get_attribute("datetime")
                if val:
                    return str(val).strip()
        except Exception:
            continue
    return None
