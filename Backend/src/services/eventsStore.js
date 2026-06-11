const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const accessMethods = require("./eventsStore/access");
const calendarMethods = require("./eventsStore/calendar");
const contentSyncMethods = require("./eventsStore/contentSync");
const engagementMethods = require("./eventsStore/engagement");
const eventCrudMethods = require("./eventsStore/eventCrud");
const notificationMethods = require("./eventsStore/notifications");
const registrationMethods = require("./eventsStore/registrations");
const storageMethods = require("./eventsStore/storage");
const {
  EVENT_STATES,
  EVENT_VISIBILITY,
  APPROVAL_STATUS,
  REGISTRATION_STATUS,
  STATE_FILE_NAMES,
} = require("./eventsStore/utils");

class EventsStore {
  constructor({ dataDir, dbPath = null, contentStore = null }) {
    this.dataDir = dataDir;
    this.dbPath = dbPath ? path.resolve(dbPath) : null;
    this.contentStore = contentStore;
    this.db = null;

    this.eventsFile = path.join(dataDir, STATE_FILE_NAMES.events);
    this.registrationsFile = path.join(dataDir, STATE_FILE_NAMES.registrations);
    this.notificationsFile = path.join(dataDir, STATE_FILE_NAMES.notifications);
    this.feedbackFile = path.join(dataDir, STATE_FILE_NAMES.feedback);
    this.galleryFile = path.join(dataDir, STATE_FILE_NAMES.gallery);
    this.checkInsFile = path.join(dataDir, STATE_FILE_NAMES.checkIns);

    if (this.dbPath) {
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
      this.db = new DatabaseSync(this.dbPath);
      this.db.exec("PRAGMA busy_timeout = 5000");
      this.db.exec("PRAGMA foreign_keys = ON");
      this._ensureSqliteSchema();
    }

    this._ensureFiles();
    this._load();
  }

  /** Public API for Career domain (Phase 5): persist a single in-app notification. */

}

Object.assign(
  EventsStore.prototype,
  storageMethods,
  contentSyncMethods,
  accessMethods,
  eventCrudMethods,
  registrationMethods,
  notificationMethods,
  engagementMethods,
  calendarMethods
);

module.exports = {
  EventsStore,
  EVENT_STATES,
  EVENT_VISIBILITY,
  APPROVAL_STATUS,
  REGISTRATION_STATUS,
};
