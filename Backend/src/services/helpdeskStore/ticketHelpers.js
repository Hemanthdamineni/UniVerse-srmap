const { randomUUID } = require("crypto");
const {
  TICKET_STATUS,
  QUEUE_STATE,
  SLA_HOURS_BY_PRIORITY,
  DEFAULT_ASSIGNEE_BY_CATEGORY,
} = require("./constants");
const {
  nowIso,
  toSafeString,
  ensureArray,
  normalizePriority,
  addHours,
} = require("./utils");

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

module.exports = { ticketHelperMethods };
