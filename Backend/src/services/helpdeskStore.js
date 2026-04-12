const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const TICKET_STATUS = {
  OPEN: "open",
  IN_PROGRESS: "in-progress",
  ESCALATED: "escalated",
  RESOLVED: "resolved",
};

const PRIORITY_ORDER = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

const DEFAULT_ASSIGNEE_BY_CATEGORY = {
  "IT Support": "IT Help Desk",
  Academic: "Academic Affairs",
  Hostel: "Hostel Maintenance",
  Finance: "Finance Office",
  Transport: "Transport Office",
  Other: "General Help Desk",
};

function nowIso() {
  return new Date().toISOString();
}

function toSafeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePriority(value) {
  const normalized = toSafeString(value).toLowerCase();
  if (["low", "medium", "high", "urgent"].includes(normalized)) {
    return normalized;
  }
  return "medium";
}

function normalizeStatus(value) {
  const normalized = toSafeString(value).toLowerCase();
  if (Object.values(TICKET_STATUS).includes(normalized)) {
    return normalized;
  }
  return TICKET_STATUS.OPEN;
}

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
  }

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
  }

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
  }

  _load() {
    this.tickets = this._readState("tickets");
    this.replies = this._readState("replies");
    this.faqs = this._readState("faqs");
    this._reindex();
  }

  _persist() {
    this._writeState("tickets", this.tickets);
    this._writeState("replies", this.replies);
    this._writeState("faqs", this.faqs);
  }

  _reindex() {
    this.ticketById = new Map(this.tickets.map((ticket) => [ticket.id, ticket]));
    this.repliesByTicketId = new Map();
    for (const reply of this.replies) {
      if (!this.repliesByTicketId.has(reply.ticketId)) {
        this.repliesByTicketId.set(reply.ticketId, []);
      }
      this.repliesByTicketId.get(reply.ticketId).push(reply);
    }
  }

  _seedFaqsIfNeeded() {
    if (this.faqs.length > 0) return;

    const seeded = [
      {
        id: randomUUID(),
        question: "How long does a normal helpdesk ticket take to resolve?",
        answer: "Most tickets are triaged within one working day. Urgent tickets are prioritized automatically.",
        category: "General",
        tags: ["sla", "timeline"],
        visible: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        id: randomUUID(),
        question: "When should I escalate a ticket?",
        answer: "Escalate when the issue blocks attendance, exams, payments, hostel access, or any deadline-sensitive work.",
        category: "General",
        tags: ["escalation", "urgent"],
        visible: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        id: randomUUID(),
        question: "What should I include in an IT Support ticket?",
        answer: "Include screenshots, the device used, the page or portal name, and the exact time the issue happened.",
        category: "IT & Technical",
        tags: ["it", "screenshots"],
        visible: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ];

    this.faqs = seeded;
    this._persist();
    this._reindex();
  }

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

  _canAccessTicket(user, ticket) {
    if (!user || !ticket) return false;
    if (user.role === "admin") return true;
    return ticket.createdByUserId === user.userId;
  }

  _buildTicketView(ticket, user) {
    const replies = ensureArray(this.repliesByTicketId.get(ticket.id)).filter((reply) => {
      if (user?.role === "admin") return true;
      return reply.visibility !== "internal";
    });

    const statusHistory = ensureArray(ticket.statusHistory);
    const createdAtMs = new Date(ticket.createdAt).getTime();
    const ageHours = createdAtMs ? Math.max(0, Math.round((Date.now() - createdAtMs) / 36e5)) : 0;

    return {
      ...ticket,
      replies,
      replyCount: replies.length,
      statusHistory,
      slaBreached: ageHours >= 48 && ticket.status !== TICKET_STATUS.RESOLVED,
      ageHours,
    };
  }

  _validateTicketPayload(payload) {
    const subject = toSafeString(payload?.subject);
    const description = toSafeString(payload?.description);
    if (!subject) {
      const error = new Error("subject is required");
      error.status = 400;
      throw error;
    }
    if (!description) {
      const error = new Error("description is required");
      error.status = 400;
      throw error;
    }
  }

  createTicket(payload, { user }) {
    this._ensureAuthenticatedUser(user);
    this._validateTicketPayload(payload);

    const createdAt = nowIso();
    const category = toSafeString(payload?.category) || "Other";
    const priority = normalizePriority(payload?.priority);
    const ticket = {
      id: randomUUID(),
      category,
      priority,
      subject: toSafeString(payload?.subject),
      description: toSafeString(payload?.description),
      status: TICKET_STATUS.OPEN,
      assignedTo: DEFAULT_ASSIGNEE_BY_CATEGORY[category] || DEFAULT_ASSIGNEE_BY_CATEGORY.Other,
      assignedTeam: DEFAULT_ASSIGNEE_BY_CATEGORY[category] || DEFAULT_ASSIGNEE_BY_CATEGORY.Other,
      createdByUserId: user.userId,
      createdByName: user.name,
      createdByEmail: user.email,
      department: user.department || "General",
      createdAt,
      updatedAt: createdAt,
      resolutionSummary: "",
      statusHistory: [
        {
          id: randomUUID(),
          status: TICKET_STATUS.OPEN,
          note: "Ticket created",
          actorName: user.name,
          actorRole: user.role,
          createdAt,
        },
      ],
    };

    this.tickets.unshift(ticket);
    this._reindex();
    this._persist();
    return this._buildTicketView(ticket, user);
  }

  listTickets({ user, filters = {} }) {
    this._ensureAuthenticatedUser(user);

    let tickets = [...this.tickets];
    if (user.role !== "admin") {
      tickets = tickets.filter((ticket) => ticket.createdByUserId === user.userId);
    }

    const query = toSafeString(filters.query).toLowerCase();
    if (query) {
      tickets = tickets.filter((ticket) =>
        [ticket.subject, ticket.description, ticket.category, ticket.assignedTo]
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    }

    const status = normalizeStatus(filters.status);
    if (toSafeString(filters.status)) {
      tickets = tickets.filter((ticket) => ticket.status === status);
    }

    const category = toSafeString(filters.category);
    if (category) {
      tickets = tickets.filter((ticket) => ticket.category === category);
    }

    const priority = normalizePriority(filters.priority);
    if (toSafeString(filters.priority)) {
      tickets = tickets.filter((ticket) => ticket.priority === priority);
    }

    tickets.sort((left, right) => {
      const priorityDelta =
        (PRIORITY_ORDER[right.priority] || 0) - (PRIORITY_ORDER[left.priority] || 0);
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });

    const counts = {
      total: tickets.length,
      open: tickets.filter((ticket) => ticket.status === TICKET_STATUS.OPEN).length,
      inProgress: tickets.filter((ticket) => ticket.status === TICKET_STATUS.IN_PROGRESS).length,
      escalated: tickets.filter((ticket) => ticket.status === TICKET_STATUS.ESCALATED).length,
      resolved: tickets.filter((ticket) => ticket.status === TICKET_STATUS.RESOLVED).length,
      slaBreached: tickets.filter((ticket) => this._buildTicketView(ticket, user).slaBreached).length,
    };

    return {
      items: tickets.map((ticket) => this._buildTicketView(ticket, user)),
      counts,
    };
  }

  getTicket(ticketId, { user }) {
    this._ensureAuthenticatedUser(user);
    const ticket = this.ticketById.get(toSafeString(ticketId));
    if (!ticket) {
      const error = new Error("Ticket not found");
      error.status = 404;
      throw error;
    }

    if (!this._canAccessTicket(user, ticket)) {
      const error = new Error("Forbidden");
      error.status = 403;
      throw error;
    }

    return this._buildTicketView(ticket, user);
  }

  updateTicket(ticketId, payload, { user }) {
    this._ensureAdmin(user);
    const ticket = this.ticketById.get(toSafeString(ticketId));
    if (!ticket) {
      const error = new Error("Ticket not found");
      error.status = 404;
      throw error;
    }

    const nextStatus = payload?.status ? normalizeStatus(payload.status) : ticket.status;
    ticket.status = nextStatus;
    ticket.assignedTo =
      payload?.assignedTo !== undefined ? toSafeString(payload.assignedTo) : ticket.assignedTo;
    ticket.assignedTeam =
      payload?.assignedTeam !== undefined ? toSafeString(payload.assignedTeam) : ticket.assignedTeam;
    ticket.resolutionSummary =
      payload?.resolutionSummary !== undefined
        ? toSafeString(payload.resolutionSummary)
        : ticket.resolutionSummary;
    ticket.updatedAt = nowIso();
    ticket.statusHistory = ensureArray(ticket.statusHistory);
    ticket.statusHistory.unshift({
      id: randomUUID(),
      status: ticket.status,
      note: toSafeString(payload?.note) || `Ticket moved to ${ticket.status}`,
      actorName: user.name,
      actorRole: user.role,
      createdAt: ticket.updatedAt,
    });

    this._persist();
    this._reindex();
    return this._buildTicketView(ticket, user);
  }

  escalateTicket(ticketId, { user, reason }) {
    this._ensureAuthenticatedUser(user);
    const ticket = this.ticketById.get(toSafeString(ticketId));
    if (!ticket) {
      const error = new Error("Ticket not found");
      error.status = 404;
      throw error;
    }

    if (!this._canAccessTicket(user, ticket)) {
      const error = new Error("Forbidden");
      error.status = 403;
      throw error;
    }

    ticket.status = TICKET_STATUS.ESCALATED;
    ticket.updatedAt = nowIso();
    ticket.statusHistory = ensureArray(ticket.statusHistory);
    ticket.statusHistory.unshift({
      id: randomUUID(),
      status: TICKET_STATUS.ESCALATED,
      note: toSafeString(reason) || "Escalated by requester",
      actorName: user.name,
      actorRole: user.role,
      createdAt: ticket.updatedAt,
    });

    this._persist();
    this._reindex();
    return this._buildTicketView(ticket, user);
  }

  addReply(ticketId, payload, { user }) {
    this._ensureAuthenticatedUser(user);
    const ticket = this.ticketById.get(toSafeString(ticketId));
    if (!ticket) {
      const error = new Error("Ticket not found");
      error.status = 404;
      throw error;
    }

    if (!(this._canAccessTicket(user, ticket) || user.role === "admin")) {
      const error = new Error("Forbidden");
      error.status = 403;
      throw error;
    }

    const message = toSafeString(payload?.message);
    if (!message) {
      const error = new Error("message is required");
      error.status = 400;
      throw error;
    }

    const createdAt = nowIso();
    const reply = {
      id: randomUUID(),
      ticketId: ticket.id,
      message,
      visibility: user.role === "admin" && payload?.visibility === "internal" ? "internal" : "public",
      authorName: user.name,
      authorRole: user.role,
      createdAt,
    };

    this.replies.unshift(reply);
    ticket.updatedAt = createdAt;
    this._persist();
    this._reindex();
    return this._buildTicketView(ticket, user);
  }

  listFaqs({ query = "", category = "", includeHidden = false } = {}) {
    const normalizedQuery = toSafeString(query).toLowerCase();
    const normalizedCategory = toSafeString(category);

    return this.faqs
      .filter((faq) => (includeHidden ? true : faq.visible !== false))
      .filter((faq) => (normalizedCategory ? faq.category === normalizedCategory : true))
      .filter((faq) => {
        if (!normalizedQuery) return true;
        return [faq.question, faq.answer, faq.category, ...ensureArray(faq.tags)]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }

  createFaq(payload, { user }) {
    this._ensureAdmin(user);
    const question = toSafeString(payload?.question);
    const answer = toSafeString(payload?.answer);
    if (!question || !answer) {
      const error = new Error("question and answer are required");
      error.status = 400;
      throw error;
    }

    const createdAt = nowIso();
    const faq = {
      id: randomUUID(),
      question,
      answer,
      category: toSafeString(payload?.category) || "General",
      tags: ensureArray(payload?.tags).map((tag) => toSafeString(tag)).filter(Boolean),
      visible: payload?.visible !== false,
      createdAt,
      updatedAt: createdAt,
    };

    this.faqs.unshift(faq);
    this._persist();
    return faq;
  }

  updateFaq(faqId, payload, { user }) {
    this._ensureAdmin(user);
    const faq = this.faqs.find((item) => item.id === toSafeString(faqId));
    if (!faq) {
      const error = new Error("FAQ not found");
      error.status = 404;
      throw error;
    }

    faq.question = payload?.question !== undefined ? toSafeString(payload.question) : faq.question;
    faq.answer = payload?.answer !== undefined ? toSafeString(payload.answer) : faq.answer;
    faq.category = payload?.category !== undefined ? toSafeString(payload.category) : faq.category;
    faq.visible = payload?.visible !== undefined ? Boolean(payload.visible) : faq.visible;
    faq.tags =
      payload?.tags !== undefined
        ? ensureArray(payload.tags).map((tag) => toSafeString(tag)).filter(Boolean)
        : faq.tags;
    faq.updatedAt = nowIso();

    this._persist();
    return faq;
  }

  deleteFaq(faqId, { user }) {
    this._ensureAdmin(user);
    const targetId = toSafeString(faqId);
    const next = this.faqs.filter((faq) => faq.id !== targetId);
    if (next.length === this.faqs.length) {
      const error = new Error("FAQ not found");
      error.status = 404;
      throw error;
    }

    this.faqs = next;
    this._persist();
    return { deleted: true, id: targetId };
  }
}

module.exports = {
  HelpdeskStore,
  TICKET_STATUS,
};
