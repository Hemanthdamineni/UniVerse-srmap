const {
  ensureArray,
  parseJsonArray,
  toSafeString,
  uniqueStrings,
  normalizeSkill,
} = require("./utils");

function scoreCareerProfile(profile) {
  const skills = uniqueStrings(profile.skills);
  const preferredTypes = uniqueStrings(profile.preferredTypes);
  const preferredLocations = uniqueStrings(profile.preferredLocations);
  const checks = [
    {
      key: "skills",
      label: "Skills listed",
      value: skills.length >= 3 ? 25 : skills.length > 0 ? 15 : 0,
      max: 25,
      missing: skills.length >= 3 ? "" : "Add at least three current skills.",
    },
    {
      key: "resume",
      label: "Resume uploaded",
      value: profile.resumeUrl || profile.resumeFileName ? 20 : 0,
      max: 20,
      missing: profile.resumeUrl || profile.resumeFileName ? "" : "Upload a current resume.",
    },
    {
      key: "bio",
      label: "Career summary",
      value: toSafeString(profile.bio).length >= 80 ? 15 : toSafeString(profile.bio) ? 8 : 0,
      max: 15,
      missing: toSafeString(profile.bio).length >= 80 ? "" : "Add a focused career summary.",
    },
    {
      key: "links",
      label: "Portfolio links",
      value: [profile.linkedinUrl, profile.githubUrl, profile.portfolioUrl].filter((item) => toSafeString(item)).length * 5,
      max: 15,
      missing:
        [profile.linkedinUrl, profile.githubUrl, profile.portfolioUrl].some((item) => toSafeString(item))
          ? ""
          : "Add LinkedIn, GitHub, or portfolio links.",
    },
    {
      key: "preferences",
      label: "Opportunity preferences",
      value: preferredTypes.length || preferredLocations.length || toSafeString(profile.minStipend) ? 25 : 0,
      max: 25,
      missing:
        preferredTypes.length || preferredLocations.length || toSafeString(profile.minStipend)
          ? ""
          : "Set preferred opportunity types, locations, or stipend expectations.",
    },
  ];

  const score = checks.reduce((sum, item) => sum + Math.min(item.max, item.value), 0);
  return {
    score,
    completed: checks.filter((item) => item.value >= item.max).map((item) => item.label),
    missing: checks.map((item) => item.missing).filter(Boolean),
    breakdown: checks.map(({ key, label, value, max }) => ({ key, label, score: Math.min(max, value), max })),
  };
}

function scoreResume(profile, academicSignals) {
  const profileScore = scoreCareerProfile(profile);
  const skills = uniqueStrings(profile.skills);
  const hasResume = Boolean(profile.resumeUrl || profile.resumeFileName);
  const cgpa = Number.parseFloat(String(academicSignals.currentCgpa || profile.cgpa || 0));
  const breakdown = [
    { label: "Resume file", score: hasResume ? 25 : 0, max: 25 },
    { label: "Skills evidence", score: Math.min(25, skills.length * 5), max: 25 },
    { label: "Profile completeness", score: Math.round(profileScore.score * 0.25), max: 25 },
    { label: "Academic signal", score: Number.isFinite(cgpa) && cgpa >= 7 ? 25 : Number.isFinite(cgpa) && cgpa > 0 ? 15 : 0, max: 25 },
  ];
  const score = breakdown.reduce((sum, item) => sum + item.score, 0);
  return {
    score,
    hasResume,
    breakdown,
    suggestions: [
      ...(hasResume ? [] : ["Upload a current resume before applying."]),
      ...(skills.length >= 5 ? [] : ["Add more role-specific skills to improve matching."]),
      ...(Number.isFinite(cgpa) && cgpa >= 7 ? [] : ["Keep academic performance context up to date for eligibility checks."]),
    ],
  };
}

function buildCareerReadiness({ careerStore, user, academicSignals }) {
  const unavailable = {
    available: false,
    profileCompleteness: { score: 0, completed: [], missing: ["Career profile data unavailable."], breakdown: [] },
    resumeScore: { score: 0, hasResume: false, breakdown: [], suggestions: ["Connect career profile data."] },
    skillGaps: [],
    recommendedOpportunities: [],
    nextActions: ["Update your career profile so academic recommendations can include opportunity matching."],
    inputsUsed: {
      careerProfile: false,
      skillGaps: 0,
      opportunities: 0,
      applications: 0,
      academicSignals: Object.keys(academicSignals || {}).filter((key) => academicSignals[key] !== undefined),
    },
  };

  if (!careerStore || !user?.userId) return unavailable;

  try {
    const profile = careerStore.getProfile(user);
    const profileSkills = uniqueStrings(profile.skills);
    const profileSkillSet = new Set(profileSkills.map(normalizeSkill));
    const skillGaps = ensureArray(careerStore.getSkillGaps(user)).slice(0, 5).map((gap) => ({
      skill: toSafeString(gap.skill),
      opportunityCount: Number(gap.opportunityCount || 0),
      gapLevel: toSafeString(gap.gapLevel || "missing"),
      reason: `${toSafeString(gap.skill)} appears in ${Number(gap.opportunityCount || 0)} active opportunity match(es) but is not in the profile.`,
    }));
    const opportunities = ensureArray(
      careerStore.getOpportunities({
        user,
        sort: "relevance",
        page: 1,
        limit: 5,
      })
    );
    const applications = typeof careerStore.getApplications === "function" ? ensureArray(careerStore.getApplications(user.userId)) : [];
    const profileCompleteness = scoreCareerProfile(profile);
    const resumeScore = scoreResume(profile, academicSignals);

    const recommendedOpportunities = opportunities.slice(0, 5).map((opportunity) => {
      const opportunitySkills = uniqueStrings(opportunity.skills || parseJsonArray(opportunity.skills));
      const matchedSkills = opportunitySkills.filter((skill) => profileSkillSet.has(normalizeSkill(skill)));
      const missingSkills = opportunitySkills.filter((skill) => !profileSkillSet.has(normalizeSkill(skill))).slice(0, 4);
      return {
        id: opportunity.id,
        title: opportunity.title,
        type: opportunity.type,
        organization: opportunity.company || opportunity.organization || opportunity.organizer || "",
        deadline: opportunity.deadline || "",
        eligibleBranches: Array.isArray(opportunity.eligibleBranches)
          ? opportunity.eligibleBranches
          : parseJsonArray(opportunity.eligibleBranches),
        eligibleYears: Array.isArray(opportunity.eligibleYears)
          ? opportunity.eligibleYears
          : parseJsonArray(opportunity.eligibleYears),
        matchedSkills,
        missingSkills,
        confidence: Math.max(0.35, Math.min(0.95, 0.45 + matchedSkills.length * 0.1 - missingSkills.length * 0.03)),
        reasons: [
          matchedSkills.length ? `Matches ${matchedSkills.length} profile skill(s).` : "Relevant active opportunity from the career catalog.",
          missingSkills.length ? `Missing skills to close: ${missingSkills.join(", ")}.` : "No major skill gap detected from listed skills.",
        ],
        inputsUsed: ["careerProfile.skills", "careerOpportunities.skills", "careerEligibility"],
      };
    });

    const nextActions = [
      ...(resumeScore.hasResume ? [] : ["Upload a resume before applying to recommended roles."]),
      ...(skillGaps[0] ? [`Start with ${skillGaps[0].skill}; it maps to ${skillGaps[0].opportunityCount} active opportunity match(es).`] : []),
      ...(recommendedOpportunities[0] ? [`Review ${recommendedOpportunities[0].title} and decide whether to save or apply.`] : []),
      ...(applications.length ? ["Update application statuses so recommendations learn from outcomes."] : ["Track applications after applying so future recommendations can adapt."]),
    ];

    return {
      available: true,
      profileCompleteness,
      resumeScore,
      skillGaps,
      recommendedOpportunities,
      nextActions: nextActions.slice(0, 4),
      inputsUsed: {
        careerProfile: true,
        skillGaps: skillGaps.length,
        opportunities: recommendedOpportunities.length,
        applications: applications.length,
        academicSignals: Object.keys(academicSignals || {}).filter((key) => academicSignals[key] !== undefined),
      },
    };
  } catch (error) {
    return {
      ...unavailable,
      error: error?.message || "Career readiness could not be computed.",
    };
  }
}

module.exports = {
  scoreCareerProfile,
  scoreResume,
  buildCareerReadiness,
};
