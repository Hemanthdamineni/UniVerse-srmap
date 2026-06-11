const {
  QUESTION_DIFFICULTIES,
  nowIso,
  randomId,
  toSafeString,
  toNullableString,
  toInteger,
  ensureArray,
  parseJson,
  stringifyJson,
  normalizeUnit,
  assertCondition,
  clamp,
} = require("../lmsUtils");

module.exports = {
  addQuestion(userId, payload) {
    const difficulty = toSafeString(payload.difficulty).toLowerCase();
    if (difficulty) {
      assertCondition(
        QUESTION_DIFFICULTIES.has(difficulty),
        400,
        "Invalid question difficulty",
        "LMS_INVALID_DIFFICULTY"
      );
    }
    const id = randomId("qb");
    this.db.prepare(
      `
        INSERT INTO lms_question_bank
        (id, subjectCode, unit, unitNormalized, topicId, question, options, correctIndex, explanation, difficulty, contributedBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      id,
      toSafeString(payload.subjectCode).toUpperCase(),
      toNullableString(payload.unit),
      payload.unit ? normalizeUnit(payload.unit) : null,
      toNullableString(payload.topicId),
      toSafeString(payload.question),
      stringifyJson(ensureArray(payload.options), "[]"),
      clamp(toInteger(payload.correctIndex, 0), 0, Math.max(0, ensureArray(payload.options).length - 1)),
      toNullableString(payload.explanation),
      difficulty || null,
      userId,
      nowIso()
    );
    return this.getQuestionBankItem(id);
  },

  getQuestionBankItem(id) {
    const row = this.db.prepare("SELECT * FROM lms_question_bank WHERE id = ?").get(id);
    if (!row) return null;
    return { ...row, options: parseJson(row.options, []) };
  },

  getQuestionBank(subjectCode, filters = {}) {
    const params = [toSafeString(subjectCode).toUpperCase()];
    const where = ["subjectCode = ?"];
    if (filters.unit) {
      where.push("unitNormalized = ?");
      params.push(normalizeUnit(filters.unit));
    }
    if (filters.difficulty) {
      where.push("difficulty = ?");
      params.push(toSafeString(filters.difficulty).toLowerCase());
    }
    const page = Math.max(1, toInteger(filters.page, 1));
    const limit = clamp(toInteger(filters.limit, 20), 1, 50);
    params.push(limit, (page - 1) * limit);
    const rows = this.db
      .prepare(
        `SELECT * FROM lms_question_bank WHERE ${where.join(" AND ")} ORDER BY upvotes DESC, createdAt DESC LIMIT ? OFFSET ?`
      )
      .all(...params);
    return { items: rows.map((row) => ({ ...row, options: parseJson(row.options, []) })), pagination: { page, limit } };
  },

  upvoteQuestion(questionId) {
    this.db.prepare("UPDATE lms_question_bank SET upvotes = upvotes + 1 WHERE id = ?").run(questionId);
    return this.getQuestionBankItem(questionId);
  },

  buildQuizFromBank(subjectCode, unit, count = 10, difficulty = "") {
    const rows = this.getQuestionBank(subjectCode, {
      unit,
      difficulty,
      limit: count,
      page: 1,
    }).items;
    assertCondition(rows.length > 0, 404, "No questions available", "LMS_NOT_FOUND");
    return {
      questions: rows.slice(0, count),
      count: rows.slice(0, count).length,
    };
  }
};
