import hashlib
import re

# Whole tokens dropped from company names before matching (order-insensitive).
_ENTITY_NOISE_TOKENS = {
    "pvt", "private", "ltd", "limited", "llc", "inc", "incorporated",
    "corp", "corporation", "gmbh", "co", "group", "holdings",
    "the", "and",
    # pandas NaN leaking through jobspy rows as a literal string
    "nan", "none", "null",
}

# Trailing role-context tokens stripped from company names ("Google India"
# and "Google Software Labs" are the same employer for dedup purposes).
_ENTITY_SUFFIX_TOKENS = {
    "india", "technologies", "technology", "solutions", "consulting",
    "consultancy", "services", "systems", "labs", "software", "digital",
}

# Title abbreviations expanded before matching so LinkedIn's long-form and
# Indeed's short-form postings collapse onto one key.
_TITLE_ABBREVIATIONS = {
    "sde": "software development engineer",
    "sdet": "software development engineer test",
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "qa": "quality assurance",
    "ux": "user experience ui",
    "ui": "user interface",
    "jr": "junior",
    "sr": "senior",
    "assoc": "associate",
    "engg": "engineer",
}


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def normalize_company(name: str) -> str:
    """'Google India Pvt. Ltd.' -> 'google'; tolerant to missing input."""
    tokens = [t for t in _tokens(name or "") if t not in _ENTITY_NOISE_TOKENS]
    while len(tokens) > 1 and tokens[-1] in _ENTITY_SUFFIX_TOKENS:
        tokens.pop()
    return " ".join(tokens)


def normalize_title(title: str) -> str:
    """'SDE Intern (Bengaluru)' -> 'software development engineer intern bengaluru'."""
    tokens: list[str] = []
    for token in _tokens(re.sub(r"[|].*$", "", title or "")):
        tokens.extend(_TITLE_ABBREVIATIONS.get(token, token).split())
    return " ".join(tokens)


def compute_dupe_key(opp: dict) -> str:
    """Secondary near-duplicate key: normalized title + normalized employer.

    Deliberately excludes deadline, location spelling, and URL — those vary
    across sources describing the same opening. Type (internship/job) is NOT
    in the key because the DB merge step guards on it instead.
    """
    title = normalize_title(opp.get("title") or "")
    entity = normalize_company(opp.get("company") or opp.get("organizer") or "")
    if not title or not entity:
        return ""
    raw = f"{title}||{entity}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


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
