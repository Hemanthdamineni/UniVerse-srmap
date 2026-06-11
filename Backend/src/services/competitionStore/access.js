const { nowIso, normalizeRound, safeJsonParse, toFiniteNumber } = require("./utils");

module.exports = {
  _getEventOrThrow(eventId) {
    const event = this.eventsStore.eventById?.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }
    return event;
  },

  _getCompetitionConfig(event) {
    const parsed = safeJsonParse(event.competitionConfig, event.competitionConfig || {});
    if (!parsed || !parsed.isCompetition) {
      const error = new Error("Competition config not found");
      error.status = 400;
      throw error;
    }
    const rounds = Array.isArray(parsed.rounds)
      ? parsed.rounds.map(normalizeRound).filter(Boolean)
      : [];
    return { ...parsed, rounds };
  },

  _setCompetitionConfig(eventId, config) {
    const event = this._getEventOrThrow(eventId);
    event.competitionConfig = JSON.stringify(config);
    event.updatedAt = nowIso();
    this.eventsStore._persistAll();
  },

  _getRoundOrThrow(eventId, roundId) {
    const event = this._getEventOrThrow(eventId);
    this._syncEventRoundsFromConfig(event);
    this._getCompetitionConfig(event);
    const row = this.db
      .prepare("SELECT * FROM rounds WHERE eventId = ? AND roundId = ?")
      .get(eventId, roundId);
    const round = row ? this._deserializeRound(row) : null;
    if (!round) {
      const error = new Error("Round not found");
      error.status = 404;
      throw error;
    }
    return { event, round };
  },

  _ensureCanManageEvent(user, event) {
    this._ensurePermission(user, event, "canEdit");
  },

  _getStoredRole(eventId, userId) {
    return this.db
      .prepare("SELECT * FROM event_roles WHERE eventId = ? AND regNo = ?")
      .get(eventId, String(userId || "").trim().toUpperCase());
  },

  _isRegistered(eventId, userId) {
    return (this.eventsStore.registrationsByEvent.get(eventId) || []).some(
      (item) => item.userId === userId && item.status === "registered"
    );
  },

  _rolePayload(event, user) {
    const regNo = String(user?.userId || "").trim().toUpperCase();
    const coOrganizers = Array.isArray(event.coOrganizers) ? event.coOrganizers.map((item) => String(item).toUpperCase()) : [];
    const stored = this._getStoredRole(event.id, regNo);
    let role = "visitor";

    if (["admin", "event_coordinator"].includes(user?.role)) {
      role = "owner";
    } else if (String(event.createdByUserId || "").toUpperCase() === regNo) {
      role = "owner";
    } else if (coOrganizers.includes(regNo)) {
      role = "co-organizer";
    } else if (stored?.role) {
      role = String(stored.role);
    } else if (this._isRegistered(event.id, user?.userId)) {
      role = "participant";
    }

    const permissionMap = {
      owner: {
        canEdit: true,
        canEvaluate: true,
        canShortlist: true,
        canManageRoles: true,
        canViewAllSubmissions: true,
      },
      "co-organizer": {
        canEdit: true,
        canEvaluate: true,
        canShortlist: true,
        canManageRoles: false,
        canViewAllSubmissions: true,
      },
      manager: {
        canEdit: true,
        canEvaluate: false,
        canShortlist: true,
        canManageRoles: false,
        canViewAllSubmissions: true,
      },
      judge: {
        canEdit: false,
        canEvaluate: true,
        canShortlist: false,
        canManageRoles: false,
        canViewAllSubmissions: true,
      },
      participant: {
        canEdit: false,
        canEvaluate: false,
        canShortlist: false,
        canManageRoles: false,
        canViewAllSubmissions: false,
      },
      visitor: {
        canEdit: false,
        canEvaluate: false,
        canShortlist: false,
        canManageRoles: false,
        canViewAllSubmissions: false,
      },
    };

    return {
      regNo,
      role,
      permissions: permissionMap[role] || permissionMap.visitor,
    };
  },

  _ensurePermission(user, event, permission) {
    const role = this._rolePayload(event, user);
    if (!role.permissions[permission]) {
      const error = new Error("Forbidden");
      error.status = 403;
      throw error;
    }
    return role;
  },

  _ensureRegistered(eventId, userId) {
    const registration = (this.eventsStore.registrationsByEvent.get(eventId) || []).find(
      (item) => item.userId === userId && item.status === "registered"
    );
    if (!registration) {
      const error = new Error("You are not registered for this event");
      error.status = 403;
      throw error;
    }
    return registration;
  },

  _getSubmissionScope(event) {
    const config = this._getCompetitionConfig(event);
    return String(config.submissionScope || "individual");
  },

  _getMaxTeamSize(event) {
    const config = this._getCompetitionConfig(event);
    return Math.max(1, Math.floor(toFiniteNumber(config.maxTeamSize, 4)));
  },

  _requireTeamScopedEvent(event) {
    if (this._getSubmissionScope(event) !== "team") {
      const error = new Error("This competition does not support team submissions");
      error.status = 400;
      throw error;
    }
  }
};
