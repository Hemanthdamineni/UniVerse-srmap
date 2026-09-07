const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { createUserContextMiddleware } = require("../utils/eventsAuth");
const { isAllowedSubmissionMime } = require("../services/events/competitionStore");

function createCompetitionRoutes({ competitionStore, sessionStore, adminPassword = "", submissionsDir, userDirectory = null }) {
  const router = express.Router();
  const userContext = createUserContextMiddleware({ sessionStore, adminPassword, userDirectory });
  router.use(userContext);

  const root = submissionsDir || competitionStore.submissionsDir;
  fs.mkdirSync(root, { recursive: true });
  const submissionExtensions = {
    "application/pdf": ".pdf",
    "application/zip": ".zip",
    "application/x-zip-compressed": ".zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "text/plain": ".txt",
    "text/markdown": ".md",
  };
  const imageExtensions = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
  };
  const uploadRateBuckets = new Map();
  const UPLOAD_WINDOW_MS = 5 * 60 * 1000;
  const UPLOAD_MAX_PER_WINDOW = 10;

  function cleanupFile(file) {
    if (file?.path) fs.rmSync(file.path, { force: true });
  }

  function validateFileMagic(file, allowedMimes) {
    if (!file || !allowedMimes.has(file.mimetype)) return false;
    const head = fs.readFileSync(file.path).subarray(0, 16);
    if (file.mimetype === "application/pdf") return head.subarray(0, 5).toString("ascii") === "%PDF-";
    if (["application/zip", "application/x-zip-compressed"].includes(file.mimetype)
      || file.mimetype.includes("openxmlformats")) {
      return head.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
        || head.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    }
    if (file.mimetype === "image/png") return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (file.mimetype === "image/jpeg") return head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    if (file.mimetype === "image/webp") return head.subarray(0, 4).toString("ascii") === "RIFF"
      && head.subarray(8, 12).toString("ascii") === "WEBP";
    return !head.includes(0);
  }

  function authenticatedUpload(middleware) {
    return (req, res, next) => {
      const key = String(req.userContext.userId || "unknown-user");
      const now = Date.now();
      const recent = (uploadRateBuckets.get(key) || []).filter((timestamp) => timestamp >= now - UPLOAD_WINDOW_MS);
      if (recent.length >= UPLOAD_MAX_PER_WINDOW) {
        return res.status(429).json({ success: false, error: "Upload quota exceeded. Please try again later." });
      }
      recent.push(now);
      uploadRateBuckets.set(key, recent);
      return middleware(req, res, (error) => {
        if (error) {
          return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
            success: false,
            error: error.code === "LIMIT_FILE_SIZE" ? "Uploaded file is too large" : error.message || "Upload rejected",
          });
        }
        return next();
      });
    };
  }

  function requireAuthenticatedMiddleware(req, res, next) {
    if (!req.userContext?.isAuthenticated) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }
    return next();
  }

  function requireUploadPermission(check) {
    return (req, res, next) => {
      try {
        check(req);
        return next();
      } catch (error) {
        return res.status(error.status || 500).json({ success: false, error: error.message || "Unknown error" });
      }
    };
  }

  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, _file, cb) => {
        const eventId = String(req.params.eventId || "").trim();
        const roundId = String(req.params.roundId || "").trim();
        const userId = String(req.userContext?.userId || "unknown-user").trim();
        const dir = path.join(root, eventId, roundId, userId);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        cb(null, `submission_${Date.now()}_${crypto.randomUUID()}${submissionExtensions[file.mimetype] || ""}`);
      },
    }),
    fileFilter: (_req, file, cb) => cb(null, isAllowedSubmissionMime(file.mimetype)),
    limits: { fileSize: 25 * 1024 * 1024 },
  });
  const templateRoot = path.join(competitionStore.certificatesDir, "templates");
  fs.mkdirSync(templateRoot, { recursive: true });
  const templateUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, templateRoot),
      filename: (_req, file, cb) => {
        cb(null, `template_${Date.now()}_${crypto.randomUUID()}${imageExtensions[file.mimetype] || ""}`);
      },
    }),
    fileFilter: (_req, file, cb) => cb(null, Boolean(imageExtensions[file.mimetype])),
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  function ensureAuthenticated(req) {
    if (!req.userContext || !req.userContext.isAuthenticated) {
      const error = new Error("Authentication required");
      error.status = 401;
      throw error;
    }
  }

  function wrap(handler) {
    return async (req, res) => {
      try {
        const data = await handler(req, res);
        if (!res.headersSent) {
          res.json({ success: true, data });
        }
      } catch (error) {
        res.status(error.status || 500).json({
          success: false,
          error: error.message || "Unknown error",
        });
      }
    };
  }

  router.get("/competitions/:eventId/config", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.getCompetitionConfig(req.params.eventId);
  }));

  router.get("/competitions/:eventId/my-role", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.getMyRole(req.params.eventId, req.userContext);
  }));

  router.get("/competitions/:eventId/roles", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.getEventRoles(req.params.eventId, req.userContext);
  }));

  router.post("/competitions/:eventId/roles", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.assignRole(req.params.eventId, req.userContext, {
      regNo: req.body?.regNo,
      role: req.body?.role,
    });
  }));

  router.delete("/competitions/:eventId/roles/:regNo", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.removeRole(req.params.eventId, req.userContext, req.params.regNo);
  }));

  router.get("/competitions/:eventId/certificate-template", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.getCertificateTemplate(req.params.eventId, req.userContext, req.query.roundId);
  }));

  router.put("/competitions/:eventId/certificate-template", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.saveCertificateTemplate(req.params.eventId, req.userContext, req.body || {});
  }));

  router.post(
    "/competitions/:eventId/certificate-template/image",
    requireAuthenticatedMiddleware,
    requireUploadPermission((req) => competitionStore.assertEventPermission(req.params.eventId, req.userContext, "canEdit")),
    authenticatedUpload(templateUpload.single("file")),
    wrap((req) => {
      if (!req.file) {
        const error = new Error("Template image file is required");
        error.status = 400;
        throw error;
      }
      try {
        if (!validateFileMagic(req.file, new Set(Object.keys(imageExtensions)))) {
          const error = new Error("Template image content does not match its declared type");
          error.status = 400;
          throw error;
        }
        return {
          path: `/api/competitions/${encodeURIComponent(req.params.eventId)}/certificate-template/image/${encodeURIComponent(req.file.filename)}`,
        };
      } catch (error) {
        cleanupFile(req.file);
        throw error;
      }
    })
  );

  router.get("/competitions/:eventId/certificate-template/image/:fileName", async (req, res) => {
    try {
      ensureAuthenticated(req);
      competitionStore.assertEventPermission(req.params.eventId, req.userContext, "canEdit");
      const fileName = path.basename(String(req.params.fileName || ""));
      const filePath = path.resolve(templateRoot, fileName);
      if (!fileName || path.dirname(filePath) !== path.resolve(templateRoot) || !fs.existsSync(filePath)) {
        const error = new Error("Template image not found");
        error.status = 404;
        throw error;
      }
      return res.sendFile(filePath);
    } catch (error) {
      return res.status(error.status || 500).json({ success: false, error: error.message || "Unknown error" });
    }
  });

  router.get("/competitions/:eventId/analytics", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.getCompetitionAnalytics(req.params.eventId, req.userContext);
  }));

  router.post(
    "/competitions/:eventId/rounds/:roundId/submit",
    requireAuthenticatedMiddleware,
    requireUploadPermission((req) => competitionStore.assertCanSubmit(req.params.eventId, req.params.roundId, req.userContext.userId)),
    authenticatedUpload(upload.single("file")),
    wrap((req) => {
      const type = String(req.body?.type || (req.file ? "file" : "link")).toLowerCase();

      try {
        if (type === "file") {
          if (!req.file) {
            const error = new Error("Submission file is required");
            error.status = 400;
            throw error;
          }
          if (!validateFileMagic(req.file, new Set(Object.keys(submissionExtensions)))) {
            const error = new Error("File content does not match its declared type");
            error.status = 400;
            throw error;
          }
        }

        const relativePath = req.file
          ? path.relative(root, req.file.path).split(path.sep).join("/")
          : null;

        return competitionStore.createSubmission(
          req.params.eventId,
          req.params.roundId,
          req.userContext.userId,
          {
            type,
            filePath: relativePath,
            mimeType: req.file?.mimetype,
            linkUrl: req.body?.linkUrl,
            description: req.body?.description,
          }
        );
      } catch (error) {
        cleanupFile(req.file);
        throw error;
      }
    })
  );

  router.get("/competitions/:eventId/rounds/:roundId/my-submission", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.getActiveSubmission(
      req.params.eventId,
      req.params.roundId,
      req.userContext.userId
    );
  }));

  router.get("/competitions/:eventId/rounds/:roundId/my-result", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.getMyResult(
      req.params.eventId,
      req.params.roundId,
      req.userContext.userId
    );
  }));

  router.get("/competitions/:eventId/rounds/:roundId/submissions", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.getSubmissionsForRound(
      req.params.eventId,
      req.params.roundId,
      req.userContext
    );
  }));

  router.get("/competitions/:eventId/rounds/:roundId/submissions/:id/download", async (req, res) => {
    try {
      ensureAuthenticated(req);
      const submission = competitionStore.getSubmissionDownload(
        req.params.eventId,
        req.params.roundId,
        req.params.id,
        req.userContext
      );
      return res.download(submission.filePath, submission.fileName);
    } catch (error) {
      return res.status(error.status || 500).json({ success: false, error: error.message || "Unknown error" });
    }
  });

  router.put("/competitions/:eventId/rounds/:roundId/submissions/:id/evaluate", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.evaluateSubmission(req.params.id, req.userContext, req.body || {});
  }));

  router.get("/competitions/:eventId/rounds/:roundId/submissions/:id/evaluations", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.getSubmissionEvaluations(
      req.params.eventId,
      req.params.roundId,
      req.params.id,
      req.userContext
    );
  }));

  router.put("/competitions/:eventId/rounds/:roundId/submissions/:id/flag", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.flagSubmission(req.params.id, req.userContext, req.body || {});
  }));

  router.post("/competitions/:eventId/rounds/:roundId/shortlist", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.applyShortlist(req.params.eventId, req.params.roundId, req.userContext, {
      mode: req.body?.mode || "topN",
      value: req.body?.value,
    });
  }));

  router.post("/competitions/:eventId/rounds/:roundId/publish", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.publishResults(req.params.eventId, req.params.roundId, req.userContext);
  }));

  router.get("/competitions/:eventId/rounds/:roundId/leaderboard", wrap((req) => {
    ensureAuthenticated(req);
    try {
      return competitionStore.getLeaderboard(req.params.eventId, req.params.roundId);
    } catch (error) {
      if (Number(error.status) === 403) {
        return [];
      }
      throw error;
    }
  }));

  router.post("/competitions/:eventId/rounds/:roundId/certificates/generate", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.generateCertificates(req.params.eventId, req.params.roundId, req.userContext);
  }));

  router.get("/competitions/:eventId/rounds/:roundId/certificates/me", wrap((req) => {
    ensureAuthenticated(req);
    try {
      return competitionStore.getMyCertificate(req.params.eventId, req.params.roundId, req.userContext.userId);
    } catch (error) {
      if (Number(error.status) === 404) {
        return null;
      }
      throw error;
    }
  }));

  router.get("/competitions/:eventId/rounds/:roundId/certificates/me/download", async (req, res) => {
    try {
      ensureAuthenticated(req);
      const certificate = competitionStore.getMyCertificate(
        req.params.eventId,
        req.params.roundId,
        req.userContext.userId
      );
      const fileName = path.basename(certificate.fileName);
      const filePath = path.join(competitionStore.certificatesDir, fileName);
      res.download(filePath, fileName, (error) => {
        if (error && !res.headersSent) {
          res.status(error.status || 500).json({
            success: false,
            error: error.message || "Failed to download certificate",
          });
        }
      });
    } catch (error) {
      res.status(error.status || 500).json({
        success: false,
        error: error.message || "Unknown error",
      });
    }
  });

  router.post("/competitions/reminders/run", wrap((req) => {
    ensureAuthenticated(req);
    if (!["admin", "event_coordinator"].includes(req.userContext.role)) {
      const error = new Error("Forbidden");
      error.status = 403;
      throw error;
    }
    return competitionStore.processDeadlineReminders();
  }));

  router.post("/competitions/:eventId/announce", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.sendOrganizerAnnouncement(
      req.params.eventId,
      req.userContext,
      req.body || {}
    );
  }));

  router.post("/competitions/:eventId/teams", wrap((req) => {
    ensureAuthenticated(req);
    const team = competitionStore.createTeam(req.params.eventId, req.userContext.userId, {
      name: req.body?.name,
    });
    return competitionStore._publicTeam(team);
  }));

  router.get("/competitions/:eventId/teams", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.listEventTeams(req.params.eventId, req.userContext);
  }));

  router.get("/competitions/:eventId/teams/recruitment", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.listTeamRecruitmentBoard(req.params.eventId, req.userContext);
  }));

  router.put("/competitions/:eventId/teams/recruitment", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.upsertTeamRecruitmentPost(
      req.params.eventId,
      req.userContext.userId,
      req.body || {}
    );
  }));

  router.get("/competitions/:eventId/teams/matches", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.listTeamMatches(req.params.eventId, req.userContext);
  }));

  router.get("/competitions/:eventId/teams/my-team", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore._publicTeam(competitionStore.getMyTeam(req.params.eventId, req.userContext.userId));
  }));

  router.post("/competitions/:eventId/teams/:teamId/invite", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.inviteMember(
      req.params.eventId,
      req.params.teamId,
      req.userContext.userId,
      { inviteeRegisterNumber: req.body?.inviteeRegisterNumber }
    );
  }));

  router.delete("/competitions/:eventId/teams/:teamId/invite/:inviteeRegisterNumber", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.cancelInvitation(
      req.params.eventId,
      req.params.teamId,
      req.userContext.userId,
      req.params.inviteeRegisterNumber
    );
  }));

  router.put("/competitions/:eventId/teams/:teamId/leader", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.transferLeadership(
      req.params.eventId,
      req.params.teamId,
      req.userContext.userId,
      String(req.body?.newLeaderId || "")
    );
  }));

  router.delete("/competitions/:eventId/teams/:teamId/members/me", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.leaveTeam(req.params.eventId, req.userContext.userId);
  }));

  router.delete("/competitions/:eventId/teams/:teamId", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.deleteTeam(req.params.eventId, req.params.teamId, req.userContext.userId);
  }));

  router.post("/competitions/:eventId/invitations/:invitationId/accept", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.acceptInvitation(
      req.params.eventId,
      req.params.invitationId,
      req.userContext.userId
    );
  }));

  router.post("/competitions/:eventId/invitations/:invitationId/decline", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.declineInvitation(
      req.params.eventId,
      req.params.invitationId,
      req.userContext.userId
    );
  }));

  router.get("/competitions/:eventId/invitations/my-invitations", wrap((req) => {
    ensureAuthenticated(req);
    return competitionStore.getMyInvitations(req.params.eventId, req.userContext.userId);
  }));

  return router;
}

module.exports = {
  createCompetitionRoutes,
};
