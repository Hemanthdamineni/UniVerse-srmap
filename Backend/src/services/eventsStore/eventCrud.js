const { randomUUID } = require("crypto");
const {
  APPROVAL_STATUS,
  EVENT_STATES,
  REGISTRATION_STATUS,
  ensureArray,
  normalizeCoOrganizers,
  normalizeRecurrence,
  cloneForRecurrence,
  nowIso,
} = require("./utils");

module.exports = {
  listEvents({ user, filters = {} }) {
    const now = Date.now();

    let events = this.events.filter((event) => {
      if (!this._checkVisibility(event, user)) return false;
      if (event.status === EVENT_STATES.DRAFT && !this._canManageEvent(user, event)) {
        return false;
      }
      return true;
    });

    if (filters.query) {
      const query = String(filters.query).toLowerCase();
      events = events.filter(
        (event) =>
          event.title.toLowerCase().includes(query) ||
          String(event.description || "").toLowerCase().includes(query) ||
          ensureArray(event.tags).some((tag) => String(tag).toLowerCase().includes(query))
      );
    }

    if (filters.department) {
      events = events.filter((event) => event.department === filters.department);
    }

    if (filters.category) {
      events = events.filter((event) => event.category === filters.category);
    }

    if (filters.status) {
      events = events.filter((event) => event.status === filters.status);
    }

    if (filters.visibility) {
      events = events.filter((event) => event.visibility === filters.visibility);
    }

    if (filters.type === "upcoming") {
      events = events.filter((event) => new Date(event.endAt).getTime() >= now);
    }

    if (filters.type === "past") {
      events = events.filter((event) => new Date(event.endAt).getTime() < now);
    }

    if (filters.startDate) {
      const startDate = new Date(filters.startDate).getTime();
      events = events.filter((event) => new Date(event.startAt).getTime() >= startDate);
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate).getTime();
      events = events.filter((event) => new Date(event.endAt).getTime() <= endDate);
    }

    if (filters.myEvents && user) {
      const myRegEventIds = new Set(
        ensureArray(this.registrationsByUser.get(user.userId))
          .filter((item) => item.status === REGISTRATION_STATUS.REGISTERED)
          .map((item) => item.eventId)
      );
      events = events.filter(
        (event) => event.createdByUserId === user.userId || myRegEventIds.has(event.id)
      );
    }

    if (filters.registered && user) {
      const myRegEventIds = new Set(
        ensureArray(this.registrationsByUser.get(user.userId))
          .filter((item) => item.status === REGISTRATION_STATUS.REGISTERED)
          .map((item) => item.eventId)
      );
      events = events.filter((event) => myRegEventIds.has(event.id));
    }

    if (filters.createdBy && user) {
      const createdBy =
        String(filters.createdBy).trim().toLowerCase() === "me"
          ? user.userId
          : String(filters.createdBy).trim();
      if (createdBy) {
        events = events.filter((event) => String(event.createdByUserId) === createdBy);
      }
    }

    events.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return events.map((event) => this._eventSummary(event, user));
  },

  listMyCreated({ user }) {
    if (!user) return [];
    return this.events
      .filter((event) => event.createdByUserId === user.userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((event) => this._eventSummary(event, user));
  },

  getEvent(eventId, { user }) {
    const event = this.eventById.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }

    if (!this._checkVisibility(event, user)) {
      const error = new Error("Forbidden");
      error.status = 403;
      throw error;
    }

    const registrations = ensureArray(this.registrationsByEvent.get(event.id));
    const feedback = this.feedback.filter((item) => item.eventId === event.id);
    const gallery = this.gallery.filter((item) => item.eventId === event.id);
    const checkIns = this.checkIns.filter((item) => item.eventId === event.id);

    return {
      ...this._eventSummary(event, user),
      registrations,
      feedback,
      gallery,
      checkIns,
      calendar: {
        googleUrl: this._googleCalendarLink(event),
        outlookUrl: this._outlookCalendarLink(event),
        icalUrl: `/api/events/${event.id}/ical`,
      },
    };
  },

  createEvent(payload, { user }) {
    if (!user) {
      const error = new Error("Authentication required");
      error.status = 401;
      throw error;
    }

    if (user.role === "guest") {
      const error = new Error("Guests cannot create events");
      error.status = 403;
      throw error;
    }

    this._validateEventPayload(payload);

    const recurrence = normalizeRecurrence(payload.recurrence);
    const createdAt = nowIso();
    const approvalStatus = APPROVAL_STATUS.NOT_REQUIRED;

    const baseEvent = {
      id: randomUUID(),
      title: String(payload.title),
      description: String(payload.description),
      startAt: new Date(payload.startAt).toISOString(),
      endAt: new Date(payload.endAt).toISOString(),
      location: {
        physical: String(payload.location?.physical || ""),
        virtual: String(payload.location?.virtual || ""),
        mapUrl: String(payload.location?.mapUrl || ""),
      },
      organizer: String(payload.organizer),
      department: String(payload.department),
      category: String(payload.category || "General"),
      tags: ensureArray(payload.tags).map((tag) => String(tag)),
      maxCapacity: Math.max(1, Number(payload.maxCapacity || 500)),
      registrationDeadline: payload.registrationDeadline
        ? new Date(payload.registrationDeadline).toISOString()
        : new Date(payload.startAt).toISOString(),
      cancellationDeadline: payload.cancellationDeadline
        ? new Date(payload.cancellationDeadline).toISOString()
        : (payload.registrationDeadline
            ? new Date(payload.registrationDeadline).toISOString()
            : new Date(payload.startAt).toISOString()),
      visibility: payload.visibility,
      featured: Boolean(payload.featured),
      coverImageUrl: String(payload.coverImageUrl || ""),
      attachments: ensureArray(payload.attachments),
      agenda: ensureArray(payload.agenda),
      speakers: ensureArray(payload.speakers),
      competitionConfig: payload.competitionConfig || null,
      prizes: String(payload.prizes || ""),
      rules: String(payload.rules || ""),
      eligibility: String(payload.eligibility || ""),
      faq: ensureArray(payload.faq),
      coOrganizers: normalizeCoOrganizers(payload.coOrganizers, user.userId),
      registrationFormFields: ensureArray(payload.registrationFormFields),
      status: payload.status || EVENT_STATES.PUBLISHED,
      approvalStatus,
      approvalNotes: "",
      approvedByUserId: null,
      approvedAt: null,
      recurring: recurrence.type !== "none",
      recurrence,
      parentEventId: null,
      recurrenceIndex: 0,
      createdByUserId: user.userId,
      createdByRole: user.role,
      createdAt,
      updatedAt: createdAt,
    };

    if (baseEvent.maxCapacity <= 0) {
      const error = new Error("maxCapacity must be > 0");
      error.status = 400;
      throw error;
    }

    const created = [baseEvent];
    for (let i = 1; i < (recurrence.count || 1); i += 1) {
      created.push(cloneForRecurrence(baseEvent, recurrence, i));
    }

    this.events.push(...created);
    this._reindex();

    this._persistAll();
    for (const event of created) {
      this._syncEventToContent(event);
    }

    return created.map((event) => this._eventSummary(event, user));
  },

  updateEvent(eventId, payload, { user }) {
    const event = this.eventById.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }

    this._ensureCanManageEvent(user, event);
    if (
      event.createdByUserId === user.userId &&
      event.status === EVENT_STATES.PUBLISHED &&
      !["admin", "event_coordinator"].includes(user.role)
    ) {
      const error = new Error("Published events cannot be edited by creator");
      error.status = 400;
      throw error;
    }
    this._validateEventPayload(payload, { partial: true });

    const updated = {
      ...event,
      ...payload,
      location: payload.location ? { ...event.location, ...payload.location } : event.location,
      tags: payload.tags ? ensureArray(payload.tags) : event.tags,
      attachments: payload.attachments ? ensureArray(payload.attachments) : event.attachments,
      agenda: payload.agenda ? ensureArray(payload.agenda) : event.agenda,
      speakers: payload.speakers ? ensureArray(payload.speakers) : event.speakers,
      coOrganizers:
        payload.coOrganizers !== undefined
          ? normalizeCoOrganizers(payload.coOrganizers, event.createdByUserId)
          : ensureArray(event.coOrganizers),
      registrationFormFields: payload.registrationFormFields
        ? ensureArray(payload.registrationFormFields)
        : event.registrationFormFields,
      updatedAt: nowIso(),
    };

    this.events = this.events.map((item) => (item.id === eventId ? updated : item));
    this._reindex();

    this._notifyEventAttendees(eventId, {
      type: "event_updated",
      title: `Event updated: ${updated.title}`,
      message: `The event details were updated. Please review the latest schedule.`,
      eventId,
    });

    this._persistAll();
    this._syncEventToContent(updated);
    return this._eventSummary(updated, user);
  },

  transitionEvent(eventId, nextStatus, { user }) {
    const event = this.eventById.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }

    this._ensureCanManageEvent(user, event);

    if (!Object.values(EVENT_STATES).includes(nextStatus)) {
      const error = new Error("Invalid event status");
      error.status = 400;
      throw error;
    }

    const transitionPayload = { status: nextStatus };
    if (nextStatus === EVENT_STATES.PUBLISHED && event.approvalStatus === APPROVAL_STATUS.PENDING) {
      transitionPayload.approvalStatus = APPROVAL_STATUS.APPROVED;
      transitionPayload.approvedByUserId = user?.userId || null;
      transitionPayload.approvedAt = nowIso();
      transitionPayload.approvalNotes = "Auto-approved in simplified workflow";
    }

    return this.updateEvent(eventId, transitionPayload, { user });
  },

  duplicateEvent(eventId, { user }) {
    const event = this.eventById.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }
    this._ensureCanManageEvent(user, event);

    const duplicatePayload = {
      ...event,
      title: `${event.title} (Copy)`,
      status: EVENT_STATES.DRAFT,
      recurrence: { type: "none" },
    };

    return this.createEvent(duplicatePayload, { user });
  },

  bulkAction(eventIds, action, { user }) {
    const ids = ensureArray(eventIds);
    if (!ids.length) {
      const error = new Error("eventIds is required");
      error.status = 400;
      throw error;
    }

    const results = [];
    for (const eventId of ids) {
      const event = this.eventById.get(eventId);
      if (!event) continue;
      if (!this._canManageEvent(user, event)) continue;

      if (action === "publish") {
        results.push(this.transitionEvent(eventId, EVENT_STATES.PUBLISHED, { user }));
      } else if (action === "unpublish") {
        results.push(this.transitionEvent(eventId, EVENT_STATES.DRAFT, { user }));
      } else if (action === "delete") {
        this.deleteEvent(eventId, { user });
        results.push({ id: eventId, deleted: true });
      }
    }

    this._persistAll();
    return results;
  },

  deleteEvent(eventId, { user }) {
    const event = this.eventById.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }

    this._ensureCanManageEvent(user, event);
    if (
      event.createdByUserId === user.userId &&
      event.status === EVENT_STATES.PUBLISHED &&
      !["admin", "event_coordinator"].includes(user.role)
    ) {
      const error = new Error("Published events cannot be deleted by creator");
      error.status = 400;
      throw error;
    }
    const removedEventIds = this.events
      .filter((item) => item.id === eventId || item.parentEventId === eventId)
      .map((item) => item.id);

    this.events = this.events.filter((item) => item.id !== eventId && item.parentEventId !== eventId);
    this.registrations = this.registrations.filter((item) => item.eventId !== eventId);
    this.feedback = this.feedback.filter((item) => item.eventId !== eventId);
    this.gallery = this.gallery.filter((item) => item.eventId !== eventId);
    this.checkIns = this.checkIns.filter((item) => item.eventId !== eventId);
    this._reindex();
    this._persistAll();
    this._removeEventsFromContent(removedEventIds);
  },

  approveEvent(eventId, { user, approved, notes }) {
    const event = this.eventById.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }

    if (!["admin", "event_coordinator", "department_head", "faculty"].includes(user.role)) {
      const error = new Error("Forbidden");
      error.status = 403;
      throw error;
    }

    if (approved) {
      const update = {
        approvalStatus: APPROVAL_STATUS.APPROVED,
        approvedByUserId: user.userId,
        approvedAt: nowIso(),
        approvalNotes: String(notes || "Approved"),
      };
      return this.updateEvent(eventId, update, { user });
    }

    return this.updateEvent(
      eventId,
      {
        approvalStatus: APPROVAL_STATUS.REJECTED,
        status: EVENT_STATES.DRAFT,
        approvalNotes: String(notes || "Rejected"),
      },
      { user }
    );
  }
};
