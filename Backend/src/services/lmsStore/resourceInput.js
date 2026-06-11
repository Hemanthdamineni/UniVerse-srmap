const {
  RESOURCE_TYPES,
  DIFFICULTY_LEVELS,
  EXAM_TYPES,
  toSafeString,
  toNullableString,
  toNullableInteger,
  stringifyJson,
  normalizeUnit,
  normalizeTagList,
  assertCondition,
  toBooleanInteger,
} = require("../lmsUtils");

function normalizeTitle(value) {
  return toSafeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  checkDuplicate({ fileHash = "", title = "", subjectCode = "", excludeId = "" }) {
    const exact = fileHash
      ? this.db
          .prepare(
            `
              SELECT id, title, subjectCode, uploadedBy, uploadedAt
              FROM lms_resources
              WHERE fileHash = ? AND isDeleted = 0 AND (? = '' OR id != ?)
              LIMIT 1
            `
          )
          .get(fileHash, excludeId, excludeId)
      : null;

    const normalized = normalizeTitle(title);
    const similar = normalized
      ? this.db
          .prepare(
            `
              SELECT id, title, subjectCode, uploadedBy, uploadedAt
              FROM lms_resources
              WHERE lower(title) = ? AND subjectCode = ? AND isDeleted = 0 AND (? = '' OR id != ?)
              ORDER BY uploadedAt DESC
              LIMIT 5
            `
          )
          .all(normalized, subjectCode, excludeId, excludeId)
      : [];

    return {
      exact: exact || null,
      similar,
      hasDuplicate: Boolean(exact) || similar.length > 0,
    };
  },

  normalizeResourceInput(payload) {
    const type = toSafeString(payload.type).toLowerCase();
    assertCondition(RESOURCE_TYPES.has(type), 400, "Invalid resource type", "LMS_INVALID_TYPE");
    const difficulty = toSafeString(payload.difficulty).toLowerCase();
    if (difficulty) {
      assertCondition(
        DIFFICULTY_LEVELS.has(difficulty),
        400,
        "Invalid difficulty",
        "LMS_INVALID_DIFFICULTY"
      );
    }
    const examType = toSafeString(payload.examType).toLowerCase();
    if (examType) {
      assertCondition(EXAM_TYPES.has(examType), 400, "Invalid exam type", "LMS_INVALID_EXAM_TYPE");
    }

    return {
      type,
      title: toSafeString(payload.title),
      description: toNullableString(payload.description),
      difficulty: difficulty || null,
      semester: toSafeString(payload.semester),
      subjectCode: toSafeString(payload.subjectCode).toUpperCase(),
      subjectName: toSafeString(payload.subjectName),
      unit: toSafeString(payload.unit),
      unitNormalized: normalizeUnit(payload.unit),
      tags: normalizeTagList(payload.tags),
      url: toNullableString(payload.url),
      filePath: toNullableString(payload.filePath),
      fileSize: toNullableInteger(payload.fileSize),
      fileHash: toNullableString(payload.fileHash),
      mimeType: toNullableString(payload.mimeType),
      noteContent: toNullableString(payload.noteContent),
      structuredContent: payload.structuredContent === undefined || payload.structuredContent === null
        ? null
        : typeof payload.structuredContent === "string"
          ? payload.structuredContent
          : stringifyJson(payload.structuredContent, "{}"),
      examYear: toNullableString(payload.examYear),
      examType: examType || null,
      examMonth: toNullableString(payload.examMonth),
      exportable: payload.exportable === undefined ? 1 : toBooleanInteger(Boolean(payload.exportable)),
      validForSemester: toNullableString(payload.validForSemester),
      estimatedMinutes: toNullableInteger(payload.estimatedMinutes),
      renderType: toNullableString(payload.renderType),
    };
  },
};
