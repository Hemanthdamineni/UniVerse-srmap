/**
 * helpers/opportunityFitScore.js — pure computation for opportunity fit scoring.
 *
 * `computeOpportunityFit()` evaluates how well a student fits a single career
 * opportunity against its listed role requirements: skill overlap, branch/year
 * eligibility, résumé quality + project/experience evidence, interest type,
 * preferred location/mode, and deadline urgency. It returns the weighted
 * 0–100 `fitScore`, the matched/missing skills, an `eligibility` object, plain-
 * language `reasons`, and actionable `recommendations`. This is the calculation
 * core of `getOpportunityFit` in `careerStore.js`; the store keeps the DB
 * orchestration and delegates the scoring here.
 */

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizedSet(values) {
  return new Set(ensureArray(values).map((value) => String(value).toLowerCase().trim()).filter(Boolean));
}

/**
 * @param {object} input
 * @param {object} input.opportunity  { id, skills, eligibleBranches, eligibleYears, type, mode, location, deadline }
 * @param {object} input.profile      { skills, preferredTypes, preferredLocations }
 * @param {object|null} input.resume  { id, fileName, qualityScore, parsedJson }
 * @param {object} input.user         { branch, year }
 * @returns {object} the full fit `feedback` payload
 */
function computeOpportunityFit({ opportunity = {}, profile = {}, resume = null, user = {} }) {
  const profileSkills = normalizedSet(profile.skills);
  const resumeSkills = normalizedSet(resume?.parsedJson?.skills || []);
  const combinedSkills = new Set([...profileSkills, ...resumeSkills]);
  const requiredSkills = ensureArray(opportunity.skills).map((skill) => toSafeString(skill)).filter(Boolean);
  const matchedSkills = requiredSkills.filter((skill) => combinedSkills.has(skill.toLowerCase()));
  const missingSkills = requiredSkills.filter((skill) => !combinedSkills.has(skill.toLowerCase()));

  const branch = toSafeString(user.branch).toLowerCase();
  const eligibleBranches = ensureArray(opportunity.eligibleBranches).map((item) => String(item).toLowerCase());
  const branchEligible =
    eligibleBranches.length === 0 ||
    eligibleBranches.some((item) => item === "all" || item === "any" || item === branch || branch.includes(item) || item.includes(branch));
  const eligibleYears = ensureArray(opportunity.eligibleYears).map((item) => Number.parseInt(String(item), 10)).filter(Number.isFinite);
  const userYear = Number.parseInt(String(user.year || ""), 10);
  const yearEligible = eligibleYears.length === 0 || (Number.isFinite(userYear) && eligibleYears.includes(userYear));
  const eligibilityScore = branchEligible && yearEligible ? 1 : branchEligible || yearEligible ? 0.45 : 0;
  const skillMatchScore = requiredSkills.length ? matchedSkills.length / requiredSkills.length : 0.5;
  const resumeQualityScore = resume ? Math.min(1, Number(resume.qualityScore || 0) / 100) : 0;
  const projectEvidence = Math.min(1, ensureArray(resume?.parsedJson?.projects).length / 2);
  const experienceEvidence = Math.min(1, ensureArray(resume?.parsedJson?.experience).length / 2);
  const interestAlignment = ensureArray(profile.preferredTypes).includes(opportunity.type) ? 1 : 0.35;
  const locationModeFit =
    !profile.preferredLocations?.length ||
    ensureArray(profile.preferredLocations).some((location) => {
      const value = String(location).toLowerCase();
      return value === String(opportunity.mode || "").toLowerCase() || String(opportunity.location || "").toLowerCase().includes(value);
    })
      ? 1
      : 0.45;
  const deadlineUrgency = opportunity.deadline && Date.parse(opportunity.deadline) > Date.now() ? 1 : 0.5;

  const score =
    0.25 * eligibilityScore +
    0.25 * skillMatchScore +
    0.15 * resumeQualityScore +
    0.1 * projectEvidence +
    0.08 * experienceEvidence +
    0.07 * interestAlignment +
    0.05 * locationModeFit +
    0.05 * deadlineUrgency;
  const fitScore = Math.round(score * 100);
  const reasons = [
    branchEligible && yearEligible ? "Meets listed branch/year eligibility." : "Eligibility needs review.",
    matchedSkills.length ? `Matches ${matchedSkills.length} required skill${matchedSkills.length === 1 ? "" : "s"}.` : "No required skills matched yet.",
    resume ? `Uses resume version ${resume.fileName}.` : "No resume version uploaded yet.",
    projectEvidence > 0 ? "Project evidence is present." : "Add project evidence to improve fit.",
  ];
  const recommendations = [
    ...(missingSkills.length ? [`Close skill gaps: ${missingSkills.slice(0, 4).join(", ")}.`] : []),
    ...(resume ? [] : ["Upload a resume version for stronger fit scoring."]),
    ...(projectEvidence > 0 ? [] : ["Add project bullets with measurable outcomes."]),
    ...(resumeQualityScore >= 0.7 ? [] : ["Improve resume structure, links, and quantified impact."]),
  ];

  return {
    fitScore,
    breakdown: {
      eligibilityScore,
      skillMatchScore,
      resumeQualityScore,
      projectEvidence,
      experienceEvidence,
      interestAlignment,
      locationModeFit,
      deadlineUrgency,
    },
    matchedSkills,
    missingSkills,
    eligibility: {
      eligible: branchEligible && yearEligible,
      branchEligible,
      yearEligible,
    },
    reasons,
    recommendations,
    resumeVersionId: resume?.id || null,
    opportunityId: opportunity.id,
  };
}

module.exports = { computeOpportunityFit };