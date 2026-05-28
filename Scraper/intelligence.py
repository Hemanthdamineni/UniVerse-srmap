import re
import logging
from datetime import datetime
from config import TECH_SKILLS

logger = logging.getLogger("Intelligence")


def extract_skills(text: str) -> list[str]:
    """Extract known tech skills from text using word-boundary matching."""
    if not text:
        return []
    text_lower = text.lower()
    extracted: list[str] = []
    for skill in TECH_SKILLS:
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text_lower):
            extracted.append(skill)
    return sorted(set(extracted))


def parse_eligible_years(text: str) -> list[int]:
    """Parse eligible academic years from text."""
    if not text:
        return []
    text = text.lower()
    years: list[int] = []

    if "final year" in text or "4th year" in text or "fourth year" in text:
        years.append(4)
    if "3rd year" in text or "third year" in text:
        years.append(3)
    if "2nd year" in text or "second year" in text:
        years.append(2)
    if "1st year" in text or "first year" in text:
        years.append(1)

    # Batch years (current year is 2026)
    if re.search(r'\b2026\b', text):
        years.append(4)
    if re.search(r'\b2027\b', text):
        years.append(3)
    if re.search(r'\b2028\b', text):
        years.append(2)
    if re.search(r'\b2029\b', text):
        years.append(1)

    return sorted(set(years))


def compute_base_relevance(opportunity: dict) -> float:
    """Score an opportunity's relevance (0–100 scale)."""
    score = 0.0
    now = datetime.now()

    # Recency (max 30 points)
    posted_at_str = opportunity.get("postedAt")
    if posted_at_str:
        try:
            posted_at = datetime.fromisoformat(str(posted_at_str).replace("Z", "+00:00"))
            # Remove tzinfo for comparison if needed
            if posted_at.tzinfo and not now.tzinfo:
                posted_at = posted_at.replace(tzinfo=None)
            days_old = (now - posted_at).days
            score += max(0, 30 - days_old * 2)
        except (ValueError, TypeError):
            score += 15  # Default if unparseable

    # Deadline urgency (max 20 points)
    deadline_str = opportunity.get("deadline")
    if deadline_str:
        try:
            deadline = datetime.fromisoformat(str(deadline_str).replace("Z", "+00:00"))
            if deadline.tzinfo and not now.tzinfo:
                deadline = deadline.replace(tzinfo=None)
            days_left = (deadline - now).days
            if 0 < days_left <= 7:
                score += 20
            elif 7 < days_left <= 14:
                score += 10
        except (ValueError, TypeError):
            pass

    # Has compensation info (10 points)
    if opportunity.get("stipend") or opportunity.get("prize"):
        score += 10

    # Has apply link (5 points)
    if opportunity.get("applyUrl"):
        score += 5

    # Has description (5 points)
    desc = opportunity.get("description") or ""
    if len(desc) > 200:
        score += 5

    # Has skills extracted (5 points)
    skills = opportunity.get("skills") or []
    if len(skills) >= 2:
        score += 5

    return round(score, 2)
