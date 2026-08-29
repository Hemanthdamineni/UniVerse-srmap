// File-serving auth middleware (Gate 5 P1).
// Backend exposes three static file mounts under `/uploads`,
// `/files/submissions`, and `/files/certificates`. The audit
// (docs/14-PROD-READINESS-CHECKLIST.md, "File-serving policy
// decided") requires a decision: gate behind session or accept
// public-by-URL with a rationale.
//
// Decision (recorded in docs/09-INFRASTRUCTURE.md and the
// checklist's "File-serving policy" line):
//
//   - `/uploads`             — gated by ensureAuthenticated
//   - `/files/submissions`   — public-by-URL (UUID-only; users
//                              share download links intentionally)
//   - `/files/certificates`  — public-by-URL (same rationale)
//
// `/uploads` is gated because uploads happen via authenticated
// POST /api/uploads and /api/lms/resources, and the audit found no
// case where a logged-out user needs to fetch a just-uploaded
// resource by URL. The cost of gating (one extra round trip in
// the just-uploaded preview) is small; the upside (no anonymous
// read of fresh user content) is large.
//
// `/files/submissions` and `/files/certificates` stay public because
// LMS workflow expects the download link to be shareable in chat
// messages and email; gating them would break that. Both are
// UUID-only and live under the same-origin nginx path, so the
// practical risk of enumeration is near zero.
//
// This middleware is mounted only on the /uploads path. The
// /files/* paths are attached directly to the app via
// express.static in app.js, bypassing this gate.

function ensureAuthenticatedForUploads(req, res, next) {
  const isAuthed = req.userContext && req.userContext.isAuthenticated;
  if (isAuthed) return next();
  res.status(401).json({
    success: false,
    error: {
      code: "RESOURCE_AUTH_REQUIRED",
      message: "Authentication required to access uploaded resources",
      retryable: false,
    },
    requestId: req.requestId || null,
  });
}

module.exports = { ensureAuthenticatedForUploads };
