const { randomUUID, createHash } = require("crypto");
const { EVENT_STATES, REGISTRATION_STATUS, ensureArray, nowIso, toCsvRow } = require("./utils");

module.exports = {
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
