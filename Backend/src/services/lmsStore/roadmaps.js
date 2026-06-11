const {
  ROADMAP_NODE_TYPES,
  nowIso,
  randomId,
  toSafeString,
  toNullableString,
  toNullableInteger,
  ensureArray,
  parseJson,
  stringifyJson,
  assertCondition,
} = require("../lmsUtils");

module.exports = {
  createRoadmap(userId, payload) {
    const id = randomId("roadmap");
    this.db.prepare(
      `
        INSERT INTO lms_roadmaps
        (id, title, description, skill, authorId, difficulty, estimatedHours, published, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      id,
      toSafeString(payload.title),
      toNullableString(payload.description),
      toSafeString(payload.skill),
      userId,
      toNullableString(payload.difficulty),
      toNullableInteger(payload.estimatedHours),
      payload.published ? 1 : 0,
      nowIso()
    );
    return this.getRoadmap(id, userId);
  },

  getRoadmapRow(id) {
    return this.db.prepare("SELECT * FROM lms_roadmaps WHERE id = ?").get(id);
  },

  listRoadmapNodes(roadmapId) {
    return this.db
      .prepare("SELECT * FROM lms_roadmap_nodes WHERE roadmapId = ? ORDER BY position ASC")
      .all(roadmapId);
  },

  listRoadmapEdges(roadmapId) {
    return this.db.prepare("SELECT * FROM lms_roadmap_edges WHERE roadmapId = ?").all(roadmapId);
  },

  getRoadmapProgressRow(userId, roadmapId) {
    const row = this.db
      .prepare("SELECT * FROM lms_roadmap_progress WHERE userId = ? AND roadmapId = ?")
      .get(userId, roadmapId);
    return row
      ? {
          ...row,
          completedNodes: parseJson(row.completedNodes, []),
        }
      : null;
  },

  listRoadmaps({ userId = "", includeDrafts = false } = {}) {
    const rows = this.db
      .prepare(`SELECT * FROM lms_roadmaps WHERE isDeleted = 0 ${includeDrafts ? "" : "AND published = 1"} ORDER BY qualityScore DESC, createdAt DESC`)
      .all();
    return rows.map((row) => this.mapRoadmap(row, false, userId));
  },

  getRoadmap(id, userId = "", { isAdmin = false } = {}) {
    const roadmap = this.getRoadmapRow(id);
    assertCondition(roadmap, 404, "Roadmap not found", "LMS_NOT_FOUND");
    assertCondition(
      Number(roadmap.isDeleted || 0) === 0 || roadmap.authorId === userId || isAdmin,
      404,
      "Roadmap not found",
      "LMS_NOT_FOUND"
    );
    return this.mapRoadmap(roadmap, true, userId);
  },

  deleteRoadmap(id, userId, { isAdmin = false } = {}) {
    const roadmap = this.getRoadmapRow(id);
    assertCondition(roadmap, 404, "Roadmap not found", "LMS_NOT_FOUND");
    assertCondition(isAdmin || roadmap.authorId === userId, 403, "You cannot delete this roadmap", "LMS_FORBIDDEN");
    const timestamp = nowIso();
    this.db
      .prepare("UPDATE lms_roadmaps SET isDeleted = 1, deletedAt = ?, deletedBy = ?, updatedAt = ? WHERE id = ?")
      .run(timestamp, userId, timestamp, id);
    return { deleted: true, id };
  },

  addRoadmapNode(roadmapId, userId, payload) {
    const roadmap = this.getRoadmapRow(roadmapId);
    assertCondition(roadmap, 404, "Roadmap not found", "LMS_NOT_FOUND");
    assertCondition(roadmap.authorId === userId, 403, "You cannot edit this roadmap", "LMS_FORBIDDEN");
    const nodeType = toSafeString(payload.nodeType).toLowerCase();
    assertCondition(ROADMAP_NODE_TYPES.has(nodeType), 400, "Invalid nodeType", "LMS_VALIDATION");
    const row = this.db
      .prepare("SELECT COALESCE(MAX(position), 0) AS maxPosition FROM lms_roadmap_nodes WHERE roadmapId = ?")
      .get(roadmapId);
    const id = randomId("rnode");
    this.db.prepare(
      `
        INSERT INTO lms_roadmap_nodes
        (id, roadmapId, title, description, nodeType, resourceId, position, isOptional)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      id,
      roadmapId,
      toSafeString(payload.title),
      toNullableString(payload.description),
      nodeType,
      toNullableString(payload.resourceId),
      Number(row?.maxPosition || 0) + 1,
      payload.isOptional ? 1 : 0
    );
    return this.getRoadmap(roadmapId, userId);
  },

  addRoadmapEdge(roadmapId, userId, fromNodeId, toNodeId) {
    const roadmap = this.getRoadmapRow(roadmapId);
    assertCondition(roadmap, 404, "Roadmap not found", "LMS_NOT_FOUND");
    assertCondition(roadmap.authorId === userId, 403, "You cannot edit this roadmap", "LMS_FORBIDDEN");
    this.db.prepare(
      "INSERT OR IGNORE INTO lms_roadmap_edges (roadmapId, fromNodeId, toNodeId) VALUES (?, ?, ?)"
    ).run(roadmapId, fromNodeId, toNodeId);
    return this.getRoadmap(roadmapId, userId);
  },

  markRoadmapNodeComplete(roadmapId, nodeId, userId) {
    const current = this.getRoadmapProgressRow(userId, roadmapId) || {
      completedNodes: [],
      startedAt: nowIso(),
      updatedAt: nowIso(),
    };
    const completedNodes = [...new Set([...ensureArray(current.completedNodes), nodeId])];
    this.db.prepare(
      `
        INSERT INTO lms_roadmap_progress (userId, roadmapId, completedNodes, startedAt, updatedAt)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(userId, roadmapId) DO UPDATE SET completedNodes = excluded.completedNodes, updatedAt = excluded.updatedAt
      `
    ).run(userId, roadmapId, stringifyJson(completedNodes, "[]"), current.startedAt, nowIso());
    return this.getRoadmap(roadmapId, userId);
  }
};
