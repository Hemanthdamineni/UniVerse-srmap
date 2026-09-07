const express = require("express");
const { createUserContextMiddleware } = require("../utils/eventsAuth");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");

/**
 * GET    /api/student-graph              — the composed StudentGraph (cached, warm < 200ms)
 * POST   /api/student-graph/recompute    — bypass the cache and rebuild
 * GET    /api/student-graph/intent       — the student's declared intent + consent
 * PUT    /api/student-graph/intent       — merge-write intent / consent (skippable)
 * GET    /api/student-graph/provenance   — "what we know about you": every signal + its source
 * DELETE /api/student-graph/derived      — forget declared intent (derived signals recompute empty)
 *
 * Backlog Stories 3.1–3.3 / Batches B4–B5.
 */
function createStudentGraphRoutes({ studentGraphService, studentIntentStore = null, sessionStore, adminPassword = "" }) {
  const router = express.Router();
  router.use(createUserContextMiddleware({ sessionStore, adminPassword }));

  function ensureAuthenticated(req, res, next) {
    if (!req.userContext?.isAuthenticated) {
      const error = new Error("Authentication required. Please sign in.");
      error.status = 401;
      return sendApiError(res, req, error);
    }
    return next();
  }
  router.use(ensureAuthenticated);

  function wrap(handler) {
    return (req, res) => {
      try {
        return sendApiSuccess(res, req, handler(req));
      } catch (error) {
        return sendApiError(res, req, error);
      }
    };
  }

  router.get(
    "/student-graph",
    wrap((req) =>
      studentGraphService.getGraph(req.userContext, {
        recompute: req.query.recompute === "1" || req.query.recompute === "true",
      }),
    ),
  );

  router.post(
    "/student-graph/recompute",
    wrap((req) => studentGraphService.getGraph(req.userContext, { recompute: true })),
  );

  if (studentIntentStore) {
    router.get(
      "/student-graph/intent",
      wrap((req) => studentIntentStore.get(req.userContext)),
    );

    router.put(
      "/student-graph/intent",
      wrap((req) => {
        const saved = studentIntentStore.update(req.userContext, req.body || {});
        studentGraphService.invalidate(req.userContext);
        return saved;
      }),
    );

    router.delete(
      "/student-graph/derived",
      wrap((req) => {
        const cleared = studentIntentStore.clear(req.userContext);
        studentGraphService.invalidate(req.userContext);
        return { cleared: true, intent: cleared };
      }),
    );

    router.get(
      "/student-graph/provenance",
      wrap((req) => buildProvenance(studentGraphService.getGraph(req.userContext))),
    );
  }

  return router;
}

/**
 * A flat, plain-language list of every inference the platform holds about the
 * student, each tagged with where it came from (T3.3.2). Nothing new is
 * computed — this is a re-projection of the graph the student can already see.
 */
function buildProvenance(graph) {
  const rows = [];
  const add = (category, label, value, source) => {
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) return;
    rows.push({ category, label, value, source });
  };

  add("Identity", "Name", graph.identity?.name, "Your SRM ERP profile");
  add("Identity", "Branch", graph.identity?.branch, "Your SRM ERP profile");
  add("Identity", "Semester", graph.identity?.semester, "Your SRM ERP profile");

  if (graph.academic?.attendance) {
    add(
      "Academic",
      "Overall attendance",
      `${graph.academic.attendance.overallPct}%`,
      `Attendance snapshot, ${graph.academic.attendance.asOf}`,
    );
  }
  if (graph.academic?.results?.cgpa != null) {
    add("Academic", "CGPA", graph.academic.results.cgpa, "ERP results page");
  }

  for (const skill of graph.skills || []) {
    add("Skills", skill.skill, skill.source === "declared" ? "you told us" : `inferred (${skill.source})`, sourceForSkill(skill.source));
  }

  const d = graph.derived || {};
  for (const r of d.atRiskSubjects || []) {
    add("Derived", `At risk: ${r.name || r.code}`, `${r.pct}% — attend ${r.classesToRecover} more`, "Computed from your attendance");
  }
  for (const g of d.skillGaps || []) {
    add("Derived", `Skill gap: ${g.skill}`, g.demand != null ? `demand ${g.demand}` : "flagged", "Computed from opportunities vs your skills");
  }
  if (typeof d.readinessScore === "number") {
    add("Derived", "Placement readiness score", `${d.readinessScore}/100`, "Weighted blend of attendance, CGPA, skills, activity, profile");
  }

  const i = graph.intent || {};
  add("You told us", "Target roles", i.targetRoles, "Onboarding");
  add("You told us", "Interest areas", i.interestAreas, "Onboarding");
  add("You told us", "Graduation year", i.graduationYear, "Onboarding");
  add("You told us", "After graduation", i.placementIntent, "Onboarding");

  return {
    generatedAt: graph.generatedAt,
    consent: graph.consent,
    rows,
  };
}

function sourceForSkill(source) {
  switch (source) {
    case "declared":
      return "Onboarding — you entered it";
    case "resume":
      return "Parsed from your uploaded resume";
    case "courses":
      return "Your registered courses";
    case "manual":
      return "You added it on your profile";
    default:
      return "Your activity on the platform";
  }
}

module.exports = { createStudentGraphRoutes, buildProvenance };
