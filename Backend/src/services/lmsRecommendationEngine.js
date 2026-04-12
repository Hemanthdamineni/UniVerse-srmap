const { clamp, recencyScore, parseJson, ensureObject } = require("./lmsUtils");

function normalizeWeights(weights) {
  const total = Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0) || 1;
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Number(value || 0) / total]));
}

class LmsRecommendationEngine {
  constructor({ lmsStore, featureFlagService }) {
    this.lmsStore = lmsStore;
    this.featureFlagService = featureFlagService;
    this.defaultWeights = normalizeWeights({
      subjectMatch: 0.25,
      typePreference: 0.15,
      qualityScore: 0.2,
      recency: 0.1,
      effectivenessScore: 0.1,
      topicGapScore: 0.1,
      examProvenScore: 0.1,
    });
    this.learningRate = 0.05;
  }

  async getRecommendations({ userId, filters = {}, limit = 12 }) {
    const [preferences, candidates, masteryMap] = await Promise.all([
      this.lmsStore.getUserPreferences(userId),
      this.lmsStore.listRecommendationCandidates({ userId, filters, limit: Math.max(limit * 3, 30) }),
      this.lmsStore.getTopicMasteryMap(userId),
    ]);

    const weights = this.defaultWeights;

    const scored = candidates.map((resource) => {
      const factors = this.computeFactors({ resource, preferences, masteryMap });
      const score =
        factors.subjectMatch * weights.subjectMatch +
        factors.typePreference * weights.typePreference +
        factors.qualityScore * weights.qualityScore +
        factors.recency * weights.recency +
        factors.effectivenessScore * weights.effectivenessScore +
        factors.topicGapScore * weights.topicGapScore +
        factors.examProvenScore * weights.examProvenScore;
      return { ...resource, recommendationScore: Number(score.toFixed(6)), _factors: factors };
    });

    const sorted = scored.sort((left, right) => right.recommendationScore - left.recommendationScore);
    const explorationCutoff = Math.max(1, Math.round(limit * 0.2));
    const exploitCount = Math.max(0, limit - explorationCutoff);
    const deterministic = sorted.slice(0, exploitCount);
    const unseen = sorted.slice(exploitCount).filter((item) => !item.userInteraction);
    const exploratory = unseen.sort(() => Math.random() - 0.5).slice(0, explorationCutoff);
    const finalList = [...deterministic, ...exploratory].slice(0, limit);

    for (const item of finalList) {
      await this.lmsStore.logShadowRanking({
        userId,
        resourceId: item.id,
        algorithmKey: "ranking-v1",
        shadowScore: item.recommendationScore,
        displayedScore: item.recommendationScore,
      });
    }

    return finalList;
  }

  computeFactors({ resource, preferences, masteryMap }) {
    const subjectWeights = ensureObject(parseJson(preferences?.subjectWeights, {}));
    const typeWeights = ensureObject(parseJson(preferences?.typeWeights, {}));
    const resourceTopics = Array.isArray(resource.topics) ? resource.topics : [];
    const gapScores = resourceTopics.map((topicId) => 1 - Number(masteryMap[topicId] || 0));
    const avgGap = gapScores.length
      ? gapScores.reduce((sum, value) => sum + value, 0) / gapScores.length
      : 0.4;

    return {
      subjectMatch: clamp(Number(subjectWeights[resource.subjectCode] || (resource.userEnrolled ? 1 : 0.35)), 0, 1),
      typePreference: clamp(Number(typeWeights[resource.type] || 0.5), 0, 1),
      qualityScore: clamp(Number(resource.qualityScore || 0) / 10, 0, 1),
      recency: clamp(recencyScore(resource.uploadedAt), 0, 1),
      effectivenessScore: clamp(Number(resource.effectivenessScore || 0) / 5, 0, 1),
      topicGapScore: clamp(avgGap, 0, 1),
      examProvenScore: clamp(Number(resource.examProvenScore || 0) / 5, 0, 1),
    };
  }

  async recordFeedback({ userId, resourceId, action }) {
    const preferences = await this.lmsStore.getUserPreferences(userId);
    const resource = this.lmsStore.getResourceRow(resourceId);
    if (!resource) return preferences;

    const subjectWeights = ensureObject(parseJson(preferences?.subjectWeights, {}));
    const typeWeights = ensureObject(parseJson(preferences?.typeWeights, {}));
    const engaged = ["click", "view", "complete", "bookmark", "upvote", "quiz_pass", "exam_feedback_positive"].includes(action);

    const subjectCurrent = Number(subjectWeights[resource.subjectCode] || 0.5);
    const typeCurrent = Number(typeWeights[resource.type] || 0.5);
    subjectWeights[resource.subjectCode] = engaged
      ? subjectCurrent + this.learningRate * (1 - subjectCurrent)
      : subjectCurrent - this.learningRate * subjectCurrent;
    typeWeights[resource.type] = engaged
      ? typeCurrent + this.learningRate * (1 - typeCurrent)
      : typeCurrent - this.learningRate * typeCurrent;

    await this.lmsStore.updateUserPreferences(userId, {
      subjectWeights,
      typeWeights,
    });
  }
}

module.exports = {
  LmsRecommendationEngine,
};
