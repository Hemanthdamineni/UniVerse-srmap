const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");
const { log } = require("../utils/logger");
const { assertAdminAccess } = require("../utils/adminAccess");
const { createUserContextMiddleware } = require("../utils/eventsAuth");
const { createHttpError } = require("../services/lms/lmsUtils");

// Extension -> permitted MIME types for the general `/uploads` slot
// (Gate 5 P1). Kept narrow on purpose: this is a catch-all endpoint
// and most uploads should go through the LMS resource route which
// has its own allowlist tuned for course material.
const RESOURCE_ALLOWED_MIME_TYPES = {
  ".pdf": ["application/pdf"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".gif": ["image/gif"],
  ".txt": ["text/plain"],
  ".csv": ["text/csv", "application/csv"],
};

function toSafeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function toUpper(value) {
  return toSafeString(value).toUpperCase();
}

function createResourceRoutes({ contentStore, sessionStore, adminPassword = "", uploadsDir }) {
  const router = express.Router();
  const userContext = createUserContextMiddleware({ sessionStore, adminPassword });
  const uploadRoot = uploadsDir || path.join(__dirname, "../../data/uploads");
  fs.mkdirSync(uploadRoot, { recursive: true });

  function ensureAuthenticated(req, res, next) {
    if (!req.userContext || !req.userContext.isAuthenticated) {
      const error = new Error("Authentication required. Please sign in.");
      error.status = 401;
      return sendApiError(res, req, error);
    }
    next();
  }

  function adminActor(req) {
    return {
      actorId: req.userContext?.userId || req.adminContext?.registerNo || req.get("x-admin-actor") || "admin",
      actorRole: req.userContext?.role || "admin",
    };
  }

  router.use(userContext);
  router.use(ensureAuthenticated);
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadRoot),
      filename: (_req, file, cb) => {
        const safeExt = path.extname(file.originalname || "").slice(0, 10).replace(/[^a-zA-Z0-9.]/g, "");
        const unique = `${Date.now()}-${crypto.randomUUID()}`;
        cb(null, `${unique}${safeExt || ""}`);
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    // MIME allowlist (Gate 5 P1). The endpoint name is `/uploads`
    // — a general-purpose attachment slot — so the allowlist is a
    // narrow set of safe types rather than the broader LMS set.
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const allowed = RESOURCE_ALLOWED_MIME_TYPES[ext];
      if (!allowed) {
        return cb(createHttpError(400, `Unsupported file extension: ${ext || "unknown"}`, "RESOURCE_INVALID_FILE"));
      }
      if (!allowed.includes(file.mimetype)) {
        return cb(createHttpError(400, `Unsupported MIME type: ${file.mimetype}`, "RESOURCE_INVALID_MIME"));
      }
      return cb(null, true);
    },
  });

  router.post("/uploads", upload.single("file"), (req, res) => {
    try {
      if (!req.file) {
        const error = new Error("No file uploaded");
        error.status = 400;
        throw error;
      }
      return sendApiSuccess(res, req, {
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        url: `/uploads/${req.file.filename}`,
      });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/resources/catalog", (req, res) => {
    try {
      const year = req.query.year;
      const data = contentStore.getLearningMaterialCatalog({ year });
      log({
        msg: "Learning-material catalog viewed",
        requestId: req.requestId,
        year: year === undefined ? null : String(year),
        courseCount: data.courses.length,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/resources/subjects", (req, res) => {
    try {
      const data = contentStore.getLearningMaterialSubjects({
        year: req.query.year,
        courseCode: req.query.courseCode,
      });
      log({
        msg: "Learning-material subject list viewed",
        requestId: req.requestId,
        year: req.query.year === undefined ? null : String(req.query.year),
        courseCode: req.query.courseCode === undefined ? null : String(req.query.courseCode),
        subjectCount: data.subjects.length,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/resources/library", (req, res) => {
    try {
      const data = contentStore.getLearningMaterialLibrary({
        year: req.query.year,
        courseCode: req.query.courseCode,
        subjectCode: req.query.subjectCode,
        query: req.query.query,
      });
      log({
        msg: "Learning-material library viewed",
        requestId: req.requestId,
        year: req.query.year === undefined ? null : String(req.query.year),
        courseCode: req.query.courseCode === undefined ? null : String(req.query.courseCode),
        subjectCode: req.query.subjectCode === undefined ? null : String(req.query.subjectCode),
        totalItems: data.totalItems,
        totalResources: data.totalResources,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/resources/admin/items", (req, res) => {
    try {
      assertAdminAccess(req, adminPassword);
      const year = toSafeString(req.query.year);
      const courseCode = toUpper(req.query.courseCode);
      const subjectCode = toUpper(req.query.subjectCode);
      const query = toSafeString(req.query.query).toLowerCase();

      const items = contentStore
        .listContent({
          type: "learning_material",
          lifecycleState: req.query.lifecycleState,
          includeAllStates: true,
          includeDeleted: req.query.includeDeleted === "true",
          page: req.query.page,
          limit: req.query.limit || 100,
        })
        .filter((item) => {
          const metadata = item.metadata || {};
          if (year && String(metadata.year || "") !== year) return false;
          if (courseCode && String(metadata.courseCode || "") !== courseCode) return false;
          if (subjectCode && String(metadata.subjectCode || "") !== subjectCode) return false;
          if (!query) return true;
          return [item.title, item.description, metadata.subjectName, metadata.courseName]
            .join(" ")
            .toLowerCase()
            .includes(query);
        })
        .map((item) => ({
          ...item,
          resources: contentStore.listResources(item.id),
        }));

      return sendApiSuccess(res, req, { items });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/resources/items", (req, res) => {
    try {
      assertAdminAccess(req, adminPassword);
      const payload = {
        ...(req.body || {}),
        type: "learning_material",
      };
      const data = contentStore.createContent(payload, {
        actor: adminActor(req),
        reason: "Admin published learning material",
      });
      return sendApiSuccess(res, req, {
        ...data,
        resources: contentStore.listResources(data.id),
      });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.put("/resources/items/:contentId", (req, res) => {
    try {
      assertAdminAccess(req, adminPassword);
      const payload = {
        ...(req.body || {}),
        type: "learning_material",
      };
      const data = contentStore.updateContent(req.params.contentId, payload, {
        actor: adminActor(req),
        reason: "Admin edited learning material",
      });
      return sendApiSuccess(res, req, {
        ...data,
        resources: contentStore.listResources(data.id),
      });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.delete("/resources/items/:contentId", (req, res) => {
    try {
      assertAdminAccess(req, adminPassword);
      const data = contentStore.deleteContent(req.params.contentId, adminActor(req));
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/resources/items/:contentId/history", (req, res) => {
    try {
      assertAdminAccess(req, adminPassword);
      return sendApiSuccess(res, req, {
        items: contentStore.listContentHistory(req.params.contentId, { limit: req.query.limit }),
      });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.patch("/resources/items/:contentId/lifecycle", (req, res) => {
    try {
      assertAdminAccess(req, adminPassword);
      const data = contentStore.transitionContent(
        req.params.contentId,
        {
          action: req.body?.action,
          reason: req.body?.reason || "Admin lifecycle transition",
        },
        adminActor(req)
      );
      return sendApiSuccess(res, req, {
        ...data,
        resources: contentStore.listResources(data.id),
      });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/resources/admin/items/bulk-preview", (req, res) => {
    try {
      assertAdminAccess(req, adminPassword);
      return sendApiSuccess(res, req, contentStore.previewBulkLifecycle({
        ids: req.body?.ids,
        action: req.body?.action,
      }));
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/resources/admin/items/bulk-execute", (req, res) => {
    try {
      assertAdminAccess(req, adminPassword);
      const data = contentStore.bulkTransitionContent(
        {
          ids: req.body?.ids,
          action: req.body?.action,
          reason: req.body?.reason || "Bulk resource lifecycle update",
        },
        adminActor(req)
      );
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/resources/recommendations", (req, res) => {
    try {
      const payload = req.body || {};
      const title = toSafeString(payload.title);
      const url = toSafeString(payload.url);
      if (!title || !url) {
        const error = new Error("title and url are required");
        error.status = 400;
        throw error;
      }

      const record = contentStore.createContent(
        {
          type: "page",
          title,
          description: toSafeString(payload.description),
          category: "resource-recommendation",
          lifecycleState: "review",
          metadata: {
            status: "pending",
            year: payload.year,
            courseCode: payload.courseCode,
            courseName: payload.courseName,
            subjectCode: payload.subjectCode,
            subjectName: payload.subjectName,
            resourceGroup: payload.resourceGroup || "links",
            recommenderUserId: req.userContext.userId,
            recommenderName: req.userContext.name,
            recommenderEmail: req.userContext.email,
            reviewerNotes: "",
          },
          resources: [
            {
              kind: payload.kind || "link",
              title,
              url_or_path: url,
            },
          ],
        },
        {
          actor: {
            actorId: req.userContext.userId,
            actorRole: "student",
          },
          action: "submit_review",
          reason: "Student submitted resource recommendation",
        }
      );

      return sendApiSuccess(res, req, record);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/resources/recommendations", (req, res) => {
    try {
      assertAdminAccess(req, adminPassword);
      const items = contentStore
        .listContent({ type: "page", category: "resource-recommendation", includeAllStates: true })
        .map((item) => ({
          ...item,
          resources: contentStore.listResources(item.id),
        }))
        .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
      return sendApiSuccess(res, req, { items });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.patch("/resources/recommendations/:contentId", (req, res) => {
    try {
      assertAdminAccess(req, adminPassword);
      const existing = contentStore.getContent(req.params.contentId);
      if (!existing || existing.category !== "resource-recommendation") {
        const error = new Error("Recommendation not found");
        error.status = 404;
        throw error;
      }

      const status = toSafeString(req.body?.status).toLowerCase();
      if (!["approved", "rejected", "pending"].includes(status)) {
        const error = new Error("Invalid status");
        error.status = 400;
        throw error;
      }

      const next = contentStore.updateContent(
        req.params.contentId,
        {
          lifecycleState: status === "approved" ? "published" : status === "rejected" ? "archived" : "review",
          metadata: {
            ...(existing.metadata || {}),
            status,
            reviewerNotes: toSafeString(req.body?.reviewerNotes),
            reviewedAt: new Date().toISOString(),
          },
        },
        {
          actor: adminActor(req),
          action: "review_resource_recommendation",
          reason: req.body?.reviewerNotes || `Recommendation marked ${status}`,
        }
      );

      return sendApiSuccess(res, req, next);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  return router;
}

module.exports = {
  createResourceRoutes,
};
