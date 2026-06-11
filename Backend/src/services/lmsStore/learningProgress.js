const {
  nowIso,
  randomId,
  toSafeString,
  toNullableString,
  toInteger,
  toNullableInteger,
  ensureArray,
  parseJson,
  stringifyJson,
  assertCondition,
  clamp,
  startOfDayIso,
  addDaysIso,
} = require("../lmsUtils");

module.exports = {
  markProgress(userId, resourceId, status, timeSpentMs = 0) {
    assertCondition(["started", "completed"].includes(status), 400, "Invalid progress status", "LMS_VALIDATION");
    const completedAt = status === "completed" ? nowIso() : null;
    this.db.prepare(
      `
        INSERT INTO lms_progress (userId, resourceId, status, completedAt, timeSpentMs, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(userId, resourceId) DO UPDATE SET
          status = excluded.status,
          completedAt = excluded.completedAt,
          timeSpentMs = excluded.timeSpentMs,
          updatedAt = excluded.updatedAt
      `
    ).run(userId, resourceId, status, completedAt, toInteger(timeSpentMs, 0), nowIso());
    this.recordActivity(userId);
    return this.db.prepare("SELECT * FROM lms_progress WHERE userId = ? AND resourceId = ?").get(userId, resourceId);
  },

  getContinueLearning(userId) {
    const row = this.db
      .prepare(
        `
          SELECT r.*, p.updatedAt AS progressUpdatedAt
          FROM lms_progress p
          JOIN lms_resources r ON r.id = p.resourceId
          WHERE p.userId = ? AND p.status = 'started'
          ORDER BY p.updatedAt DESC
          LIMIT 1
        `
      )
      .get(userId);
    return row ? this.mapResource(row) : null;
  },

  updateTopicMastery(userId, topicId, quizScore = 0, interactionScore = 0, revisionScore = 0) {
    const current = this.db
      .prepare("SELECT * FROM lms_topic_mastery WHERE userId = ? AND topicId = ?")
      .get(userId, topicId) || {
      mastery: 0,
      quizScore: 0,
      interactionScore: 0,
      revisionScore: 0,
    };
    const nextQuiz = quizScore !== undefined ? Number(quizScore || current.quizScore || 0) : Number(current.quizScore || 0);
    const nextInteraction = interactionScore !== undefined
      ? Number(interactionScore || current.interactionScore || 0)
      : Number(current.interactionScore || 0);
    const nextRevision = revisionScore !== undefined
      ? Number(revisionScore || current.revisionScore || 0)
      : Number(current.revisionScore || 0);
    const mastery = clamp(nextQuiz * 0.5 + nextInteraction * 0.25 + nextRevision * 0.25, 0, 1);
    this.db.prepare(
      `
        INSERT INTO lms_topic_mastery (userId, topicId, mastery, quizScore, interactionScore, revisionScore, lastUpdated)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(userId, topicId) DO UPDATE SET
          mastery = excluded.mastery,
          quizScore = excluded.quizScore,
          interactionScore = excluded.interactionScore,
          revisionScore = excluded.revisionScore,
          lastUpdated = excluded.lastUpdated
      `
    ).run(userId, topicId, mastery, nextQuiz, nextInteraction, nextRevision, nowIso());
    return this.db
      .prepare("SELECT * FROM lms_topic_mastery WHERE userId = ? AND topicId = ?")
      .get(userId, topicId);
  },

  getRevisionQueue(userId) {
    return this.db
      .prepare(
        `
          SELECT rq.*, r.title, r.subjectCode, r.subjectName, r.type, r.estimatedMinutes
          FROM lms_revision_queue rq
          JOIN lms_resources r ON r.id = rq.resourceId
          WHERE rq.userId = ?
          ORDER BY rq.dueDate ASC
        `
      )
      .all(userId);
  },

  updateRevisionSchedule(userId, resourceId, score) {
    const current = this.db
      .prepare("SELECT * FROM lms_revision_queue WHERE userId = ? AND resourceId = ?")
      .get(userId, resourceId) || {
      interval: 1,
      repetition: 0,
    };
    const next = this.revisionScheduler.getNextRevision({
      previousInterval: current.interval,
      previousRepetition: current.repetition,
      score,
    });
    this.db.prepare(
      `
        INSERT INTO lms_revision_queue (userId, resourceId, dueDate, interval, repetition)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(userId, resourceId) DO UPDATE SET
          dueDate = excluded.dueDate,
          interval = excluded.interval,
          repetition = excluded.repetition
      `
    ).run(userId, resourceId, next.dueDate, next.interval, next.repetition);
    return this.getRevisionQueue(userId);
  },

  submitRevisionReview(userId, resourceId, score) {
    const queue = this.updateRevisionSchedule(userId, resourceId, score);
    const topics = this.getTopicsForResource(resourceId);
    for (const topic of topics) {
      this.updateTopicMastery(userId, topic.id, undefined, undefined, clamp(Number(score || 0) / 100, 0, 1));
    }
    this.recordActivity(userId);
    return queue;
  },

  recordActivity(userId, activityDate = new Date()) {
    const today = startOfDayIso(activityDate);
    const current = this.db.prepare("SELECT * FROM lms_streaks WHERE userId = ?").get(userId);
    if (!current) {
      this.db.prepare(
        "INSERT INTO lms_streaks (userId, currentStreak, longestStreak, lastActivityDate) VALUES (?, 1, 1, ?)"
      ).run(userId, today);
      return { userId, currentStreak: 1, longestStreak: 1, lastActivityDate: today };
    }
    if (current.lastActivityDate === today) return current;
    const yesterday = addDaysIso(today, -1);
    const currentStreak = current.lastActivityDate === yesterday ? Number(current.currentStreak || 0) + 1 : 1;
    const longestStreak = Math.max(Number(current.longestStreak || 0), currentStreak);
    this.db.prepare(
      "UPDATE lms_streaks SET currentStreak = ?, longestStreak = ?, lastActivityDate = ? WHERE userId = ?"
    ).run(currentStreak, longestStreak, today, userId);
    return { userId, currentStreak, longestStreak, lastActivityDate: today };
  },

  getStreak(userId) {
    return this.db.prepare("SELECT * FROM lms_streaks WHERE userId = ?").get(userId) || {
      userId,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
    };
  },

  recordQuizAttempt(resourceId, userId, payload) {
    const answers = ensureArray(payload.answers);
    const questionIds = this.db
      .prepare("SELECT questionId FROM lms_quiz_questions WHERE resourceId = ? ORDER BY position ASC")
      .all(resourceId)
      .map((row) => row.questionId);
    const questions = questionIds.map((questionId) => this.getQuestionBankItem(questionId)).filter(Boolean);
    let score = 0;
    questions.forEach((question, index) => {
      if (Number(answers[index]) === Number(question.correctIndex)) {
        score += 1;
      }
    });
    const maxScore = Math.max(1, questions.length);
    const percentage = Number(((score / maxScore) * 100).toFixed(2));
    const id = randomId("attempt");
    this.db.prepare(
      `
        INSERT INTO lms_quiz_attempts (id, resourceId, userId, answers, score, maxScore, percentage, mode, timeTakenMs, completedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      id,
      resourceId,
      userId,
      stringifyJson(answers, "[]"),
      score,
      maxScore,
      percentage,
      toSafeString(payload.mode || "practice"),
      toNullableInteger(payload.timeTakenMs),
      nowIso()
    );
    this.recomputeResourceEffectiveness(resourceId);
    this.markProgress(userId, resourceId, "completed", toInteger(payload.timeTakenMs, 0));
    const topics = this.getTopicsForResource(resourceId);
    for (const topic of topics) {
      this.updateTopicMastery(userId, topic.id, clamp(percentage / 100, 0, 1));
    }
    this.updateRevisionSchedule(userId, resourceId, percentage);
    return this.db.prepare("SELECT * FROM lms_quiz_attempts WHERE id = ?").get(id);
  },

  getQuizAttempts(resourceId, userId) {
    return this.db
      .prepare("SELECT * FROM lms_quiz_attempts WHERE resourceId = ? AND userId = ? ORDER BY completedAt DESC")
      .all(resourceId, userId)
      .map((row) => ({ ...row, answers: parseJson(row.answers, []) }));
  },

  applyInteractionEffects({ userId, resourceId, action, timeSpentMs = 0 }) {
    if (action === "view") {
      this.db.prepare("UPDATE lms_resources SET viewCount = viewCount + 1 WHERE id = ?").run(resourceId);
      this.markProgress(userId, resourceId, "started", timeSpentMs);
    }
    if (action === "complete") {
      this.markProgress(userId, resourceId, "completed", timeSpentMs);
    }
    if (action === "bookmark") {
      this.toggleBookmark(resourceId, userId);
    }
    if (action === "upvote") {
      this.toggleUpvote(resourceId, userId);
    }
  },

  insertInteractionBatch(events) {
    this.withTransaction(() => {
      for (const event of events) {
        this.db.prepare(
          `
            INSERT OR IGNORE INTO lms_user_interactions
            (id, userId, resourceId, guideId, roadmapId, action, timeSpentMs, metadata, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        ).run(
          event.id,
          event.userId,
          toNullableString(event.resourceId),
          toNullableString(event.guideId),
          toNullableString(event.roadmapId),
          toSafeString(event.action),
          toNullableInteger(event.timeSpentMs),
          typeof event.metadata === "string" ? event.metadata : stringifyJson(event.metadata || {}, "{}"),
          event.createdAt || nowIso()
        );
      }
    });
    return events.length;
  }
};
