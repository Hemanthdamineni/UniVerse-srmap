"""
Scraper for intranet documents, notices, and resource links.

Collects: policies, guidelines, forms, FAQs, useful links.
Audience: shared — these are institutional documents available to all students.
"""

import logging
import time
from typing import Optional
from urllib.parse import urlparse

import config
from scrapers.base import (
    extract_document_links,
    get_attr,
    get_text,
    paginate,
)
from normalizer import clean_text, normalize_url, make_summary

logger = logging.getLogger("IntranetDocuments")

SOURCE_KEY = "documents"

_CANDIDATE_PATHS = [
    "/documents",
    "/downloads",
    "/resources",
    "/forms",
    "/policies",
    "/guidelines",
    "/faqs",
    "/faq",
    "/useful-links",
    "/links",
    "/student-resources",
    "/circulars",
    "/notices",
]

# Content types by URL/title keyword
_TYPE_MAPPING = {
    "policy": "document",
    "guideline": "document",
    "form": "document",
    "circular": "circular",
    "notice": "notice",
    "faq": "document",
    "link": "link",
}


def _classify_content_type(title: str, url: str) -> str:
    """Infer content type from title/URL keywords."""
    combined = (title + " " + url).lower()
    for kw, ct in _TYPE_MAPPING.items():
        if kw in combined:
            return ct
    return "document"


def _discover_document_urls(session) -> list[str]:
    """Find document/resource section URLs on the intranet."""
    base = config.INTRANET_BASE_URL.rstrip("/")
    page = session.get_page()
    found = []

    for path in _CANDIDATE_PATHS:
        url = base + path
        try:
            resp = session.navigate(url, wait_until="domcontentloaded")
            if resp and resp.status < 400:
                current = page.url
                # Verify there's useful content
                doc_links = extract_document_links(page, current)
                any_links = page.query_selector_all("a[href]")
                if doc_links or len(any_links) > 5:
                    found.append(current)
                    if len(found) >= 3:
                        break
        except Exception:
            continue
        time.sleep(config.INTER_REQUEST_DELAY_S * 0.5)

    if not found:
        # Try navigation links
        try:
            session.navigate(base, wait_until="domcontentloaded")
            links = page.query_selector_all("nav a, .menu a, header a, footer a")
            for link in links:
                text = get_text(link).lower()
                if any(kw in text for kw in ["document", "download", "resource", "form", "policy",
                                              "guideline", "faq", "link", "notice"]):
                    href = normalize_url(get_attr(link, "href"), base)
                    if href and session.is_same_origin(href) and href not in found:
                        found.append(href)
        except Exception:
            pass

    return found


def run_documents(session, db) -> dict:
    """Scrape documents, resources, and useful links."""
    counts = {"new": 0, "updated": 0, "unchanged": 0, "errors": 0}

    doc_urls = _discover_document_urls(session)
    if not doc_urls:
        logger.warning("Could not discover documents/resources URL on intranet")
        return counts

    items_by_url: dict[str, dict] = {}

    for doc_url in doc_urls:
        logger.info(f"Scraping documents from: {doc_url}")
        try:
            for page_obj in paginate(session, doc_url, max_pages=5):
                # Collect all anchor links on the page
                try:
                    links = page_obj.query_selector_all("a[href]")
                    for link in links:
                        href = get_attr(link, "href")
                        if not href:
                            continue
                        abs_url = normalize_url(href, config.INTRANET_BASE_URL)
                        if not abs_url:
                            continue
                        if abs_url in items_by_url:
                            continue

                        label = clean_text(get_text(link))
                        if not label or len(label) < 3:
                            continue

                        # Determine content type
                        parsed = urlparse(abs_url)
                        path_lower = parsed.path.lower()
                        is_doc = any(path_lower.endswith(ext) for ext in
                                     [".pdf", ".docx", ".doc", ".xlsx", ".pptx", ".zip"])
                        is_external = not session.is_same_origin(abs_url)

                        if is_doc or (not is_external and session.is_same_origin(abs_url)):
                            content_type = _classify_content_type(label, abs_url)
                            item = {
                                "source_key": SOURCE_KEY,
                                "content_type": content_type,
                                "audience": config.AUDIENCE_SHARED,
                                "title": label,
                                "source_url": abs_url,
                                "document_links": [{"url": abs_url, "label": label}] if is_doc else None,
                            }
                            items_by_url[abs_url] = item

                except Exception as exc:
                    logger.warning(f"Link extraction error on {page_obj.url}: {exc}")
                time.sleep(config.INTER_REQUEST_DELAY_S)

        except Exception as exc:
            logger.error(f"Failed to process document section {doc_url}: {exc}")

    logger.info(f"Discovered {len(items_by_url)} document/resource items")

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
            logger.error(f"Failed to upsert document {url}: {exc}")
            counts["errors"] += 1

    return counts
