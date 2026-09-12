const express = require("express");
const path = require("path");
const multer = require("multer");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");
const { createUserContextMiddleware } = require("../utils/eventsAuth");
const { resolveSessionId } = require("../utils/cookies");
const { createCareerCache } = require("../services/career/careerServices");
const { rankOpportunities, studentSliceFromGraph } = require("../services/career/opportunityFit");
const electiveGuidance = require("../services/career/electiveGuidance");
const { canonicalizeSkills } = require("../utils/skillNames");
const { extractResumeText } = require("../services/career/resumeText");

const RESUME_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const RESUME_ACCEPTED_EXTENSIONS = new Set([".pdf", ".docx", ".txt", ".md"]);

function createCareerRoutes({ careerStore, sessionStore, adminPassword = "", lmsTrackerService = null, studentGraphService = null, redisClient = null, scraperSupervisorStatus = null, scraperTriggerOnce = null }) {
  const router = express.Router();
  const userContext = createUserContextMiddleware({ sessionStore, adminPassword });
  // Redis-backed read-through cache for global career reads; degrades to a
  // no-op pass-through when Redis is unavailable.
  const careerCache = createCareerCache(redisClient);
  router.use(userContext);

  // Résumé uploads: held in memory, text extracted server-side (see resumeText.js).
  const resumeUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: RESUME_UPLOAD_MAX_BYTES },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      if (!RESUME_ACCEPTED_EXTENSIONS.has(ext)) {
        const error = new Error(`Unsupported résumé file type${ext ? ` (${ext})` : ""}.`);
        error.status = 400;
        error.code = "RESUME_INVALID_FILE";
        return cb(error);
      }
      return cb(null, true);
    },
  });

  function receiveResumeUpload(req, res, next) {
    resumeUpload.single("file")(req, res, (error) => {
      if (!error) return next();
      if (error.code === "LIMIT_FILE_SIZE") {
        error.status = 413;
        error.message = "Résumé must be 5 MB or smaller.";
      } else if (!error.status) {
        error.status = 400;
      }
      return sendApiError(res, req, error);
    });
  }

  function ensureAuthenticated(req, res, next) {
    if (!req.userContext || !req.userContext.isAuthenticated) {
      const error = new Error("Authentication required. Please sign in.");
      error.status = 401;
      return sendApiError(res, req, error);
    }
    return next();
  }

  function ensureCareerAdmin(req) {
    if (!req.userContext?.hasAdminAccess) {
      const error = new Error("Admin access required.");
      error.status = 403;
      throw error;
    }
  }

  function wrap(handler) {
    return (req, res) => {
      try {
        const data = handler(req, res);
        if (!res.headersSent) {
          return sendApiSuccess(res, req, data);
        }
        return undefined;
      } catch (error) {
        return sendApiError(res, req, error);
      }
    };
  }

  function wrapAsync(handler) {
    return (req, res) => {
      Promise.resolve()
        .then(() => handler(req, res))
        .then((data) => {
          if (!res.headersSent) {
            return sendApiSuccess(res, req, data);
          }
          return undefined;
        })
        .catch((error) => sendApiError(res, req, error));
    };
  }

  function toPositiveInt(value, fallback, max = 100) {
    const parsed = Number.parseInt(String(value || ""), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
  }

  function normalizeSkills(skills) {
    if (!Array.isArray(skills)) return [];
    const raw = skills.map((skill) => {
      if (typeof skill === "string") return skill.trim();
      if (skill && typeof skill === "object") return String(skill.name || "").trim();
      return "";
    });
    // Canonical display form + case-insensitive de-dupe (AWS, Node.js, C, ...).
    return canonicalizeSkills(raw);
  }

  function normalizeProfilePayload(data = {}) {
    return {
      ...data,
      bio: data.bio ?? data.summary ?? "",
      skills: normalizeSkills(data.skills),
      preferredTypes: Array.isArray(data.preferredTypes) ? data.preferredTypes : [],
      preferredLocations: Array.isArray(data.preferredLocations) ? data.preferredLocations : [],
    };
  }

  function parseJsonArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function decorateOpportunity(opportunity) {
    if (!opportunity || typeof opportunity !== "object") return opportunity;
    const organization = opportunity.organization || opportunity.company || opportunity.organizer || "";
    return {
      ...opportunity,
      organization,
      link: opportunity.link || opportunity.applyUrl || opportunity.sourceUrl || "",
      saved: Boolean(opportunity.saved ?? opportunity.isBookmarked),
      applied: Boolean(opportunity.applied ?? opportunity.hasApplied),
      isBookmarked: Boolean(opportunity.isBookmarked),
      hasApplied: Boolean(opportunity.hasApplied),
      isPanIndia: Boolean(opportunity.isPanIndia),
      isFree: Boolean(opportunity.isFree),
      isActive: Boolean(opportunity.isActive),
      isVerified: Boolean(opportunity.isVerified),
      isFeatured: Boolean(opportunity.isFeatured ?? opportunity.featured),
    };
  }

  function decorateSubmission(submission) {
    if (!submission || typeof submission !== "object") return submission;
    return {
      ...submission,
      skills: parseJsonArray(submission.skills),
      tags: parseJsonArray(submission.tags),
      eligibleBranches: parseJsonArray(submission.eligibleBranches),
      eligibleYears: parseJsonArray(submission.eligibleYears),
    };
  }

  router.use(ensureAuthenticated);

  router.get("/career/permissions", wrap((req) => ({
    canModerateSubmissions: Boolean(req.userContext.hasAdminAccess),
  })));

  router.get("/career/trending", wrap((req) => ({
    items: careerStore
      .getTrendingOpportunities(req.userContext, toPositiveInt(req.query.limit, 12, 50))
      .map(decorateOpportunity),
  })));

  router.get("/career/deadline-soon", wrap((req) => ({
    items: careerStore
      .getDeadlineSoonBookmarked(req.userContext, toPositiveInt(req.query.days, 3, 30))
      .map(decorateOpportunity),
  })));

  router.get("/career/feed", wrap((req) => ({
    items: careerStore
      .getOpportunities({
        user: req.userContext,
        sort: "relevance",
        page: req.query.page,
        limit: req.query.limit || 24,
      })
      .map(decorateOpportunity),
  })));

  if (lmsTrackerService) {
    router.get("/career/insights/unified", wrapAsync((req) =>
      lmsTrackerService.getUnifiedInsights({
        sessionId: resolveSessionId(req),
        user: req.userContext,
      })
    ));
  }

  router.get("/career/health", wrap(() => ({
    sources: careerStore.getScraperHealth(),
    recentRuns: careerStore.getScraperRuns(10),
  })));

  // Admin-only: full scraper pipeline status (runs, breaker state, DB counts).
  router.get("/career/scraper-status", wrap((req) => {
    ensureCareerAdmin(req);
    return {
      ...careerStore.getScraperStatus(),
      supervisor: typeof scraperSupervisorStatus === "function" ? scraperSupervisorStatus() : null,
    };
  }));

  // Admin-only: request an immediate scrape run. When the scheduler daemon
  // is alive it picks up a flag file within ~1s; otherwise a one-shot
  // `main.py --once` process is spawned.
  router.post("/career/scraper-trigger", wrap((req) => {
    ensureCareerAdmin(req);
    if (typeof scraperTriggerOnce !== "function") {
      const error = new Error("Scraper trigger is not available.");
      error.status = 503;
      throw error;
    }
    return { trigger: scraperTriggerOnce() };
  }));

  router.get("/career/stats", wrapAsync(async () => {
    const cached = await careerCache.getJson("stats");
    if (cached) return cached;
    const stats = await careerStore.getCareerStats();
    await careerCache.setJson("stats", stats);
    return stats;
  }));

  router.get("/career/opportunities", wrap((req) => {
    const baseOptions = {
      user: req.userContext,
      type: req.query.type,
      skills: req.query.skills,
      location: req.query.location,
      mode: req.query.mode,
      query: req.query.query,
      isFree: req.query.isFree,
      hasStipend: req.query.hasStipend,
      expiringWithinDays: req.query.expiringWithinDays,
      bookmarkedOnly: req.query.bookmarkedOnly === "true",
    };

    // sort=fit — rank against the student graph (B7 / T4.2.1–3). Falls back to
    // the plain relevance sort when the graph service isn't wired.
    if (req.query.sort === "fit" && studentGraphService) {
      const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
      const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit || "24"), 10) || 24));
      // Score a wide candidate window so the top of the ranked list is stable
      // across pages without re-scoring the whole catalogue.
      const CANDIDATE_WINDOW = 400;
      const candidates = careerStore.getOpportunities({
        ...baseOptions,
        sort: "relevance",
        page: 1,
        limit: CANDIDATE_WINDOW,
      });
      let student;
      try {
        student = studentSliceFromGraph(studentGraphService.getGraph(req.userContext));
      } catch {
        student = {};
      }
      const ranked = rankOpportunities(candidates, student, { includeIneligible: false });
      const start = (page - 1) * limit;
      const slice = ranked.slice(start, start + limit);
      return {
        items: slice.map((o) => ({ ...decorateOpportunity(o), fit: o.fit })),
        page,
        limit,
        hasMore: start + limit < ranked.length,
        rankedTotal: ranked.length,
      };
    }

    const { items, page, limit, hasMore } = careerStore.getOpportunitiesPage({
      ...baseOptions,
      sort: req.query.sort,
      page: req.query.page,
      limit: req.query.limit,
    });

    return { items: items.map(decorateOpportunity), page, limit, hasMore };
  }));

  router.post("/career/opportunities", wrap((req) => {
    const opportunity = decorateOpportunity(careerStore.createOpportunity(req.body || {}, req.userContext));
    void careerCache.invalidateCommon();
    return opportunity;
  }));

  router.get("/career/opportunities/:id/fit", wrap((req) =>
    careerStore.getOpportunityFit(req.userContext, req.params.id, {
      resumeVersionId: req.query.resumeVersionId,
    })
  ));

  router.get("/career/opportunities/:id", wrap((req) => {
    const opportunity = careerStore.getOpportunity(req.params.id, req.userContext);
    if (!opportunity) {
      const error = new Error("Opportunity not found");
      error.status = 404;
      throw error;
    }
    return decorateOpportunity(opportunity);
  }));

  router.put("/career/opportunities/:id", wrap((req) => {
    const updated = careerStore.updateOpportunity(req.params.id, req.body || {}, req.userContext);
    void careerCache.invalidateCommon();
    return updated;
  }));

  router.delete("/career/opportunities/:id", wrap((req) => {
    const removed = careerStore.deleteOpportunity(req.params.id, req.userContext);
    void careerCache.invalidateCommon();
    return removed;
  }));

  router.post("/career/opportunities/:id/save", wrap((req) =>
    careerStore.saveOpportunity(req.params.id, req.userContext)
  ));

  router.delete("/career/opportunities/:id/save", wrap((req) =>
    careerStore.unsaveOpportunity(req.params.id, req.userContext)
  ));

  router.post("/career/opportunities/:id/bookmark", wrap((req) =>
    careerStore.bookmarkOpportunity(req.params.id, req.userContext.userId)
  ));

  router.post("/career/opportunities/:id/dismiss", wrap((req) =>
    careerStore.dismissOpportunity(req.params.id, req.userContext.userId)
  ));

  router.post("/career/opportunities/:id/view", wrap((req) =>
    careerStore.trackView(req.params.id, req.userContext.userId)
  ));

  router.post("/career/opportunities/:id/apply", wrap((req) =>
    careerStore.trackApply(req.params.id, req.userContext.userId, req.body?.notes)
  ));

  router.post("/career/opportunities/:id/flag", wrap((req) =>
    careerStore.flagOpportunity(
      req.params.id,
      req.userContext.userId,
      req.body?.reason || "No reason provided"
    )
  ));

  router.get("/career/profile/skill-gaps", wrap((req) => ({
    items: careerStore.getSkillGaps(req.userContext),
  })));

  router.get("/career/resumes", wrap((req) => ({
    items: careerStore.listResumeVersions(req.userContext),
  })));

  // Accepts either a multipart file upload (`file`) — text is extracted from the
  // bytes here — or a JSON body carrying `extractedText` directly (text paste,
  // static-prototype, tests).
  router.post(
    "/career/resumes",
    receiveResumeUpload,
    wrapAsync(async (req) => {
      if (req.file) {
        const { text } = await extractResumeText(req.file.buffer, {
          mimeType: req.file.mimetype,
          fileName: req.file.originalname,
        });
        return careerStore.createResumeVersion(req.userContext, {
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
          extractedText: text,
        });
      }
      return careerStore.createResumeVersion(req.userContext, req.body || {});
    }),
  );

  router.delete("/career/resumes/:resumeVersionId", wrap((req) =>
    careerStore.deleteResumeVersion(req.userContext, req.params.resumeVersionId)
  ));

  router.get("/career/resumes/:resumeVersionId/analysis", wrap((req) =>
    careerStore.analyzeResumeVersion(req.userContext, req.params.resumeVersionId)
  ));

  router.post("/career/resumes/:resumeVersionId/merge-to-profile", wrap((req) =>
    careerStore.mergeResumeToProfile(req.userContext, req.params.resumeVersionId)
  ));

  router.post("/career/resumes/:resumeVersionId/fit/:opportunityId", wrap((req) =>
    careerStore.getOpportunityFit(req.userContext, req.params.opportunityId, {
      resumeVersionId: req.params.resumeVersionId,
    })
  ));

  router.post("/career/profile/resume", wrap((req) => {
    const fileName = String(req.body?.fileName || "uploaded-resume.pdf");
    const url = `/uploads/resumes/${encodeURIComponent(req.userContext.userId)}-${Date.now()}.pdf`;
    if (req.body?.extractedText || req.body?.resumeText || req.body?.text) {
      const resume = careerStore.createResumeVersion(req.userContext, {
        ...req.body,
        fileName,
        filePath: url,
      });
      return { url, fileName, resumeVersionId: resume.id, qualityScore: resume.qualityScore };
    }
    careerStore.updateResume(req.userContext.userId, url, fileName);
    return { url, fileName };
  }));

  router.get("/career/profile", wrap((req) => careerStore.getProfile(req.userContext)));

  router.put("/career/profile", wrap((req) => {
    careerStore.updateProfile(req.userContext, normalizeProfilePayload(req.body || {}));
    const profile = careerStore.getProfile(req.userContext);
    return { updated: true, profile };
  }));

  router.get("/career/applications", wrap((req) => ({
    items: careerStore.getApplications(req.userContext.userId),
  })));

  router.post("/career/applications", wrap((req) =>
    careerStore.createApplication(
      req.userContext.userId,
      req.body?.opportunityId,
      req.body?.notes
    )
  ));

  router.put("/career/applications/:applicationId", wrap((req) =>
    careerStore.updateApplicationStatus(
      req.params.applicationId,
      req.userContext.userId,
      req.body?.status,
      req.body?.notes
    )
  ));

  router.delete("/career/applications/:applicationId", wrap((req) =>
    careerStore.deleteApplication(req.params.applicationId, req.userContext.userId)
  ));

  // Saved searches + alerts (T4.2.6).
  router.get("/career/saved-searches", wrap((req) => ({
    items: careerStore.listSavedSearches(req.userContext),
  })));

  router.post("/career/saved-searches", wrap((req) =>
    careerStore.createSavedSearch(req.userContext, {
      name: req.body?.name,
      filters: req.body?.filters,
      alertsEnabled: req.body?.alertsEnabled,
    })
  ));

  router.patch("/career/saved-searches/:id", wrap((req) =>
    careerStore.updateSavedSearch(req.userContext, req.params.id, req.body || {})
  ));

  router.delete("/career/saved-searches/:id", wrap((req) =>
    careerStore.deleteSavedSearch(req.userContext, req.params.id)
  ));

  // Skill learning plans + gap-closure tracking (Story 4.3).
  router.get("/career/learning-plans", wrap((req) => {
    // Auto-close plans for skills the student has since acquired.
    if (studentGraphService) {
      try {
        const graph = studentGraphService.getGraph(req.userContext);
        const skills = (graph?.skills || [])
          .map((s) => (typeof s === "string" ? s : s?.skill))
          .filter(Boolean);
        careerStore.reconcileLearningPlans(req.userContext, skills);
      } catch {
        /* reconciliation is a bonus — never fail the list over it */
      }
    }
    return careerStore.listLearningPlans(req.userContext);
  }));

  router.post("/career/learning-plans", wrap((req) =>
    careerStore.createLearningPlan(req.userContext, req.body?.skill)
  ));

  router.patch("/career/learning-plans/:id", wrap((req) =>
    careerStore.setLearningPlanStatus(
      req.userContext,
      req.params.id,
      req.body?.status === "closed" ? "closed" : "active",
      "manual",
    )
  ));

  router.delete("/career/learning-plans/:id", wrap((req) =>
    careerStore.deleteLearningPlan(req.userContext, req.params.id)
  ));

  // Elective guidance — rank the student's electives against their career
  // track(s) (Story 4.1 / T4.1.4). Needs the student graph for curriculum +
  // intent; returns an empty list (with a resolved-tracks hint) otherwise.
  router.get("/career/elective-guidance", wrap((req) => {
    if (!studentGraphService) return { tracks: [], electives: [] };
    try {
      return electiveGuidance.fromGraph(studentGraphService.getGraph(req.userContext));
    } catch {
      return { tracks: [], electives: [] };
    }
  }));

  router.post("/career/submit", wrap((req) =>
    careerStore.submitOpportunity(req.userContext.userId, req.body || {})
  ));

  router.get("/career/submit/mine", wrap((req) => {
    const result = careerStore.getSubmissions({
      submittedBy: req.userContext.userId,
      status: req.query.status || "all",
      page: req.query.page,
      limit: req.query.limit,
    });
    return { ...result, items: result.items.map(decorateSubmission) };
  }));

  router.get("/career/submit/pending", wrap((req) => {
    ensureCareerAdmin(req);
    const result = careerStore.getPendingSubmissions({
      status: req.query.status || "pending",
      page: req.query.page,
      limit: req.query.limit,
      query: req.query.query,
    });
    return { ...result, items: result.items.map(decorateSubmission) };
  }));

  router.post("/career/submit/:submissionId/approve", wrap((req) => {
    ensureCareerAdmin(req);
    const submission = careerStore.approveSubmission(
      req.params.submissionId,
      req.userContext,
      req.body?.reason || "Approved by admin"
    );
    void careerCache.invalidateCommon();
    return { approved: true, submission: decorateSubmission(submission) };
  }));

  router.patch("/career/submit/:submissionId", wrap((req) => {
    ensureCareerAdmin(req);
    const submission = careerStore.reviewSubmission(req.params.submissionId, req.body || {}, req.userContext);
    void careerCache.invalidateCommon();
    return decorateSubmission(submission);
  }));

  router.get("/career/interviews/slots", wrap((req) => ({
    items: careerStore.listInterviewSlots({ user: req.userContext }),
  })));

  router.post("/career/interviews/slots", wrap((req) =>
    careerStore.createInterviewSlot(req.body || {}, req.userContext)
  ));

  router.put("/career/interviews/slots/:slotId", wrap((req) =>
    careerStore.updateInterviewSlot(req.params.slotId, req.body || {}, req.userContext)
  ));

  router.delete("/career/interviews/slots/:slotId", wrap((req) =>
    careerStore.deleteInterviewSlot(req.params.slotId, req.userContext)
  ));

  router.get("/career/interviews/bookings", wrap((req) => ({
    items: careerStore.listInterviewBookings({ user: req.userContext }),
  })));

  router.post("/career/interviews/bookings", wrap((req) =>
    careerStore.bookInterviewSlot(req.body || {}, req.userContext)
  ));

  router.delete("/career/interviews/bookings/:bookingId", wrap((req) =>
    careerStore.cancelInterviewBooking(req.params.bookingId, req.userContext)
  ));

  router.get("/career/alumni", wrap((req) => ({
    items: careerStore.listAlumni({
      user: req.userContext,
      query: req.query.query,
      batch: req.query.batch,
    }),
  })));

  router.post("/career/alumni", wrap((req) => {
    ensureCareerAdmin(req);
    return careerStore.createAlumni(req.body || {}, req.userContext);
  }));

  router.put("/career/alumni/:alumniId", wrap((req) => {
    ensureCareerAdmin(req);
    return careerStore.updateAlumni(req.params.alumniId, req.body || {}, req.userContext);
  }));

  router.delete("/career/alumni/:alumniId", wrap((req) => {
    ensureCareerAdmin(req);
    return careerStore.deleteAlumni(req.params.alumniId, req.userContext);
  }));

  router.post("/career/alumni/:alumniId/requests", wrap((req) =>
    careerStore.requestAlumniConnection(req.params.alumniId, req.body || {}, req.userContext)
  ));

  router.get("/career/alumni/requests/sent", wrap((req) => ({
    items: careerStore.listSentAlumniRequests(req.userContext),
  })));

  router.get("/career/alumni/requests/pending", wrap((req) => {
    ensureCareerAdmin(req);
    return { items: careerStore.getPendingAlumniConnectionRequests() };
  }));

  router.patch("/career/alumni/requests/:requestId", wrap((req) => {
    ensureCareerAdmin(req);
    return careerStore.reviewAlumniConnectionRequest(req.params.requestId, req.body || {}, req.userContext);
  }));

  router.post("/career/alumni/nominations", wrap((req) =>
    careerStore.nominateAlumnus(req.body || {}, req.userContext)
  ));

  router.get("/career/alumni/nominations/mine", wrap((req) => ({
    items: careerStore.listMyAlumniNominations(req.userContext),
  })));

  router.get("/career/alumni/nominations/pending", wrap((req) => {
    ensureCareerAdmin(req);
    return { items: careerStore.getPendingAlumniNominations() };
  }));

  router.patch("/career/alumni/nominations/:nominationId", wrap((req) => {
    ensureCareerAdmin(req);
    return careerStore.reviewAlumniNomination(req.params.nominationId, req.body || {}, req.userContext);
  }));

  return router;
}

module.exports = {
  createCareerRoutes,
};
