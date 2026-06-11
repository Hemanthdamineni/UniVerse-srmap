const { ensureArray } = require("./utils");

module.exports = {
  _recordGeneratedRecommendations({ user, academicRecommendations, careerReadiness }) {
    if (!this.trackerStore || !user?.userId) return [];
    const academicEvents = this.trackerStore.recordRecommendationEvents({
      userId: user.userId,
      eventType: "generated",
      sourceDomain: "academic_tracker",
      recommendations: ensureArray(academicRecommendations).map((recommendation) => ({
        ...recommendation,
        confidence:
          recommendation.type === "warning"
            ? 0.9
            : recommendation.type === "improvement"
              ? 0.75
              : 0.65,
        inputsUsed: ["gpaTrend", "attendanceRecords", "categoryPerformance"],
      })),
    });
    const careerEvents = this.trackerStore.recordRecommendationEvents({
      userId: user.userId,
      eventType: "generated",
      sourceDomain: "career_readiness",
      recommendations: ensureArray(careerReadiness?.recommendedOpportunities),
    });
    return [...academicEvents, ...careerEvents];
  },

  _getCareerProfile(user) {
    if (!this.careerStore || !user?.userId || typeof this.careerStore.getProfile !== "function") {
      return {
        userId: user?.userId || "",
        skills: [],
        preferredTypes: [],
        preferredLocations: [],
        resumeUrl: "",
        resumeFileName: "",
      };
    }
    try {
      return this.careerStore.getProfile(user);
    } catch {
      return {
        userId: user.userId,
        skills: [],
        preferredTypes: [],
        preferredLocations: [],
        resumeUrl: "",
        resumeFileName: "",
      };
    }
  },

  _getCareerApplications(user) {
    if (!this.careerStore || !user?.userId || typeof this.careerStore.getApplications !== "function") {
      return [];
    }
    try {
      return ensureArray(this.careerStore.getApplications(user.userId));
    } catch {
      return [];
    }
  },

  _getStoredRecommendationEvents(user, limit = 50) {
    if (!this.trackerStore || !user?.userId) return [];
    return ensureArray(this.trackerStore.listRecommendationEvents(user.userId, { limit }));
  },

  async _getLmsRecommendations(user, limit = 5) {
    if (!user?.userId) return [];
    try {
      if (this.recommendationEngine && typeof this.recommendationEngine.getRecommendations === "function") {
        return ensureArray(await this.recommendationEngine.getRecommendations({ userId: user.userId, limit }));
      }
      if (this.lmsStore && typeof this.lmsStore.listRecommendationCandidates === "function") {
        return ensureArray(this.lmsStore.listRecommendationCandidates({ userId: user.userId, limit })).slice(0, limit);
      }
    } catch {
      return [];
    }
    return [];
  },

  _recordUnifiedRecommendations({ user, nextSkills, opportunityRecommendations, actionPlan }) {
    if (!this.trackerStore || !user?.userId) return [];
    const recommendations = [
      ...ensureArray(nextSkills).map((item) => ({
        id: item.id,
        title: item.title,
        confidence: item.confidence,
        inputsUsed: item.inputsUsed,
        reasons: item.reasons,
      })),
      ...ensureArray(opportunityRecommendations).map((item) => ({
        id: item.id,
        title: item.title,
        confidence: item.confidence,
        inputsUsed: item.inputsUsed,
        reasons: item.reasons,
      })),
      ...ensureArray(actionPlan).map((item) => ({
        id: item.id,
        title: item.title,
        confidence: item.confidence,
        inputsUsed: item.inputsUsed,
        reasons: item.reasons,
      })),
    ];
    return this.trackerStore.recordRecommendationEvents({
      userId: user.userId,
      eventType: "generated",
      sourceDomain: "unified_insights",
      recommendations,
    });
  }
};
