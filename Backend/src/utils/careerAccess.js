const { CAREER_SUBMISSION_REVIEW_ROLES } = require("../config/env");

/**
 * Roles allowed to list pending manual submissions and approve/reject them.
 * Comma-separated env CAREER_SUBMISSION_REVIEW_ROLES overrides defaults.
 */
function parseReviewRoles() {
  return String(CAREER_SUBMISSION_REVIEW_ROLES || "")
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
}

const DEFAULT_REVIEW_ROLES = new Set(["admin", "faculty", "event_coordinator", "department_head"]);

function canModerateCareerSubmissions(userContext) {
  if (!userContext) return false;
  if (userContext.hasAdminAccess) return true;
  const role = String(userContext.role || "").toLowerCase();
  const custom = parseReviewRoles();
  if (custom.length) {
    return custom.includes(role);
  }
  return DEFAULT_REVIEW_ROLES.has(role);
}

module.exports = {
  canModerateCareerSubmissions,
  parseReviewRoles,
};
