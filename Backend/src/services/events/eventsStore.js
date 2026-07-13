const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { randomUUID, createHash } = require("crypto");

// --- utils.js (utility) ---
const EVENT_STATES = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
};

const EVENT_VISIBILITY = {
  PUBLIC: "public",
  PRIVATE: "private",
  DEPARTMENT_ONLY: "department-only",
  CREATOR_ONLY: "creator-only",
  REGISTERED: "registered",
};

const APPROVAL_STATUS = {
  NOT_REQUIRED: "not-required",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const REGISTRATION_STATUS = {
  REGISTERED: "registered",
  CANCELLED: "cancelled",
};

const STATE_FILE_NAMES = {
  events: "events.json",
  registrations: "registrations.json",
  notifications: "notifications.json",
  feedback: "feedback.json",
  gallery: "gallery.json",
  checkIns: "checkins.json",
};

const STATE_KEYS = Object.keys(STATE_FILE_NAMES);

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCoOrganizers(value, creatorId = "") {
  const unique = new Set(
    ensureArray(value)
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .filter((item) => item !== String(creatorId || "").trim())
  );
  return Array.from(unique);
}

function nowIso() {
  return new Date().toISOString();
}

function parseDate(dateValue, field) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`Invalid ${field}`);
    error.status = 400;
    throw error;
  }
  return date;
}

function toCsvRow(cells) {
  return cells
    .map((cell) => {
      const value = String(cell ?? "").replace(/"/g, '""');
      return `"${value}"`;
    })
    .join(",");
}

function normalizeRecurrence(recurrence) {
  if (!recurrence || recurrence.type === "none") {
    return { type: "none" };
  }

  const type = String(recurrence.type || "none").toLowerCase();
  const interval = Math.max(1, Number(recurrence.interval || 1));
  const count = Math.max(1, Math.min(52, Number(recurrence.count || 1)));
  if (!["weekly", "monthly"].includes(type)) {
    const error = new Error("Invalid recurrence type. Use weekly or monthly.");
    error.status = 400;
    throw error;
  }

  return { type, interval, count };
}

function cloneForRecurrence(base, recurrence, index) {
  const start = new Date(base.startAt);
  const end = new Date(base.endAt);

  if (recurrence.type === "weekly") {
    start.setDate(start.getDate() + recurrence.interval * 7 * index);
    end.setDate(end.getDate() + recurrence.interval * 7 * index);
  } else if (recurrence.type === "monthly") {
    start.setMonth(start.getMonth() + recurrence.interval * index);
    end.setMonth(end.getMonth() + recurrence.interval * index);
  }

  return {
    ...base,
    id: randomUUID(),
    parentEventId: base.id,
    recurrenceIndex: index,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

// --- access.js ---
const accessMethods = {
  _canManageEvent(user, event) {
    if (!user) return false;
    if (event.createdByUserId === user.userId) return true;
    if (ensureArray(event.coOrganizers).map(String).includes(String(user.userId))) return true;
    if (["admin", "event_coordinator"].includes(user.role)) return true;
    if (["faculty", "department_head"].includes(user.role)) {
      return user.department === event.department;
    }
    return false;
  },

  _ensureCanManageEvent(user, event) {
    if (!this._canManageEvent(user, event)) {
      const error = new Error("Forbidden");
      error.status = 403;
      throw error;
    }
  },

  _validateEventPayload(payload, { partial = false } = {}) {
    const required = [
      "title",
      "description",
      "startAt",
      "endAt",
      "location",
      "organizer",
      "department",
      "visibility",
    ];

    if (!partial) {
      for (const field of required) {
        if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
          const error = new Error(`${field} is required`);
          error.status = 400;
          throw error;
        }
      }
    }

    if (payload.startAt !== undefined) parseDate(payload.startAt, "startAt");
    if (payload.endAt !== undefined) parseDate(payload.endAt, "endAt");
    if (payload.registrationDeadline !== undefined) {
      parseDate(payload.registrationDeadline, "registrationDeadline");
    }

    if (payload.startAt && payload.endAt) {
      const startAt = new Date(payload.startAt).getTime();
      const endAt = new Date(payload.endAt).getTime();
      if (endAt <= startAt) {
        const error = new Error("endAt must be after startAt");
        error.status = 400;
        throw error;
      }
    }

    if (payload.visibility !== undefined && !Object.values(EVENT_VISIBILITY).includes(payload.visibility)) {
      const error = new Error("Invalid visibility");
      error.status = 400;
      throw error;
    }
  },

  _eventSummary(event, requester = null) {
    const regs = ensureArray(this.registrationsByEvent.get(event.id));
    const registeredCount = regs.filter((r) => r.status === REGISTRATION_STATUS.REGISTERED).length;
    const mine = requester
      ? regs.find(
          (r) =>
            r.userId === requester.userId &&
            r.status === REGISTRATION_STATUS.REGISTERED
        )
      : null;

    return {
      ...event,
      registeredCount,
      waitlistCount: 0,
      seatsAvailable: Math.max(0, event.maxCapacity - registeredCount),
      myRegistration: mine || null,
    };
  },

  _checkVisibility(event, user) {
    if (event.visibility === EVENT_VISIBILITY.PUBLIC) return true;
    if (event.visibility === EVENT_VISIBILITY.CREATOR_ONLY) {
      return Boolean(user && this._canManageEvent(user, event));
    }
    if (event.visibility === EVENT_VISIBILITY.REGISTERED) {
      if (!user) return false;
      const registrations = ensureArray(this.registrationsByEvent.get(event.id));
      const hasRegistration = registrations.some(
        (registration) =>
          registration.userId === user.userId &&
          registration.status === REGISTRATION_STATUS.REGISTERED
      );
      return hasRegistration || this._canManageEvent(user, event);
    }
    if (!user) return false;

    if (["admin", "event_coordinator"].includes(user.role)) return true;
    if (event.visibility === EVENT_VISIBILITY.PRIVATE) {
      return this._canManageEvent(user, event);
    }
    if (event.visibility === EVENT_VISIBILITY.DEPARTMENT_ONLY) {
      return user.department === event.department || this._canManageEvent(user, event);
    }

    return true;
  }
};

// --- calendar.js ---
const calendarMethods = {
  _icsDate(dateLike) {
    return new Date(dateLike).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  },

  createIcal(eventId) {
    const event = this.eventById.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//UniVerse - SRMAP Edition//Events//EN",
      "BEGIN:VEVENT",
      `UID:${event.id}@universe-srmap.local`,
      `DTSTAMP:${this._icsDate(nowIso())}`,
      `DTSTART:${this._icsDate(event.startAt)}`,
      `DTEND:${this._icsDate(event.endAt)}`,
      `SUMMARY:${event.title.replace(/\n/g, " ")}`,
      `DESCRIPTION:${event.description.replace(/\n/g, " ")}`,
      `LOCATION:${(event.location.physical || event.location.virtual || "TBA").replace(/\n/g, " ")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    return lines.join("\r\n");
  },

  _googleCalendarLink(event) {
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: event.title,
      dates: `${this._icsDate(event.startAt)}/${this._icsDate(event.endAt)}`,
      details: event.description,
      location: event.location.physical || event.location.virtual || "TBA",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  },

  _outlookCalendarLink(event) {
    const params = new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      startdt: event.startAt,
      enddt: event.endAt,
      subject: event.title,
      body: event.description,
      location: event.location.physical || event.location.virtual || "TBA",
    });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  }
};

// --- contentSync.js ---
const contentSyncMethods = {
  _toContentResource(resource, fallbackTitle = "Resource") {
    const url = String(resource?.url || resource?.url_or_path || "").trim();
    if (!url) return null;

    const kindFromInput = String(resource?.kind || "").trim().toLowerCase();
    const allowedKinds = new Set(["pdf", "ppt", "image", "video", "link", "doc"]);
    let kind = allowedKinds.has(kindFromInput) ? kindFromInput : "link";

    if (!allowedKinds.has(kindFromInput)) {
      const lower = url.toLowerCase();
      if (lower.endsWith(".pdf")) kind = "pdf";
      else if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) kind = "ppt";
      else if (/\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/.test(lower)) kind = "image";
      else if (/\.(mp4|mov|webm|mkv)(\?|$)/.test(lower)) kind = "video";
      else if (/\.(doc|docx|rtf)(\?|$)/.test(lower)) kind = "doc";
    }

    return {
      kind,
      title: String(resource?.title || resource?.name || fallbackTitle || "Resource").trim() || "Resource",
      url_or_path: url,
      mime_type: resource?.mime_type || resource?.mimeType || null,
      size_bytes: Number.isFinite(Number(resource?.size_bytes || resource?.sizeBytes))
        ? Math.floor(Number(resource?.size_bytes || resource?.sizeBytes))
        : null,
    };
  },

  _buildEventContentResources(event) {
    const resources = [];

    for (const attachment of ensureArray(event.attachments)) {
      const normalized = this._toContentResource(attachment, "Attachment");
      if (normalized) resources.push(normalized);
    }

    if (String(event.coverImageUrl || "").trim()) {
      resources.push({
        kind: "image",
        title: "Cover Image",
        url_or_path: String(event.coverImageUrl).trim(),
        mime_type: null,
        size_bytes: null,
      });
    }

    const gallery = this.gallery.filter((item) => item.eventId === event.id);
    for (const photo of gallery) {
      const normalized = this._toContentResource(
        { kind: "image", title: photo.caption || "Gallery Photo", url: photo.url },
        "Gallery Photo"
      );
      if (normalized) resources.push(normalized);
    }

    return resources;
  },

  _syncEventToContent(event) {
    if (!this.contentStore) return;
    try {
      this.contentStore.upsertContent({
        id: event.id,
        type: "event",
        title: String(event.title || "").trim() || "Untitled Event",
        description: String(event.description || ""),
        category: String(event.category || ""),
        startDate: event.startAt || null,
        endDate: event.endAt || null,
        location: String(event.location?.physical || ""),
        resources: this._buildEventContentResources(event),
      });
    } catch (_error) {
      // Keep events workflow resilient even if unified content sync fails.
    }
  },

  _removeEventsFromContent(eventIds) {
    if (!this.contentStore) return;
    for (const eventId of eventIds) {
      try {
        this.contentStore.deleteContentIfExists(eventId);
      } catch (_error) {
        // Ignore sync cleanup errors.
      }
    }
  }
};

// --- engagement.js ---
const engagementMethods = {
  submitFeedback(eventId, { user, rating, comments, answers }) {
    const event = this.eventById.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }

    if (new Date(event.endAt).getTime() > Date.now()) {
      const error = new Error("Feedback is available after the event ends");
      error.status = 400;
      throw error;
    }

    const hasAttended = ensureArray(this.registrationsByEvent.get(eventId)).some(
      (item) => item.userId === user.userId && item.status === REGISTRATION_STATUS.REGISTERED
    );

    if (!hasAttended) {
      const error = new Error("Only attendees can submit feedback");
      error.status = 403;
      throw error;
    }

    const existing = this.feedback.find((item) => item.eventId === eventId && item.userId === user.userId);
    if (existing) {
      existing.rating = Number(rating || existing.rating);
      existing.comments = String(comments || existing.comments);
      existing.answers = ensureArray(answers || existing.answers);
      existing.updatedAt = nowIso();
      this._persistAll();
      return existing;
    }

    const item = {
      id: randomUUID(),
      eventId,
      userId: user.userId,
      rating: Number(rating || 0),
      comments: String(comments || ""),
      answers: ensureArray(answers),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    this.feedback.push(item);
    this._persistAll();
    return item;
  },

  addGalleryPhoto(eventId, { user, url, caption }) {
    const event = this.eventById.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }

    this._ensureCanManageEvent(user, event);

    const photo = {
      id: randomUUID(),
      eventId,
      url: String(url || ""),
      caption: String(caption || ""),
      uploadedByUserId: user.userId,
      createdAt: nowIso(),
    };

    this.gallery.push(photo);
    this._persistAll();
    this._syncEventToContent(event);
    return photo;
  },

  analytics({ user }) {
    if (!["admin", "event_coordinator", "faculty", "department_head"].includes(user.role)) {
      const error = new Error("Forbidden");
      error.status = 403;
      throw error;
    }

    const publishedEvents = this.events.filter((event) => event.status === EVENT_STATES.PUBLISHED);
    const pastEvents = publishedEvents.filter((event) => new Date(event.endAt).getTime() < Date.now());

    const registrations = this.registrations.filter((item) => item.status === REGISTRATION_STATUS.REGISTERED);
    const checkedIns = this.checkIns.length;
    const attendanceRate = registrations.length ? Number((checkedIns / registrations.length).toFixed(2)) : 0;

    const popularEvents = [...publishedEvents]
      .map((event) => this._eventSummary(event, user))
      .sort((a, b) => b.registeredCount - a.registeredCount)
      .slice(0, 5)
      .map((event) => ({ id: event.id, title: event.title, registrations: event.registeredCount }));

    const registrationTrend = this._buildRegistrationTrend();

    return {
      totals: {
        events: this.events.length,
        publishedEvents: publishedEvents.length,
        pastEvents: pastEvents.length,
        registrations: registrations.length,
        checkedIns,
        attendanceRate,
      },
      popularEvents,
      registrationTrend,
      feedbackAverage:
        this.feedback.length > 0
          ? Number(
              (
                this.feedback.reduce((sum, item) => sum + Number(item.rating || 0), 0) /
                this.feedback.length
              ).toFixed(2)
            )
          : 0,
    };
  },

  _buildRegistrationTrend() {
    const trend = new Map();
    for (const registration of this.registrations) {
      if (registration.status !== REGISTRATION_STATUS.REGISTERED) continue;
      const key = registration.registeredAt.slice(0, 10);
      trend.set(key, (trend.get(key) || 0) + 1);
    }
    return Array.from(trend.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, registrations]) => ({ date, registrations }));
  }
};

// --- eventCrud.js ---

const eventCrudMethods = {
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

// --- notifications.js ---
const notificationMethods = {
  createReminderNotifications() {
    const now = Date.now();
    const reminders = [];

    for (const event of this.events) {
      if (event.status !== EVENT_STATES.PUBLISHED) continue;
      const startTime = new Date(event.startAt).getTime();
      const deltaMs = startTime - now;
      const within24h = deltaMs <= 24 * 60 * 60 * 1000 && deltaMs > 23 * 60 * 60 * 1000;
      const within1h = deltaMs <= 60 * 60 * 1000 && deltaMs > 55 * 60 * 1000;

      if (!within24h && !within1h) continue;

      const users = ensureArray(this.registrationsByEvent.get(event.id))
        .filter((item) => item.status === REGISTRATION_STATUS.REGISTERED)
        .map((item) => item.userId);

      for (const userId of users) {
        const type = within24h ? "event_reminder_24h" : "event_reminder_1h";
        const notification = this._pushNotification(userId, {
          type,
          title: `Reminder: ${event.title}`,
          message: within24h ? "Your event starts in 24 hours." : "Your event starts in 1 hour.",
          eventId: event.id,
        });
        reminders.push(notification);
      }
    }

    this._persistAll();
    return reminders;
  },

  sendBulkMessage(eventId, { user, message, subject }) {
    const event = this.eventById.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }
    this._ensureCanManageEvent(user, event);

    const registrations = ensureArray(this.registrationsByEvent.get(eventId)).filter((item) =>
      item.status === REGISTRATION_STATUS.REGISTERED
    );

    const created = registrations.map((registration) =>
      this._pushNotification(registration.userId, {
        type: "organizer_message",
        title: String(subject || `Message from organizer: ${event.title}`),
        message: String(message || ""),
        eventId,
      })
    );

    this._persistAll();
    return created;
  },

  listNotifications(userId) {
    return this.notifications
      .filter((item) => item.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  markNotificationRead(notificationId, userId) {
    const notification = this.notifications.find(
      (item) => item.id === notificationId && item.userId === userId
    );
    if (!notification) {
      const error = new Error("Notification not found");
      error.status = 404;
      throw error;
    }

    notification.readAt = nowIso();
    this._persistAll();
    return notification;
  },

  _notifyEventAttendees(eventId, payload) {
    const users = ensureArray(this.registrationsByEvent.get(eventId))
      .filter((registration) => registration.status === REGISTRATION_STATUS.REGISTERED)
      .map((registration) => registration.userId);

    for (const userId of users) {
      this._pushNotification(userId, payload);
    }
  },

  _notifyRoleTargets(roles, payload) {
    const fakeUsers = [
      { userId: "admin-user", role: "admin" },
      { userId: "coordinator-user", role: "event_coordinator" },
      { userId: "hod-user", role: "department_head" },
    ];

    for (const user of fakeUsers) {
      if (roles.includes(user.role)) {
        this._pushNotification(user.userId, payload);
      }
    }
  },

  _pushNotification(userId, payload) {
    const notification = {
      id: randomUUID(),
      userId,
      type: String(payload.type || "info"),
      title: String(payload.title || "Notification"),
      message: String(payload.message || ""),
      eventId: payload.eventId || null,
      opportunityId: payload.opportunityId || null,
      channel: Array.isArray(payload.channel) ? payload.channel : ["in-app", "email"],
      readAt: null,
      createdAt: nowIso(),
    };

    this.notifications.push(notification);
    return notification;
  },

  pushCareerNotification(userId, payload) {
    const row = this._pushNotification(userId, payload);
    this._persistAll();
    return row;
  }
};

// --- registrations.js ---
const registrationMethods = {
  register(eventId, payload, { user }) {
    if (!user || user.role === "guest") {
      const error = new Error("Authentication required to register");
      error.status = 401;
      throw error;
    }

    const event = this.eventById.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }

    if (event.status !== EVENT_STATES.PUBLISHED) {
      const error = new Error("Event is not open for registration");
      error.status = 400;
      throw error;
    }

    if (new Date(event.registrationDeadline).getTime() < Date.now()) {
      const error = new Error("Registration deadline has passed");
      error.status = 400;
      throw error;
    }

    const existing = ensureArray(this.registrationsByEvent.get(eventId)).find(
      (registration) =>
        registration.userId === user.userId &&
        registration.status === REGISTRATION_STATUS.REGISTERED
    );

    if (existing) {
      const error = new Error("Already registered");
      error.status = 409;
      throw error;
    }

    const regs = ensureArray(this.registrationsByEvent.get(eventId));
    const registeredCount = regs.filter((item) => item.status === REGISTRATION_STATUS.REGISTERED).length;
    if (registeredCount >= event.maxCapacity) {
      const error = new Error("Event is full");
      error.status = 409;
      throw error;
    }

    const checkInCode = createHash("sha256")
      .update(`${eventId}:${user.userId}:${Date.now()}`)
      .digest("hex")
      .slice(0, 18);

    const registration = {
      id: randomUUID(),
      eventId,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      department: user.department,
      status: REGISTRATION_STATUS.REGISTERED,
      formResponses: ensureArray(payload.formResponses),
      registeredAt: nowIso(),
      cancelledAt: null,
      cancellationReason: null,
      checkInCode,
      checkedInAt: null,
    };

    this.registrations.push(registration);
    this._reindex();

    this._pushNotification(user.userId, {
      type: "registration_confirmation",
      title: `Registered: ${event.title}`,
      message: "Your registration is confirmed.",
      eventId,
    });

    this._persistAll();
    return registration;
  },

  cancelRegistration(eventId, { user, reason }) {
    const event = this.eventById.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }

    const registration = ensureArray(this.registrationsByEvent.get(eventId)).find(
      (item) =>
        item.userId === user.userId &&
        item.status === REGISTRATION_STATUS.REGISTERED
    );

    if (!registration) {
      const error = new Error("No active registration found");
      error.status = 404;
      throw error;
    }

    if (new Date(event.cancellationDeadline).getTime() < Date.now()) {
      const error = new Error("Cancellation deadline has passed");
      error.status = 400;
      throw error;
    }

    registration.status = REGISTRATION_STATUS.CANCELLED;
    registration.cancelledAt = nowIso();
    registration.cancellationReason = String(reason || "Cancelled by attendee");

    this._reindex();
    this._persistAll();
    return registration;
  },

  listMyRegistrations({ user }) {
    const mine = ensureArray(this.registrationsByUser.get(user.userId)).filter((item) =>
      item.status === REGISTRATION_STATUS.REGISTERED
    );

    return mine.map((registration) => {
      const event = this.eventById.get(registration.eventId);
      const eventEnd = event ? new Date(event.endAt).getTime() : 0;
      const past = eventEnd < Date.now();
      const attendanceStatus = registration.checkedInAt
        ? "Attended"
        : past
          ? "No-show"
          : "Upcoming";
      return {
        registration,
        event: event ? this._eventSummary(event, user) : null,
        attendanceStatus,
      };
    });
  },

  checkIn(eventId, { code, actor }) {
    const event = this.eventById.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }

    if (!["admin", "event_coordinator", "faculty", "department_head"].includes(actor.role)) {
      const error = new Error("Forbidden");
      error.status = 403;
      throw error;
    }

    const registration = ensureArray(this.registrationsByEvent.get(eventId)).find(
      (item) => item.checkInCode === code && item.status === REGISTRATION_STATUS.REGISTERED
    );

    if (!registration) {
      const error = new Error("Invalid check-in code");
      error.status = 404;
      throw error;
    }

    registration.checkedInAt = nowIso();
    this.checkIns.push({
      id: randomUUID(),
      eventId,
      registrationId: registration.id,
      userId: registration.userId,
      scannedByUserId: actor.userId,
      checkedInAt: registration.checkedInAt,
    });

    this._persistAll();
    return registration;
  },

  exportAttendeesCsv(eventId, { user }) {
    const event = this.eventById.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }
    this._ensureCanManageEvent(user, event);

    const registrations = ensureArray(this.registrationsByEvent.get(eventId)).filter(
      (item) => item.status === REGISTRATION_STATUS.REGISTERED
    );

    const rows = [
      toCsvRow(["Name", "Email", "User ID", "Department", "Checked In", "Registered At"]),
      ...registrations.map((item) =>
        toCsvRow([
          item.userName,
          item.userEmail,
          item.userId,
          item.department,
          item.checkedInAt ? "Yes" : "No",
          item.registeredAt,
        ])
      ),
    ];

    return rows.join("\n");
  }
};

// --- storage.js ---
const storageMethods = {
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

// --- class ---

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
