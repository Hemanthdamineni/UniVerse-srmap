const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { randomUUID } = require("crypto");

// --- utils.js (utility) ---

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

function normalizeQueue(value) {
  const normalized = toSafeString(value).toLowerCase();
  if (Object.values(QUEUE_STATE).includes(normalized)) return normalized;
  return "";
}

function normalizePagination({ limit, offset } = {}) {
  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);
  return {
    limit:
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(Math.floor(parsedLimit), 100)
        : DEFAULT_PAGE_SIZE,
    offset:
      Number.isFinite(parsedOffset) && parsedOffset > 0
        ? Math.floor(parsedOffset)
        : 0,
  };
}

function addHours(isoValue, hours) {
  const start = new Date(isoValue).getTime();
  const base = Number.isFinite(start) ? start : Date.now();
  return new Date(base + Number(hours || 0) * 36e5).toISOString();
}

// --- constants.js ---
const TICKET_STATUS = {
  OPEN: "open",
  IN_PROGRESS: "in-progress",
  ESCALATED: "escalated",
  RESOLVED: "resolved",
};

const QUEUE_STATE = {
  NEW: "new",
  IN_PROGRESS: "in-progress",
  ESCALATED: "escalated",
  RESOLVED: "resolved",
  BREACHED: "breached",
};

const PRIORITY_ORDER = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

const SLA_HOURS_BY_PRIORITY = {
  urgent: 4,
  high: 24,
  medium: 48,
  low: 72,
};

const DEFAULT_PAGE_SIZE = 50;

const DEFAULT_ASSIGNEE_BY_CATEGORY = {
  "IT Support": "IT Help Desk",
  Academic: "Academic Affairs",
  Hostel: "Hostel Maintenance",
  Finance: "Finance Office",
  Transport: "Transport Office",
  Other: "General Help Desk",
};

// --- storage.js ---
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

// --- ticketHelpers.js ---

const ticketHelperMethods = {
  _ensureAuthenticatedUser(user) {
    if (!user || !user.userId || user.role === "guest") {
      const error = new Error("Authentication required");
      error.status = 401;
      throw error;
    }
  },

  _ensureAdmin(user) {
    if (!user || user.role !== "admin") {
      const error = new Error("Admin access required");
      error.status = 403;
      throw error;
    }
  },

  _canAccessTicket(user, ticket) {
    if (!user || !ticket) return false;
    if (user.role === "admin") return true;
    return ticket.createdByUserId === user.userId;
  },

  _normalizeTicket(ticket) {
    const priority = normalizePriority(ticket.priority);
    const category = toSafeString(ticket.category) || "Other";
    const defaultTeam = DEFAULT_ASSIGNEE_BY_CATEGORY[category] || DEFAULT_ASSIGNEE_BY_CATEGORY.Other;
    const createdAt = ticket.createdAt || nowIso();
    const slaPolicyHours = Number(ticket.slaPolicyHours || SLA_HOURS_BY_PRIORITY[priority] || 48);

    ticket.priority = priority;
    ticket.category = category;
    ticket.assignedTeam = toSafeString(ticket.assignedTeam || ticket.assignedTo || defaultTeam) || defaultTeam;
    ticket.assignedTo = toSafeString(ticket.assignedTo || ticket.ownerName || ticket.assignedTeam) || ticket.assignedTeam;
    ticket.ownerUserId = toSafeString(ticket.ownerUserId || "");
    ticket.ownerName = toSafeString(ticket.ownerName || ticket.assignedTo || ticket.assignedTeam);
    ticket.slaPolicyHours = slaPolicyHours;
    ticket.slaDueAt = ticket.slaDueAt || addHours(createdAt, slaPolicyHours);
    ticket.slaBreachedAt = ticket.slaBreachedAt || "";
    ticket.statusHistory = ensureArray(ticket.statusHistory);
    ticket.auditTrail = ensureArray(ticket.auditTrail);

    if (ticket.auditTrail.length === 0 && ticket.statusHistory.length > 0) {
      ticket.auditTrail = ticket.statusHistory.map((history) => ({
        id: history.id || randomUUID(),
        action: "status_changed",
        fromStatus: "",
        toStatus: history.status,
        note: history.note,
        actorName: history.actorName,
        actorRole: history.actorRole,
        createdAt: history.createdAt,
      }));
    }

    return ticket;
  },

  _isBreached(ticket) {
    if (ticket.status === TICKET_STATUS.RESOLVED) return false;
    const dueAt = new Date(ticket.slaDueAt || "").getTime();
    return Number.isFinite(dueAt) && Date.now() > dueAt;
  },

  _queueState(ticket) {
    if (ticket.status === TICKET_STATUS.RESOLVED) return QUEUE_STATE.RESOLVED;
    if (this._isBreached(ticket)) return QUEUE_STATE.BREACHED;
    if (ticket.status === TICKET_STATUS.ESCALATED) return QUEUE_STATE.ESCALATED;
    if (ticket.status === TICKET_STATUS.IN_PROGRESS) return QUEUE_STATE.IN_PROGRESS;
    return QUEUE_STATE.NEW;
  },

  _insertAudit(ticket, { action, fromStatus = "", toStatus = "", note = "", user }) {
    const createdAt = nowIso();
    ticket.auditTrail = ensureArray(ticket.auditTrail);
    ticket.auditTrail.unshift({
      id: randomUUID(),
      action,
      fromStatus,
      toStatus,
      note,
      actorName: user?.name || "System",
      actorRole: user?.role || "system",
      createdAt,
    });

    if (toStatus) {
      ticket.statusHistory = ensureArray(ticket.statusHistory);
      ticket.statusHistory.unshift({
        id: randomUUID(),
        status: toStatus,
        note,
        actorName: user?.name || "System",
        actorRole: user?.role || "system",
        createdAt,
      });
    }

    return createdAt;
  },

  _buildTicketView(ticket, user) {
    this._normalizeTicket(ticket);
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
      auditTrail: user?.role === "admin" ? ensureArray(ticket.auditTrail) : [],
      queueState: this._queueState(ticket),
      slaBreached: this._isBreached(ticket),
      ageHours,
      sla: {
        policyHours: ticket.slaPolicyHours,
        dueAt: ticket.slaDueAt,
        breachedAt: this._isBreached(ticket) ? ticket.slaBreachedAt || ticket.slaDueAt : "",
      },
    };
  },

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
  },
};

// --- tickets.js ---

const ticketMethods = {
  createTicket(payload, { user }) {
    this._ensureAuthenticatedUser(user);
    this._validateTicketPayload(payload);

    const createdAt = nowIso();
    const category = toSafeString(payload?.category) || "Other";
    const priority = normalizePriority(payload?.priority);
    const assignedTeam = DEFAULT_ASSIGNEE_BY_CATEGORY[category] || DEFAULT_ASSIGNEE_BY_CATEGORY.Other;
    const slaPolicyHours = SLA_HOURS_BY_PRIORITY[priority] || SLA_HOURS_BY_PRIORITY.medium;
    const ticket = {
      id: randomUUID(),
      category,
      priority,
      subject: toSafeString(payload?.subject),
      description: toSafeString(payload?.description),
      status: TICKET_STATUS.OPEN,
      assignedTo: assignedTeam,
      assignedTeam,
      ownerUserId: "",
      ownerName: assignedTeam,
      createdByUserId: user.userId,
      createdByName: user.name,
      createdByEmail: user.email,
      department: user.department || "General",
      createdAt,
      updatedAt: createdAt,
      resolutionSummary: "",
      slaPolicyHours,
      slaDueAt: addHours(createdAt, slaPolicyHours),
      slaBreachedAt: "",
      statusHistory: [],
      auditTrail: [],
    };
    this._insertAudit(ticket, {
      action: "created",
      toStatus: TICKET_STATUS.OPEN,
      note: `Ticket created and routed to ${assignedTeam}`,
      user,
    });

    this.tickets.unshift(ticket);
    this._reindex();
    this._persist();
    return this._buildTicketView(ticket, user);
  },

  listTickets({ user, filters = {} }) {
    this._ensureAuthenticatedUser(user);

    let tickets = [...this.tickets].map((ticket) => this._normalizeTicket(ticket));
    if (user.role !== "admin") {
      tickets = tickets.filter((ticket) => ticket.createdByUserId === user.userId);
    }

    const baseTickets = [...tickets];

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

    const queue = normalizeQueue(filters.queue);
    if (queue) {
      tickets = tickets.filter((ticket) => this._queueState(ticket) === queue);
    }

    const category = toSafeString(filters.category);
    if (category) {
      tickets = tickets.filter((ticket) => ticket.category === category);
    }

    const priority = normalizePriority(filters.priority);
    if (toSafeString(filters.priority)) {
      tickets = tickets.filter((ticket) => ticket.priority === priority);
    }

    const owner = toSafeString(filters.owner).toLowerCase();
    if (owner) {
      tickets = tickets.filter((ticket) =>
        [ticket.ownerUserId, ticket.ownerName, ticket.assignedTo].join(" ").toLowerCase().includes(owner)
      );
    }

    const team = toSafeString(filters.team).toLowerCase();
    if (team) {
      tickets = tickets.filter((ticket) => toSafeString(ticket.assignedTeam).toLowerCase() === team);
    }

    tickets.sort((left, right) => {
      const priorityDelta =
        (PRIORITY_ORDER[right.priority] || 0) - (PRIORITY_ORDER[left.priority] || 0);
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });

    const queueCounts = Object.fromEntries(Object.values(QUEUE_STATE).map((state) => [state, 0]));
    for (const ticket of baseTickets) queueCounts[this._queueState(ticket)] += 1;

    const workloadMap = new Map();
    for (const ticket of baseTickets.filter((item) => item.status !== TICKET_STATUS.RESOLVED)) {
      const key = `${ticket.assignedTeam || "Unassigned"}|${ticket.ownerName || ticket.assignedTo || "Unassigned"}`;
      if (!workloadMap.has(key)) {
        workloadMap.set(key, {
          assignedTeam: ticket.assignedTeam || "Unassigned",
          ownerName: ticket.ownerName || ticket.assignedTo || "Unassigned",
          open: 0,
          breached: 0,
          total: 0,
        });
      }
      const workload = workloadMap.get(key);
      workload.total += 1;
      if (ticket.status === TICKET_STATUS.OPEN || ticket.status === TICKET_STATUS.IN_PROGRESS) workload.open += 1;
      if (this._isBreached(ticket)) workload.breached += 1;
    }

    const counts = {
      total: baseTickets.length,
      filtered: tickets.length,
      open: baseTickets.filter((ticket) => ticket.status === TICKET_STATUS.OPEN).length,
      inProgress: baseTickets.filter((ticket) => ticket.status === TICKET_STATUS.IN_PROGRESS).length,
      escalated: baseTickets.filter((ticket) => ticket.status === TICKET_STATUS.ESCALATED).length,
      resolved: baseTickets.filter((ticket) => ticket.status === TICKET_STATUS.RESOLVED).length,
      slaBreached: queueCounts[QUEUE_STATE.BREACHED],
      queues: queueCounts,
    };
    const pagination = normalizePagination(filters);
    const pagedTickets = tickets.slice(pagination.offset, pagination.offset + pagination.limit);

    return {
      items: pagedTickets.map((ticket) => this._buildTicketView(ticket, user)),
      counts,
      pagination: {
        ...pagination,
        total: tickets.length,
      },
      workload: Array.from(workloadMap.values()).sort((left, right) => right.total - left.total),
    };
  },

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
  },

  updateTicket(ticketId, payload, { user }) {
    this._ensureAdmin(user);
    const ticket = this.ticketById.get(toSafeString(ticketId));
    if (!ticket) {
      const error = new Error("Ticket not found");
      error.status = 404;
      throw error;
    }
    this._normalizeTicket(ticket);

    const nextStatus = payload?.status ? normalizeStatus(payload.status) : ticket.status;
    const previousStatus = ticket.status;
    const note = toSafeString(payload?.note);
    const resolutionSummary =
      payload?.resolutionSummary !== undefined
        ? toSafeString(payload.resolutionSummary)
        : ticket.resolutionSummary;

    if (nextStatus === TICKET_STATUS.RESOLVED && !resolutionSummary) {
      const error = new Error("resolutionSummary is required to resolve a ticket");
      error.status = 400;
      throw error;
    }
    if (previousStatus === TICKET_STATUS.RESOLVED && nextStatus !== TICKET_STATUS.RESOLVED && !note) {
      const error = new Error("note is required to reopen a resolved ticket");
      error.status = 400;
      throw error;
    }

    const nextAssignedTeam =
      payload?.assignedTeam !== undefined ? toSafeString(payload.assignedTeam) : ticket.assignedTeam;
    const nextAssignedTo =
      payload?.assignedTo !== undefined ? toSafeString(payload.assignedTo) : ticket.assignedTo;
    if (!nextAssignedTeam && !nextAssignedTo) {
      const error = new Error("assignedTeam or assignedTo is required");
      error.status = 400;
      throw error;
    }

    ticket.status = nextStatus;
    ticket.assignedTeam = nextAssignedTeam || nextAssignedTo;
    ticket.assignedTo = nextAssignedTo || nextAssignedTeam;
    ticket.ownerUserId =
      payload?.ownerUserId !== undefined ? toSafeString(payload.ownerUserId) : ticket.ownerUserId;
    ticket.ownerName =
      payload?.ownerName !== undefined ? toSafeString(payload.ownerName) : ticket.ownerName || ticket.assignedTo;
    ticket.resolutionSummary = resolutionSummary;
    ticket.updatedAt = this._insertAudit(ticket, {
      action: previousStatus !== nextStatus ? "status_changed" : "ticket_updated",
      fromStatus: previousStatus,
      toStatus: previousStatus !== nextStatus ? nextStatus : "",
      note: note || (previousStatus !== nextStatus ? `Ticket moved to ${nextStatus}` : "Ticket metadata updated"),
      user,
    });
    if (previousStatus !== nextStatus && nextStatus === TICKET_STATUS.RESOLVED) {
      this._insertAudit(ticket, {
        action: "resolved",
        fromStatus: previousStatus,
        toStatus: "",
        note: resolutionSummary,
        user,
      });
    }
    if (
      payload?.assignedTo !== undefined ||
      payload?.assignedTeam !== undefined ||
      payload?.ownerName !== undefined ||
      payload?.ownerUserId !== undefined
    ) {
      this._insertAudit(ticket, {
        action: "assigned",
        note: `Assigned to ${ticket.ownerName || ticket.assignedTo} / ${ticket.assignedTeam}`,
        user,
      });
      ticket.updatedAt = nowIso();
    }

    this._persist();
    this._reindex();
    return this._buildTicketView(ticket, user);
  },

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

    this._normalizeTicket(ticket);
    const previousStatus = ticket.status;
    const note = toSafeString(reason) || "Escalated by requester";
    ticket.status = TICKET_STATUS.ESCALATED;
    ticket.updatedAt = this._insertAudit(ticket, {
      action: previousStatus === TICKET_STATUS.ESCALATED ? "escalation_repeated" : "escalated",
      fromStatus: previousStatus,
      toStatus: previousStatus === TICKET_STATUS.ESCALATED ? "" : TICKET_STATUS.ESCALATED,
      note,
      user,
    });

    this._persist();
    this._reindex();
    return this._buildTicketView(ticket, user);
  },

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
    this._normalizeTicket(ticket);

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
    this._insertAudit(ticket, {
      action: reply.visibility === "internal" ? "internal_note_added" : "reply_added",
      note: reply.visibility === "internal" ? "Internal note added" : "Public reply added",
      user,
    });
    ticket.updatedAt = createdAt;
    this._persist();
    this._reindex();
    return this._buildTicketView(ticket, user);
  },

  bulkUpdateTickets(payload, { user }) {
    this._ensureAdmin(user);
    const ticketIds = ensureArray(payload?.ticketIds).map(toSafeString).filter(Boolean).slice(0, 100);
    if (ticketIds.length === 0) {
      const error = new Error("ticketIds are required");
      error.status = 400;
      throw error;
    }

    const patch = {
      status: payload?.status,
      assignedTo: payload?.assignedTo,
      assignedTeam: payload?.assignedTeam,
      ownerUserId: payload?.ownerUserId,
      ownerName: payload?.ownerName,
      resolutionSummary: payload?.resolutionSummary,
      note: toSafeString(payload?.note) || "Bulk admin update",
    };
    const updated = [];
    const failures = [];

    for (const ticketId of ticketIds) {
      try {
        updated.push(this.updateTicket(ticketId, patch, { user }));
      } catch (error) {
        failures.push({
          ticketId,
          message: error?.message || "Update failed",
          status: error?.status || 500,
        });
      }
    }

    return {
      updated,
      failures,
      counts: {
        requested: ticketIds.length,
        updated: updated.length,
        failed: failures.length,
      },
    };
  },
};

// --- faqs.js ---
const faqMethods = {
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
  },

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
  },

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
  },

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
  },

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
  },
};

// --- class ---
class HelpdeskStore {
  constructor({ dbPath }) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
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
