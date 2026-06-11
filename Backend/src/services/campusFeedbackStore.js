const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const { FEEDBACK_TYPES, MODERATION_STATUS } = require("./campusFeedbackStore/constants");
const { schemaMethods } = require("./campusFeedbackStore/schema");
const { rowMapperMethods } = require("./campusFeedbackStore/rowMappers");
const { optionMethods } = require("./campusFeedbackStore/options");
const { submissionMethods } = require("./campusFeedbackStore/submissions");
const { listingModerationMethods } = require("./campusFeedbackStore/listingModeration");

class CampusFeedbackStore {
  constructor({ dbPath }) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this._ensureSchema();
  }
}

Object.assign(
  CampusFeedbackStore.prototype,
  schemaMethods,
  rowMapperMethods,
  optionMethods,
  submissionMethods,
  listingModerationMethods
);

module.exports = {
  CampusFeedbackStore,
  FEEDBACK_TYPES,
  MODERATION_STATUS,
};
