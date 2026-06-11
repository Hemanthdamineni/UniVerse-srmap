const { randomUUID } = require("crypto");
const { nowIso, safeJsonParse, toFiniteNumber } = require("./utils");

module.exports = {
  sendOrganizerAnnouncement(eventId, user, payload) {
    const event = this._getEventOrThrow(eventId);
    this._ensureCanManageEvent(user, event);
    this._getCompetitionConfig(event);
    const subject = String(payload?.subject || "").trim();
    const message = String(payload?.message || "").trim();
    if (!subject || !message) {
      const error = new Error("Subject and message are required.");
      error.status = 400;
      throw error;
    }
    const notifications = this.eventsStore.sendBulkMessage(eventId, { user, subject, message });
    return { sentCount: Array.isArray(notifications) ? notifications.length : 0 };
  },

  getCompetitionConfig(eventId) {
    const event = this._getEventOrThrow(eventId);
    this._syncEventRoundsFromConfig(event);
    const config = this._getCompetitionConfig(event);
    const rounds = this.db
      .prepare("SELECT * FROM rounds WHERE eventId = ? ORDER BY roundId ASC")
      .all(eventId)
      .map((row) => this._deserializeRound(row));
    return {
      ...config,
      rounds,
      maxTeamSize: Math.max(1, Math.floor(toFiniteNumber(config.maxTeamSize, 4))),
    };
  },

  getMyRole(eventId, user) {
    const event = this._getEventOrThrow(eventId);
    return this._rolePayload(event, user);
  },

  getEventRoles(eventId, user) {
    const event = this._getEventOrThrow(eventId);
    this._ensurePermission(user, event, "canManageRoles");
    return this.db
      .prepare("SELECT regNo, name, role, assignedAt, assignedBy FROM event_roles WHERE eventId = ? ORDER BY assignedAt DESC")
      .all(eventId);
  },

  assignRole(eventId, user, { regNo, role }) {
    const event = this._getEventOrThrow(eventId);
    this._ensurePermission(user, event, "canManageRoles");
    const normalizedRegNo = String(regNo || "").trim().toUpperCase();
    const normalizedRole = String(role || "").trim();
    if (!normalizedRegNo) {
      const error = new Error("Registration number is required.");
      error.status = 400;
      throw error;
    }
    if (!["co-organizer", "manager", "judge"].includes(normalizedRole)) {
      const error = new Error("Invalid event role.");
      error.status = 400;
      throw error;
    }

    const assignedAt = nowIso();
    this.db
      .prepare(
        `INSERT INTO event_roles (id, eventId, regNo, name, role, assignedBy, assignedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(eventId, regNo) DO UPDATE SET
           role = excluded.role,
           assignedBy = excluded.assignedBy,
           assignedAt = excluded.assignedAt`
      )
      .run(
        `${eventId}:${normalizedRegNo}`,
        eventId,
        normalizedRegNo,
        normalizedRegNo,
        normalizedRole,
        user.userId,
        assignedAt
      );

    return this.db
      .prepare("SELECT regNo, name, role, assignedAt, assignedBy FROM event_roles WHERE eventId = ? AND regNo = ?")
      .get(eventId, normalizedRegNo);
  },

  removeRole(eventId, user, regNo) {
    const event = this._getEventOrThrow(eventId);
    this._ensurePermission(user, event, "canManageRoles");
    const normalizedRegNo = String(regNo || "").trim().toUpperCase();
    this.db.prepare("DELETE FROM event_roles WHERE eventId = ? AND regNo = ?").run(eventId, normalizedRegNo);
    return { removed: true };
  },

  getCompetitionAnalytics(eventId, user) {
    const event = this._getEventOrThrow(eventId);
    this._ensureCanManageEvent(user, event);
    const config = this.getCompetitionConfig(eventId);
    const registrations = (this.eventsStore.registrationsByEvent.get(eventId) || []).filter(
      (item) => item.status === "registered"
    );
    const regCount = registrations.length;
    const rounds = (config.rounds || []).map((round) => {
      const submissions = this.db
        .prepare("SELECT * FROM submissions WHERE eventId = ? AND roundId = ?")
        .all(eventId, round.roundId);
      const latestKey = new Set();
      for (const submission of submissions) {
        const identity = submission.teamId || submission.submittedBy;
        const key = `${identity}:${submission.resubmissionCount}`;
        latestKey.add(key);
      }
      const submittedCount = latestKey.size;
      const evaluatedCount = submissions.filter((item) => typeof item.totalScore === "number").length;
      const evalTimes = submissions
        .filter((item) => item.evaluatedAt && item.submittedAt)
        .map((item) => Math.max(0, new Date(item.evaluatedAt).getTime() - new Date(item.submittedAt).getTime()));
      const avgTimeMs = evalTimes.length
        ? Math.round(evalTimes.reduce((sum, value) => sum + value, 0) / evalTimes.length)
        : null;
      return {
        roundId: round.roundId,
        title: round.title || round.roundId,
        submissions: submittedCount,
        submissionRate: regCount > 0 ? Number(((submittedCount / regCount) * 100).toFixed(2)) : 0,
        evaluationCompletion:
          submittedCount > 0 ? Number(((evaluatedCount / submittedCount) * 100).toFixed(2)) : 0,
        averageTimeToEvaluateMs: avgTimeMs,
      };
    });
    return {
      registrations: regCount,
      rounds,
    };
  },

  processDeadlineReminders() {
    const now = Date.now();
    const events = Array.from(this.eventsStore.eventById?.values?.() || []);
    let sent = 0;
    for (const event of events) {
      let config;
      try {
        config = this.getCompetitionConfig(event.id);
      } catch {
        continue;
      }
      const registrations = (this.eventsStore.registrationsByEvent.get(event.id) || []).filter(
        (item) => item.status === "registered"
      );
      for (const round of config.rounds || []) {
        const deadlineMs = new Date(round.submissionDeadline || "").getTime();
        if (!Number.isFinite(deadlineMs)) continue;
        const diff = deadlineMs - now;
        const windows = [
          { marker: "24h", min: 23 * 60 * 60 * 1000, max: 24 * 60 * 60 * 1000 + 5 * 60 * 1000 },
          { marker: "1h", min: 50 * 60 * 1000, max: 60 * 60 * 1000 + 5 * 60 * 1000 },
        ];
        for (const window of windows) {
          if (diff < window.min || diff > window.max) continue;
          for (const registration of registrations) {
            const userId = registration.userId;
            const already = this.db
              .prepare(
                "SELECT id FROM reminder_marks WHERE eventId = ? AND roundId = ? AND userId = ? AND marker = ?"
              )
              .get(event.id, round.roundId, userId, window.marker);
            if (already) continue;
            this.db
              .prepare(
                "INSERT INTO reminder_marks (id, eventId, roundId, userId, marker, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
              )
              .run(randomUUID(), event.id, round.roundId, userId, window.marker, nowIso());
            this.eventsStore._pushNotification(userId, {
              type: "competition_deadline_reminder",
              title: window.marker === "24h" ? "Submission deadline tomorrow" : "Submission closes in 1 hour",
              message:
                window.marker === "24h"
                  ? `Reminder: ${round.title || round.roundId} submission deadline is tomorrow.`
                  : `Final reminder: ${round.title || round.roundId} closes in 1 hour.`,
              eventId: event.id,
            });
            sent += 1;
          }
        }
      }
    }
    if (sent > 0) this.eventsStore._persistAll();
    return { sent };
  }
};
