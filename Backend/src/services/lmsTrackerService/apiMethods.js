const {
  UNIFIED_INSIGHTS_CONTRACT_VERSION,
  buildScoringSchema,
  clampUnit,
  ensureArray,
  normalizeIdentity,
  summarizeRecentEvents,
} = require("./utils");
const {
  buildCategoryPerformance,
  buildHighlights,
  buildRecommendations,
  flattenHistoricalResults,
} = require("./academicSignals");
const { buildCareerReadiness } = require("./careerReadiness");
const {
  buildAtsScore,
  buildNextSkillRecommendations,
  buildUnifiedActionPlan,
  buildUnifiedOpportunityRecommendations,
  buildUnifiedProfileGraph,
  evaluateUnifiedInsightPayload,
} = require("./unifiedInsights");

module.exports = {
  async getOverview({ sessionId, user = null }) {
    const batch = await this._loadBatch(sessionId);
    const overview = this._buildOverviewFromBatch({
      ...batch,
      user,
    });
    const snapshot = this._persistSnapshot({
      user,
      snapshotType: "overview",
      payload: overview,
      sourceStatus: this._buildSourceStatus(batch),
    });
    return {
      ...overview,
      snapshot,
      history: this._getSnapshotHistory(user, "overview"),
    };
  },

  async getInsights({ sessionId, user = null }) {
    const batch = await this._loadBatch(sessionId);
    const overview = this._buildOverviewFromBatch({
      ...batch,
      user,
    });
    const { examMarkRaw, currentRaw } = batch;
    const resultRows = flattenHistoricalResults(examMarkRaw, currentRaw);
    const categoryPerformance = buildCategoryPerformance(resultRows);
    const recommendations = buildRecommendations({
      gpaTrend: overview.semesters.map((item) => ({
        semester: item.semester,
        sgpa: Number(item.sgpa),
      })),
      attendanceRecords: overview.attendanceRecords,
      categoryPerformance,
      progressPercent: overview.progressPercent,
    });
    const payload = {
      gpaTrend: overview.semesters.map((item) => ({
        semester: item.label,
        sgpa: Number(item.sgpa),
      })),
      categoryPerformance,
      highlights: buildHighlights({
        gpaTrend: overview.semesters.map((item) => ({
          semester: item.semester,
          sgpa: Number(item.sgpa),
        })),
        categoryPerformance,
        attendanceRecords: overview.attendanceRecords,
      }),
      recommendations,
      overview,
      careerReadiness: overview.careerReadiness,
    };
    const snapshot = this._persistSnapshot({
      user,
      snapshotType: "insights",
      payload,
      sourceStatus: this._buildSourceStatus(batch),
    });
    const generatedEvents = this._recordGeneratedRecommendations({
      user,
      academicRecommendations: recommendations,
      careerReadiness: overview.careerReadiness,
    });

    return {
      ...payload,
      snapshot,
      history: this._getSnapshotHistory(user, "insights"),
      recommendationEvents: generatedEvents.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        recommendationId: event.recommendationId,
        recommendationTitle: event.recommendationTitle,
        sourceDomain: event.sourceDomain,
        confidence: event.confidence,
        createdAt: event.createdAt,
      })),
    };
  },

  async getUnifiedInsights({ sessionId, user = null }) {
    const startedAt = Date.now();
    const batch = await this._loadBatch(sessionId);
    const overview = this._buildOverviewFromBatch({
      ...batch,
      user,
    });
    const resultRows = flattenHistoricalResults(batch.examMarkRaw, batch.currentRaw);
    const categoryPerformance = buildCategoryPerformance(resultRows);
    const academicRecommendations = buildRecommendations({
      gpaTrend: overview.semesters.map((item) => ({
        semester: item.semester,
        sgpa: Number(item.sgpa),
      })),
      attendanceRecords: overview.attendanceRecords,
      categoryPerformance,
      progressPercent: overview.progressPercent,
    });
    const careerReadiness = overview.careerReadiness || buildCareerReadiness({
      careerStore: this.careerStore,
      user,
      academicSignals: {
        currentCgpa: overview.currentCgpa,
        progressPercent: overview.progressPercent,
        attendancePct: overview.attendancePct,
        subjectsAtRisk: overview.subjectsAtRisk,
      },
    });
    const careerProfile = this._getCareerProfile(user);
    const applications = this._getCareerApplications(user);
    const previousEvents = this._getStoredRecommendationEvents(user, 50);
    const lmsRecommendations = await this._getLmsRecommendations(user, 5);
    const profileGraph = buildUnifiedProfileGraph({
      overview,
      careerReadiness,
      careerProfile,
      applications,
      lmsRecommendations,
      recommendationEvents: previousEvents,
    });
    const atsScore = buildAtsScore(careerReadiness);
    const nextSkills = buildNextSkillRecommendations({
      careerReadiness,
      lmsRecommendations,
      recommendationEvents: previousEvents,
    });
    const opportunityRecommendations = buildUnifiedOpportunityRecommendations({
      careerReadiness,
      user,
      recommendationEvents: previousEvents,
    });
    const actionPlan = buildUnifiedActionPlan({
      overview,
      categoryPerformance,
      careerReadiness,
      nextSkills,
      opportunityRecommendations,
    });

    const payload = {
      contractVersion: UNIFIED_INSIGHTS_CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      scoringSchema: buildScoringSchema(),
      profileGraph,
      atsScore,
      academicSignals: {
        currentCgpa: overview.currentCgpa,
        progressPercent: overview.progressPercent,
        attendancePct: overview.attendancePct,
        subjectsAtRisk: overview.subjectsAtRisk,
        recommendations: academicRecommendations,
      },
      nextSkills,
      opportunityRecommendations,
      actionPlan,
      feedbackLoop: {
        recentEvents: summarizeRecentEvents(previousEvents),
        adaptiveSignals: previousEvents.filter((event) => normalizeIdentity(event.eventType) !== "generated").length,
        modelInfluence:
          previousEvents.length > 0
            ? "Prior clicks, saves, applies, and dismissals adjust confidence in later rankings."
            : "No prior interaction events yet; rankings use academic, LMS, and career profile signals.",
      },
      lmsSignals: {
        recommendations: lmsRecommendations.slice(0, 5).map((item) => ({
          id: item.id,
          title: item.title,
          confidence: clampUnit(item.confidence, 0),
          recommendationScore: item.recommendationScore ?? null,
          reasons: ensureArray(item.reasons),
          inputsUsed: item.inputsUsed || {},
        })),
      },
      sourceStatus: this._buildSourceStatus(batch),
      responseTimeMs: Date.now() - startedAt,
    };
    payload.qualityMonitoring = {
      ...evaluateUnifiedInsightPayload(payload),
      measuredLatencyMs: payload.responseTimeMs,
      dashboardCards: [
        { label: "Explainability", value: `${Math.round(evaluateUnifiedInsightPayload(payload).metrics.explainabilityCoverage * 100)}%` },
        { label: "Eligible opportunities", value: `${Math.round(evaluateUnifiedInsightPayload(payload).metrics.eligibleOpportunityRate * 100)}%` },
        { label: "Feedback events", value: String(payload.feedbackLoop.recentEvents.length) },
      ],
    };

    const generatedEvents = this._recordUnifiedRecommendations({
      user,
      nextSkills,
      opportunityRecommendations,
      actionPlan,
    });
    payload.feedbackLoop.generatedEvents = summarizeRecentEvents(generatedEvents);

    const snapshot = this._persistSnapshot({
      user,
      snapshotType: "unified-insights",
      payload,
      sourceStatus: this._buildSourceStatus(batch),
    });

    return {
      ...payload,
      snapshot,
      history: this._getSnapshotHistory(user, "unified-insights"),
    };
  },

  getHistory({ user, snapshotType = "", limit = 10 }) {
    if (!this.trackerStore || !user?.userId) {
      return { items: [] };
    }
    return {
      items: this.trackerStore
        .listSnapshots(user.userId, { snapshotType, limit })
        .map((snapshot) => this._summarizeSnapshot(snapshot)),
    };
  },

  getRecommendationEvents({ user, limit = 25 }) {
    if (!this.trackerStore || !user?.userId) {
      return { items: [] };
    }
    return {
      items: this.trackerStore.listRecommendationEvents(user.userId, { limit }),
    };
  },

  recordRecommendationEvent({ user, payload = {} }) {
    if (!this.trackerStore || !user?.userId) {
      return { items: [] };
    }
    const items = this.trackerStore.recordRecommendationEvents({
      userId: user.userId,
      eventType: payload.eventType || "interaction",
      sourceDomain: payload.sourceDomain || "academic_tracker",
      recommendations: [
        {
          id: payload.recommendationId,
          title: payload.recommendationTitle,
          confidence: payload.confidence,
          action: payload.action,
          inputsUsed: payload.inputsUsed,
        },
      ],
    });
    return { items };
  }
};
