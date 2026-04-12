const rateLimit = require("express-rate-limit");

function keyUserOrIp(req) {
  return String(req.userContext?.userId || req.ip || "anon");
}

/** Manual opportunity submissions — per authenticated user. */
function createCareerSubmitLimiter() {
  return rateLimit({
    windowMs: Number(process.env.CAREER_SUBMIT_WINDOW_MS || 60 * 60 * 1000),
    max: Number(process.env.CAREER_SUBMIT_MAX_PER_WINDOW || 20),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `career:submit:${keyUserOrIp(req)}`,
    message: { success: false, error: { code: "RATE_LIMITED", message: "Too many submissions. Try again later." } },
  });
}

/** Approve / moderation actions. */
function createCareerReviewLimiter() {
  return rateLimit({
    windowMs: Number(process.env.CAREER_REVIEW_WINDOW_MS || 60 * 1000),
    max: Number(process.env.CAREER_REVIEW_MAX_PER_WINDOW || 60),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `career:review:${keyUserOrIp(req)}`,
    message: { success: false, error: { code: "RATE_LIMITED", message: "Too many review actions. Slow down." } },
  });
}

/** Pending queue listing (moderators). */
function createCareerPendingListLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.CAREER_PENDING_LIST_MAX_PER_MIN || 40),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `career:pending:${keyUserOrIp(req)}`,
    message: { success: false, error: { code: "RATE_LIMITED", message: "Too many list requests." } },
  });
}

module.exports = {
  createCareerSubmitLimiter,
  createCareerReviewLimiter,
  createCareerPendingListLimiter,
};
