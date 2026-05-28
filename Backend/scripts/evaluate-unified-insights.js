const { evaluateUnifiedInsightPayload } = require("../src/services/lmsTrackerService");

const fixtures = [
  {
    name: "complete-profile",
    payload: {
      profileGraph: {
        nodes: [
          { status: "ready" },
          { status: "ready" },
          { status: "ready" },
          { status: "ready" },
        ],
      },
      nextSkills: [
        {
          title: "Build Node.js",
          reasons: ["Node.js appears in active opportunity demand."],
          inputsUsed: ["careerSkillGaps"],
        },
      ],
      opportunityRecommendations: [
        {
          title: "Frontend Engineering Intern",
          eligibility: { eligible: true },
          reasons: ["Matches profile skills."],
          inputsUsed: ["careerProfile.skills"],
        },
      ],
      actionPlan: [
        {
          title: "Review Frontend Engineering Intern",
          reasons: ["Highest-confidence eligible match."],
          inputsUsed: ["careerEligibility"],
        },
      ],
      feedbackLoop: {
        recentEvents: [{ eventType: "clicked" }, { eventType: "applied" }],
      },
    },
  },
  {
    name: "cold-start",
    payload: {
      profileGraph: {
        nodes: [
          { status: "ready" },
          { status: "sparse" },
          { status: "missing" },
          { status: "cold_start" },
        ],
      },
      nextSkills: [
        {
          title: "Build SQL",
          reasons: ["SQL appears in active opportunity demand."],
          inputsUsed: ["careerSkillGaps"],
        },
      ],
      opportunityRecommendations: [],
      actionPlan: [
        {
          title: "Upload resume for ATS scoring",
          reasons: ["Resume file contributes to the rubric."],
          inputsUsed: ["resumeMetadata"],
        },
      ],
      feedbackLoop: {
        recentEvents: [],
      },
    },
  },
];

const results = fixtures.map((fixture) => ({
  name: fixture.name,
  ...evaluateUnifiedInsightPayload(fixture.payload),
}));

const aggregate = results.reduce(
  (acc, result) => {
    acc.explainabilityCoverage += result.metrics.explainabilityCoverage;
    acc.eligibleOpportunityRate += result.metrics.eligibleOpportunityRate;
    acc.profileSignalCoverage += result.metrics.profileSignalCoverage;
    acc.feedbackEventCount += result.metrics.feedbackEventCount;
    return acc;
  },
  {
    explainabilityCoverage: 0,
    eligibleOpportunityRate: 0,
    profileSignalCoverage: 0,
    feedbackEventCount: 0,
  }
);

for (const key of Object.keys(aggregate)) {
  aggregate[key] = Number((aggregate[key] / results.length).toFixed(3));
}

console.log(JSON.stringify({ baseline: "unified-insights-offline-v1", aggregate, results }, null, 2));
