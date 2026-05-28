const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

const { LmsTrackerService } = require("../src/services/lmsTrackerService");
const { LmsTrackerStore } = require("../src/services/lmsTrackerStore");

function createErpAggregationService() {
  const service = {
    calls: 0,
    async getBatch() {
      service.calls += 1;
      return {
        "academic/cgpa-summary": {
          data: {
            Table: [
              { label: "Earned Credits", value: "96" },
              { label: "Current CGPA", value: "8.20" },
            ],
          },
        },
        "academic/attendance-details": {
          data: {
            Academic: {
              "Attendance Details": {
                tables: [
                  [
                    {
                      "Subject Code": "Subject Code",
                      "Subject Description": "Subject Description",
                      "Attendance %": "Attendance %",
                    },
                    {
                      "Subject Code": "CSE 301",
                      "Subject Description": "Database Systems",
                      "Attendance %": "72",
                      "Classes Conducted": "50",
                      "Present(P)": "36",
                    },
                    {
                      "Subject Code": "CSE 302",
                      "Subject Description": "Web Engineering",
                      "Attendance %": "88",
                      "Classes Conducted": "40",
                      "Present(P)": "35",
                    },
                  ],
                ],
              },
            },
          },
        },
        "examination/exam-mark-details": {
          data: {
            Examination: {
              "Exam Mark Details": {
                tables: [
                  [
                    {
                      Semester: "1",
                      "Subject Code": "CSE 101",
                      "Subject Description": "Programming",
                      Credit: "4",
                      Grade: "A",
                    },
                    {
                      Semester: "2",
                      "Subject Code": "MAT 102",
                      "Subject Description": "Mathematics II",
                      Credit: "3",
                      Grade: "B+",
                    },
                  ],
                ],
              },
            },
          },
        },
        "examination/current-semester-results": {
          data: {
            Examination: {
              "Current Semester Results": {
                text: "S.G.P.A 8.50",
                tables: [
                  [
                    {
                      Semester: "3",
                      "Subject Code": "CSE 301",
                      "Subject Description": "Database Systems",
                      Credit: "3",
                      Grade: "A",
                      Result: "Pass",
                    },
                  ],
                ],
              },
            },
          },
        },
      };
    },
  };
  return service;
}

function createCareerStore() {
  return {
    getProfile() {
      return {
        userId: "AP23110010001",
        skills: ["React", "SQL"],
        preferredTypes: ["internship"],
        preferredLocations: ["remote"],
        minStipend: "10000",
        cgpa: "8.2",
        bio: "Frontend focused student building production dashboards and academic systems.",
        linkedinUrl: "https://linkedin.example/student",
        githubUrl: "https://github.example/student",
        portfolioUrl: "",
        resumeUrl: "",
        resumeFileName: "",
      };
    },
    getSkillGaps() {
      return [
        { skill: "Node.js", opportunityCount: 4, gapLevel: "missing" },
        { skill: "Docker", opportunityCount: 2, gapLevel: "missing" },
      ];
    },
    getOpportunities() {
      return [
        {
          id: "opp-1",
          title: "Frontend Engineering Intern",
          type: "internship",
          company: "Acme Labs",
          deadline: "2026-06-30",
          skills: ["React", "Node.js", "SQL"],
          eligibleBranches: ["computer science"],
          eligibleYears: [3],
        },
        {
          id: "opp-ineligible",
          title: "Mechanical Systems Internship",
          type: "internship",
          company: "Mech Labs",
          deadline: "2026-07-10",
          skills: ["CAD", "Thermodynamics"],
          eligibleBranches: ["mechanical"],
          eligibleYears: [3],
        },
      ];
    },
    getApplications() {
      return [];
    },
  };
}

function createRecommendationEngine() {
  return {
    async getRecommendations() {
      return [
        {
          id: "res-node",
          title: "Node.js Service Patterns",
          confidence: 0.81,
          recommendationScore: 0.72,
          reasons: [{ code: "topicGapScore", label: "Targets topics with room to improve", weight: 0.7 }],
          inputsUsed: { algorithmKey: "ranking-v2" },
        },
      ];
    },
  };
}

test("LmsTrackerService combines ERP academic signals with career readiness inputs", async () => {
  const erpAggregationService = createErpAggregationService();
  const service = new LmsTrackerService({
    erpAggregationService,
    careerStore: createCareerStore(),
  });
  const user = {
    userId: "AP23110010001",
    role: "student",
    branch: "computer science",
    year: 3,
  };

  const insights = await service.getInsights({ sessionId: "session-1", user });

  assert.equal(insights.overview.subjectsAtRisk, 1);
  assert.equal(insights.careerReadiness.available, true);
  assert.equal(insights.careerReadiness.skillGaps[0].skill, "Node.js");
  assert.equal(insights.careerReadiness.recommendedOpportunities[0].title, "Frontend Engineering Intern");
  assert.deepEqual(insights.careerReadiness.recommendedOpportunities[0].matchedSkills, ["React", "SQL"]);
  assert.ok(insights.careerReadiness.recommendedOpportunities[0].missingSkills.includes("Node.js"));
  assert.ok(insights.careerReadiness.resumeScore.suggestions.includes("Upload a current resume before applying."));
  assert.ok(insights.careerReadiness.nextActions.some((action) => action.includes("Node.js")));
  assert.ok(insights.careerReadiness.inputsUsed.academicSignals.includes("subjectsAtRisk"));
  assert.equal(erpAggregationService.calls, 1);
});

test("LmsTrackerService persists snapshots and recommendation events", async () => {
  const erpAggregationService = createErpAggregationService();
  const trackerStore = new LmsTrackerStore({
    dbPath: path.join(os.tmpdir(), `lms-tracker-${process.pid}-${Date.now()}.sqlite`),
  });
  const service = new LmsTrackerService({
    erpAggregationService,
    careerStore: createCareerStore(),
    trackerStore,
  });
  const user = {
    userId: "AP23110010001",
    role: "student",
    branch: "computer science",
    year: 3,
  };

  const overview = await service.getOverview({ sessionId: "session-1", user });
  assert.equal(overview.snapshot.snapshotType, "overview");
  assert.equal(overview.history.length, 1);
  assert.equal(overview.history[0].summary.currentCgpa, "8.20");

  const insights = await service.getInsights({ sessionId: "session-1", user });
  assert.equal(insights.snapshot.snapshotType, "insights");
  assert.ok(insights.history[0].summary.subjectsAtRisk >= 1);
  assert.ok(insights.recommendationEvents.length >= 2);
  assert.ok(
    insights.recommendationEvents.some((event) => event.sourceDomain === "career_readiness"),
    "expected career readiness recommendation event"
  );

  const history = service.getHistory({ user, snapshotType: "overview" });
  assert.equal(history.items.length, 1);

  const events = service.getRecommendationEvents({ user });
  assert.ok(events.items.length >= insights.recommendationEvents.length);

  const interaction = service.recordRecommendationEvent({
    user,
    payload: {
      eventType: "clicked",
      sourceDomain: "career_readiness",
      recommendationId: "opp-1",
      recommendationTitle: "Frontend Engineering Intern",
      confidence: 0.7,
      action: "open_detail",
    },
  });
  assert.equal(interaction.items.length, 1);
  assert.equal(interaction.items[0].eventType, "clicked");
  assert.equal(erpAggregationService.calls, 2);
});

test("LmsTrackerService returns a unified explainable recommendation contract", async () => {
  const erpAggregationService = createErpAggregationService();
  const trackerStore = new LmsTrackerStore({
    dbPath: path.join(os.tmpdir(), `lms-tracker-unified-${process.pid}-${Date.now()}.sqlite`),
  });
  const service = new LmsTrackerService({
    erpAggregationService,
    careerStore: createCareerStore(),
    trackerStore,
    recommendationEngine: createRecommendationEngine(),
  });
  const user = {
    userId: "AP23110010001",
    role: "student",
    branch: "computer science",
    year: 3,
  };

  const unified = await service.getUnifiedInsights({ sessionId: "session-1", user });

  assert.equal(unified.contractVersion, "unified-insights-v1");
  assert.equal(unified.scoringSchema.recommendationShape.confidence, "0..1");
  assert.ok(unified.profileGraph.nodes.some((node) => node.id === "academic"));
  assert.ok(unified.atsScore.rubric.some((item) => item.label === "Resume file"));
  assert.equal(unified.nextSkills[0].skill, "Node.js");
  assert.ok(unified.nextSkills[0].reasons.some((reason) => reason.includes("active opportunity")));
  assert.equal(unified.opportunityRecommendations.length, 1);
  assert.equal(unified.opportunityRecommendations[0].id, "opp-1");
  assert.equal(unified.opportunityRecommendations[0].eligibility.eligible, true);
  assert.ok(unified.actionPlan.some((item) => item.domain === "academic"));
  assert.equal(unified.qualityMonitoring.metrics.explainabilityCoverage, 1);
  assert.equal(unified.qualityMonitoring.metrics.eligibleOpportunityRate, 1);
  assert.ok(unified.responseTimeMs < 400);
});

test("LmsTrackerService adapts unified ranking after recommendation feedback", async () => {
  const erpAggregationService = createErpAggregationService();
  const trackerStore = new LmsTrackerStore({
    dbPath: path.join(os.tmpdir(), `lms-tracker-feedback-${process.pid}-${Date.now()}.sqlite`),
  });
  const service = new LmsTrackerService({
    erpAggregationService,
    careerStore: createCareerStore(),
    trackerStore,
    recommendationEngine: createRecommendationEngine(),
  });
  const user = {
    userId: "AP23110010001",
    role: "student",
    branch: "computer science",
    year: 3,
  };

  const before = await service.getUnifiedInsights({ sessionId: "session-1", user });
  const beforeScore = before.opportunityRecommendations[0].confidence;
  service.recordRecommendationEvent({
    user,
    payload: {
      eventType: "applied",
      sourceDomain: "career_readiness",
      recommendationId: "opp-1",
      recommendationTitle: "Frontend Engineering Intern",
      confidence: beforeScore,
      action: "apply",
    },
  });

  const after = await service.getUnifiedInsights({ sessionId: "session-1", user });

  assert.ok(after.opportunityRecommendations[0].confidence > beforeScore);
  assert.ok(after.opportunityRecommendations[0].reasons.some((reason) => reason.includes("interaction increased")));
  assert.ok(after.feedbackLoop.recentEvents.some((event) => event.eventType === "applied"));
});
