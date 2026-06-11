const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const {
  CONTENT_TYPES,
  RESOURCE_KINDS,
  LEARNING_MATERIAL_GROUPS,
} = require("./contentStore/constants");
const { schemaMethods } = require("./contentStore/schema");
const { contentRecordMethods } = require("./contentStore/contentRecords");
const { auditLifecycleMethods } = require("./contentStore/auditLifecycle");
const { resourceMethods } = require("./contentStore/resources");
const { learningMaterialMethods } = require("./contentStore/learningMaterials");
const { seedingMethods } = require("./contentStore/seeding");

class ContentStore {
  constructor(dbPath) {
    const dirPath = path.dirname(dbPath);
    fs.mkdirSync(dirPath, { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.ensureSchema();
  }
}

Object.assign(
  ContentStore.prototype,
  schemaMethods,
  contentRecordMethods,
  auditLifecycleMethods,
  resourceMethods,
  learningMaterialMethods,
  seedingMethods
);

module.exports = {
  ContentStore,
  CONTENT_TYPES: Array.from(CONTENT_TYPES),
  RESOURCE_KINDS: Array.from(RESOURCE_KINDS),
  LEARNING_MATERIAL_GROUPS: Array.from(LEARNING_MATERIAL_GROUPS),
};
