const { nowIso, toSafeString } = require("./utils");

module.exports = {
  getProfile(user) {
    this._ensureAuthenticatedUser(user);
    const row = this.db.prepare("SELECT * FROM career_profiles WHERE userId = ?").get(user.userId);
    if (!row) {
      // Return a default profile if not found
      return {
        userId: user.userId,
        skills: [],
        preferredTypes: [],
        preferredLocations: [],
        minStipend: "",
        cgpa: null,
        bio: "",
        linkedinUrl: "",
        githubUrl: "",
        portfolioUrl: "",
        resumeUrl: "",
        resumeFileName: "",
        updatedAt: nowIso()
      };
    }

    return {
      ...row,
      skills: JSON.parse(row.skills || "[]"),
      preferredTypes: JSON.parse(row.preferredTypes || "[]"),
      preferredLocations: JSON.parse(row.preferredLocations || "[]")
    };
  },

  updateProfile(user, data) {
    this._ensureAuthenticatedUser(user);
    const now = nowIso();
    const existing = this.db.prepare("SELECT 1 FROM career_profiles WHERE userId = ?").get(user.userId);

    if (existing) {
      this.db.prepare(`
        UPDATE career_profiles SET
          skills = ?,
          preferredTypes = ?,
          preferredLocations = ?,
          minStipend = ?,
          cgpa = ?,
          bio = ?,
          linkedinUrl = ?,
          githubUrl = ?,
          portfolioUrl = ?,
          updatedAt = ?
        WHERE userId = ?
      `).run(
        JSON.stringify(data.skills || []),
        JSON.stringify(data.preferredTypes || []),
        JSON.stringify(data.preferredLocations || []),
        toSafeString(data.minStipend),
        data.cgpa || null,
        toSafeString(data.bio),
        toSafeString(data.linkedinUrl),
        toSafeString(data.githubUrl),
        toSafeString(data.portfolioUrl),
        now,
        user.userId
      );
    } else {
      this.db.prepare(`
        INSERT INTO career_profiles (
          userId, skills, preferredTypes, preferredLocations, minStipend,
          cgpa, bio, linkedinUrl, githubUrl, portfolioUrl, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        user.userId,
        JSON.stringify(data.skills || []),
        JSON.stringify(data.preferredTypes || []),
        JSON.stringify(data.preferredLocations || []),
        toSafeString(data.minStipend),
        data.cgpa || null,
        toSafeString(data.bio),
        toSafeString(data.linkedinUrl),
        toSafeString(data.githubUrl),
        toSafeString(data.portfolioUrl),
        now
      );
    }

    // Recompute skill gaps after profile update
    this._recomputeSkillGaps(user.userId, data.skills || []);

    return { updated: true };
  },

  updateResume(userId, resumeUrl, resumeFileName) {
    const now = nowIso();
    const existing = this.db.prepare("SELECT 1 FROM career_profiles WHERE userId = ?").get(userId);
    
    if (existing) {
      this.db.prepare(`
        UPDATE career_profiles SET
          resumeUrl = ?,
          resumeFileName = ?,
          updatedAt = ?
        WHERE userId = ?
      `).run(resumeUrl, resumeFileName, now, userId);
    } else {
      this.db.prepare(`
        INSERT INTO career_profiles (
          userId, resumeUrl, resumeFileName, updatedAt
        ) VALUES (?, ?, ?, ?)
      `).run(userId, resumeUrl, resumeFileName, now);
    }
    return { updated: true };
  },

  getSkillGaps(user) {
    this._ensureAuthenticatedUser(user);
    const rows = this.db.prepare(`
      SELECT * FROM career_skill_gaps 
      WHERE userId = ? 
      ORDER BY opportunityCount DESC
    `).all(user.userId);
    return rows;
  },

  _recomputeSkillGaps(userId, userSkills) {
    const userSkillsSet = new Set(userSkills.map(s => s.toLowerCase()));
    const now = nowIso();
    
    // Get all skills required by active opportunities
    const opps = this.db.prepare("SELECT skills FROM career_opportunities WHERE isActive = 1").all();
    const gapMap = new Map();

    for (const opp of opps) {
      const skills = JSON.parse(opp.skills || "[]");
      for (const skill of skills) {
        const skillLower = skill.toLowerCase();
        if (!userSkillsSet.has(skillLower)) {
          gapMap.set(skillLower, (gapMap.get(skillLower) || 0) + 1);
        }
      }
    }

    // Clear old gaps
    this.db.prepare("DELETE FROM career_skill_gaps WHERE userId = ?").run(userId);

    // Insert new gaps (top 10)
    const sortedGaps = Array.from(gapMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const insert = this.db.prepare(`
      INSERT INTO career_skill_gaps (userId, skill, opportunityCount, updatedAt, gapLevel)
      VALUES (?, ?, ?, ?, 'missing')
    `);

    for (const [skill, count] of sortedGaps) {
      insert.run(userId, skill, count, now);
    }
  }
};
