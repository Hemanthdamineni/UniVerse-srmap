const { EVENT_VISIBILITY, REGISTRATION_STATUS, ensureArray, parseDate } = require("./utils");

module.exports = {
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
