const fs = require("fs");
const path = require("path");

const TEMPLATE_FILE = path.join(__dirname, "../data/feedbackTemplates.json");

function readFeedbackTemplates() {
  try {
    const raw = fs.readFileSync(TEMPLATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => String(entry || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function validateFeedbackComment(value) {
  const comment = String(value || "").replace(/\s+/g, " ").trim();
  if (comment.length <= 10) {
    const error = new Error("Comment must be more than 10 characters.");
    error.status = 400;
    error.code = "INVALID_COMMENT";
    throw error;
  }

  if (comment.length > 500) {
    const error = new Error("Comment must be less than 500 characters.");
    error.status = 400;
    error.code = "INVALID_COMMENT";
    throw error;
  }

  return comment;
}

function getRandomFeedbackTemplate() {
  const templates = readFeedbackTemplates();
  if (!templates.length) return "";
  const index = Math.floor(Math.random() * templates.length);
  return templates[index] || "";
}

module.exports = {
  readFeedbackTemplates,
  validateFeedbackComment,
  getRandomFeedbackTemplate,
};
