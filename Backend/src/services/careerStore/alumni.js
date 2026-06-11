const { randomUUID } = require("crypto");
const { nowIso } = require("./utils");

module.exports = {
  listAlumni({ user, query = "", batch = "" }) {
    this._ensureAuthenticatedUser(user);
    let sql = `
      SELECT * FROM career_alumni 
      WHERE 1=1
    `;
    const params = [];

    if (query) {
      sql += " AND (name LIKE ? OR company LIKE ? OR position LIKE ?)";
      const likeQuery = `%${query}%`;
      params.push(likeQuery, likeQuery, likeQuery);
    }

    if (batch) {
      sql += " AND batch = ?";
      params.push(batch);
    }

    sql += " ORDER BY name";

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(row => ({
      ...row,
      skills: JSON.parse(row.skills || "[]"),
    }));
  },

  createAlumni(data, user) {
    this._ensureAuthenticatedUser(user);
    const id = randomUUID();
    const now = nowIso();
    
    this.db.prepare(`
      INSERT INTO career_alumni (
        id, userId, name, email, batch, branch, company, position, location,
        linkedinUrl, bio, skills, isAvailableForMentoring, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      user.userId,
      data.name || "",
      data.email || "",
      data.batch || "",
      data.branch || "",
      data.company || "",
      data.position || "",
      data.location || "",
      data.linkedinUrl || "",
      data.bio || "",
      JSON.stringify(data.skills || []),
      data.isAvailableForMentoring ? 1 : 0,
      now,
      now
    );

    return { id, ...data, createdAt: now, updatedAt: now };
  },

  updateAlumni(id, data, user) {
    this._ensureAuthenticatedUser(user);
    const now = nowIso();
    
    this.db.prepare(`
      UPDATE career_alumni SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        batch = COALESCE(?, batch),
        branch = COALESCE(?, branch),
        company = COALESCE(?, company),
        position = COALESCE(?, position),
        location = COALESCE(?, location),
        linkedinUrl = COALESCE(?, linkedinUrl),
        bio = COALESCE(?, bio),
        skills = COALESCE(?, skills),
        isAvailableForMentoring = COALESCE(?, isAvailableForMentoring),
        updatedAt = ?
      WHERE id = ? AND userId = ?
    `).run(
      data.name,
      data.email,
      data.batch,
      data.branch,
      data.company,
      data.position,
      data.location,
      data.linkedinUrl,
      data.bio,
      data.skills ? JSON.stringify(data.skills) : null,
      data.isAvailableForMentoring !== undefined ? (data.isAvailableForMentoring ? 1 : 0) : null,
      now,
      id,
      user.userId
    );

    return { updated: true };
  },

  deleteAlumni(id, user) {
    this._ensureAuthenticatedUser(user);
    this.db.prepare("DELETE FROM career_alumni WHERE id = ? AND userId = ?").run(id, user.userId);
    return { deleted: true };
  },

  requestAlumniConnection(alumniId, data, user) {
    this._ensureAuthenticatedUser(user);
    // For now, just return success. In a real implementation, this would send a notification
    // or create a connection request record
    return { requested: true };
  }
};
