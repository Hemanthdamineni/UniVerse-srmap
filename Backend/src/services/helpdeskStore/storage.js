const { nowIso } = require("./utils");

const storageMethods = {
  _ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS helpdesk_state (
        state_key TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO helpdesk_state (state_key, payload_json, updated_at)
      VALUES (?, ?, ?)
    `);
    const now = nowIso();
    for (const stateKey of ["tickets", "replies", "faqs"]) {
      insert.run(stateKey, "[]", now);
    }
  },

  _readState(stateKey) {
    const row = this.db
      .prepare("SELECT payload_json FROM helpdesk_state WHERE state_key = ?")
      .get(stateKey);

    if (!row) return [];

    try {
      const parsed = JSON.parse(row.payload_json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  _writeState(stateKey, payload) {
    this.db
      .prepare(`
        INSERT INTO helpdesk_state (state_key, payload_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(state_key) DO UPDATE SET
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `)
      .run(stateKey, JSON.stringify(Array.isArray(payload) ? payload : []), nowIso());
  },

  _load() {
    this.tickets = this._readState("tickets");
    this.replies = this._readState("replies");
    this.faqs = this._readState("faqs");
    this._reindex();
  },

  _persist() {
    this._writeState("tickets", this.tickets);
    this._writeState("replies", this.replies);
    this._writeState("faqs", this.faqs);
  },

  _reindex() {
    this.ticketById = new Map(this.tickets.map((ticket) => [ticket.id, ticket]));
    this.repliesByTicketId = new Map();
    for (const reply of this.replies) {
      if (!this.repliesByTicketId.has(reply.ticketId)) {
        this.repliesByTicketId.set(reply.ticketId, []);
      }
      this.repliesByTicketId.get(reply.ticketId).push(reply);
    }
  },
};

module.exports = { storageMethods };
