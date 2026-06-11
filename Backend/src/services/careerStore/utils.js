function nowIso() {
  return new Date().toISOString();
}

function toSafeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

const APPLICATION_STATUSES = new Set([
  "interested",
  "applied",
  "under_review",
  "shortlisted",
  "interviewed",
  "offered",
  "rejected",
  "withdrawn",
]);

const OPPORTUNITY_TYPES = new Set(["job", "internship", "hackathon", "competition", "fellowship", "workshop"]);

/** FTS5 prefix query: space-separated terms become mandatory prefixes (safe tokenization). */
function careerSearchMatchExpression(rawQuery) {
  const terms = toSafeString(rawQuery)
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter((t) => t.length >= 2)
    .slice(0, 8);
  if (!terms.length) return "";
  return terms.map((t) => `${t}*`).join(" AND ");
}

function clampCareerPageLimit(limit) {
  const n = Number.parseInt(String(limit), 10);
  if (!Number.isFinite(n)) return 20;
  return Math.min(50, Math.max(1, n));
}

function clampCareerPage(page) {
  const n = Number.parseInt(String(page), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

function normalizeOpportunityType(value) {
  const normalized = toSafeString(value).toLowerCase().replace(/\s+/g, "-");
  if (normalized === "full-time-job") return "job";
  if (!OPPORTUNITY_TYPES.has(normalized)) {
    const error = new Error("Invalid opportunity type");
    error.status = 400;
    throw error;
  }
  return normalized;
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => toSafeString(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => toSafeString(item)).filter(Boolean);
  }
  return [];
}

function createOpportunityFingerprint({ title, company, organizer, applyUrl }) {
  return [title, company || organizer, applyUrl]
    .map((value) => toSafeString(value).toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

module.exports = {
  APPLICATION_STATUSES,
  OPPORTUNITY_TYPES,
  nowIso,
  toSafeString,
  careerSearchMatchExpression,
  clampCareerPageLimit,
  clampCareerPage,
  normalizeOpportunityType,
  normalizeStringList,
  createOpportunityFingerprint,
};
