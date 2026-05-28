const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const { chromium } = require("playwright");
const { ACCEPTED_LMS_MIME_TYPES } = require("../config/lmsMimeTypes");
const { LMS_UPLOAD_MAX_BYTES, LMS_FILES_DIR } = require("../config/env");
const { sendApiError } = require("../utils/apiResponse");
const { resolveSessionId } = require("../utils/cookies");
const { createUserContextMiddleware } = require("../utils/eventsAuth");
const {
  toSafeString,
  parseJson,
  ensureArray,
  buildFileStoragePath,
  createHttpError,
} = require("../services/lmsUtils");

function sendLmsSuccess(res, req, data, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    requestId: req.requestId || null,
  });
}

function toBoolean(value) {
  const normalized = toSafeString(value).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parseMaybeJson(value, fallback) {
  if (typeof value !== "string") return value ?? fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return parseJson(trimmed, fallback);
}

function createHandle(req, res, next, action) {
  Promise.resolve()
    .then(() => action())
    .then((data) => {
      if (!res.headersSent) {
        sendLmsSuccess(res, req, data);
      }
    })
    .catch((error) => {
      if (!res.headersSent) {
        sendApiError(res, req, error);
      } else {
        next(error);
      }
    });
}

function createLimiter({ max, windowMs }) {
  const buckets = new Map();
  return function limiter(req, _res, next) {
    const key = `${req.userContext?.userId || req.ip}:${req.route?.path || req.path}`;
    const windowStart = Date.now() - windowMs;
    const recent = (buckets.get(key) || []).filter((timestamp) => timestamp >= windowStart);
    if (recent.length >= max) {
      return next(createHttpError(429, "Too many requests. Please retry later.", "LMS_RATE_LIMITED"));
    }
    recent.push(Date.now());
    buckets.set(key, recent);
    return next();
  };
}

async function renderGuidePdf(guide) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const sections = ensureArray(guide.sections)
      .map(
        (section) => `
          <section style="margin-bottom:24px;">
            <h2 style="font-size:18px;margin-bottom:8px;">${section.title}</h2>
            <div style="font-size:13px;line-height:1.6;white-space:pre-wrap;">${section.content}</div>
          </section>
        `
      )
      .join("");
    await page.setContent(
      `
        <html>
          <body style="font-family: 'Georgia', 'Times New Roman', serif; padding: 32px;">
            <h1 style="font-size: 28px; margin-bottom: 8px;">${guide.title}</h1>
            <p style="font-size: 14px; color: #555; margin-bottom: 24px;">${guide.description || ""}</p>
            ${sections}
          </body>
        </html>
      `,
      { waitUntil: "domcontentloaded" }
    );
    return await page.pdf({ format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }
}

function createLmsRoutes({
  sessionStore,
  adminPassword = "",
  lmsStore,
  lmsTrackerService,
  recommendationEngine,
  interactionTracker,
  examFeedbackService,
  duplicateDetector,
  readingTimeEstimator,
  featureFlagService,
}) {
  const router = express.Router();
  const userContext = createUserContextMiddleware({ sessionStore, adminPassword });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: LMS_UPLOAD_MAX_BYTES },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const allowed = ACCEPTED_LMS_MIME_TYPES[ext];
      if (!allowed) {
        return cb(createHttpError(400, `Unsupported file extension: ${ext || "unknown"}`, "LMS_INVALID_FILE"));
      }
      if (!allowed.includes(file.mimetype)) {
        return cb(createHttpError(400, `Unsupported MIME type: ${file.mimetype}`, "LMS_INVALID_MIME"));
      }
      return cb(null, true);
    },
  });

  const uploadLimiter = createLimiter({ max: 10, windowMs: 5 * 60 * 1000 });
  const commentLimiter = createLimiter({ max: 20, windowMs: 5 * 60 * 1000 });
  const requestLimiter = createLimiter({ max: 10, windowMs: 10 * 60 * 1000 });

  function ensureAuthenticated(req, _res, next) {
    if (!req.userContext?.isAuthenticated) {
      return next(createHttpError(401, "Authentication required", "LMS_AUTH_REQUIRED"));
    }
    return next();
  }

  function ensureAdmin(req, _res, next) {
    if (!req.userContext?.hasAdminAccess) {
      return next(createHttpError(403, "Admin access required", "LMS_FORBIDDEN"));
    }
    return next();
  }

  async function persistUploadedFile(file, subjectCode, type) {
    const targetPath = buildFileStoragePath(LMS_FILES_DIR, subjectCode, type, file.originalname);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, file.buffer);
    return targetPath;
  }

  function parseResourcePayload(req) {
    return {
      ...req.body,
      tags: parseMaybeJson(req.body.tags, req.body.tags),
      structuredContent: parseMaybeJson(req.body.structuredContent, req.body.structuredContent),
      exportable: req.body.exportable === undefined ? undefined : toBoolean(req.body.exportable),
    };
  }

  router.use(userContext);
  router.use(ensureAuthenticated);

  if (lmsTrackerService) {
    router.get("/lms/tracker/overview", (req, res, next) =>
      createHandle(req, res, next, async () => {
        const sessionId = resolveSessionId(req);
        return lmsTrackerService.getOverview({ sessionId, user: req.userContext });
      })
    );

    router.get("/lms/tracker/insights", (req, res, next) =>
      createHandle(req, res, next, async () => {
        const sessionId = resolveSessionId(req);
        return lmsTrackerService.getInsights({ sessionId, user: req.userContext });
      })
    );

    router.get("/lms/tracker/unified-insights", (req, res, next) =>
      createHandle(req, res, next, async () => {
        const sessionId = resolveSessionId(req);
        return lmsTrackerService.getUnifiedInsights({ sessionId, user: req.userContext });
      })
    );

    router.get("/lms/tracker/history", (req, res, next) =>
      createHandle(req, res, next, async () =>
        lmsTrackerService.getHistory({
          user: req.userContext,
          snapshotType: req.query.type,
          limit: req.query.limit,
        })
      )
    );

    router.get("/lms/tracker/recommendation-events", (req, res, next) =>
      createHandle(req, res, next, async () =>
        lmsTrackerService.getRecommendationEvents({
          user: req.userContext,
          limit: req.query.limit,
        })
      )
    );

    router.post("/lms/tracker/recommendation-events", (req, res, next) =>
      createHandle(req, res, next, async () =>
        lmsTrackerService.recordRecommendationEvent({
          user: req.userContext,
          payload: req.body || {},
        })
      )
    );
  }

  router.get("/lms/resources", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getResources(
        {
          subjectCode: req.query.subjectCode,
          semester: req.query.semester,
          unit: req.query.unit,
          type: req.query.type,
          difficulty: req.query.difficulty,
          tags: req.query.tags,
          examYear: req.query.examYear,
          examType: req.query.examType,
          examProven: toBoolean(req.query.examProven),
          query: req.query.query,
          sort: req.query.sort,
          page: req.query.page,
          limit: req.query.limit,
        },
        { userId: req.userContext.userId }
      )
    )
  );

  router.get("/lms/resources/check-duplicate", (req, res, next) =>
    createHandle(req, res, next, async () =>
      duplicateDetector.checkDuplicate({
        fileHash: req.query.fileHash,
        title: req.query.title,
        subjectCode: req.query.subjectCode,
      })
    )
  );

  router.get("/lms/resources/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getResource(req.params.id, req.userContext.userId, {
        includeHiddenOwn: true,
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.post("/lms/resources", uploadLimiter, upload.single("file"), (req, res, next) =>
    createHandle(req, res, next, async () => {
      const payload = parseResourcePayload(req);
      let filePath = null;
      let fileHash = null;
      let fileSize = null;
      let mimeType = null;

      if (req.file) {
        fileHash = duplicateDetector.computeHash(req.file.buffer);
        const duplicate = await duplicateDetector.checkDuplicate({
          fileHash,
          title: payload.title,
          subjectCode: payload.subjectCode,
        });
        if (duplicate.exact) {
          throw createHttpError(409, "An identical file already exists for this subject.", "LMS_DUPLICATE");
        }
        filePath = await persistUploadedFile(req.file, payload.subjectCode, payload.type || "file");
        fileSize = req.file.size;
        mimeType = req.file.mimetype;
      }

      const estimatedMinutes = await readingTimeEstimator.computeReadingTime({
        type: payload.type,
        noteContent: payload.noteContent,
        structuredContent: payload.structuredContent,
        filePath,
        fileSize,
        mimeType,
        url: payload.url,
      });

      return lmsStore.createResource(req.userContext.userId, {
        ...payload,
        filePath,
        fileHash,
        fileSize,
        mimeType,
        estimatedMinutes,
      });
    })
  );

  router.put("/lms/resources/:id", uploadLimiter, upload.single("file"), (req, res, next) =>
    createHandle(req, res, next, async () => {
      const payload = parseResourcePayload(req);
      let filePath = payload.filePath;
      let fileHash = payload.fileHash;
      let fileSize = payload.fileSize;
      let mimeType = payload.mimeType;

      if (req.file) {
        fileHash = duplicateDetector.computeHash(req.file.buffer);
        const duplicate = await duplicateDetector.checkDuplicate({
          fileHash,
          title: payload.title,
          subjectCode: payload.subjectCode,
          excludeId: req.params.id,
        });
        if (duplicate.exact) {
          throw createHttpError(409, "An identical file already exists for this subject.", "LMS_DUPLICATE");
        }
        filePath = await persistUploadedFile(req.file, payload.subjectCode, payload.type || "file");
        fileSize = req.file.size;
        mimeType = req.file.mimetype;
      }

      const estimatedMinutes = await readingTimeEstimator.computeReadingTime({
        type: payload.type,
        noteContent: payload.noteContent,
        structuredContent: payload.structuredContent,
        filePath,
        fileSize,
        mimeType,
        url: payload.url,
      });

      return lmsStore.updateResource(req.params.id, req.userContext.userId, {
        ...payload,
        filePath,
        fileHash,
        fileSize,
        mimeType,
        estimatedMinutes,
      }, {
        isAdmin: req.userContext.hasAdminAccess,
      });
    })
  );

  router.delete("/lms/resources/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.deleteResource(req.params.id, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.post("/lms/resources/:id/restore", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.restoreResource(req.params.id, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.post("/lms/resources/bulk", ensureAdmin, (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.bulkResourceOperation(
        req.userContext.userId,
        req.body.operation,
        req.body.resourceIds,
        req.body.payload,
        { isAdmin: true }
      )
    )
  );

  router.post("/lms/resources/:id/upvote", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.toggleUpvote(req.params.id, req.userContext.userId))
  );

  router.post("/lms/resources/:id/bookmark", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.toggleBookmark(req.params.id, req.userContext.userId))
  );

  router.post("/lms/resources/:id/flag", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.flagResource(req.params.id, req.userContext.userId, req.body.reason)
    )
  );

  router.post("/lms/resources/:id/mark-outdated", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.markOutdated(req.params.id, req.userContext.userId, req.body.reason)
    )
  );

  router.post("/lms/resources/:id/rate", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.rateResource(
        req.params.id,
        req.userContext.userId,
        req.body.rating,
        req.body.review,
        req.body.dimensionTags
      )
    )
  );

  router.post("/lms/resources/:id/view", (req, res, next) =>
    createHandle(req, res, next, async () =>
      interactionTracker.track({
        userId: req.userContext.userId,
        resourceId: req.params.id,
        action: "view",
        timeSpentMs: req.body.timeSpentMs,
        metadata: req.body.metadata,
      })
    )
  );

  router.get("/lms/resources/:id/comments", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.listComments(req.params.id, req.userContext.userId))
  );

  router.post("/lms/resources/:id/comments", commentLimiter, (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.commentOnResource(req.params.id, req.userContext.userId, req.body.content)
    )
  );

  router.post("/lms/comments/:id/helpful", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.toggleCommentHelpful(req.params.id, req.userContext.userId)
    )
  );

  router.get("/lms/resources/:id/annotations", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getAnnotations(req.userContext.userId, req.params.id)
    )
  );

  router.post("/lms/resources/:id/annotations", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.saveAnnotation(req.userContext.userId, req.params.id, req.body.content)
    )
  );

  router.delete("/lms/annotations/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.deleteAnnotation(req.params.id, req.userContext.userId)
    )
  );

  router.get("/lms/pyq/upcoming", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getUpcomingExamPyqs(req.userContext.userId))
  );

  router.get("/lms/pyq/:subjectCode", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getPyqBank(
        req.params.subjectCode,
        {
          examYear: req.query.examYear,
          examType: req.query.examType,
          page: req.query.page,
          limit: req.query.limit,
          sort: req.query.sort || "recent",
        },
        { userId: req.userContext.userId }
      )
    )
  );

  router.get("/lms/requests", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getRequests({
        subjectCode: req.query.subjectCode,
        status: req.query.status,
        page: req.query.page,
        limit: req.query.limit,
      })
    )
  );

  router.post("/lms/requests", requestLimiter, (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.createRequest(req.userContext.userId, req.body))
  );

  router.post("/lms/requests/:id/upvote", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.upvoteRequest(req.params.id, req.userContext.userId))
  );

  router.post("/lms/requests/:id/fulfill", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.fulfillRequest(req.params.id, req.userContext.userId, req.body.resourceId)
    )
  );

  router.delete("/lms/requests/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.closeRequest(req.params.id, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.get("/lms/exam-feedback/pending", (req, res, next) =>
    createHandle(req, res, next, async () =>
      examFeedbackService.getPendingFeedback({
        userId: req.userContext.userId,
        sessionId: resolveSessionId(req),
      })
    )
  );

  router.post("/lms/exam-feedback", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.submitExamFeedback(req.userContext.userId, req.body.feedbackItems)
    )
  );

  router.post("/lms/resources/:id/quiz-attempt", (req, res, next) =>
    createHandle(req, res, next, async () => {
      const result = lmsStore.recordQuizAttempt(req.params.id, req.userContext.userId, req.body);
      await interactionTracker.track({
        userId: req.userContext.userId,
        resourceId: req.params.id,
        action: Number(result.percentage || 0) >= 60 ? "quiz_pass" : "quiz_fail",
        timeSpentMs: req.body.timeTakenMs,
        metadata: { percentage: result.percentage },
      });
      return result;
    })
  );

  router.get("/lms/resources/:id/quiz-attempts", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getQuizAttempts(req.params.id, req.userContext.userId)
    )
  );

  router.get("/lms/question-bank", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getQuestionBank(req.query.subjectCode, {
        unit: req.query.unit,
        difficulty: req.query.difficulty,
        page: req.query.page,
        limit: req.query.limit,
      })
    )
  );

  router.post("/lms/question-bank", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.addQuestion(req.userContext.userId, req.body)
    )
  );

  router.post("/lms/question-bank/:id/upvote", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.upvoteQuestion(req.params.id))
  );

  router.get("/lms/question-bank/build-quiz", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.buildQuizFromBank(
        req.query.subjectCode,
        req.query.unit,
        req.query.count,
        req.query.difficulty
      )
    )
  );

  router.get("/lms/collections", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.listCollections(req.userContext.userId))
  );

  router.post("/lms/collections", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.createCollection(
        req.userContext.userId,
        req.body.name,
        req.body.description,
        req.body.isPublic
      )
    )
  );

  router.get("/lms/collections/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getCollection(req.params.id, req.userContext.userId)
    )
  );

  router.post("/lms/collections/:id/items", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.addToCollection(req.params.id, req.body.resourceId, req.userContext.userId)
    )
  );

  router.delete("/lms/collections/:id/items/:resourceId", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.removeFromCollection(req.params.id, req.params.resourceId, req.userContext.userId)
    )
  );

  router.get("/lms/guides", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.listGuides(
        {
          subjectCode: req.query.subjectCode,
          includeDrafts: toBoolean(req.query.includeDrafts),
        },
        { userId: req.userContext.userId }
      )
    )
  );

  router.post("/lms/guides", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.createGuide(req.userContext.userId, req.body))
  );

  router.get("/lms/guides/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getGuide(req.params.id, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.put("/lms/guides/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.updateGuide(req.params.id, req.userContext.userId, req.body, {
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.delete("/lms/guides/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.deleteGuide(req.params.id, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.post("/lms/guides/:id/sections", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.addGuideSection(req.params.id, req.userContext.userId, req.body)
    )
  );

  router.put("/lms/guides/:id/sections/:sid", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.updateGuideSection(req.params.id, req.params.sid, req.userContext.userId, req.body)
    )
  );

  router.post("/lms/guides/:id/sections/:sid/read", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.markGuideSectionRead(req.params.id, req.params.sid, req.userContext.userId)
    )
  );

  router.post("/lms/guides/:id/upvote", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.toggleEntityUpvote("guide", req.params.id, req.userContext.userId)
    )
  );

  router.get("/lms/guides/:id/export", async (req, res, next) => {
    try {
      const guide = await lmsStore.getGuide(req.params.id, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      });
      const pdf = await renderGuidePdf(guide);
      res.setHeader("content-type", "application/pdf");
      res.setHeader("content-disposition", `attachment; filename="${guide.title.replace(/[^a-z0-9]+/gi, "-")}.pdf"`);
      return res.send(pdf);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/lms/roadmaps", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.listRoadmaps({
        userId: req.userContext.userId,
        includeDrafts: toBoolean(req.query.includeDrafts),
      })
    )
  );

  router.post("/lms/roadmaps", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.createRoadmap(req.userContext.userId, req.body))
  );

  router.get("/lms/roadmaps/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getRoadmap(req.params.id, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.delete("/lms/roadmaps/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.deleteRoadmap(req.params.id, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.post("/lms/roadmaps/:id/nodes", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.addRoadmapNode(req.params.id, req.userContext.userId, req.body)
    )
  );

  router.post("/lms/roadmaps/:id/edges", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.addRoadmapEdge(req.params.id, req.userContext.userId, req.body.fromNodeId, req.body.toNodeId)
    )
  );

  router.post("/lms/roadmaps/:id/nodes/:nid/complete", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.markRoadmapNodeComplete(req.params.id, req.params.nid, req.userContext.userId)
    )
  );

  router.get("/lms/recommendations/next-step", (req, res, next) =>
    createHandle(req, res, next, async () => {
      const resource = lmsStore.getResource(req.query.resourceId, req.userContext.userId, {
        includeHiddenOwn: true,
        isAdmin: req.userContext.hasAdminAccess,
      });
      const related = lmsStore.getResources(
        {
          subjectCode: resource.subjectCode,
          unit: resource.unitNormalized,
          sort: "quality",
          limit: 6,
          page: 1,
        },
        { userId: req.userContext.userId }
      ).items.filter((item) => item.id !== resource.id);
      return related.slice(0, 3);
    })
  );

  router.get("/lms/recommendations", (req, res, next) =>
    createHandle(req, res, next, async () =>
      recommendationEngine.getRecommendations({
        userId: req.userContext.userId,
        filters: {
          subjectCode: req.query.subjectCode,
          type: req.query.type,
        },
        limit: req.query.limit,
      })
    )
  );

  router.get("/lms/explore", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getExplore(req.userContext.userId))
  );

  router.get("/lms/subjects/:code/overview", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getSubjectOverview(req.params.code, req.userContext.userId)
    )
  );

  router.get("/lms/subjects/:code/presence", (req, res, next) =>
    createHandle(req, res, next, async () => ({
      subjectCode: toSafeString(req.params.code).toUpperCase(),
      count: lmsStore.getCurrentlyStudyingCount(req.params.code),
    }))
  );

  router.get("/lms/topics/graph", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getTopicGraph(req.query.subjectCode))
  );

  router.get("/lms/leaderboard/weekly", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getWeeklyLeaderboard())
  );

  router.get("/lms/progress", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getProgressSummary(req.userContext.userId))
  );

  router.get("/lms/progress/:subjectCode", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getProgressForSubject(req.userContext.userId, req.params.subjectCode)
    )
  );

  router.get("/lms/mastery", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getMastery(req.userContext.userId))
  );

  router.get("/lms/continue", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getContinueLearning(req.userContext.userId))
  );

  router.get("/lms/revision", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getRevisionQueue(req.userContext.userId))
  );

  router.post("/lms/revision/:resourceId/review", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.submitRevisionReview(req.userContext.userId, req.params.resourceId, req.body.score)
    )
  );

  router.get("/lms/streak", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getStreak(req.userContext.userId))
  );

  router.post("/lms/session/generate", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.generateLearningSession(req.userContext.userId, req.body.durationMinutes)
    )
  );

  router.get("/lms/me/contributions", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getUserContributions(req.userContext.userId))
  );

  router.get("/lms/me/bookmarks", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getBookmarkedResources(req.userContext.userId))
  );

  router.get("/lms/me/activity", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getActivity(req.userContext.userId))
  );

  router.get("/lms/me/requests", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getUserRequests(req.userContext.userId))
  );

  router.put("/lms/me/preferences", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.updateUserPreferences(req.userContext.userId, req.body)
    )
  );

  router.get("/lms/contributors/:userId", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getContributorProfile(req.params.userId))
  );

  router.get("/lms/admin/resource-flags", ensureAdmin, (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getResourceModerationQueue({
        state: req.query.state,
        query: req.query.query,
        page: req.query.page,
        limit: req.query.limit,
      })
    )
  );

  router.patch("/lms/admin/resources/:id/moderation", ensureAdmin, (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.moderateResource(req.params.id, req.body || {}, {
        userId: req.userContext.userId,
      })
    )
  );

  router.get("/lms/me/export/:guideId", async (req, res, next) => {
    try {
      const guide = await lmsStore.getGuide(req.params.guideId, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      });
      const pdf = await renderGuidePdf(guide);
      res.setHeader("content-type", "application/pdf");
      res.setHeader("content-disposition", `attachment; filename="${guide.title.replace(/[^a-z0-9]+/gi, "-")}.pdf"`);
      return res.send(pdf);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/lms/admin/flags", ensureAdmin, (req, res, next) =>
    createHandle(req, res, next, async () => featureFlagService.listFlags())
  );

  router.put("/lms/admin/flags/:key", ensureAdmin, (req, res, next) =>
    createHandle(req, res, next, async () =>
      featureFlagService.setFlag({
        key: req.params.key,
        enabled: req.body.enabled,
        rolloutType: req.body.rolloutType,
        rolloutValue: req.body.rolloutValue,
        description: req.body.description,
        updatedBy: req.userContext.userId,
      })
    )
  );

  return router;
}

module.exports = {
  createLmsRoutes,
};
