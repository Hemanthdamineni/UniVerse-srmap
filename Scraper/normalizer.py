import uuid
import logging
from datetime import datetime
from typing import Optional

from intelligence import extract_skills, parse_eligible_years, compute_base_relevance, parse_stipend
from deduplicator import generate_fingerprint, compute_dupe_key

logger = logging.getLogger("Normalizer")


def _safe_str(val: object) -> str:
    """Coerce to string safely, return empty string for None."""
    if val is None:
        return ""
    return str(val).strip()


def _safe_date(val: object) -> Optional[str]:
    """Attempt to parse / pass-through a date string. Returns ISO string or None."""
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("nat", "none", "null", "nan"):
        return None
    # If it's already ISO-ish, return it
    try:
        datetime.fromisoformat(s.replace("Z", "+00:00"))
        return s
    except (ValueError, TypeError):
        pass
    # Try common formats
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(s, fmt).isoformat()
        except ValueError:
            continue
    logger.debug(f"Unparseable date string: {s!r}")
    return None


def normalize_opportunity(raw_data: dict, source: str) -> Optional[dict]:
    """Normalize raw scraped data into canonical opportunity schema.

    Returns None if the data fails validation (missing required fields).
    """
    now = datetime.now().isoformat()

    title = _safe_str(raw_data.get("title"))
    source_url = _safe_str(raw_data.get("sourceUrl"))

    # ── Validation ───────────────────────────────────────────────────────
    if not title or title.lower() in ("untitled", "untitled opportunity", "unknown"):
        logger.warning(f"Skipping opportunity with empty/invalid title from {source}")
        return None

    if not source_url:
        logger.warning(f"Skipping opportunity '{title}' from {source}: no sourceUrl")
        return None

    # ── Type validation ──────────────────────────────────────────────────
    raw_type = _safe_str(raw_data.get("type")).lower() or "job"
    valid_types = {"job", "internship", "hackathon", "competition", "fellowship", "workshop"}
    opp_type = raw_type if raw_type in valid_types else "job"

    # ── Mode validation ──────────────────────────────────────────────────
    raw_mode = _safe_str(raw_data.get("mode")).lower() or "onsite"
    valid_modes = {"remote", "onsite", "hybrid", "online", "offline"}
    mode = raw_mode if raw_mode in valid_modes else "onsite"

    # ── Build canonical object ───────────────────────────────────────────
    description = _safe_str(raw_data.get("description"))

    opp: dict = {
        "id": str(uuid.uuid4()),
        "type": opp_type,
        "title": title,
        "company": raw_data.get("company"),
        "organizer": raw_data.get("organizer"),
        "description": description,
        "requirements": raw_data.get("requirements"),
        "location": raw_data.get("location"),
        "mode": mode,
        "isPanIndia": raw_data.get("isPanIndia", False),
        "stipend": raw_data.get("stipend"),
        "prize": raw_data.get("prize"),
        "isFree": raw_data.get("isFree", True),
        "postedAt": _safe_date(raw_data.get("postedAt")),
        "deadline": _safe_date(raw_data.get("deadline")),
        "startDate": _safe_date(raw_data.get("startDate")),
        "duration": raw_data.get("duration"),
        "source": source,
        "sourceUrl": source_url,
        "applyUrl": _safe_str(raw_data.get("applyUrl")) or source_url,
        "scrapedAt": now,
        "updatedAt": now,
    }

    # ── Intelligence-based fields ────────────────────────────────────────
    full_text = f"{opp['title']} {opp['description']} {_safe_str(opp.get('requirements'))}"

    # Structured stipend range (monthly INR) for sorting/filtering.
    stipend_low, stipend_high = parse_stipend(opp.get("stipend"))
    opp["stipendMin"] = stipend_low
    opp["stipendMax"] = stipend_high
    opp["skills"] = extract_skills(full_text)
    opp["eligibleYears"] = parse_eligible_years(full_text)
    opp["shortDescription"] = description[:200].strip() if description else ""

    # ── Tags ─────────────────────────────────────────────────────────────
    opp["tags"] = [opp["type"]]
    if opp["mode"]:
        opp["tags"].append(opp["mode"])

    # ── Eligibility branches ─────────────────────────────────────────────
    opp["eligibleBranches"] = []

    # ── Fingerprint for cross-source dedup ───────────────────────────────
    opp["fingerprint"] = generate_fingerprint(opp)
    opp["sources"] = [source]
    # Near-duplicate key (normalized title+employer) used by the DB merge step.
    opp["dupeKey"] = compute_dupe_key(opp)

    # ── Relevance score ──────────────────────────────────────────────────
    opp["relevanceScore"] = compute_base_relevance(opp)

    return opp


def from_jobspy(row) -> Optional[dict]:
    """Normalize a pandas Series row from python-jobspy."""
    try:
        title = _safe_str(row.get("title"))
        if not title:
            return None

        posted_at = None
        raw_date = row.get("date_posted")
        if raw_date is not None:
            if hasattr(raw_date, "isoformat"):
                posted_at = raw_date.isoformat()
            else:
                posted_at = _safe_date(str(raw_date))

        raw = {
            "type": "internship" if "intern" in title.lower() else "job",
            "title": title,
            "company": _safe_str(row.get("company")),
            "description": _safe_str(row.get("description")),
            "location": _safe_str(row.get("location")),
            "mode": "remote" if row.get("is_remote") else "onsite",
            "sourceUrl": _safe_str(row.get("job_url")),
            "postedAt": posted_at,
        }
        return normalize_opportunity(raw, "jobspy")
    except Exception as e:
        logger.error(f"Error normalizing jobspy row: {e}")
        return None


def from_devfolio(raw_card: dict) -> Optional[dict]:
    """Normalize a Devfolio hackathon card."""
    try:
        raw = {
            "type": "hackathon",
            "title": raw_card.get("title", ""),
            "organizer": raw_card.get("organizer"),
            "description": raw_card.get("description", ""),
            "location": raw_card.get("location"),
            "mode": "online" if raw_card.get("is_online") else "offline",
            "sourceUrl": raw_card.get("url", ""),
            "deadline": raw_card.get("deadline"),
            "prize": raw_card.get("prize"),
        }
        return normalize_opportunity(raw, "devfolio")
    except Exception as e:
        logger.error(f"Error normalizing devfolio card: {e}")
        return None
