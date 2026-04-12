import re
from datetime import datetime
from config import TECH_SKILLS

def extract_skills(text: str) -> list[str]:
    if not text:
        return []
    text_lower = text.lower()
    # Use word boundaries to avoid matching sub-words (e.g., "git" in "digital")
    extracted = []
    for skill in TECH_SKILLS:
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text_lower):
            extracted.append(skill)
    return sorted(list(set(extracted)))

def parse_eligible_years(text: str) -> list[int]:
    if not text:
        return []
    text = text.lower()
    years = []
    # Matches "3rd year", "final year", "2026 batch", etc.
    if "final year" in text or "4th year" in text or "fourth year" in text:
        years.append(4)
    if "3rd year" in text or "third year" in text:
        years.append(3)
    if "2nd year" in text or "second year" in text:
        years.append(2)
    if "1st year" in text or "first year" in text:
        years.append(1)
    
    # Batch years (current year is 2026)
    match_2026 = re.search(r'\b2026\b', text)
    if match_2026: years.append(4)
    match_2027 = re.search(r'\b2027\b', text)
    if match_2027: years.append(3)
    
    return sorted(list(set(years)))

def compute_base_relevance(opportunity: dict) -> float:
    score = 0.0
    now = datetime.now()

    # Recency (max 30 points)
    posted_at_str = opportunity.get("postedAt")
    if posted_at_str:
        try:
            # Try to handle various ISO formats
            posted_at = datetime.fromisoformat(posted_at_str.replace('Z', '+00:00'))
            days_old = (now - posted_at).days
            score += max(0, 30 - days_old * 2)
        except (ValueError, TypeError):
            score += 15 # Default if unparseable

    # Deadline urgency (max 20 points)
    deadline_str = opportunity.get("deadline")
    if deadline_str:
        try:
            deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
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

    return round(score, 2)
