"""
Data normalization utilities for intranet content.

Converts raw scraped dicts into the canonical intranet_items schema.
"""

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urljoin, urlparse

import config

logger = logging.getLogger("IntranetNormalizer")

# ── Date parsing ───────────────────────────────────────────────────────────────

_DATE_FORMATS = [
    "%d %B %Y",
    "%d %b %Y",
    "%B %d, %Y",
    "%b %d, %Y",
    "%Y-%m-%d",
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%Y/%m/%d",
    "%d.%m.%Y",
    "%m/%d/%Y",
    "%d %B, %Y",
    "%d %b, %Y",
]


def safe_parse_date(val: object, field_name: str = "date") -> Optional[str]:
    """Attempt to parse a date value. Returns ISO string or None.

    Does NOT invent dates. Returns None for ambiguous or missing values.
    """
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("", "nat", "none", "null", "nan", "n/a", "tbd", "tba"):
        return None

    # Already ISO-ish
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        # Keep original timezone information
        return dt.isoformat()
    except (ValueError, TypeError):
        pass

    # Strip common prefixes
    s_clean = re.sub(r"^(posted|updated|published|on|at|from|deadline)\s*:?\s*", "", s,
                     flags=re.IGNORECASE).strip()

    for fmt in _DATE_FORMATS:
        try:
            dt = datetime.strptime(s_clean, fmt)
            # Return as date-only ISO (no invented time component)
            return dt.date().isoformat()
        except ValueError:
            continue

    logger.debug(f"Cannot parse {field_name} date: {s!r}")
    return None


# ── URL normalization ──────────────────────────────────────────────────────────

def normalize_url(url: Optional[str], base: str = "") -> Optional[str]:
    """Ensure URL is absolute and belongs to the intranet origin."""
    if not url:
        return None
    url = str(url).strip()
    if not url or url.startswith("javascript:") or url.startswith("#"):
        return None
    if url.startswith("//"):
        url = "https:" + url
    if url.startswith("/") and base:
        url = urljoin(base, url)
    if not url.startswith("http"):
        if base:
            url = urljoin(base, url)
        else:
            return None
    return url


def is_intranet_url(url: str, base: str = config.INTRANET_BASE_URL) -> bool:
    """Return True if url belongs to the intranet origin."""
    if not url:
        return False
    base_host = urlparse(base).netloc.lower()
    target_host = urlparse(url).netloc.lower()
    return target_host == base_host


# ── Text cleaning ──────────────────────────────────────────────────────────────

def clean_text(text: Optional[str], max_len: int = 0) -> str:
    """Strip excessive whitespace from scraped text."""
    if not text:
        return ""
    cleaned = re.sub(r"\s+", " ", str(text)).strip()
    if max_len and len(cleaned) > max_len:
        cleaned = cleaned[:max_len].rsplit(" ", 1)[0] + "…"
    return cleaned


def make_summary(body: str, max_len: int = 300) -> str:
    """Generate a summary from body text (first sentence or 300 chars)."""
    if not body:
        return ""
    # Take first paragraph
    first = re.split(r"\n{2,}|\.\s+", body.strip(), maxsplit=1)[0]
    if len(first) > max_len:
        first = first[:max_len].rsplit(" ", 1)[0] + "…"
    return first.strip()


# ── Item normalization ─────────────────────────────────────────────────────────

VALID_CONTENT_TYPES = {
    "announcement", "event", "news", "notice", "document", "circular",
    "academic", "facility", "directory", "link", "achievement",
}

VALID_AUDIENCES = {
    config.AUDIENCE_SHARED,
    config.AUDIENCE_COHORT,
    config.AUDIENCE_STUDENT_SPECIFIC,
    config.AUDIENCE_RESTRICTED,
}


def normalize_item(raw: dict, source_key: str) -> Optional[dict]:
    """Normalize a raw scraped dict to the canonical intranet_items schema.

    Returns None if the item fails validation (missing required fields).
    """
    title = clean_text(raw.get("title"))
    source_url = normalize_url(raw.get("source_url") or raw.get("url"), config.INTRANET_BASE_URL)

    if not title:
        logger.debug(f"[{source_key}] Skipping item with empty title")
        return None
    if not source_url:
        logger.debug(f"[{source_key}] Skipping item '{title}': no source URL")
        return None

    content_type = str(raw.get("content_type", "announcement")).lower()
    if content_type not in VALID_CONTENT_TYPES:
        logger.debug(f"[{source_key}] Unknown content_type '{content_type}'; defaulting to 'announcement'")
        content_type = "announcement"

    audience = str(raw.get("audience", config.AUDIENCE_SHARED)).lower()
    if audience not in VALID_AUDIENCES:
        audience = config.AUDIENCE_SHARED

    body = clean_text(raw.get("body") or raw.get("content") or raw.get("description"))
    summary_raw = clean_text(raw.get("summary") or raw.get("excerpt"))
    summary = summary_raw or (make_summary(body) if body else "")

    tags_raw = raw.get("tags") or raw.get("categories") or []
    if isinstance(tags_raw, str):
        tags_raw = [t.strip() for t in tags_raw.split(",") if t.strip()]
    tags = [clean_text(t) for t in tags_raw if t]

    document_links_raw = raw.get("document_links") or raw.get("attachments") or []
    document_links = []
    for dl in document_links_raw:
        if isinstance(dl, str):
            norm = normalize_url(dl, config.INTRANET_BASE_URL)
            if norm:
                document_links.append({"url": norm, "label": ""})
        elif isinstance(dl, dict):
            norm = normalize_url(dl.get("url"), config.INTRANET_BASE_URL)
            if norm:
                document_links.append({
                    "url": norm,
                    "label": clean_text(dl.get("label") or dl.get("title") or ""),
                })

    return {
        "id": raw.get("id") or str(uuid.uuid4()),
        "source_key": source_key,
        "content_type": content_type,
        "audience": audience,
        "title": title,
        "summary": summary or None,
        "body": body or None,
        "published_at": safe_parse_date(raw.get("published_at") or raw.get("date"), "published_at"),
        "effective_at": safe_parse_date(raw.get("effective_at"), "effective_at"),
        "expires_at": safe_parse_date(raw.get("expires_at") or raw.get("expiry"), "expires_at"),
        "event_start": safe_parse_date(raw.get("event_start") or raw.get("start_date"), "event_start"),
        "event_end": safe_parse_date(raw.get("event_end") or raw.get("end_date"), "event_end"),
        "deadline": safe_parse_date(raw.get("deadline"), "deadline"),
        "department": clean_text(raw.get("department")) or None,
        "programme": clean_text(raw.get("programme") or raw.get("program")) or None,
        "semester": clean_text(raw.get("semester")) or None,
        "tags": tags or None,
        "source_url": source_url,
        "canonical_url": normalize_url(raw.get("canonical_url"), config.INTRANET_BASE_URL) or source_url,
        "document_links": document_links or None,
        "attachments": raw.get("attachments_meta") or None,
        "metadata": raw.get("metadata") or None,
    }
