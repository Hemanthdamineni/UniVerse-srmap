const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const accessMethods = require("./competitionStore/access");
const certificateMethods = require("./competitionStore/certificates");
const evaluationMethods = require("./competitionStore/evaluation");
const managementMethods = require("./competitionStore/management");
const schemaMethods = require("./competitionStore/schema");
const submissionIntakeMethods = require("./competitionStore/submissionIntake");
const teamMethods = require("./competitionStore/teams");
const { isAllowedSubmissionMime } = require("./competitionStore/utils");

class CompetitionStore {
  constructor({ eventsStore, dbPath, submissionsDir }) {
    this.eventsStore = eventsStore;
    this.dbPath = path.resolve(dbPath);
    this.submissionsDir = submissionsDir || path.join(path.dirname(this.dbPath), "submissions");
    this.certificatesDir = path.join(path.dirname(this.dbPath), "certificates");

    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    fs.mkdirSync(this.submissionsDir, { recursive: true });
    fs.mkdirSync(this.certificatesDir, { recursive: true });

    this.db = new DatabaseSync(this.dbPath);
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this._ensureSchema();
    this._migrateRoundsFromJson();
  }

}

Object.assign(
  CompetitionStore.prototype,
  schemaMethods,
  accessMethods,
  teamMethods,
  submissionIntakeMethods,
  evaluationMethods,
  managementMethods,
  certificateMethods
);

function createCompetitionStore(args) {
  return new CompetitionStore(args);
}

module.exports = {
  CompetitionStore,
  createCompetitionStore,
  isAllowedSubmissionMime,
};
