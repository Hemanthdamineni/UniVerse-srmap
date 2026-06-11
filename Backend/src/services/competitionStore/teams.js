const { randomUUID } = require("crypto");
const { nowIso, safeJsonParse } = require("./utils");

module.exports = {
  _hydrateTeam(row) {
    return row
      ? {
          ...row,
          members: Array.isArray(row.members) ? row.members : safeJsonParse(row.members, []),
        }
      : null;
  },

  getMyTeam(eventId, userId) {
    const event = this._getEventOrThrow(eventId);
    this._requireTeamScopedEvent(event);
    const row = this.db
      .prepare(
        `SELECT t.*
         FROM teams t, json_each(t.members) m
         WHERE t.eventId = ? AND m.value = ?
         LIMIT 1`
      )
      .get(eventId, userId);
    return this._hydrateTeam(row);
  },

  createTeam(eventId, userId, { name }) {
    const event = this._getEventOrThrow(eventId);
    this._requireTeamScopedEvent(event);
    this._ensureRegistered(eventId, userId);
    const trimmedName = String(name || "").trim();
    if (!trimmedName || trimmedName.length > 100) {
      const error = new Error("Team name must be between 1 and 100 characters");
      error.status = 400;
      throw error;
    }
    if (this.getMyTeam(eventId, userId)) {
      const error = new Error("You are already in a team for this event");
      error.status = 409;
      throw error;
    }
    const team = {
      id: randomUUID(),
      eventId,
      name: trimmedName,
      leaderId: userId,
      members: [userId],
      createdAt: nowIso(),
    };
    this.db
      .prepare("INSERT INTO teams (id, eventId, name, leaderId, members, createdAt) VALUES (?, ?, ?, ?, ?, ?)")
      .run(team.id, team.eventId, team.name, team.leaderId, JSON.stringify(team.members), team.createdAt);
    return team;
  },

  inviteMember(eventId, teamId, leaderId, { inviteeRegisterNumber }) {
    const event = this._getEventOrThrow(eventId);
    this._requireTeamScopedEvent(event);
    const team = this._hydrateTeam(
      this.db.prepare("SELECT * FROM teams WHERE id = ? AND eventId = ?").get(teamId, eventId)
    );
    if (!team) {
      const error = new Error("Team not found");
      error.status = 404;
      throw error;
    }
    if (team.leaderId !== leaderId) {
      const error = new Error("Only the team leader can send invitations");
      error.status = 403;
      throw error;
    }
    const invitee = String(inviteeRegisterNumber || "").trim();
    if (!invitee) {
      const error = new Error("Invitee register number is required");
      error.status = 400;
      throw error;
    }
    const registration = (this.eventsStore.registrationsByEvent.get(eventId) || []).find(
      (item) => item.userId === invitee && item.status === "registered"
    );
    if (!registration) {
      const error = new Error("Invitee is not registered for this event");
      error.status = 404;
      throw error;
    }
    if (this.getMyTeam(eventId, invitee)) {
      const error = new Error("Invitee is already in a team for this event");
      error.status = 409;
      throw error;
    }
    if (team.members.length >= this._getMaxTeamSize(event)) {
      const error = new Error("Team is already at maximum size");
      error.status = 409;
      throw error;
    }
    const invitation = {
      id: randomUUID(),
      teamId: team.id,
      eventId,
      invitedBy: leaderId,
      inviteeRegisterNumber: invitee,
      status: "pending",
      createdAt: nowIso(),
    };
    try {
      this.db
        .prepare(
          "INSERT INTO team_invitations (id, teamId, eventId, invitedBy, inviteeRegisterNumber, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          invitation.id,
          invitation.teamId,
          invitation.eventId,
          invitation.invitedBy,
          invitation.inviteeRegisterNumber,
          invitation.status,
          invitation.createdAt
        );
    } catch {
      const error = new Error("Invitation already sent to this participant");
      error.status = 409;
      throw error;
    }
    this.eventsStore._pushNotification(invitee, {
      type: "team_invitation",
      title: "Team invitation",
      message: `You have been invited to join team ${team.name} for ${event.title}.`,
      eventId,
    });
    this.eventsStore._persistAll();
    return invitation;
  },

  cancelInvitation(eventId, teamId, leaderId, inviteeRegisterNumber) {
    const team = this._hydrateTeam(
      this.db.prepare("SELECT * FROM teams WHERE id = ? AND eventId = ?").get(teamId, eventId)
    );
    if (!team) {
      const error = new Error("Team not found");
      error.status = 404;
      throw error;
    }
    if (team.leaderId !== leaderId) {
      const error = new Error("Only the team leader can cancel invitations");
      error.status = 403;
      throw error;
    }
    this.db
      .prepare(
        "UPDATE team_invitations SET status = 'cancelled' WHERE teamId = ? AND eventId = ? AND inviteeRegisterNumber = ? AND status = 'pending'"
      )
      .run(teamId, eventId, String(inviteeRegisterNumber || ""));
    return { cancelled: true };
  },

  acceptInvitation(eventId, invitationId, userId) {
    const invitation = this.db
      .prepare("SELECT * FROM team_invitations WHERE id = ? AND eventId = ?")
      .get(invitationId, eventId);
    if (!invitation || invitation.inviteeRegisterNumber !== userId) {
      const error = new Error("Invitation not found");
      error.status = 404;
      throw error;
    }
    if (invitation.status !== "pending") {
      const error = new Error("Invitation is no longer pending");
      error.status = 409;
      throw error;
    }
    if (this.getMyTeam(eventId, userId)) {
      const error = new Error("You are already in a team for this event");
      error.status = 409;
      throw error;
    }
    const team = this._hydrateTeam(this.db.prepare("SELECT * FROM teams WHERE id = ?").get(invitation.teamId));
    if (!team) {
      const error = new Error("Team not found");
      error.status = 404;
      throw error;
    }
    const event = this._getEventOrThrow(eventId);
    if (team.members.length >= this._getMaxTeamSize(event)) {
      const error = new Error("Team is already at maximum size");
      error.status = 409;
      throw error;
    }
    const members = Array.from(new Set([...team.members, userId]));
    this.db.prepare("UPDATE team_invitations SET status = 'accepted' WHERE id = ?").run(invitationId);
    this.db.prepare("UPDATE teams SET members = ? WHERE id = ?").run(JSON.stringify(members), team.id);
    this.eventsStore._pushNotification(team.leaderId, {
      type: "team_member_joined",
      title: "Member joined team",
      message: `${userId} has joined your team ${team.name}.`,
      eventId,
    });
    this.eventsStore._persistAll();
    return { accepted: true };
  },

  declineInvitation(eventId, invitationId, userId) {
    const invitation = this.db
      .prepare("SELECT * FROM team_invitations WHERE id = ? AND eventId = ?")
      .get(invitationId, eventId);
    if (!invitation || invitation.inviteeRegisterNumber !== userId) {
      const error = new Error("Invitation not found");
      error.status = 404;
      throw error;
    }
    if (invitation.status !== "pending") {
      const error = new Error("Invitation is no longer pending");
      error.status = 409;
      throw error;
    }
    this.db.prepare("UPDATE team_invitations SET status = 'declined' WHERE id = ?").run(invitationId);
    return { declined: true };
  },

  transferLeadership(eventId, teamId, currentLeaderId, newLeaderId) {
    const event = this._getEventOrThrow(eventId);
    const team = this._hydrateTeam(
      this.db.prepare("SELECT * FROM teams WHERE id = ? AND eventId = ?").get(teamId, eventId)
    );
    if (!team) {
      const error = new Error("Team not found");
      error.status = 404;
      throw error;
    }
    if (team.leaderId !== currentLeaderId) {
      const error = new Error("Only the team leader can transfer leadership");
      error.status = 403;
      throw error;
    }
    if (!team.members.includes(newLeaderId)) {
      const error = new Error("New leader must already be a team member");
      error.status = 400;
      throw error;
    }
    this.db.prepare("UPDATE teams SET leaderId = ? WHERE id = ?").run(newLeaderId, team.id);
    this.eventsStore._pushNotification(newLeaderId, {
      type: "team_leader_transfer",
      title: "Leadership transferred",
      message: `You are now the leader of team ${team.name} for ${event.title}.`,
      eventId,
    });
    this.eventsStore._persistAll();
    return { transferred: true };
  },

  leaveTeam(eventId, userId) {
    const team = this.getMyTeam(eventId, userId);
    if (!team) {
      const error = new Error("You are not in a team for this event");
      error.status = 404;
      throw error;
    }
    if (team.leaderId === userId) {
      const error = new Error("Team leader cannot leave without transferring leadership first");
      error.status = 403;
      throw error;
    }
    const hasSubmission = this.db
      .prepare("SELECT id FROM submissions WHERE eventId = ? AND teamId = ? LIMIT 1")
      .get(eventId, team.id);
    if (hasSubmission) {
      const error = new Error("Cannot leave team after a submission has been made");
      error.status = 409;
      throw error;
    }
    const members = team.members.filter((item) => item !== userId);
    this.db.prepare("UPDATE teams SET members = ? WHERE id = ?").run(JSON.stringify(members), team.id);
    return { left: true };
  },

  deleteTeam(eventId, teamId, leaderId) {
    const team = this._hydrateTeam(
      this.db.prepare("SELECT * FROM teams WHERE id = ? AND eventId = ?").get(teamId, eventId)
    );
    if (!team) {
      const error = new Error("Team not found");
      error.status = 404;
      throw error;
    }
    if (team.leaderId !== leaderId) {
      const error = new Error("Only the team leader can delete the team");
      error.status = 403;
      throw error;
    }
    const hasSubmission = this.db
      .prepare("SELECT id FROM submissions WHERE eventId = ? AND teamId = ? LIMIT 1")
      .get(eventId, team.id);
    if (hasSubmission) {
      const error = new Error("Cannot delete team after a submission has been made");
      error.status = 409;
      throw error;
    }
    this.db.prepare("DELETE FROM team_invitations WHERE teamId = ?").run(team.id);
    this.db.prepare("DELETE FROM teams WHERE id = ?").run(team.id);
    return { deleted: true };
  },

  getMyInvitations(eventId, userId) {
    const rows = this.db
      .prepare(
        `SELECT ti.*, t.name AS teamName
         FROM team_invitations ti
         JOIN teams t ON t.id = ti.teamId
         WHERE ti.eventId = ? AND ti.inviteeRegisterNumber = ? AND ti.status = 'pending'`
      )
      .all(eventId, userId);
    return rows;
  }
};
