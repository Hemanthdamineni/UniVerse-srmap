const { randomUUID } = require("crypto");
const { EVENT_STATES, REGISTRATION_STATUS, nowIso } = require("./utils");

module.exports = {
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
