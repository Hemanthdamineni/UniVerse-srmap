const {
  nowIso,
  randomId,
  toSafeString,
  toInteger,
  ensureObject,
  parseJson,
  stringifyJson,
  normalizeTagList,
  clamp,
} = require("../lmsUtils");

module.exports = {
  getUserStorageRow(userId) {
    const row = this.db.prepare("SELECT * FROM lms_user_storage WHERE userId = ?").get(userId);
    if (row) return row;
    this.db.prepare("INSERT INTO lms_user_storage (userId, totalBytes) VALUES (?, 0)").run(userId);
    return { userId, totalBytes: 0 };
  },

  updateUserStorage(userId, deltaBytes) {
    const current = this.getUserStorageRow(userId);
    const totalBytes = Math.max(0, Number(current.totalBytes || 0) + Number(deltaBytes || 0));
    this.db.prepare("UPDATE lms_user_storage SET totalBytes = ? WHERE userId = ?").run(totalBytes, userId);
    return totalBytes;
  },

  getPublisherSummary(userId) {
    const normalizedUserId = toSafeString(userId);
    if (!normalizedUserId) {
      return {
        userId: "",
        displayName: "Legacy contributor",
        contributionCount: 0,
        approvedCount: 0,
        flaggedCount: 0,
        hiddenCount: 0,
        qualityAverage: 0,
        upvoteTotal: 0,
        trustScore: 35,
        lastPublishedAt: null,
      };
    }

    const row = this.db
      .prepare(
        `
          SELECT
            COUNT(*) AS contributionCount,
            SUM(CASE WHEN isDeleted = 0 AND moderationState < 2 THEN 1 ELSE 0 END) AS approvedCount,
            SUM(CASE WHEN flagCount > 0 THEN 1 ELSE 0 END) AS flaggedCount,
            SUM(CASE WHEN moderationState >= 2 OR isDeleted = 1 THEN 1 ELSE 0 END) AS hiddenCount,
            COALESCE(AVG(qualityScore), 0) AS qualityAverage,
            COALESCE(SUM(upvotes), 0) AS upvoteTotal,
            MAX(uploadedAt) AS lastPublishedAt
          FROM lms_resources
          WHERE uploadedBy = ?
        `
      )
      .get(normalizedUserId);
    const contributionCount = toInteger(row?.contributionCount, 0);
    const approvedCount = toInteger(row?.approvedCount, 0);
    const flaggedCount = toInteger(row?.flaggedCount, 0);
    const hiddenCount = toInteger(row?.hiddenCount, 0);
    const qualityAverage = Number(Number(row?.qualityAverage || 0).toFixed(2));
    const upvoteTotal = toInteger(row?.upvoteTotal, 0);
    const trustScore = Math.round(
      clamp(
        50 +
          approvedCount * 7 +
          Math.min(qualityAverage, 10) * 3 +
          Math.min(upvoteTotal, 50) * 0.5 -
          flaggedCount * 8 -
          hiddenCount * 15,
        0,
        100
      )
    );

    return {
      userId: normalizedUserId,
      displayName: normalizedUserId,
      contributionCount,
      approvedCount,
      flaggedCount,
      hiddenCount,
      qualityAverage,
      upvoteTotal,
      trustScore,
      lastPublishedAt: row?.lastPublishedAt || null,
    };
  },

  getUserPreferences(userId) {
    let row = this.db.prepare("SELECT * FROM lms_user_preferences WHERE userId = ?").get(userId);
    if (!row) {
      const created = {
        userId,
        subjectWeights: "{}",
        typeWeights: "{}",
        difficultyPref: "any",
        topicWeights: "{}",
        explorationRate: 0.2,
        lastUpdated: nowIso(),
      };
      this.db.prepare(
        `
          INSERT INTO lms_user_preferences
          (userId, subjectWeights, typeWeights, difficultyPref, topicWeights, explorationRate, lastUpdated)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        created.userId,
        created.subjectWeights,
        created.typeWeights,
        created.difficultyPref,
        created.topicWeights,
        created.explorationRate,
        created.lastUpdated
      );
      row = created;
    }
    return row;
  },

  updateUserPreferences(userId, patch) {
    const current = this.getUserPreferences(userId);
    const nextSubjectWeights = ensureObject(parseJson(current.subjectWeights, {}));
    const nextTypeWeights = ensureObject(parseJson(current.typeWeights, {}));
    const nextTopicWeights = ensureObject(parseJson(current.topicWeights, {}));

    if (patch.subjectCode) {
      nextSubjectWeights[patch.subjectCode] = clamp(Number(nextSubjectWeights[patch.subjectCode] || 0.5), 0, 1);
    }
    if (patch.type) {
      nextTypeWeights[patch.type] = clamp(Number(nextTypeWeights[patch.type] || 0.5), 0, 1);
    }
    if (patch.subjectWeights && typeof patch.subjectWeights === "object" && !Array.isArray(patch.subjectWeights)) {
      Object.assign(nextSubjectWeights, patch.subjectWeights);
    }
    if (patch.typeWeights && typeof patch.typeWeights === "object" && !Array.isArray(patch.typeWeights)) {
      Object.assign(nextTypeWeights, patch.typeWeights);
    }
    if (patch.topicWeights && typeof patch.topicWeights === "object" && !Array.isArray(patch.topicWeights)) {
      Object.assign(nextTopicWeights, patch.topicWeights);
    }

    const explorationRate = patch.explorationRate !== undefined
      ? clamp(Number(patch.explorationRate || 0.2), 0, 1)
      : Number(current.explorationRate || 0.2);

    this.db.prepare(
      `
        UPDATE lms_user_preferences
        SET subjectWeights = ?, typeWeights = ?, topicWeights = ?, difficultyPref = ?, explorationRate = ?, lastUpdated = ?
        WHERE userId = ?
      `
    ).run(
      stringifyJson(nextSubjectWeights, "{}"),
      stringifyJson(nextTypeWeights, "{}"),
      stringifyJson(nextTopicWeights, "{}"),
      toSafeString(patch.difficultyPref || current.difficultyPref || "any") || "any",
      explorationRate,
      nowIso(),
      userId
    );
    return this.getUserPreferences(userId);
  },

  getTopicMasteryMap(userId) {
    const rows = this.db.prepare("SELECT topicId, mastery FROM lms_topic_mastery WHERE userId = ?").all(userId);
    return Object.fromEntries(rows.map((row) => [row.topicId, Number(row.mastery || 0)]));
  },

  getTopicsForResource(resourceId) {
    return this.db
      .prepare(
        `
          SELECT t.id, t.label, t.subjectCode, t.description, t.crossSubjectLinks
          FROM lms_resource_topics rt
          JOIN lms_topics t ON t.id = rt.topicId
          WHERE rt.resourceId = ?
          ORDER BY t.label ASC
        `
      )
      .all(resourceId)
      .map((row) => ({
        ...row,
        crossSubjectLinks: parseJson(row.crossSubjectLinks, []),
      }));
  },

  ensureTopicsForTags({ resourceId, subjectCode, tags }) {
    const normalizedTags = normalizeTagList(tags);
    this.db.prepare("DELETE FROM lms_resource_topics WHERE resourceId = ?").run(resourceId);
    for (const tag of normalizedTags) {
      let topic = this.db.prepare("SELECT * FROM lms_topics WHERE label = ?").get(tag);
      if (!topic) {
        const id = randomId("topic");
        this.db.prepare(
          `
            INSERT INTO lms_topics (id, label, subjectCode, description, crossSubjectLinks)
            VALUES (?, ?, ?, '', '[]')
          `
        ).run(id, tag, subjectCode);
        topic = { id, label: tag, subjectCode };
      }
      this.db.prepare(
        "INSERT OR IGNORE INTO lms_resource_topics (resourceId, topicId) VALUES (?, ?)"
      ).run(resourceId, topic.id);
    }
  }
};
