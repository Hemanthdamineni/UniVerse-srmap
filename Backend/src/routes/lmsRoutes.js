const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const { chromium } = require("playwright");
const { ACCEPTED_LMS_MIME_TYPES } = require("../config/lmsMimeTypes");
const { LMS_UPLOAD_MAX_BYTES, LMS_FILES_DIR } = require("../config/env");
const { sendApiError } = require("../utils/apiResponse");
const { createUserContextMiddleware } = require("../utils/eventsAuth");
const {
  toSafeString,
  parseJson,
  ensureArray,
  buildFileStoragePath,
  createHttpError,
} = require("../services/lms/lmsUtils");
const { registerTrackerRoutes } = require("./lmsRoutes/trackerRoutes");
const { registerResourceRoutes } = require("./lmsRoutes/resourceRoutes");
const { registerGuideRoadmapRoutes } = require("./lmsRoutes/guideRoadmapRoutes");
const { registerLearningAdminRoutes } = require("./lmsRoutes/learningAdminRoutes");
const { registerSearchRoutes } = require("./lmsRoutes/searchRoutes");

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
  const maxBuckets = 10_000;
  let nextSweepAt = 0;
  return function limiter(req, _res, next) {
    const key = `${req.userContext?.userId || req.ip}:${req.route?.path || req.path}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    if (now >= nextSweepAt) {
      for (const [bucketKey, timestamps] of buckets) {
        if (!timestamps.some((timestamp) => timestamp >= windowStart)) buckets.delete(bucketKey);
      }
      nextSweepAt = now + Math.min(windowMs, 60_000);
    }
    if (!buckets.has(key) && buckets.size >= maxBuckets) {
      buckets.delete(buckets.keys().next().value);
    }
    const recent = (buckets.get(key) || []).filter((timestamp) => timestamp >= windowStart);
    if (recent.length >= max) {
      return next(createHttpError(429, "Too many requests. Please retry later.", "LMS_RATE_LIMITED"));
    }
    recent.push(now);
    // Refresh insertion order so the bounded eviction above acts as LRU.
    buckets.delete(key);
    buckets.set(key, recent);
    return next();
  };
}

const GUIDE_PDF_MAX_CONCURRENCY = Math.max(1, Number(process.env.LMS_PDF_MAX_CONCURRENCY || 2));
let activeGuidePdfJobs = 0;

function escapePrintableText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildGuidePdfHtml(guide) {
  const sections = ensureArray(guide.sections)
    .slice(0, 200)
    .map(
      (section) => `
        <section style="margin-bottom:24px;">
          <h2 style="font-size:18px;margin-bottom:8px;">${escapePrintableText(section.title)}</h2>
          <div style="font-size:13px;line-height:1.6;white-space:pre-wrap;">${escapePrintableText(section.content)}</div>
        </section>
      `
    )
    .join("");
  return `
    <html>
      <head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';"></head>
      <body style="font-family: Georgia, 'Times New Roman', serif; padding: 32px;">
        <h1 style="font-size: 28px; margin-bottom: 8px;">${escapePrintableText(guide.title)}</h1>
        <p style="font-size: 14px; color: #555; margin-bottom: 24px;">${escapePrintableText(guide.description)}</p>
        ${sections}
      </body>
    </html>
  `;
}

async function renderGuidePdf(guide) {
  if (activeGuidePdfJobs >= GUIDE_PDF_MAX_CONCURRENCY) {
    throw createHttpError(429, "Too many PDF exports are in progress. Please retry shortly.", "LMS_PDF_BUSY");
  }
  activeGuidePdfJobs += 1;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ javaScriptEnabled: false });
    await page.route("**/*", (route) => route.abort());
    await page.setContent(buildGuidePdfHtml(guide), { waitUntil: "domcontentloaded", timeout: 10_000 });
    return await page.pdf({ format: "A4", printBackground: true, timeout: 15_000 });
  } finally {
    await browser.close();
    activeGuidePdfJobs -= 1;
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
  studentGraphService = null,
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

  registerTrackerRoutes(router, { createHandle, lmsTrackerService });
  registerResourceRoutes(router, {
    createHandle,
    lmsStore,
    duplicateDetector,
    readingTimeEstimator,
    interactionTracker,
    examFeedbackService,
    upload,
    uploadLimiter,
    commentLimiter,
    requestLimiter,
    ensureAdmin,
    parseResourcePayload,
    persistUploadedFile,
    lmsFilesDir: LMS_FILES_DIR,
    toBoolean,
  });
  registerGuideRoadmapRoutes(router, {
    createHandle,
    lmsStore,
    toBoolean,
    renderGuidePdf,
  });
  registerLearningAdminRoutes(router, {
    createHandle,
    lmsStore,
    recommendationEngine,
    featureFlagService,
    ensureAdmin,
    renderGuidePdf,
    studentGraphService,
  });
  registerSearchRoutes(router, { createHandle, lmsStore });

  return router;
}

module.exports = {
  createLmsRoutes,
  buildGuidePdfHtml,
  escapePrintableText,
};
