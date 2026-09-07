/**
 * opportunityFit.js — pure fit scoring for a career opportunity against a
 * student profile slice. Batch B7 / Story 4.2.
 *
 * `scoreOpportunityFit()` is the single source of truth for "how well does
 * this opportunity fit this student": skills ∩ requirements, CGPA cutoff,
 * branch/year eligibility, target-role alignment, deadline urgency. It returns
 * a 0–100 `fitScore`, the matched/missing skills, a hard `eligible` flag, and
 * a short `whyThis` list of plain-language reasons for the card.
 *
 * `rankOpportunities()` scores + sorts a batch, dropping the hard-ineligible
 * unless asked to keep them.
 *
 * @module career/opportunityFit
 */

function arr(v) {
  return Array.isArray(v) ? v : v == null ? [] : [v];
}

function str(v) {
  return String(v ?? "").trim();
}

function lowerSet(list) {
  return new Set(arr(list).map((x) => str(x).toLowerCase()).filter(Boolean));
}

function toNum(v) {
  const n = Number.parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const WEIGHTS = {
  eligibility: 0.28,
  skillMatch: 0.30,
  cgpa: 0.12,
  targetRole: 0.15,
  interestType: 0.08,
  deadline: 0.07,
};

/**
 * @param {object} input
 * @param {object} input.opportunity  { skills, eligibleBranches, eligibleYears, minCGPA, type, title, tags, company, organizer, deadline, isActive }
 * @param {object} input.student
 * @param {string[]} input.student.skills
 * @param {string}   input.student.branch
 * @param {number}   input.student.year
 * @param {number|null} input.student.cgpa
 * @param {string[]} input.student.targetRoles
 * @param {string[]} input.student.preferredTypes
 * @returns {{
 *   fitScore: number, eligible: boolean, matchedSkills: string[], missingSkills: string[],
 *   whyThis: string[], breakdown: Record<string, number>
 * }}
 */
function scoreOpportunityFit({ opportunity = {}, student = {} }) {
  const studentSkills = lowerSet(student.skills);
  const requiredSkills = arr(opportunity.skills).map(str).filter(Boolean);
  const matchedSkills = requiredSkills.filter((s) => studentSkills.has(s.toLowerCase()));
  const missingSkills = requiredSkills.filter((s) => !studentSkills.has(s.toLowerCase()));

  // ---- Eligibility (hard) ----
  // An *unknown* student attribute (missing branch/year/CGPA) never
  // disqualifies — only a known value that fails the listed constraint does.
  const branch = str(student.branch).toLowerCase();
  const eligBranches = arr(opportunity.eligibleBranches).map((b) => str(b).toLowerCase());
  const branchEligible =
    eligBranches.length === 0 ||
    !branch ||
    eligBranches.some((b) => b === "all" || b === "any" || b === branch || branch.includes(b) || b.includes(branch));

  const eligYears = arr(opportunity.eligibleYears)
    .map((y) => Number.parseInt(str(y), 10))
    .filter(Number.isFinite);
  const year = Number.parseInt(str(student.year), 10);
  const yearEligible = eligYears.length === 0 || !Number.isFinite(year) || eligYears.includes(year);

  const minCgpa = toNum(opportunity.minCGPA);
  const cgpa = toNum(student.cgpa);
  // Only a *known* CGPA below the cutoff makes a student ineligible.
  const cgpaEligible = minCgpa == null || cgpa == null || cgpa >= minCgpa;

  const eligible = branchEligible && yearEligible && cgpaEligible;
  const eligibilityScore = eligible ? 1 : branchEligible && yearEligible ? 0.4 : branchEligible || yearEligible ? 0.25 : 0;

  // ---- Soft signals ----
  const skillMatchScore = requiredSkills.length ? matchedSkills.length / requiredSkills.length : 0.5;

  let cgpaScore = 0.5;
  if (minCgpa != null && cgpa != null) {
    cgpaScore = cgpa >= minCgpa ? Math.min(1, 0.7 + (cgpa - minCgpa) / 4) : 0.15;
  } else if (cgpa != null) {
    cgpaScore = Math.min(1, cgpa / 10 + 0.1);
  }

  const haystack = `${str(opportunity.title)} ${arr(opportunity.tags).map(str).join(" ")} ${str(opportunity.type)}`.toLowerCase();
  const targetRoles = arr(student.targetRoles).map(str).filter(Boolean);
  const roleHits = targetRoles.filter((role) => {
    const words = role.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    return words.length > 0 && words.some((w) => haystack.includes(w));
  });
  const targetRoleScore = targetRoles.length === 0 ? 0.5 : Math.min(1, roleHits.length / Math.min(targetRoles.length, 2));

  const interestTypeScore = arr(student.preferredTypes).map(str).includes(str(opportunity.type)) ? 1 : 0.4;

  const deadlineMs = opportunity.deadline ? Date.parse(opportunity.deadline) : NaN;
  let deadlineScore = 0.5;
  if (Number.isFinite(deadlineMs)) {
    const days = (deadlineMs - Date.now()) / 86_400_000;
    deadlineScore = days < 0 ? 0 : days <= 21 ? 1 : days <= 60 ? 0.8 : 0.55;
  }

  const raw =
    WEIGHTS.eligibility * eligibilityScore +
    WEIGHTS.skillMatch * skillMatchScore +
    WEIGHTS.cgpa * cgpaScore +
    WEIGHTS.targetRole * targetRoleScore +
    WEIGHTS.interestType * interestTypeScore +
    WEIGHTS.deadline * deadlineScore;
  const fitScore = Math.max(0, Math.min(100, Math.round(raw * 100)));

  // ---- Plain-language reasons (most specific first) ----
  const whyThis = [];
  if (roleHits.length) whyThis.push(`Matches your goal: ${roleHits[0]}`);
  if (matchedSkills.length) {
    whyThis.push(
      `You have ${matchedSkills.length}/${requiredSkills.length} of the listed skills` +
        (matchedSkills.length <= 3 ? ` (${matchedSkills.join(", ")})` : ""),
    );
  }
  if (minCgpa != null && cgpa != null && cgpa >= minCgpa) whyThis.push(`Your CGPA clears the ${minCgpa} cutoff`);
  if (eligible && (eligBranches.length || eligYears.length)) whyThis.push("You meet the branch/year eligibility");
  if (Number.isFinite(deadlineMs)) {
    const days = Math.ceil((deadlineMs - Date.now()) / 86_400_000);
    if (days >= 0 && days <= 14) whyThis.push(`Closes in ${days} day${days === 1 ? "" : "s"}`);
  }
  if (whyThis.length === 0) whyThis.push("Open to your branch and year");

  return {
    fitScore,
    eligible,
    matchedSkills,
    missingSkills,
    whyThis: whyThis.slice(0, 3),
    breakdown: {
      eligibilityScore,
      skillMatchScore: round(skillMatchScore),
      cgpaScore: round(cgpaScore),
      targetRoleScore: round(targetRoleScore),
      interestTypeScore,
      deadlineScore,
    },
  };
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

/**
 * Score + sort a batch. Hard-ineligible items are dropped unless
 * `includeIneligible` is set (then they sort last).
 *
 * @param {Array} opportunities
 * @param {object} student  same slice as scoreOpportunityFit
 * @param {{ includeIneligible?: boolean }} [opts]
 * @returns {Array} each item = { ...opportunity, fit: { fitScore, eligible, matchedSkills, missingSkills, whyThis, breakdown } }
 */
function rankOpportunities(opportunities, student, { includeIneligible = false } = {}) {
  const scored = arr(opportunities).map((opportunity) => ({
    ...opportunity,
    fit: scoreOpportunityFit({ opportunity, student }),
  }));
  const filtered = includeIneligible ? scored : scored.filter((o) => o.fit.eligible);
  return filtered.sort((a, b) => {
    if (a.fit.eligible !== b.fit.eligible) return a.fit.eligible ? -1 : 1;
    return b.fit.fitScore - a.fit.fitScore;
  });
}

/** Pull the fit-relevant slice out of a full StudentGraph. */
function studentSliceFromGraph(graph) {
  return {
    skills: arr(graph?.skills).map((s) => (typeof s === "string" ? s : s?.skill)).filter(Boolean),
    branch: graph?.identity?.branch || "",
    year: graph?.identity?.semester != null ? Math.ceil(Number(graph.identity.semester) / 2) : "",
    cgpa: graph?.academic?.results?.cgpa ?? null,
    targetRoles: arr(graph?.intent?.targetRoles),
    preferredTypes: [],
  };
}

module.exports = { scoreOpportunityFit, rankOpportunities, studentSliceFromGraph, FIT_WEIGHTS: WEIGHTS };
