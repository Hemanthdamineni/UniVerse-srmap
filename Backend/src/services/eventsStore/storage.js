const fs = require("fs");
const path = require("path");
const { STATE_FILE_NAMES, STATE_KEYS, ensureArray, nowIso } = require("./utils");

module.exports = {
  _ensureSqliteSchema() {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events_state (
        state_key TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  },

  _readSqliteState(stateKey) {
    if (!this.db) return [];

    const row = this.db
      .prepare("SELECT payload_json FROM events_state WHERE state_key = ?")
      .get(stateKey);
    if (!row) return [];

    try {
      const parsed = JSON.parse(row.payload_json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  _writeSqliteState(stateKey, payload) {
    if (!this.db) return;

    const serialized = JSON.stringify(Array.isArray(payload) ? payload : []);
    this.db
      .prepare(`
        INSERT INTO events_state (state_key, payload_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(state_key) DO UPDATE SET
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `)
      .run(stateKey, serialized, nowIso());
  },

  _importLegacyJsonIfNeeded() {
    if (!this.db || !this.dataDir) return;
    if (this._readSqliteState("events").length > 0) return;

    const imported = {};
    let hasLegacyRecords = false;

    for (const stateKey of STATE_KEYS) {
      const filePath = path.join(this.dataDir, STATE_FILE_NAMES[stateKey]);
      if (!fs.existsSync(filePath)) {
        imported[stateKey] = [];
        continue;
      }

      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        imported[stateKey] = Array.isArray(parsed) ? parsed : [];
      } catch {
        imported[stateKey] = [];
      }

      if (imported[stateKey].length > 0) {
        hasLegacyRecords = true;
      }
    }

    if (!hasLegacyRecords) return;

    for (const stateKey of STATE_KEYS) {
      this._writeSqliteState(stateKey, imported[stateKey]);
    }
  },

  _ensureFiles() {
    if (this.db) {
      const insert = this.db.prepare(`
        INSERT OR IGNORE INTO events_state (state_key, payload_json, updated_at)
        VALUES (?, ?, ?)
      `);
      const now = nowIso();
      for (const stateKey of STATE_KEYS) {
        insert.run(stateKey, "[]", now);
      }
      this._importLegacyJsonIfNeeded();
      return;
    }

    fs.mkdirSync(this.dataDir, { recursive: true });
    const defaults = [
      [this.eventsFile, []],
      [this.registrationsFile, []],
      [this.notificationsFile, []],
      [this.feedbackFile, []],
      [this.galleryFile, []],
      [this.checkInsFile, []],
    ];

    for (const [file, fallback] of defaults) {
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
      }
    }
  },

  _load() {
    if (this.db) {
      this.events = this._readSqliteState("events");
      this.registrations = this._readSqliteState("registrations");
      this.notifications = this._readSqliteState("notifications");
      this.feedback = this._readSqliteState("feedback");
      this.gallery = this._readSqliteState("gallery");
      this.checkIns = this._readSqliteState("checkIns");
      this._reindex();
      return;
    }

    this.events = ensureArray(JSON.parse(fs.readFileSync(this.eventsFile, "utf8")));
    this.registrations = ensureArray(JSON.parse(fs.readFileSync(this.registrationsFile, "utf8")));
    this.notifications = ensureArray(JSON.parse(fs.readFileSync(this.notificationsFile, "utf8")));
    this.feedback = ensureArray(JSON.parse(fs.readFileSync(this.feedbackFile, "utf8")));
    this.gallery = ensureArray(JSON.parse(fs.readFileSync(this.galleryFile, "utf8")));
    this.checkIns = ensureArray(JSON.parse(fs.readFileSync(this.checkInsFile, "utf8")));
    this._reindex();
  },

  _persistAll() {
    if (this.db) {
      this._writeSqliteState("events", this.events);
      this._writeSqliteState("registrations", this.registrations);
      this._writeSqliteState("notifications", this.notifications);
      this._writeSqliteState("feedback", this.feedback);
      this._writeSqliteState("gallery", this.gallery);
      this._writeSqliteState("checkIns", this.checkIns);
      return;
    }

    fs.writeFileSync(this.eventsFile, JSON.stringify(this.events, null, 2));
    fs.writeFileSync(this.registrationsFile, JSON.stringify(this.registrations, null, 2));
    fs.writeFileSync(this.notificationsFile, JSON.stringify(this.notifications, null, 2));
    fs.writeFileSync(this.feedbackFile, JSON.stringify(this.feedback, null, 2));
    fs.writeFileSync(this.galleryFile, JSON.stringify(this.gallery, null, 2));
    fs.writeFileSync(this.checkInsFile, JSON.stringify(this.checkIns, null, 2));
  },

  _reindex() {
    this.eventById = new Map(this.events.map((event) => [event.id, event]));
    this.registrationsByEvent = new Map();
    this.registrationsByUser = new Map();

    for (const registration of this.registrations) {
      if (!this.registrationsByEvent.has(registration.eventId)) {
        this.registrationsByEvent.set(registration.eventId, []);
      }
      this.registrationsByEvent.get(registration.eventId).push(registration);

      if (!this.registrationsByUser.has(registration.userId)) {
        this.registrationsByUser.set(registration.userId, []);
      }
      this.registrationsByUser.get(registration.userId).push(registration);
    }
  }
};
