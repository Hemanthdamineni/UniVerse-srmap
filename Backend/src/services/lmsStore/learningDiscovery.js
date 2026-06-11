const {
  toSafeString,
  toInteger,
  parseJson,
} = require("../lmsUtils");

module.exports = {
  listRecommendationCandidates({ userId = "", filters = {}, limit = 30 }) {
    const items = this.getResources(
      {
        ...filters,
        recommendable: true,
        limit,
        page: 1,
      },
      { userId }
    ).items;
    return items.map((item) => {
      const interaction = userId
        ? this.db
            .prepare(
              "SELECT action, createdAt FROM lms_user_interactions WHERE userId = ? AND resourceId = ? ORDER BY createdAt DESC LIMIT 1"
            )
            .get(userId, item.id)
        : null;
      return {
        ...item,
        userInteraction: interaction || null,
        userEnrolled: Boolean(userId && this.db.prepare("SELECT 1 FROM lms_progress WHERE userId = ? AND resourceId = ?").get(userId, item.id)),
      };
    });
  },

  getExplore(userId) {
    const trending = this.db
      .prepare(
        `
          SELECT r.*, COUNT(ix.id) AS recentInteractions
          FROM lms_resources r
          LEFT JOIN lms_user_interactions ix
            ON ix.resourceId = r.id AND ix.createdAt >= datetime('now', '-7 days')
          WHERE r.isDeleted = 0 AND r.moderationState < 2
          GROUP BY r.id
          ORDER BY recentInteractions DESC, r.qualityScore DESC
          LIMIT 8
        `
      )
      .all()
      .map((row) => this.attachResourceUserState(this.mapResource(row), userId));
    const topRated = this.getResources({ sort: "quality", limit: 8, page: 1 }, { userId }).items;
    const examReady = this.db
      .prepare(
        "SELECT * FROM lms_resources WHERE isDeleted = 0 AND moderationState < 2 AND examProvenScore > 2.0 ORDER BY examProvenScore DESC LIMIT 8"
      )
      .all()
      .map((row) => this.attachResourceUserState(this.mapResource(row), userId));
    return { trending, topRated, examReady };
  },

  getSubjectOverview(subjectCode, userId) {
    const resources = this.getResources({ subjectCode, limit: 200, page: 1 }, { userId }).items;
    const byUnit = new Map();
    for (const resource of resources) {
      const bucket = byUnit.get(resource.unitNormalized) || [];
      bucket.push(resource);
      byUnit.set(resource.unitNormalized, bucket);
    }
    const topByUnit = Array.from(byUnit.entries()).map(([unitNormalized, items]) => ({
      unitNormalized,
      unit: items[0]?.unit || unitNormalized,
      topResource: items.sort((left, right) => right.qualityScore - left.qualityScore)[0] || null,
    }));
    const requests = this.getRequests({ subjectCode, status: "open", limit: 20, page: 1 }).items;
    const topicMastery = this.db
      .prepare(
        `
          SELECT tm.*, t.label
          FROM lms_topic_mastery tm
          JOIN lms_topics t ON t.id = tm.topicId
          WHERE tm.userId = ? AND t.subjectCode = ?
          ORDER BY t.label ASC
        `
      )
      .all(userId, toSafeString(subjectCode).toUpperCase());
    return {
      subjectCode: toSafeString(subjectCode).toUpperCase(),
      topByUnit,
      examProven: resources.filter((item) => Number(item.examProvenScore || 0) > 2).slice(0, 8),
      openRequests: requests,
      topicMastery,
      studyingCount: this.getCurrentlyStudyingCount(subjectCode),
    };
  },

  getTopicGraph(subjectCode) {
    const topics = this.db.prepare("SELECT * FROM lms_topics WHERE subjectCode = ? ORDER BY label ASC").all(
      toSafeString(subjectCode).toUpperCase()
    );
    const prerequisites = this.db
      .prepare(
        `
          SELECT tp.topicId, tp.prerequisiteId, t1.label AS topicLabel, t2.label AS prerequisiteLabel
          FROM lms_topic_prerequisites tp
          JOIN lms_topics t1 ON t1.id = tp.topicId
          JOIN lms_topics t2 ON t2.id = tp.prerequisiteId
          WHERE t1.subjectCode = ?
        `
      )
      .all(toSafeString(subjectCode).toUpperCase());
    return { topics: topics.map((row) => ({ ...row, crossSubjectLinks: parseJson(row.crossSubjectLinks, []) })), prerequisites };
  },

  getCurrentlyStudyingCount(subjectCode) {
    const row = this.db
      .prepare(
        `
          SELECT COUNT(DISTINCT ix.userId) AS total
          FROM lms_user_interactions ix
          JOIN lms_resources r ON r.id = ix.resourceId
          WHERE r.subjectCode = ? AND ix.createdAt >= datetime('now', '-1 day')
        `
      )
      .get(toSafeString(subjectCode).toUpperCase());
    return toInteger(row?.total, 0);
  },

  getWeeklyLeaderboard() {
    const resourceRows = this.db
      .prepare(
        `
          SELECT uploadedBy AS userId, COUNT(*) AS uploads
          FROM lms_resources
          WHERE uploadedAt >= datetime('now', '-7 days') AND isDeleted = 0
          GROUP BY uploadedBy
        `
      )
      .all();
    const guideRows = this.db
      .prepare(
        `
          SELECT authorId AS userId, COUNT(*) AS guidesPublished
          FROM lms_guides
          WHERE createdAt >= datetime('now', '-7 days') AND isDeleted = 0
          GROUP BY authorId
        `
      )
      .all();
    const roadmapRows = this.db
      .prepare(
        `
          SELECT authorId AS userId, COUNT(*) AS roadmapsPublished
          FROM lms_roadmaps
          WHERE createdAt >= datetime('now', '-7 days') AND isDeleted = 0
          GROUP BY authorId
        `
      )
      .all();
    const points = new Map();
    const merge = (userId, field, value) => {
      const existing = points.get(userId) || { userId, uploads: 0, guidesPublished: 0, roadmapsPublished: 0, score: 0 };
      existing[field] = Number(value || 0);
      existing.score = existing.uploads * 1 + existing.guidesPublished * 5 + existing.roadmapsPublished * 10;
      points.set(userId, existing);
    };
    for (const row of resourceRows) merge(row.userId, "uploads", row.uploads);
    for (const row of guideRows) merge(row.userId, "guidesPublished", row.guidesPublished);
    for (const row of roadmapRows) merge(row.userId, "roadmapsPublished", row.roadmapsPublished);
    return Array.from(points.values())
      .sort((left, right) => right.score - left.score)
      .slice(0, 10);
  },

  getProgressSummary(userId) {
    const rows = this.db
      .prepare(
        `
          SELECT p.*, r.subjectCode, r.subjectName, r.title
          FROM lms_progress p
          JOIN lms_resources r ON r.id = p.resourceId
          WHERE p.userId = ?
          ORDER BY p.updatedAt DESC
        `
      )
      .all(userId);
    const completed = rows.filter((row) => row.status === "completed").length;
    const started = rows.length;
    const perSubject = new Map();
    for (const row of rows) {
      const bucket = perSubject.get(row.subjectCode) || { subjectCode: row.subjectCode, subjectName: row.subjectName, started: 0, completed: 0 };
      bucket.started += 1;
      if (row.status === "completed") bucket.completed += 1;
      perSubject.set(row.subjectCode, bucket);
    }
    return {
      started,
      completed,
      completionRate: started > 0 ? Number(((completed / started) * 100).toFixed(2)) : 0,
      subjects: Array.from(perSubject.values()),
    };
  },

  getProgressForSubject(userId, subjectCode) {
    return this.db
      .prepare(
        `
          SELECT p.*, r.title, r.type, r.unit, r.subjectName
          FROM lms_progress p
          JOIN lms_resources r ON r.id = p.resourceId
          WHERE p.userId = ? AND r.subjectCode = ?
          ORDER BY p.updatedAt DESC
        `
      )
      .all(userId, toSafeString(subjectCode).toUpperCase());
  },

  getMastery(userId) {
    return this.db
      .prepare(
        `
          SELECT tm.*, t.label, t.subjectCode
          FROM lms_topic_mastery tm
          JOIN lms_topics t ON t.id = tm.topicId
          WHERE tm.userId = ?
          ORDER BY t.subjectCode ASC, t.label ASC
        `
      )
      .all(userId);
  },

  generateLearningSession(userId, durationMinutes) {
    const dueItems = this.getRevisionQueue(userId).slice(0, 2);
    const recommendations = this.listRecommendationCandidates({ userId, limit: 10 });
    const resources = recommendations.slice(0, 2);
    return {
      durationMinutes: toInteger(durationMinutes, 30),
      revision: dueItems,
      resources,
      totalEstimatedMinutes: resources.reduce((sum, item) => sum + Number(item.estimatedMinutes || 5), 0),
    };
  },

  getUserContributions(userId) {
    return {
      resources: this.db.prepare("SELECT * FROM lms_resources WHERE uploadedBy = ? ORDER BY uploadedAt DESC").all(userId).map((row) => this.mapResource(row)),
      guides: this.db.prepare("SELECT * FROM lms_guides WHERE authorId = ? ORDER BY createdAt DESC").all(userId).map((row) => this.mapGuide(row, false, userId)),
      roadmaps: this.db.prepare("SELECT * FROM lms_roadmaps WHERE authorId = ? ORDER BY createdAt DESC").all(userId).map((row) => this.mapRoadmap(row, false, userId)),
    };
  },

  getBookmarkedResources(userId) {
    return this.db
      .prepare(
        `
          SELECT r.*
          FROM lms_bookmarks b
          JOIN lms_resources r ON r.id = b.resourceId
          WHERE b.userId = ?
          ORDER BY b.createdAt DESC
        `
      )
      .all(userId)
      .map((row) => this.mapResource(row));
  },

  getActivity(userId) {
    return this.db
      .prepare("SELECT * FROM lms_user_interactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 100")
      .all(userId)
      .map((row) => ({ ...row, metadata: parseJson(row.metadata, {}) }));
  },

  getUserRequests(userId) {
    return this.db.prepare("SELECT * FROM lms_requests WHERE userId = ? ORDER BY createdAt DESC").all(userId);
  },

  getContributorProfile(userId) {
    const contributions = this.getUserContributions(userId);
    const summary = this.getPublisherSummary(userId);
    const resourceCount = contributions.resources.length;
    const guideCount = contributions.guides.length;
    const roadmapCount = contributions.roadmaps.length;
    return {
      userId,
      displayName: summary.displayName,
      trust: summary,
      totals: {
        resources: resourceCount,
        guides: guideCount,
        roadmaps: roadmapCount,
      },
      recentResources: contributions.resources.slice(0, 5),
      contributions,
    };
  }
};
