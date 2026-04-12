import hashlib

def generate_fingerprint(opp: dict) -> str:
    # fingerprint = sha256(f"{title.lower().strip()}{(organizer or company or '').lower()}{deadline or ''}").hexdigest()[:16]
    title = opp['title'].lower().strip()
    entity = (opp.get('company') or opp.get('organizer') or '').lower().strip()
    deadline = opp.get('deadline') or ''
    
    raw = f"{title}{entity}{deadline}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]

def is_duplicate(opp: dict, existing_fingerprints: set) -> bool:
    # URL dedup is handled by DB UNIQUE constraint
    # This fingerprint dedup is for cross-source matching
    fingerprint = generate_fingerprint(opp)
    return fingerprint in existing_fingerprints
