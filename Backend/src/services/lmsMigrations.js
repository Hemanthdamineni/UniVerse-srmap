const { nowIso } = require("./lmsUtils");
const { MIGRATIONS } = require("./lmsMigrations/migrationDefinitions");

function getCurrentVersion(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS lms_schema_version (id INTEGER PRIMARY KEY CHECK(id = 1), version INTEGER NOT NULL, updatedAt TEXT NOT NULL)"
  );
  const row = db.prepare("SELECT version FROM lms_schema_version WHERE id = 1").get();
  return Number(row?.version || 0);
}

function setCurrentVersion(db, version) {
  db.prepare(
    `
      INSERT INTO lms_schema_version (id, version, updatedAt)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET version = excluded.version, updatedAt = excluded.updatedAt
    `
  ).run(version, nowIso());
}

function runLmsMigrations(db) {
  const currentVersion = getCurrentVersion(db);
  const pending = MIGRATIONS.filter((migration) => migration.version > currentVersion).sort(
    (left, right) => left.version - right.version
  );

  if (!pending.length) return currentVersion;

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const migration of pending) {
      db.exec(migration.sql);
      setCurrentVersion(db, migration.version);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return pending[pending.length - 1].version;
}

module.exports = {
  MIGRATIONS,
  runLmsMigrations,
};
