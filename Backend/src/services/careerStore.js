const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const alumniMethods = require("./careerStore/alumni");
const catalogMethods = require("./careerStore/catalog");
const healthMethods = require("./careerStore/health");
const interviewMethods = require("./careerStore/interviews");
const opportunityActionMethods = require("./careerStore/opportunityActions");
const profileMethods = require("./careerStore/profile");
const schemaMethods = require("./careerStore/schema");
const submissionMethods = require("./careerStore/submissions");

class CareerStore {
  constructor({ dbPath }) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this._ensureSchema();
    this._seedDefaultsIfNeeded();
    this._rebuildCareerSearchFts();
  }

  /** External-content FTS5 must use the content table INTEGER rowid, not TEXT id. */

  _ensureAuthenticatedUser(user) {
    if (!user || !user.userId || user.role === "guest") {
      const error = new Error("Authentication required");
      error.status = 401;
      throw error;
    }
  }

  _ensureAdmin(user) {
    if (!user || user.role !== "admin") {
      const error = new Error("Admin access required");
      error.status = 403;
      throw error;
    }
  }

  _ensureActiveOpportunityId(opportunityId) {
    const row = this.db
      .prepare(
        "SELECT 1 FROM career_opportunities WHERE id = ? AND isActive = 1 AND moderationState = 0"
      )
      .get(opportunityId);
    if (!row) {
      const error = new Error("Opportunity not found");
      error.status = 404;
      throw error;
    }
  }

  // Phase 1+2 Core Methods

  /** Bookmarked opportunities with deadline within the next `days` days (API contract). */

  // Opportunity CRUD operations

  // Student Actions

  // Application Tracker

  // Manual Submissions

  /**
   * Manual moderator approval. Pass moderatorContext for human reviewers; omit for system auto-approve.
   */

  // Health

  // Phase 4 - Profile & Personalization

  // Alumni methods

  // Interview methods

}

Object.assign(
  CareerStore.prototype,
  schemaMethods,
  catalogMethods,
  opportunityActionMethods,
  submissionMethods,
  healthMethods,
  profileMethods,
  alumniMethods,
  interviewMethods
);

module.exports = {
  CareerStore,
};
