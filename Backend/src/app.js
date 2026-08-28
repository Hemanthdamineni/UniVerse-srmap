const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const { createHealthRoutes } = require("./routes/healthRoutes");
const { createAuthRoutes } = require("./routes/authRoutes");
const { createDebugRoutes } = require("./routes/debugRoutes");
const { createExternalRoutes } = require("./routes/externalRoutes");
const { createContentRoutes } = require("./routes/contentRoutes");
const { createResourceRoutes } = require("./routes/resourceRoutes");
const { createFeedbackRoutes } = require("./routes/feedbackRoutes");
const { createScrapeRoutes } = require("./routes/scrapeRoutes");
const { createErpV2Routes } = require("./routes/erpV2Routes");
const { createEventsRoutes } = require("./routes/eventsRoutes");
const { createHelpdeskRoutes } = require("./routes/helpdeskRoutes");
const { createCampusFeedbackRoutes } = require("./routes/campusFeedbackRoutes");
const { createCareerRoutes } = require("./routes/careerRoutes");
const { createCompetitionRoutes } = require("./routes/competitionRoutes");
const { createLmsRoutes } = require("./routes/lmsRoutes");
const { createProfileRoutes } = require("./routes/profileRoutes");
const { createRecommendationRoutes } = require("./routes/recommendationRoutes");
const { createCompanionAnalyticsRoutes } = require("./routes/companionAnalyticsRoutes");
const { createAttendanceRoutes } = require("./routes/attendanceRoutes");
const { createMetricsRoutes } = require("./routes/metricsRoutes");
const { createTelemetryRoutes } = require("./routes/telemetryRoutes");
const { createAcademicCalendarRoutes } = require("./routes/academicCalendarRoutes");
const { createFacultyCabinRoutes } = require("./routes/facultyCabinRoutes");
const { createVacantRoomRoutes } = require("./routes/vacantRoomRoutes");
const { createPersistentTeamRoutes } = require("./routes/persistentTeamRoutes");
const { createAdminRoutes } = require("./routes/adminRoutes");
const { createRequestContextMiddleware } = require("./middleware/requestContext");
const { createAdminContextMiddleware } = require("./middleware/adminContext");
const { createGlobalRateLimitMiddleware, createLoginRateLimitMiddleware } = require("./middleware/rateLimit");
const { FEATURE_ERP_V2_API } = require("./config/env");
const { sendApiError } = require("./utils/apiResponse");

function createApp({
  sessionStore,
  discoveryRepository,
  externalDataStore,
  contentStore,
  contentAdminPassword,
  feedbackService,
  eventsStore,
  helpdeskStore,
  campusFeedbackStore,
  careerStore,
  scraperSupervisorStatus,
  scraperTriggerOnce,
  competitionStore,
  persistentTeamStore,
  unifiedProfileStore,
  companionAnalyticsStore,
  lmsStore,
  lmsTrackerService,
  recommendationEngine,
  interactionTracker,
  examFeedbackService,
  duplicateDetector,
  readingTimeEstimator,
  featureFlagService,
  erpAggregationService,
  erpLiveService,
  uiMapStore,
  actionExecutor,
  pagePolicyStore,
  redisClient,
  integrityService,
  erpDumpService,
  uploadsDir,
  vacantRoomStore,
  attendanceSnapshotStore,
  erpDataSink,
}) {
  const app = express();

  // Same-origin CORS lockdown (Gate 6 P1). The frontend and the API
  // are served from the same origin behind nginx, so a permissive
  // cors() is just attack surface. Reflect the request's Origin
  // header only when it matches a same-origin allowlist, and only
  // when credentials are present (cookie-mode routes).
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  app.use(
    cors({
      origin(origin, cb) {
        // Same-origin requests have no Origin header in many cases;
        // allow them. For cross-origin, require an explicit allowlist
        // entry — empty by default, so cross-origin is rejected
        // unless the operator opts in.
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    })
  );
  app.use(helmet());
  app.use(cookieParser());
  app.use(compression());
  app.use(createRequestContextMiddleware());
  app.use(createAdminContextMiddleware({ sessionStore }));
  if (eventsStore?.dataDir) {
    const submissionsPath = path.join(eventsStore.dataDir, "../submissions");
    const certificatesPath = path.join(eventsStore.dataDir, "../certificates");
    fs.mkdirSync(submissionsPath, { recursive: true });
    fs.mkdirSync(certificatesPath, { recursive: true });
    // Uploaded artifacts are immutable once written; let browsers reuse them
    // instead of revalidating on every render.
    const uploadedFilesStatic = { maxAge: "7d" };
    app.use("/files/submissions", express.static(submissionsPath, uploadedFilesStatic));
    app.use("/files/certificates", express.static(certificatesPath, uploadedFilesStatic));
  }
  if (uploadsDir) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    app.use("/uploads", express.static(uploadsDir, { maxAge: "1h" }));
  }
  app.use("/api", createGlobalRateLimitMiddleware({ redisClient }));
  app.use(
    [
      "/api/captcha",
      "/api/auth/captcha",
      "/api/login",
      "/api/auth/login",
      "/api/forgot",
      "/api/auth/forgot",
    ],
    createLoginRateLimitMiddleware({ redisClient })
  );
  app.use("/api", express.json({ limit: "2mb" }));

  app.use(
    "/api",
    createHealthRoutes({
      sessionStore,
      discoveryRepository,
      pagePolicyStore,
      redisClient,
      externalDataStore,
      contentStore,
      integrityService,
      careerStore,
    })
  );
  app.use("/api", createMetricsRoutes());
  app.use("/api", createTelemetryRoutes());
  if (companionAnalyticsStore) {
    app.use(
      "/api",
      createCompanionAnalyticsRoutes({
        analyticsStore: companionAnalyticsStore,
        sessionStore,
        adminPassword: contentAdminPassword,
      })
    );
  }
  if (erpDumpService) {
    app.use("/api", createDebugRoutes({ erpDumpService }));
  }
  app.use("/api", createAuthRoutes({ sessionStore, erpDumpService }));
  app.use("/api", createAdminRoutes({ sessionStore, adminPassword: contentAdminPassword }));
  if (FEATURE_ERP_V2_API) {
    app.use("/api", createErpV2Routes({ erpAggregationService, uiMapStore, actionExecutor, dataSink: erpDataSink }));
  }
  app.use("/api", createExternalRoutes({ externalDataStore }));
  if (contentStore) {
    app.use("/api", createContentRoutes({ contentStore, adminPassword: contentAdminPassword }));
    app.use(
      "/api",
      createResourceRoutes({
        contentStore,
        sessionStore,
        adminPassword: contentAdminPassword,
        uploadsDir,
      })
    );
  }
  if (feedbackService) {
    app.use("/api", createFeedbackRoutes({ feedbackService }));
  }
  app.use(
    "/api",
    createEventsRoutes({
      eventsStore,
      sessionStore,
      competitionStore,
      adminPassword: contentAdminPassword,
    })
  );
  if (helpdeskStore) {
    app.use(
      "/api",
      createHelpdeskRoutes({
        helpdeskStore,
        sessionStore,
        adminPassword: contentAdminPassword,
      })
    );
  }
  if (campusFeedbackStore) {
    app.use(
      "/api",
      createCampusFeedbackRoutes({
        campusFeedbackStore,
        sessionStore,
        adminPassword: contentAdminPassword,
      })
    );
  }
  if (careerStore) {
    app.use(
      "/api",
      createCareerRoutes({
        careerStore,
        sessionStore,
        adminPassword: contentAdminPassword,
        lmsTrackerService,
        eventsStore,
        redisClient,
        scraperSupervisorStatus,
        scraperTriggerOnce,
      })
    );
  }
  if (competitionStore) {
    app.use(
      "/api",
      createCompetitionRoutes({
        competitionStore,
        sessionStore,
        adminPassword: contentAdminPassword,
      })
    );
  }
  if (persistentTeamStore) {
    app.use(
      "/api",
      createPersistentTeamRoutes({
        persistentTeamStore,
        sessionStore,
      })
    );
  }
  if (unifiedProfileStore) {
    app.use(
      "/api",
      createProfileRoutes({
        unifiedProfileStore,
        sessionStore,
        adminPassword: contentAdminPassword,
      })
    );
    app.use(
      "/api",
      createRecommendationRoutes({
        unifiedProfileStore,
        sessionStore,
        adminPassword: contentAdminPassword,
      })
    );
  }
  if (lmsStore) {
    app.use(
      "/api",
      createLmsRoutes({
        sessionStore,
        adminPassword: contentAdminPassword,
        lmsStore,
        lmsTrackerService,
        recommendationEngine,
        interactionTracker,
        examFeedbackService,
        duplicateDetector,
        readingTimeEstimator,
        featureFlagService,
      })
    );
  }
  app.use(
    "/api",
    createAttendanceRoutes({ sessionStore, attendanceSnapshotStore, erpAggregationService })
  );
  app.use("/api", createAcademicCalendarRoutes());
  app.use("/api", createFacultyCabinRoutes());
  if (vacantRoomStore) {
    app.use("/api", createVacantRoomRoutes({ vacantRoomStore }));
  }
  app.use("/api", createScrapeRoutes({ erpAggregationService, erpLiveService }));
  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }
    return sendApiError(res, req, error);
  });

  return app;
}

module.exports = {
  createApp,
};
