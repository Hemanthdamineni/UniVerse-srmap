const {
  nowIso,
  randomId,
  toSafeString,
  toNullableString,
  assertCondition,
  toBooleanInteger,
} = require("../lmsUtils");

module.exports = {
  createCollection(userId, name, description, isPublic) {
    const id = randomId("col");
    this.db.prepare(
      "INSERT INTO lms_collections (id, userId, name, description, isPublic, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, userId, toSafeString(name), toNullableString(description), toBooleanInteger(isPublic), nowIso());
    return this.getCollection(id, userId);
  },

  listCollections(userId) {
    return this.db
      .prepare(
        `
          SELECT *
          FROM lms_collections
          WHERE userId = ? OR isPublic = 1
          ORDER BY createdAt DESC
        `
      )
      .all(userId);
  },

  getCollection(id, userId) {
    const collection = this.db.prepare("SELECT * FROM lms_collections WHERE id = ?").get(id);
    assertCondition(collection, 404, "Collection not found", "LMS_NOT_FOUND");
    assertCondition(
      collection.userId === userId || Number(collection.isPublic || 0) === 1,
      403,
      "You cannot view this collection",
      "LMS_FORBIDDEN"
    );
    const items = this.db
      .prepare(
        `
          SELECT r.*
          FROM lms_collection_items ci
          JOIN lms_resources r ON r.id = ci.resourceId
          WHERE ci.collectionId = ?
          ORDER BY ci.addedAt DESC
        `
      )
      .all(id)
      .map((row) => this.mapResource(row));
    return { ...collection, items };
  },

  addToCollection(collectionId, resourceId, userId) {
    const collection = this.db.prepare("SELECT * FROM lms_collections WHERE id = ?").get(collectionId);
    assertCondition(collection, 404, "Collection not found", "LMS_NOT_FOUND");
    assertCondition(collection.userId === userId, 403, "You cannot modify this collection", "LMS_FORBIDDEN");
    this.db.prepare(
      "INSERT OR IGNORE INTO lms_collection_items (collectionId, resourceId, addedAt) VALUES (?, ?, ?)"
    ).run(collectionId, resourceId, nowIso());
    return this.getCollection(collectionId, userId);
  },

  removeFromCollection(collectionId, resourceId, userId) {
    const collection = this.db.prepare("SELECT * FROM lms_collections WHERE id = ?").get(collectionId);
    assertCondition(collection, 404, "Collection not found", "LMS_NOT_FOUND");
    assertCondition(collection.userId === userId, 403, "You cannot modify this collection", "LMS_FORBIDDEN");
    this.db.prepare("DELETE FROM lms_collection_items WHERE collectionId = ? AND resourceId = ?").run(
      collectionId,
      resourceId
    );
    return this.getCollection(collectionId, userId);
  }
};
