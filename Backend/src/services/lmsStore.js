const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { runLmsMigrations } = require("./lmsMigrations");
const collectionsMethods = require("./lmsStore/collections");
const communityMethods = require("./lmsStore/community");
const featureFlagMethods = require("./lmsStore/featureFlags");
const guideMethods = require("./lmsStore/guides");
const learningDiscoveryMethods = require("./lmsStore/learningDiscovery");
const learningProgressMethods = require("./lmsStore/learningProgress");
const moderationMethods = require("./lmsStore/moderation");
const questionBankMethods = require("./lmsStore/questionBank");
const resourceInputMethods = require("./lmsStore/resourceInput");
const resourceMethods = require("./lmsStore/resources");
const resourceSearchMethods = require("./lmsStore/resourceSearch");
const roadmapMethods = require("./lmsStore/roadmaps");
const userStateMethods = require("./lmsStore/userState");
const { parseJson } = require("./lmsUtils");

class LmsStore {
  constructor({ dbPath, filesDir, moderationService, revisionScheduler }) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.mkdirSync(filesDir, { recursive: true });
    this.filesDir = filesDir;
    this.moderationService = moderationService;
    this.revisionScheduler = revisionScheduler;
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    runLmsMigrations(this.db);
  }

  withTransaction(callback) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = callback();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  mapResource(row) {
    if (!row) return null;
    const moderation = this.buildModerationSummary(row);
    return {
      ...row,
      tags: parseJson(row.tags, []),
      structuredContent: parseJson(row.structuredContent, null),
      topics: this.getTopicsForResource(row.id),
      publisher: this.getPublisherSummary(row.uploadedBy),
      moderation,
    };
  }

  mapGuide(row, includeSections = false, userId = "") {
    if (!row) return null;
    const guide = {
      ...row,
      tags: parseJson(row.tags, []),
      sections: includeSections ? this.listGuideSections(row.id) : [],
      userProgress: userId ? this.getGuideProgressRow(userId, row.id) : null,
      userUpvoted: userId ? this.hasEntityUpvote("guide", row.id, userId) : false,
    };
    return guide;
  }

  mapRoadmap(row, includeNodes = false, userId = "") {
    if (!row) return null;
    return {
      ...row,
      nodes: includeNodes ? this.listRoadmapNodes(row.id) : [],
      edges: includeNodes ? this.listRoadmapEdges(row.id) : [],
      userProgress: userId ? this.getRoadmapProgressRow(userId, row.id) : null,
    };
  }

}

Object.assign(
  LmsStore.prototype,
  collectionsMethods,
  communityMethods,
  featureFlagMethods,
  guideMethods,
  learningDiscoveryMethods,
  learningProgressMethods,
  resourceInputMethods,
  resourceSearchMethods,
  resourceMethods,
  moderationMethods,
  questionBankMethods,
  roadmapMethods,
  userStateMethods
);

module.exports = {
  LmsStore,
};
