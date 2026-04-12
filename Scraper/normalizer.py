import uuid
from datetime import datetime
from intelligence import extract_skills, parse_eligible_years, compute_base_relevance

from deduplicator import generate_fingerprint

def normalize_opportunity(raw_data: dict, source: str) -> dict:
    now = datetime.now().isoformat()
    
    # Common fields
    opp = {
        "id": str(uuid.uuid4()),
        "type": raw_data.get("type", "job"),
        "title": raw_data.get("title", "Untitled Opportunity").strip(),
        "company": raw_data.get("company"),
        "organizer": raw_data.get("organizer"),
        "description": raw_data.get("description", ""),
        "requirements": raw_data.get("requirements"),
        "location": raw_data.get("location"),
        "mode": raw_data.get("mode", "onsite"),
        "isPanIndia": raw_data.get("isPanIndia", False),
        "stipend": raw_data.get("stipend"),
        "prize": raw_data.get("prize"),
        "isFree": raw_data.get("isFree", True),
        "postedAt": raw_data.get("postedAt"),
        "deadline": raw_data.get("deadline"),
        "startDate": raw_data.get("startDate"),
        "duration": raw_data.get("duration"),
        "source": source,
        "sourceUrl": raw_data.get("sourceUrl"),
        "applyUrl": raw_data.get("applyUrl") or raw_data.get("sourceUrl"),
        "scrapedAt": now,
        "updatedAt": now,
    }

    # Intelligence-based fields
    full_text = f"{opp['title']} {opp['description']} {opp.get('requirements', '')}"
    opp["skills"] = extract_skills(full_text)
    opp["eligibleYears"] = parse_eligible_years(full_text)
    opp["shortDescription"] = opp["description"][:200].strip() if opp["description"] else ""
    
    # Default tags
    opp["tags"] = [opp["type"]]
    if opp["mode"]: opp["tags"].append(opp["mode"])
    
    # Eligibility branches (simple keyword match for now)
    opp["eligibleBranches"] = [] # Default all
    
    # Fingerprint for deduplication
    opp["fingerprint"] = generate_fingerprint(opp)
    opp["sources"] = [source]
    
    # Compute base relevance
    opp["relevanceScore"] = compute_base_relevance(opp)
    
    return opp

def from_jobspy(row) -> dict:
    # row is a pandas Series from jobspy
    raw = {
        "type": "job" if "intern" not in row['title'].lower() else "internship",
        "title": row['title'],
        "company": row['company'],
        "description": row['description'],
        "location": row['location'],
        "mode": "remote" if row.get('is_remote') else "onsite",
        "sourceUrl": row['job_url'],
        "postedAt": row['date_posted'].isoformat() if hasattr(row['date_posted'], 'isoformat') else str(row['date_posted']),
    }
    return normalize_opportunity(raw, "jobspy")

def from_devfolio(raw_card: dict) -> dict:
    raw = {
        "type": "hackathon",
        "title": raw_card['title'],
        "organizer": raw_card.get('organizer'),
        "description": raw_card.get('description', ''),
        "location": raw_card.get('location'),
        "mode": "online" if raw_card.get('is_online') else "offline",
        "sourceUrl": raw_card['url'],
        "deadline": raw_card.get('deadline'),
        "prize": raw_card.get('prize'),
    }
    return normalize_opportunity(raw, "devfolio")
