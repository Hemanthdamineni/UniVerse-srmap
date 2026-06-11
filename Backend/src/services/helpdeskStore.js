const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const { TICKET_STATUS, QUEUE_STATE } = require("./helpdeskStore/constants");
const { storageMethods } = require("./helpdeskStore/storage");
const { ticketHelperMethods } = require("./helpdeskStore/ticketHelpers");
const { ticketMethods } = require("./helpdeskStore/tickets");
const { faqMethods } = require("./helpdeskStore/faqs");

class HelpdeskStore {
  constructor({ dbPath }) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this._ensureSchema();
    this._load();
    this._seedFaqsIfNeeded();
  }
}

Object.assign(
  HelpdeskStore.prototype,
  storageMethods,
  ticketHelperMethods,
  ticketMethods,
  faqMethods
);

module.exports = {
  HelpdeskStore,
  TICKET_STATUS,
  QUEUE_STATE,
};
