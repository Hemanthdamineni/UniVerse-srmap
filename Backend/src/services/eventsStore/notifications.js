const { randomUUID } = require("crypto");
const { EVENT_STATES, REGISTRATION_STATUS, ensureArray, nowIso } = require("./utils");

module.exports = {
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
