const crypto = require("crypto");
const { toSafeString, nowIso, randomId, ensureArray, safeParseStructuredContent, clamp, recencyScore, parseJson, ensureObject, addDaysIso } = require("./lmsUtils");
const { LMS_QUEUE_BATCH_SIZE, LMS_QUEUE_FLUSH_MS, LMS_QUEUE_MAX_RETRIES } = require("../../config/env");
const fs = require("fs");

// --- lmsDuplicateDetector.js ---
function normalizeTitle(value) {
  return toSafeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

class LmsDuplicateDetector {
  constructor({ lmsStore }) {
    this.lmsStore = lmsStore;
  }

  computeHash(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  async checkDuplicate({ fileHash, title, subjectCode, excludeId = "" }) {
    const normalizedTitle = normalizeTitle(title);
    return this.lmsStore.checkDuplicate({
      fileHash,
      title: normalizedTitle,
      subjectCode,
      excludeId,
    });
  }
}

// --- lmsExamFeedbackService.js ---
class LmsExamFeedbackService {
  constructor({ lmsStore, erpAggregationService }) {
    this.lmsStore = lmsStore;
    this.erpAggregationService = erpAggregationService;
  }

  async getPendingFeedback({ userId, sessionId }) {
    let currentSemester = "";
    if (this.erpAggregationService && sessionId) {
      try {
        const batch = await this.erpAggregationService.getBatch({
          pageKeys: ["examination/current-semester-results"],
          sessionId,
        });
        const payload = batch["examination/current-semester-results"]?.data || {};
        currentSemester = this.extractCurrentSemester(payload);
      } catch {
        currentSemester = "";
      }
    }

    return this.lmsStore.getPendingExamFeedback({
      userId,
      semester: currentSemester,
    });
  }

  extractCurrentSemester(payload) {
    const tables = payload?.Examination?.["Current Semester Results"]?.tables;
    if (!Array.isArray(tables)) return "";
    for (const table of tables) {
      if (!Array.isArray(table)) continue;
      for (const row of table) {
        const semester = String(row?.Semester || "").trim();
        if (semester) return semester;
      }
    }
    return "";
  }
}

// --- lmsFeatureFlagService.js ---
class LmsFeatureFlagService {
  constructor({ lmsStore }) {
    this.lmsStore = lmsStore;
  }

  async listFlags() {
    return this.lmsStore.listFeatureFlags();
  }

  async setFlag({ key, enabled, rolloutType = "global", rolloutValue = "", description = "", updatedBy = "" }) {
    return this.lmsStore.upsertFeatureFlag({
      key,
      enabled,
      rolloutType,
      rolloutValue,
      description,
      updatedBy,
      updatedAt: nowIso(),
    });
  }

  async isEnabled(key, { userId = "" } = {}) {
    const flag = await this.lmsStore.getFeatureFlag(key);
    if (!flag || !flag.enabled) return false;

    if (flag.rolloutType === "global") return true;

    if (flag.rolloutType === "percentage") {
      const percentage = Number.parseInt(String(flag.rolloutValue || "0"), 10);
      const bucket = this.computeBucket(`${key}:${userId || "guest"}`);
      return bucket < Math.max(0, Math.min(100, percentage));
    }

    if (flag.rolloutType === "cohort") {
      const allowed = String(flag.rolloutValue || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      return allowed.includes(userId);
    }

    return false;
  }

  async assignExperiment({ experimentKey, userId }) {
    const normalizedExperimentKey = toSafeString(experimentKey);
    const normalizedUserId = toSafeString(userId);
    if (!normalizedExperimentKey || !normalizedUserId) {
      return null;
    }

    const existing = await this.lmsStore.getExperimentAssignment(normalizedExperimentKey, normalizedUserId);
    if (existing) return existing;

    const variant = this.computeBucket(`${normalizedExperimentKey}:${normalizedUserId}`) < 50 ? "A" : "B";
    return this.lmsStore.assignExperiment({
      id: randomId("exp"),
      experimentKey: normalizedExperimentKey,
      userId: normalizedUserId,
      variant,
      assignedAt: nowIso(),
    });
  }

  computeBucket(value) {
    let total = 0;
    for (const char of String(value)) {
      total = (total + char.charCodeAt(0) * 17) % 100;
    }
    return total;
  }
}

// --- lmsInteractionQueue.js ---
class LmsInteractionQueue {
  constructor({ lmsStore, flushMs = LMS_QUEUE_FLUSH_MS, batchSize = LMS_QUEUE_BATCH_SIZE, maxRetries = LMS_QUEUE_MAX_RETRIES }) {
    this.lmsStore = lmsStore;
    this.flushMs = flushMs;
    this.batchSize = batchSize;
    this.maxRetries = maxRetries;
    this.pending = [];
    this.deadLetters = [];
    this.timer = setInterval(() => {
      this.flush().catch(() => {
        // Flush errors are handled per batch item retry state.
      });
    }, this.flushMs);
    this.timer.unref?.();
  }

  enqueue(event) {
    this.pending.push({ ...event, _retryCount: Number(event?._retryCount || 0) });
    if (this.pending.length >= this.batchSize) {
      return this.flush();
    }
    return Promise.resolve();
  }

  async flush() {
    if (!this.pending.length) return 0;
    const batch = this.pending.splice(0, this.batchSize);
    try {
      await this.lmsStore.insertInteractionBatch(batch);
      return batch.length;
    } catch (error) {
      for (const event of batch) {
        const nextRetryCount = Number(event._retryCount || 0) + 1;
        if (nextRetryCount > this.maxRetries) {
          this.deadLetters.push({
            id: randomId("dead"),
            failedAt: new Date().toISOString(),
            error: error?.message || "Queue flush failed",
            event,
          });
          continue;
        }
        this.pending.unshift({ ...event, _retryCount: nextRetryCount });
      }
      throw error;
    }
  }

  getHealth() {
    return {
      pendingCount: this.pending.length,
      deadLetterCount: this.deadLetters.length,
      flushMs: this.flushMs,
      batchSize: this.batchSize,
    };
  }

  stop() {
    clearInterval(this.timer);
  }
}

// --- lmsInteractionTracker.js ---
class LmsInteractionTracker {
  constructor({ lmsStore, queue, recommendationEngine }) {
    this.lmsStore = lmsStore;
    this.queue = queue;
    this.recommendationEngine = recommendationEngine;
  }

  async track({ userId, resourceId = null, guideId = null, roadmapId = null, action, timeSpentMs = 0, metadata = {} }) {
    const event = {
      id: randomId("ix"),
      userId,
      resourceId,
      guideId,
      roadmapId,
      action,
      timeSpentMs,
      metadata: JSON.stringify(metadata || {}),
      createdAt: nowIso(),
    };

    await this.queue.enqueue(event);

    if (resourceId) {
      await this.lmsStore.applyInteractionEffects({ userId, resourceId, action, timeSpentMs, metadata });
      if (this.recommendationEngine) {
        await this.recommendationEngine.recordFeedback({ userId, resourceId, action });
      }
    }

    await this.lmsStore.recordActivity(userId);
    return event;
  }
}

// --- lmsModerationService.js ---
class LmsModerationService {
  computeModerationState(flagCount) {
    const count = Number(flagCount || 0);
    if (count >= 5) return 3;
    if (count >= 2) return 2;
    if (count >= 1) return 1;
    return 0;
  }

  isOutdated(outdatedCount) {
    return Number(outdatedCount || 0) >= 3 ? 1 : 0;
  }
}

// --- lmsReadingTimeEstimator.js ---
function countWords(value) {
  return toSafeString(value)
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean).length;
}

function estimatePdfMinutes(fileSizeBytes) {
  const sizeMb = Math.max(1, Math.ceil(Number(fileSizeBytes || 0) / (1024 * 1024)));
  return Math.max(2, sizeMb * 2);
}

function estimateStructuredMinutes(type, structuredContent) {
  const content = safeParseStructuredContent(structuredContent);
  if (!content) return 5;

  if (type === "quiz") {
    const questions = ensureArray(content.questions);
    return Math.max(5, questions.length * 2);
  }

  if (type === "flashcard") {
    const cards = ensureArray(content.cards);
    return Math.max(5, Math.ceil(cards.length * 0.75));
  }

  return 5;
}

class LmsReadingTimeEstimator {
  async computeReadingTime({ type, noteContent, structuredContent, filePath, fileSize, mimeType, url, sections }) {
    const normalizedType = toSafeString(type).toLowerCase();
    const normalizedUrl = toSafeString(url).toLowerCase();
    const normalizedMime = toSafeString(mimeType).toLowerCase();

    if (normalizedType === "note" || normalizedType === "guide") {
      const text = normalizedType === "guide"
        ? ensureArray(sections)
            .map((section) => toSafeString(section?.content))
            .join(" ")
        : toSafeString(noteContent);
      return Math.max(1, Math.ceil(countWords(text) / 200));
    }

    if (normalizedType === "quiz" || normalizedType === "flashcard") {
      return estimateStructuredMinutes(normalizedType, structuredContent);
    }

    if (normalizedMime.includes("pdf") || normalizedUrl.endsWith(".pdf")) {
      return estimatePdfMinutes(fileSize);
    }

    if (normalizedType === "file" || normalizedType === "pyq") {
      if (filePath) {
        try {
          const stats = fs.statSync(filePath);
          return estimatePdfMinutes(stats.size);
        } catch {
          return estimatePdfMinutes(fileSize);
        }
      }
      return estimatePdfMinutes(fileSize);
    }

    if (normalizedUrl.includes("youtube.com") || normalizedUrl.includes("youtu.be")) {
      return 8;
    }

    return 5;
  }
}

// --- lmsRecommendationEngine.js ---
function normalizeWeights(weights) {
  const total = Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0) || 1;
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Number(value || 0) / total]));
}

class LmsRecommendationEngine {
  constructor({ lmsStore, featureFlagService, unifiedProfileStore = null }) {
    this.lmsStore = lmsStore;
    this.featureFlagService = featureFlagService;
    this.unifiedProfileStore = unifiedProfileStore;
    this.defaultWeights = normalizeWeights({
      subjectMatch: 0.25,
      typePreference: 0.15,
      qualityScore: 0.18,
      engagementScore: 0.12,
      recency: 0.08,
      effectivenessScore: 0.1,
      topicGapScore: 0.1,
      examProvenScore: 0.1,
      careerGapScore: 0.08,
      academicContextScore: 0.06,
      examIntentScore: 0.04,
    });
    this.examPrepWeights = normalizeWeights({
      subjectMatch: 0.18,
      typePreference: 0.06,
      qualityScore: 0.14,
      engagementScore: 0.08,
      recency: 0.06,
      effectivenessScore: 0.1,
      topicGapScore: 0.14,
      examProvenScore: 0.18,
      careerGapScore: 0.08,
      academicContextScore: 0.06,
      examIntentScore: 0.22,
    });
    this.learningRate = 0.05;
  }

  async getRecommendations({ userId, user = null, filters = {}, limit = 12, purpose = "default" }) {
    const [preferences, candidates, masteryMap] = await Promise.all([
      this.lmsStore.getUserPreferences(userId),
      this.lmsStore.listRecommendationCandidates({ userId, filters, limit: Math.max(limit * 3, 30) }),
      this.lmsStore.getTopicMasteryMap(userId),
    ]);

    const profileContext = this.buildProfileContext({ userId, user });
    const weights = purpose === "exam-prep" ? this.examPrepWeights : this.defaultWeights;
    const algorithmKey = purpose === "exam-prep" ? "ranking-v3-exam-prep" : "ranking-v3-profile-aware";

    const scored = candidates.map((resource) => {
      const factors = this.computeFactors({ resource, preferences, masteryMap, profileContext, purpose });
      const score =
        factors.subjectMatch * weights.subjectMatch +
        factors.typePreference * weights.typePreference +
        factors.qualityScore * weights.qualityScore +
        factors.engagementScore * weights.engagementScore +
        factors.recency * weights.recency +
        factors.effectivenessScore * weights.effectivenessScore +
        factors.topicGapScore * weights.topicGapScore +
        factors.examProvenScore * weights.examProvenScore +
        factors.careerGapScore * weights.careerGapScore +
        factors.academicContextScore * weights.academicContextScore +
        factors.examIntentScore * weights.examIntentScore;
      return {
        ...resource,
        recommendationScore: Number(score.toFixed(6)),
        confidence: Number(clamp(0.45 + score * 0.55, 0, 1).toFixed(3)),
        reasons: this.buildReasons(factors, purpose),
        inputsUsed: {
          algorithmKey,
          factors,
          moderationState: Number(resource.moderationState || 0),
          flagCount: Number(resource.flagCount || 0),
          userInteraction: resource.userInteraction?.action || null,
          publisherTrustScore: resource.publisher?.trustScore ?? null,
          profileSignals: profileContext.signalsUsed,
        },
        rankingPolicy: {
          algorithmKey,
          eligible: Boolean(resource.moderation?.recommendationEligible ?? true),
          filters: ["not_deleted", "moderation_clear", "no_open_flags"],
        },
        _factors: factors,
      };
    });

    const sorted = scored.sort((left, right) => right.recommendationScore - left.recommendationScore);
    const explorationCutoff = purpose === "exam-prep" ? 0 : Math.max(1, Math.round(limit * 0.2));
    const exploitCount = Math.max(0, limit - explorationCutoff);
    const deterministic = sorted.slice(0, exploitCount);
    const unseen = sorted.slice(exploitCount).filter((item) => !item.userInteraction);
    const exploratory = unseen.sort(() => Math.random() - 0.5).slice(0, explorationCutoff);
    const finalList = [...deterministic, ...exploratory].slice(0, limit);

    for (const item of finalList) {
      await this.lmsStore.logShadowRanking({
        userId,
        resourceId: item.id,
        algorithmKey,
        shadowScore: item.recommendationScore,
        displayedScore: item.recommendationScore,
      });
    }

    return finalList;
  }

  async getExamPrepRecommendations({ userId, user = null, filters = {}, limit = 8 }) {
    const recommendations = await this.getRecommendations({
      userId,
      user,
      filters,
      limit: Math.max(Number(limit || 8), 8),
      purpose: "exam-prep",
    });
    const examRelevant = recommendations.filter((resource) =>
      resource.type === "pyq" ||
      Number(resource.examProvenScore || 0) > 0 ||
      this.resourceMatchesAny(resource, ["exam", "pyq", "revision", "previous year"])
    );
    return (examRelevant.length ? examRelevant : recommendations).slice(0, Math.max(1, Number(limit || 8)));
  }

  buildProfileContext({ userId, user }) {
    const context = {
      skillKeywords: [],
      gapKeywords: [],
      academicKeywords: [],
      eventKeywords: [],
      signalsUsed: [],
    };
    const safeUser = user?.userId ? user : userId ? { userId, role: "student" } : null;

    if (safeUser?.branch) context.academicKeywords.push(safeUser.branch);
    if (safeUser?.department) context.academicKeywords.push(safeUser.department);
    if (safeUser?.year) context.academicKeywords.push(String(safeUser.year));

    if (!this.unifiedProfileStore || !safeUser?.userId) {
      return context;
    }

    try {
      const profile = this.unifiedProfileStore.buildUnifiedProfile(safeUser, { recompute: true });
      for (const item of Array.isArray(profile.skills) ? profile.skills : []) {
        const skill = typeof item === "string" ? item : item?.skill;
        if (skill) context.skillKeywords.push(skill);
      }
      for (const gap of Array.isArray(profile.career?.skillGaps) ? profile.career.skillGaps : []) {
        const skill = typeof gap === "string" ? gap : gap?.skill;
        if (skill) context.gapKeywords.push(skill);
      }
      for (const subject of Array.isArray(profile.lms?.progress?.subjects) ? profile.lms.progress.subjects : []) {
        if (subject?.subjectCode) context.academicKeywords.push(subject.subjectCode);
        if (subject?.subjectName) context.academicKeywords.push(subject.subjectName);
      }
      for (const registration of Array.isArray(profile.events?.registrations) ? profile.events.registrations : []) {
        if (registration?.title) context.eventKeywords.push(registration.title);
        if (registration?.eventTitle) context.eventKeywords.push(registration.eventTitle);
      }
      for (const event of Array.isArray(profile.events?.organized) ? profile.events.organized : []) {
        if (event?.title) context.eventKeywords.push(event.title);
      }
      if (profile.user?.branch) context.academicKeywords.push(profile.user.branch);
      if (profile.user?.department) context.academicKeywords.push(profile.user.department);
      context.signalsUsed.push("unified_profile");
    } catch {
      context.signalsUsed.push("unified_profile_unavailable");
    }

    context.skillKeywords = uniqueKeywords(context.skillKeywords);
    context.gapKeywords = uniqueKeywords(context.gapKeywords);
    context.academicKeywords = uniqueKeywords(context.academicKeywords);
    context.eventKeywords = uniqueKeywords([
      ...context.eventKeywords,
      ...this.getUpcomingCompetitionKeywords({ user: safeUser }),
    ]);
    return context;
  }

  getUpcomingCompetitionKeywords({ user }) {
    const keywords = [];
    const eventsStore = this.unifiedProfileStore?.eventsStore;
    if (!eventsStore?.listEvents || !user?.userId) return keywords;
    try {
      const events = eventsStore.listEvents({ user, filters: { type: "upcoming" } }) || [];
      for (const event of events.slice(0, 20)) {
        if (!event?.competitionConfig) continue;
        keywords.push(event.title, event.category, event.department);
        if (Array.isArray(event.tags)) keywords.push(...event.tags);
      }
    } catch {
      return keywords;
    }
    return keywords;
  }

  resourceMatchesAny(resource, keywords) {
    if (!keywords.length) return false;
    const text = [
      resource.title,
      resource.description,
      resource.subjectCode,
      resource.subjectName,
      resource.unit,
      ...(Array.isArray(resource.tags) ? resource.tags : []),
      ...(Array.isArray(resource.topics) ? resource.topics.map((topic) => (typeof topic === "string" ? topic : topic?.label)) : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return keywords.some((keyword) => {
      const normalized = String(keyword || "").trim().toLowerCase();
      return normalized && text.includes(normalized);
    });
  }

  scoreKeywordMatch(resource, keywords, fallback = 0) {
    if (!keywords.length) return fallback;
    const matches = keywords.filter((keyword) => this.resourceMatchesAny(resource, [keyword])).length;
    return clamp(matches / Math.min(keywords.length, 4), 0, 1);
  }

  computeFactors({ resource, preferences, masteryMap, profileContext = {}, purpose = "default" }) {
    const subjectWeights = ensureObject(parseJson(preferences?.subjectWeights, {}));
    const typeWeights = ensureObject(parseJson(preferences?.typeWeights, {}));
    const resourceTopics = Array.isArray(resource.topics) ? resource.topics : [];
    const gapScores = resourceTopics.map((topic) => {
      const topicId = typeof topic === "string" ? topic : topic?.id;
      return 1 - Number(masteryMap[topicId] || 0);
    });
    const avgGap = gapScores.length
      ? gapScores.reduce((sum, value) => sum + value, 0) / gapScores.length
      : 0.4;
    const engagementRaw =
      Math.log1p(Number(resource.upvotes || 0)) * 0.3 +
      Math.log1p(Number(resource.bookmarkCount || 0)) * 0.25 +
      Math.log1p(Number(resource.commentCount || 0)) * 0.2 +
      Math.log1p(Number(resource.viewCount || 0)) * 0.15 +
      Number(resource.publisher?.trustScore || 0) / 100 * 0.1;

    return {
      subjectMatch: clamp(Number(subjectWeights[resource.subjectCode] || (resource.userEnrolled ? 1 : 0.35)), 0, 1),
      typePreference: clamp(Number(typeWeights[resource.type] || 0.5), 0, 1),
      qualityScore: clamp(Number(resource.qualityScore || 0) / 10, 0, 1),
      engagementScore: clamp(engagementRaw, 0, 1),
      recency: clamp(recencyScore(resource.uploadedAt), 0, 1),
      effectivenessScore: clamp(Number(resource.effectivenessScore || 0) / 5, 0, 1),
      topicGapScore: clamp(avgGap, 0, 1),
      examProvenScore: clamp(Number(resource.examProvenScore || 0) / 5, 0, 1),
      careerGapScore: this.scoreKeywordMatch(resource, profileContext.gapKeywords || [], 0),
      academicContextScore: clamp(
        Math.max(
          this.scoreKeywordMatch(resource, profileContext.academicKeywords || [], 0),
          resource.userEnrolled ? 1 : 0
        ),
        0,
        1
      ),
      examIntentScore: purpose === "exam-prep"
        ? clamp(
            (resource.type === "pyq" ? 1 : 0) ||
              (Number(resource.examProvenScore || 0) > 0 ? 0.85 : 0) ||
              (this.resourceMatchesAny(resource, ["exam", "pyq", "revision", "previous year"]) ? 0.7 : 0.25),
            0,
            1
          )
        : 0,
    };
  }

  buildReasons(factors, purpose = "default") {
    const ranked = [
      ["examIntentScore", factors.examIntentScore, purpose === "exam-prep" ? "Prioritized for exam prep" : "Exam-ready resource"],
      ["subjectMatch", factors.subjectMatch, "Matches your subject focus"],
      ["careerGapScore", factors.careerGapScore, "Closes a career skill gap"],
      ["academicContextScore", factors.academicContextScore, "Matches your academic profile"],
      ["typePreference", factors.typePreference, "Fits your resource format preference"],
      ["qualityScore", factors.qualityScore, "Strong learner quality signals"],
      ["engagementScore", factors.engagementScore, "High community engagement"],
      ["effectivenessScore", factors.effectivenessScore, "Effective for practice outcomes"],
      ["topicGapScore", factors.topicGapScore, "Targets topics with room to improve"],
      ["examProvenScore", factors.examProvenScore, "Useful for exam preparation"],
      ["recency", factors.recency, "Recently updated"],
    ];
    return ranked
      .filter(([, value]) => Number(value) >= 0.45)
      .sort((left, right) => Number(right[1]) - Number(left[1]))
      .slice(0, 3)
      .map(([code, value, label]) => ({
        code,
        label,
        weight: Number(Number(value).toFixed(3)),
      }));
  }

  roadmapMatchesAny(roadmap, keywords) {
    if (!keywords.length) return false;
    const text = [
      roadmap.title,
      roadmap.description,
      roadmap.skill,
      roadmap.difficulty,
      ...(Array.isArray(roadmap.nodes) ? roadmap.nodes.flatMap((node) => [node.title, node.description]) : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return keywords.some((keyword) => {
      const normalized = String(keyword || "").trim().toLowerCase();
      return normalized && text.includes(normalized);
    });
  }

  scoreRoadmapKeywordMatch(roadmap, keywords, fallback = 0) {
    if (!keywords.length) return fallback;
    const matches = keywords.filter((keyword) => this.roadmapMatchesAny(roadmap, [keyword])).length;
    return clamp(matches / Math.min(keywords.length, 4), 0, 1);
  }

  computeRoadmapFactors({ roadmap, profileContext }) {
    const completed = Array.isArray(roadmap.userProgress?.completedNodes)
      ? roadmap.userProgress.completedNodes.length
      : 0;
    const totalNodes = Array.isArray(roadmap.nodes) ? roadmap.nodes.length : 0;
    const completionRatio = totalNodes ? completed / totalNodes : 0;
    const skillGapMatch = Math.max(
      this.scoreRoadmapKeywordMatch(roadmap, profileContext.gapKeywords || [], 0),
      profileContext.gapKeywords?.some((keyword) => String(roadmap.skill || "").toLowerCase() === String(keyword || "").toLowerCase())
        ? 1
        : 0
    );
    return {
      skillGapMatch: clamp(skillGapMatch, 0, 1),
      competitionMatch: this.scoreRoadmapKeywordMatch(roadmap, profileContext.eventKeywords || [], 0),
      academicContextScore: this.scoreRoadmapKeywordMatch(roadmap, profileContext.academicKeywords || [], 0),
      qualityScore: clamp(Number(roadmap.qualityScore || 0) / 10, 0, 1),
      completionOpportunity: clamp(1 - completionRatio, 0, 1),
      nodeCoverage: clamp(totalNodes / 6, 0, 1),
    };
  }

  buildRoadmapReasons(factors) {
    return [
      ["skillGapMatch", factors.skillGapMatch, "Targets a career skill gap"],
      ["competitionMatch", factors.competitionMatch, "Prepares for upcoming competitions"],
      ["academicContextScore", factors.academicContextScore, "Matches your academic context"],
      ["qualityScore", factors.qualityScore, "Strong roadmap quality"],
      ["completionOpportunity", factors.completionOpportunity, "Good next roadmap to progress"],
      ["nodeCoverage", factors.nodeCoverage, "Has structured milestones"],
    ]
      .filter(([, value]) => Number(value) >= 0.35)
      .sort((left, right) => Number(right[1]) - Number(left[1]))
      .slice(0, 3)
      .map(([code, value, label]) => ({
        code,
        label,
        weight: Number(Number(value).toFixed(3)),
      }));
  }

  async getRoadmapRecommendations({ userId, user = null, limit = 6 } = {}) {
    const cappedLimit = Math.min(Math.max(Number(limit || 6), 1), 20);
    const profileContext = this.buildProfileContext({ userId, user });
    const roadmaps = this.lmsStore.listRoadmaps({ userId, includeDrafts: false })
      .map((roadmap) => this.lmsStore.getRoadmap(roadmap.id, userId));
    const scored = roadmaps.map((roadmap) => {
      const factors = this.computeRoadmapFactors({ roadmap, profileContext });
      const score =
        factors.skillGapMatch * 0.34 +
        factors.competitionMatch * 0.24 +
        factors.academicContextScore * 0.12 +
        factors.qualityScore * 0.12 +
        factors.completionOpportunity * 0.1 +
        factors.nodeCoverage * 0.08;
      return {
        ...roadmap,
        recommendationScore: Number(score.toFixed(6)),
        confidence: Number(clamp(0.45 + score * 0.55, 0, 1).toFixed(3)),
        reasons: this.buildRoadmapReasons(factors),
        inputsUsed: {
          algorithmKey: "roadmap-ranking-v1-cross-domain",
          factors,
          profileSignals: profileContext.signalsUsed,
          gapKeywords: profileContext.gapKeywords,
          eventKeywords: profileContext.eventKeywords,
        },
        rankingPolicy: {
          algorithmKey: "roadmap-ranking-v1-cross-domain",
          filters: ["published", "not_deleted", "career_gap_or_event_or_academic_context"],
        },
      };
    });
    return scored
      .filter((roadmap) => {
        const factors = roadmap.inputsUsed?.factors || {};
        return (
          Number(factors.skillGapMatch || 0) > 0 ||
          Number(factors.competitionMatch || 0) > 0 ||
          Number(factors.academicContextScore || 0) > 0
        );
      })
      .sort((left, right) => right.recommendationScore - left.recommendationScore)
      .slice(0, cappedLimit);
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

function uniqueKeywords(values) {
  return [
    ...new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    ),
  ];
}

// --- lmsRevisionScheduler.js ---
const INTERVALS = [1, 3, 7, 14, 30];

class LmsRevisionScheduler {
  getNextRevision({ previousInterval = 1, previousRepetition = 0, score = 0 }) {
    if (score < 60) {
      return {
        dueDate: addDaysIso(nowIso(), 1),
        interval: 1,
        repetition: 0,
      };
    }

    const repetition = previousRepetition + 1;
    const interval = INTERVALS[Math.min(INTERVALS.length - 1, repetition - 1)] || previousInterval || 30;
    return {
      dueDate: addDaysIso(nowIso(), interval),
      interval,
      repetition,
    };
  }
}

module.exports = {
  LmsDuplicateDetector,
  LmsExamFeedbackService,
  LmsFeatureFlagService,
  LmsInteractionQueue,
  LmsInteractionTracker,
  LmsModerationService,
  LmsReadingTimeEstimator,
  LmsRecommendationEngine,
  LmsRevisionScheduler,
};