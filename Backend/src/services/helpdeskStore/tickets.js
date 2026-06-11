const { randomUUID } = require("crypto");
const {
  TICKET_STATUS,
  QUEUE_STATE,
  PRIORITY_ORDER,
  SLA_HOURS_BY_PRIORITY,
  DEFAULT_ASSIGNEE_BY_CATEGORY,
} = require("./constants");
const {
  nowIso,
  toSafeString,
  ensureArray,
  normalizePriority,
  normalizeStatus,
  normalizeQueue,
  normalizePagination,
  addHours,
} = require("./utils");

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

module.exports = { ticketMethods };
