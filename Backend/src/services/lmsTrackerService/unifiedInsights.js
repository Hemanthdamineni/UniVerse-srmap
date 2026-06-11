const {
  clampUnit,
  ensureArray,
  feedbackBoostForRecommendation,
  isOpportunityEligibleForUser,
  normalizeIdentity,
  normalizeSkill,
  toPercent,
  toSafeString,
  uniqueStrings,
} = require("./utils");

function buildUnifiedProfileGraph({ overview, careerReadiness, careerProfile, applications, lmsRecommendations, recommendationEvents }) {
  const profileSkills = uniqueStrings(careerProfile?.skills);
  const nodes = [
    {
      id: "academic",
      type: "source",
      label: "Academic Record",
      status: overview.semesters.length ? "ready" : "sparse",
      value: `${overview.currentCgpa || "0.00"} CGPA`,
      confidence: overview.semesters.length ? 0.86 : 0.35,
      inputsUsed: ["cgpa", "semesterResults", "attendance"],
    },
    {
      id: "lms",
      type: "source",
      label: "LMS Engagement",
      status: lmsRecommendations.length ? "ready" : "sparse",
      value: `${lmsRecommendations.length} ranked resource(s)`,
      confidence: lmsRecommendations.length ? 0.78 : 0.32,
      inputsUsed: ["lmsRecommendations", "topicMastery", "resourceEngagement"],
    },
    {
      id: "resume",
      type: "source",
      label: "Resume",
      status: careerReadiness.resumeScore.hasResume ? "ready" : "missing",
      value: `${careerReadiness.resumeScore.score}% ATS score`,
      confidence: careerReadiness.resumeScore.hasResume ? 0.82 : 0.44,
      inputsUsed: ["resumeFile", "careerProfile", "academicSignals"],
    },
    {
      id: "skills",
      type: "profile",
      label: "Skill Profile",
      status: profileSkills.length >= 3 ? "ready" : "sparse",
      value: `${profileSkills.length} skill(s)`,
      confidence: profileSkills.length >= 3 ? 0.8 : 0.42,
      inputsUsed: ["careerProfile.skills", "careerSkillGaps"],
    },
    {
      id: "applications",
      type: "behavior",
      label: "Applications",
      status: applications.length ? "ready" : "sparse",
      value: `${applications.length} tracked application(s)`,
      confidence: applications.length ? 0.76 : 0.35,
      inputsUsed: ["careerApplications"],
    },
    {
      id: "feedback",
      type: "behavior",
      label: "Recommendation Feedback",
      status: recommendationEvents.length ? "ready" : "cold_start",
      value: `${recommendationEvents.length} event(s)`,
      confidence: recommendationEvents.length ? 0.72 : 0.28,
      inputsUsed: ["recommendationEvents"],
    },
  ];

  return {
    nodes,
    edges: [
      { from: "academic", to: "resume", signal: "CGPA and progress influence ATS rubric." },
      { from: "skills", to: "applications", signal: "Skill profile controls opportunity eligibility and fit." },
      { from: "lms", to: "skills", signal: "LMS ranking informs the next learning action." },
      { from: "feedback", to: "applications", signal: "Clicks, saves, and applies adapt later recommendations." },
    ],
    coverage: {
      readySignals: nodes.filter((node) => node.status === "ready").length,
      totalSignals: nodes.length,
      missingSignals: nodes.filter((node) => node.status === "missing" || node.status === "cold_start").map((node) => node.label),
    },
  };
}

function buildAtsScore(careerReadiness) {
  const resumeScore = careerReadiness.resumeScore || { score: 0, hasResume: false, breakdown: [], suggestions: [] };
  return {
    score: toPercent(resumeScore.score),
    hasResume: Boolean(resumeScore.hasResume),
    rubric: ensureArray(resumeScore.breakdown).map((item) => ({
      label: toSafeString(item.label),
      score: toPercent(item.score),
      max: toPercent(item.max),
      reason:
        Number(item.score || 0) >= Number(item.max || 0)
          ? `${toSafeString(item.label)} is complete.`
          : `${toSafeString(item.label)} needs improvement before high-fit applications.`,
    })),
    suggestions: ensureArray(resumeScore.suggestions),
    confidence: resumeScore.hasResume ? 0.82 : 0.56,
    inputsUsed: ["careerProfile", "resumeMetadata", "academicSignals"],
  };
}

function buildNextSkillRecommendations({ careerReadiness, lmsRecommendations, recommendationEvents }) {
  const lmsTitles = ensureArray(lmsRecommendations).map((item) => toSafeString(item.title)).filter(Boolean);
  return ensureArray(careerReadiness.skillGaps)
    .slice(0, 5)
    .map((gap, index) => {
      const baseConfidence = clampUnit(0.52 + Math.min(0.28, Number(gap.opportunityCount || 0) * 0.04) - index * 0.03, 0.5);
      const feedbackBoost = feedbackBoostForRecommendation({ id: `skill-${normalizeSkill(gap.skill)}`, title: `Learn ${gap.skill}` }, recommendationEvents);
      const confidence = clampUnit(baseConfidence + feedbackBoost, baseConfidence);
      return {
        id: `skill-${normalizeSkill(gap.skill).replace(/[^a-z0-9]+/g, "-")}`,
        skill: toSafeString(gap.skill),
        title: `Build ${toSafeString(gap.skill)}`,
        opportunityDemand: Number(gap.opportunityCount || 0),
        gapLevel: toSafeString(gap.gapLevel || "missing"),
        confidence,
        feedbackBoost,
        reasons: [
          `${toSafeString(gap.skill)} appears in ${Number(gap.opportunityCount || 0)} active opportunity match(es).`,
          gap.reason || "This skill is absent from the current career profile.",
          lmsTitles[index] ? `Use LMS resource: ${lmsTitles[index]}.` : "No ranked LMS resource is currently attached.",
        ],
        inputsUsed: ["careerSkillGaps", "activeOpportunityDemand", "lmsRecommendations", "recommendationEvents"],
      };
    });
}

function buildUnifiedOpportunityRecommendations({ careerReadiness, user, recommendationEvents }) {
  return ensureArray(careerReadiness.recommendedOpportunities)
    .filter((opportunity) => isOpportunityEligibleForUser(opportunity, user))
    .map((opportunity) => {
      const feedbackBoost = feedbackBoostForRecommendation(opportunity, recommendationEvents);
      const confidence = clampUnit(Number(opportunity.confidence || 0.45) + feedbackBoost, 0.45);
      const reasons = [
        ...ensureArray(opportunity.reasons),
        feedbackBoost > 0 ? "Recent interaction increased this recommendation's relevance." : "",
        feedbackBoost < 0 ? "Recent dismissal reduced this recommendation's relevance." : "",
      ].filter(Boolean);
      return {
        id: opportunity.id,
        title: opportunity.title,
        type: opportunity.type,
        organization: opportunity.organization,
        deadline: opportunity.deadline,
        matchedSkills: ensureArray(opportunity.matchedSkills),
        missingSkills: ensureArray(opportunity.missingSkills),
        confidence,
        feedbackBoost,
        eligibility: {
          eligible: true,
          branch: toSafeString(user?.branch) || "not provided",
          year: toSafeString(user?.year) || "not provided",
          filtersApplied: ["activeOpportunity", "branchEligible", "yearEligible", "moderationClear"],
        },
        reasons,
        inputsUsed: uniqueStrings([...(opportunity.inputsUsed || []), "recommendationEvents", "careerEligibility"]),
      };
    })
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 5);
}

function buildUnifiedActionPlan({ overview, categoryPerformance, careerReadiness, nextSkills, opportunityRecommendations }) {
  const weakestCategory = [...ensureArray(categoryPerformance)].sort((left, right) => left.avgGpa - right.avgGpa)[0];
  const actions = [];

  if (overview.subjectsAtRisk > 0) {
    actions.push({
      id: "action-attendance-risk",
      domain: "academic",
      priority: "high",
      title: "Recover attendance risk",
      description: `${overview.subjectsAtRisk} subject(s) are below the attendance safety line.`,
      confidence: 0.9,
      reasons: ["Attendance below threshold blocks exam eligibility and should be resolved first."],
      inputsUsed: ["attendanceRecords"],
    });
  }

  if (weakestCategory) {
    actions.push({
      id: `action-strengthen-${normalizeSkill(weakestCategory.category).replace(/[^a-z0-9]+/g, "-")}`,
      domain: "academic",
      priority: "medium",
      title: `Strengthen ${weakestCategory.category}`,
      description: `${weakestCategory.category} has the lowest current academic score cluster.`,
      confidence: 0.74,
      reasons: [`Average GPA is ${Number(weakestCategory.avgGpa || 0).toFixed(2)} across ${weakestCategory.subjects} subject(s).`],
      inputsUsed: ["categoryPerformance", "gpaTrend"],
    });
  }

  if (!careerReadiness.resumeScore.hasResume) {
    actions.push({
      id: "action-upload-resume",
      domain: "career",
      priority: "high",
      title: "Upload resume for ATS scoring",
      description: "Opportunity ranking has lower confidence without resume evidence.",
      confidence: 0.82,
      reasons: ["Resume file contributes 25 points to the ATS-style rubric."],
      inputsUsed: ["careerProfile", "resumeMetadata"],
    });
  }

  if (nextSkills[0]) {
    actions.push({
      id: `action-${nextSkills[0].id}`,
      domain: "career",
      priority: "high",
      title: `Build ${nextSkills[0].skill}`,
      description: `${nextSkills[0].opportunityDemand} active opportunity match(es) need this skill.`,
      confidence: nextSkills[0].confidence,
      reasons: nextSkills[0].reasons,
      inputsUsed: nextSkills[0].inputsUsed,
    });
  }

  if (opportunityRecommendations[0]) {
    actions.push({
      id: `action-review-${opportunityRecommendations[0].id}`,
      domain: "career",
      priority: "medium",
      title: `Review ${opportunityRecommendations[0].title}`,
      description: "This eligible opportunity is currently the highest-confidence career match.",
      confidence: opportunityRecommendations[0].confidence,
      reasons: opportunityRecommendations[0].reasons,
      inputsUsed: opportunityRecommendations[0].inputsUsed,
    });
  }

  return actions.slice(0, 6);
}

function evaluateUnifiedInsightPayload(payload) {
  const recommendations = [
    ...ensureArray(payload.nextSkills),
    ...ensureArray(payload.opportunityRecommendations),
    ...ensureArray(payload.actionPlan),
  ];
  const explainable = recommendations.filter(
    (item) => ensureArray(item.reasons).length > 0 && ensureArray(item.inputsUsed).length > 0
  ).length;
  const opportunities = ensureArray(payload.opportunityRecommendations);
  const eligible = opportunities.filter((item) => item.eligibility?.eligible !== false).length;
  const nodes = ensureArray(payload.profileGraph?.nodes);
  const readySignals = nodes.filter((node) => node.status === "ready").length;
  const totalSignals = nodes.length || 1;

  return {
    baseline: "offline-fixture-v1",
    metrics: {
      recommendationCount: recommendations.length,
      explainabilityCoverage: recommendations.length ? Number((explainable / recommendations.length).toFixed(3)) : 1,
      eligibleOpportunityRate: opportunities.length ? Number((eligible / opportunities.length).toFixed(3)) : 1,
      profileSignalCoverage: Number((readySignals / totalSignals).toFixed(3)),
      feedbackEventCount: ensureArray(payload.feedbackLoop?.recentEvents).length,
    },
    thresholds: {
      explainabilityCoverage: 1,
      eligibleOpportunityRate: 1,
      profileSignalCoverage: 0.5,
      recommendationApiP95Ms: 400,
    },
  };
}

module.exports = {
  buildUnifiedProfileGraph,
  buildAtsScore,
  buildNextSkillRecommendations,
  buildUnifiedOpportunityRecommendations,
  buildUnifiedActionPlan,
  evaluateUnifiedInsightPayload,
};
