const UNIFIED_INSIGHTS_CONTRACT_VERSION = "unified-insights-v1";

const GRADE_POINTS = {
  O: 10,
  "A+": 9,
  A: 8,
  "B+": 7,
  B: 6,
  C: 5,
  P: 4,
};

function toSafeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPercent(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Number(parsed.toFixed(2))));
}

function clampUnit(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, Number(parsed.toFixed(3))));
}

function ensureObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeSkill(value) {
  return toSafeString(value).toLowerCase();
}

function uniqueStrings(values) {
  return Array.from(new Set(ensureArray(values).map(toSafeString).filter(Boolean)));
}

function normalizeIdentity(value) {
  return toSafeString(value).toLowerCase();
}

function hasIntersection(list, acceptedValues) {
  const accepted = new Set(acceptedValues.map(normalizeIdentity).filter(Boolean));
  return ensureArray(list).some((item) => accepted.has(normalizeIdentity(item)));
}

function isOpportunityEligibleForUser(opportunity, user) {
  const branches = Array.isArray(opportunity.eligibleBranches)
    ? opportunity.eligibleBranches
    : parseJsonArray(opportunity.eligibleBranches);
  const years = Array.isArray(opportunity.eligibleYears)
    ? opportunity.eligibleYears
    : parseJsonArray(opportunity.eligibleYears);
  const branch = normalizeIdentity(user?.branch);
  const year = toSafeString(user?.year);

  const branchEligible =
    branches.length === 0 ||
    hasIntersection(branches, ["all", "any"]) ||
    (branch ? hasIntersection(branches, [branch]) : true);
  const yearEligible =
    years.length === 0 ||
    hasIntersection(years, ["all", "any"]) ||
    (year ? hasIntersection(years, [year]) : true);

  return branchEligible && yearEligible;
}

function buildScoringSchema() {
  return {
    contractVersion: UNIFIED_INSIGHTS_CONTRACT_VERSION,
    recommendationShape: {
      id: "string",
      title: "string",
      confidence: "0..1",
      reasons: "string[]",
      inputsUsed: "string[]",
      eligibility: "object",
    },
    dimensions: [
      { key: "academicRisk", label: "Academic risk", inputs: ["attendance", "gpaTrend", "categoryPerformance"] },
      { key: "resumeQuality", label: "ATS-style resume quality", inputs: ["careerProfile", "resume", "academicSignals"] },
      { key: "opportunityFit", label: "Opportunity fit", inputs: ["profileSkills", "opportunitySkills", "eligibility"] },
      { key: "skillDemand", label: "Skill demand", inputs: ["careerSkillGaps", "activeOpportunityDemand"] },
      { key: "feedbackAdaptation", label: "Feedback adaptation", inputs: ["recommendationEvents"] },
    ],
    eligibilityFilters: ["activeOpportunity", "moderationClear", "branchEligible", "yearEligible", "notDismissed"],
    feedbackWeights: {
      clicked: 0.05,
      saved: 0.07,
      applied: 0.12,
      dismissed: -0.12,
    },
  };
}

function summarizeRecentEvents(events) {
  return ensureArray(events)
    .slice(0, 8)
    .map((event) => ({
      id: event.id,
      eventType: event.eventType,
      recommendationId: event.recommendationId,
      recommendationTitle: event.recommendationTitle,
      sourceDomain: event.sourceDomain,
      confidence: clampUnit(event.confidence, 0),
      createdAt: event.createdAt,
    }));
}

function feedbackBoostForRecommendation(item, events) {
  const itemId = toSafeString(item.id);
  const itemTitle = normalizeIdentity(item.title);
  let boost = 0;
  for (const event of ensureArray(events)) {
    const matches =
      toSafeString(event.recommendationId) === itemId ||
      normalizeIdentity(event.recommendationTitle) === itemTitle;
    if (!matches) continue;
    const eventType = normalizeIdentity(event.eventType || event.action);
    if (["clicked", "click", "opened", "viewed"].includes(eventType)) boost += 0.05;
    if (["saved", "bookmarked"].includes(eventType)) boost += 0.07;
    if (["applied", "apply"].includes(eventType)) boost += 0.12;
    if (["dismissed", "hidden"].includes(eventType)) boost -= 0.12;
  }
  return Number(Math.max(-0.2, Math.min(0.25, boost)).toFixed(3));
}

module.exports = {
  UNIFIED_INSIGHTS_CONTRACT_VERSION,
  GRADE_POINTS,
  toSafeString,
  toNumber,
  toPercent,
  clampUnit,
  ensureObject,
  ensureArray,
  parseJsonArray,
  normalizeSkill,
  uniqueStrings,
  normalizeIdentity,
  hasIntersection,
  isOpportunityEligibleForUser,
  buildScoringSchema,
  summarizeRecentEvents,
  feedbackBoostForRecommendation,
};
