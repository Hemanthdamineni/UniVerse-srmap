"""
Scraper for intranet news and achievements.

Audience: University-wide news and achievements are shared content.
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

logger = logging.getLogger("IntranetNews")

SOURCE_KEY = "news"

_CANDIDATE_PATHS = [
    "/news",
    "/latest-news",
    "/university-news",
    "/achievements",
    "/category/news",
    "/category/achievements",
    "/press-releases",
    "/media",
    "/in-the-news",
]

_NEWS_ITEM_SELECTORS = [
    ".news-item",
    ".achievement-item",
    "article.news",
    "article.post",
    "article",
    ".post",
    ".entry",
]


def _discover_news_url(session) -> Optional[str]:
    base = config.INTRANET_BASE_URL.rstrip("/")
    page = session.get_page()

    for path in _CANDIDATE_PATHS:
        url = base + path
        try:
            resp = session.navigate(url, wait_until="domcontentloaded")
            if resp and resp.status < 400:
                for sel in _NEWS_ITEM_SELECTORS:
                    try:
                        items = page.query_selector_all(sel)
                        if len(items) >= 2:
                            logger.info(f"Found news at: {page.url}")
                            return page.url
                    except Exception:
                        continue
        except Exception:
            continue

    # Try navigation links
    try:
        session.navigate(base, wait_until="domcontentloaded")
        links = page.query_selector_all("nav a, .menu a, header a")
        for link in links:
            text = get_text(link).lower()
            if any(kw in text for kw in ["news", "achievement", "press", "media"]):
                href = normalize_url(get_attr(link, "href"), base)
                if href and session.is_same_origin(href):
                    return href
    except Exception:
        pass

    return None


def _extract_news_item(el, page_url: str) -> Optional[dict]:
    title_text = ""
    source_url = None

    for sel in ["h1", "h2", "h3", ".title", ".post-title", "a"]:
        try:
            title_el = el.query_selector(sel)
            if title_el:
                title_text = get_text(title_el)
                link_el = el.query_selector("a[href]")
                if link_el:
                    source_url = normalize_url(get_attr(link_el, "href"), config.INTRANET_BASE_URL)
                if title_text:
                    break
        except Exception:
            continue

    if not title_text:
        return None

    date_text = None
    for sel in [".date", "time", ".post-date", ".published"]:
        try:
            date_el = el.query_selector(sel)
            if date_el:
                date_text = get_text(date_el) or get_attr(date_el, "datetime")
                if date_text:
                    break
        except Exception:
            continue

    body = ""
    for sel in [".excerpt", ".summary", ".description", "p"]:
        try:
            body_el = el.query_selector(sel)
            if body_el:
                body = get_text(body_el)
                if body:
                    break
        except Exception:
            continue

    tags = []
    try:
        cats = el.query_selector_all(".category, .tag, .label")
        tags = [clean_text(get_text(c)) for c in cats if get_text(c)]
    except Exception:
        pass

    return {
        "source_key": SOURCE_KEY,
        "content_type": "news",
        "audience": config.AUDIENCE_SHARED,
        "title": clean_text(title_text),
        "summary": make_summary(body),
        "body": clean_text(body) or None,
        "published_at": date_text,
        "source_url": source_url or page_url,
        "tags": tags or None,
    }


def run_news(session, db) -> dict:
    """Scrape news/achievements and upsert into DB."""
    counts = {"new": 0, "updated": 0, "unchanged": 0, "errors": 0}

    news_url = _discover_news_url(session)
    if not news_url:
        logger.warning("Could not discover news URL on intranet")
        return counts

    logger.info(f"Scraping news from: {news_url}")
    items_by_url: dict[str, dict] = {}

    for page_obj in paginate(session, news_url):
        for sel in _NEWS_ITEM_SELECTORS:
            try:
                items = page_obj.query_selector_all(sel)
                if not items:
                    continue
                for el in items:
                    item = _extract_news_item(el, page_obj.url)
                    if item:
                        url = item.get("source_url", page_obj.url)
                        items_by_url[url] = item
                if items_by_url:
                    break
            except Exception as exc:
                logger.warning(f"News extraction error: {exc}")
        time.sleep(config.INTER_REQUEST_DELAY_S)

    logger.info(f"Discovered {len(items_by_url)} news items")

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
            logger.error(f"Failed to upsert news item {url}: {exc}")
            counts["errors"] += 1

    return counts
