const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { randomUUID } = require("crypto");

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

class PersistentTeamStore {
  constructor({ dbPath }) {
    this.dbPath = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });

    this.db = new DatabaseSync(this.dbPath);
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA journal_mode = WAL");
    this._ensureSchema();
  }

  _ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS persistent_teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        leaderId TEXT NOT NULL,
        members TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_persistent_teams_leader ON persistent_teams(leaderId);");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS persistent_team_invitations (
        id TEXT PRIMARY KEY,
        teamId TEXT NOT NULL,
        invitedBy TEXT NOT NULL,
        inviteeRegisterNumber TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        createdAt TEXT NOT NULL,
        UNIQUE (teamId, inviteeRegisterNumber)
      );
    `);
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_persistent_invitations_invitee ON persistent_team_invitations(inviteeRegisterNumber, status);"
    );
  }

  _normalizeRegNo(value) {
    return String(value || "").trim().toUpperCase();
  }

  _teamToJson(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      leaderRegNo: row.leaderId,
      members: safeJsonParse(row.members, []),
      createdAt: row.createdAt,
    };
  }

  _getTeamRow(teamId) {
    const row = this.db.prepare("SELECT * FROM persistent_teams WHERE id = ?").get(teamId);
    if (!row) {
      const error = new Error("Team not found");
      error.status = 404;
      throw error;
    }
    return row;
  }

  _requireTeam(teamId) {
    const row = this._getTeamRow(teamId);
    const team = this._teamToJson(row);
    const invitations = this.db
      .prepare(
        "SELECT * FROM persistent_team_invitations WHERE teamId = ? AND status = 'pending' ORDER BY createdAt ASC"
      )
      .all(team.id)
      .map((row) => this._invitationToJson(row));
    return { ...team, pendingInvitations: invitations };
  }

  _invitationToJson(row) {
    const teamRow = this.db.prepare("SELECT name FROM persistent_teams WHERE id = ?").get(row.teamId);
    return {
      id: row.id,
      teamId: row.teamId,
      teamName: teamRow?.name || "",
      inviteeRegisterNumber: row.inviteeRegisterNumber,
      inviterRegisterNumber: row.invitedBy,
      status: row.status,
      createdAt: row.createdAt,
    };
  }

  listMyTeams(userId) {
    const regNo = this._normalizeRegNo(userId);
    if (!regNo) return [];
    const rows = this.db
      .prepare("SELECT * FROM persistent_teams ORDER BY createdAt DESC")
      .all();
    return rows
      .map((row) => this._teamToJson(row))
      .filter(
        (team) =>
          team.leaderRegNo === regNo ||
          team.members.some((member) => this._normalizeRegNo(member.regNo) === regNo && member.status === "accepted")
      );
  }

  createTeam(userId, { name, inviteRegNos } = {}) {
    const leaderRegNo = this._normalizeRegNo(userId);
    if (!leaderRegNo) {
      const error = new Error("A register number is required to create a team");
      error.status = 400;
      throw error;
    }
    const teamName = String(name || "").trim();
    if (!teamName) {
      const error = new Error("Team name is required");
      error.status = 400;
      throw error;
    }

    const team = {
      id: `persistent-team-${randomUUID()}`,
      name: teamName,
      leaderRegNo,
      members: [
        {
          regNo: leaderRegNo,
          name: leaderRegNo,
          joinedAt: nowIso(),
          status: "accepted",
        },
      ],
      createdAt: nowIso(),
    };

    const insertTeam = this.db.prepare(
      "INSERT INTO persistent_teams (id, name, leaderId, members, createdAt) VALUES (?, ?, ?, ?, ?)"
    );
    insertTeam.run(
      team.id,
      team.name,
      team.leaderRegNo,
      JSON.stringify(team.members),
      team.createdAt
    );

    const invites = Array.isArray(inviteRegNos) ? inviteRegNos : [];
    for (const rawRegNo of invites) {
      this._insertInvitation(team.id, leaderRegNo, rawRegNo);
    }

    return this._requireTeam(team.id);
  }

  _insertInvitation(teamId, inviterRegNo, rawInviteeRegNo) {
    const invitee = this._normalizeRegNo(rawInviteeRegNo);
    if (!invitee || invitee === this._normalizeRegNo(inviterRegNo)) return null;

    const teamRow = this._getTeamRow(teamId);
    const members = safeJsonParse(teamRow.members, []);
    if (members.some((member) => this._normalizeRegNo(member.regNo) === invitee)) return null;

    // Re-invite replaces any prior decision so a declined/cancelled invite
    // can be sent again without unique-constraint failures.
    this.db
      .prepare("DELETE FROM persistent_team_invitations WHERE teamId = ? AND inviteeRegisterNumber = ?")
      .run(teamId, invitee);

    const invitation = {
      id: `persistent-invite-${randomUUID()}`,
      teamId,
      inviteeRegisterNumber: invitee,
      inviterRegisterNumber: this._normalizeRegNo(inviterRegNo),
      status: "pending",
      createdAt: nowIso(),
    };
    this.db
      .prepare(
        "INSERT INTO persistent_team_invitations (id, teamId, invitedBy, inviteeRegisterNumber, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(
        invitation.id,
        invitation.teamId,
        invitation.inviterRegisterNumber,
        invitation.inviteeRegisterNumber,
        invitation.status,
        invitation.createdAt
      );
    return this._invitationToJson(
      this.db.prepare("SELECT * FROM persistent_team_invitations WHERE id = ?").get(invitation.id)
    );
  }

  deleteTeam(userId, teamId) {
    const regNo = this._normalizeRegNo(userId);
    const team = this._getTeamRow(teamId);
    if (team.leaderId !== regNo) {
      const error = new Error("Only the team leader can delete the team");
      error.status = 403;
      throw error;
    }
    this.db.prepare("DELETE FROM persistent_team_invitations WHERE teamId = ?").run(team.id);
    this.db.prepare("DELETE FROM persistent_teams WHERE id = ?").run(team.id);
    return { removed: true };
  }

  inviteMembers(userId, teamId, inviteRegNos) {
    const regNo = this._normalizeRegNo(userId);
    const team = this._getTeamRow(teamId);
    if (team.leaderId !== regNo) {
      const error = new Error("Only the team leader can send invitations");
      error.status = 403;
      throw error;
    }
    const invites = Array.isArray(inviteRegNos) ? inviteRegNos : [];
    if (!invites.length) {
      const error = new Error("At least one register number is required");
      error.status = 400;
      throw error;
    }
    const created = [];
    for (const rawInvitee of invites) {
      const invitation = this._insertInvitation(team.id, regNo, rawInvitee);
      if (invitation) created.push(invitation);
    }
    return created;
  }

  cancelInvitation(userId, teamId, inviteeRegNo) {
    const regNo = this._normalizeRegNo(userId);
    const team = this._getTeamRow(teamId);
    if (team.leaderId !== regNo) {
      const error = new Error("Only the team leader can cancel invitations");
      error.status = 403;
      throw error;
    }
    const invitee = this._normalizeRegNo(inviteeRegNo);
    const result = this.db
      .prepare(
        "UPDATE persistent_team_invitations SET status = 'cancelled' WHERE teamId = ? AND inviteeRegisterNumber = ? AND status = 'pending'"
      )
      .run(team.id, invitee);
    if (result.changes === 0) {
      const error = new Error("Pending invitation not found");
      error.status = 404;
      throw error;
    }
    return { cancelled: true };
  }

  listMyInvitations(userId) {
    const regNo = this._normalizeRegNo(userId);
    if (!regNo) return [];
    const rows = this.db
      .prepare(
        "SELECT * FROM persistent_team_invitations WHERE inviteeRegisterNumber = ? AND status = 'pending' ORDER BY createdAt DESC"
      )
      .all(regNo);
    return rows.map((row) => this._invitationToJson(row));
  }

  respondToInvitation(userId, invitationId, accept) {
    const regNo = this._normalizeRegNo(userId);
    const invitation = this.db
      .prepare("SELECT * FROM persistent_team_invitations WHERE id = ?")
      .get(invitationId);
    if (!invitation || invitation.inviteeRegisterNumber !== regNo) {
      const error = new Error("Invitation not found");
      error.status = 404;
      throw error;
    }
    if (invitation.status !== "pending") {
      const error = new Error("Invitation has already been resolved");
      error.status = 400;
      throw error;
    }

    this.db
      .prepare("UPDATE persistent_team_invitations SET status = ? WHERE id = ?")
      .run(accept ? "accepted" : "declined", invitation.id);

    if (accept) {
      const teamRow = this._getTeamRow(invitation.teamId);
      const members = safeJsonParse(teamRow.members, []);
      const alreadyMember = members.some(
        (member) => this._normalizeRegNo(member.regNo) === regNo
      );
      if (!alreadyMember) {
        members.push({
          regNo,
          name: regNo,
          joinedAt: nowIso(),
          status: "accepted",
        });
        this.db
          .prepare("UPDATE persistent_teams SET members = ? WHERE id = ?")
          .run(JSON.stringify(members), teamRow.id);
      }
    }

    return { updated: true };
  }

  close() {
    this.db.close();
  }
}

function createPersistentTeamStore(args) {
  return new PersistentTeamStore(args);
}

module.exports = {
  PersistentTeamStore,
  createPersistentTeamStore,
};
