const express = require("express");
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
const { createStudentGraphRoutes } = require("./routes/studentGraphRoutes");
const { createNotificationRoutes } = require("./routes/notificationRoutes");
const { createGoogleCalendarRoutes } = require("./routes/googleCalendarRoutes");
const { createDeadlineRoutes } = require("./routes/deadlineRoutes");
const { createCompanionAnalyticsRoutes } = require("./routes/companionAnalyticsRoutes");
const { createAttendanceRoutes } = require("./routes/attendanceRoutes");
const { createMetricsRoutes } = require("./routes/metricsRoutes");
const { createTelemetryRoutes } = require("./routes/telemetryRoutes");
const { createAcademicCalendarRoutes } = require("./routes/academicCalendarRoutes");
const { createFacultyCabinRoutes } = require("./routes/facultyCabinRoutes");
const { createVacantRoomRoutes } = require("./routes/vacantRoomRoutes");
const { createPersistentTeamRoutes } = require("./routes/persistentTeamRoutes");
const { createScoresRoutes } = require("./routes/scoresRoutes");
const { createHostelBuddyRoutes } = require("./routes/hostelBuddyRoutes");
const { createUserDirectoryRoutes } = require("./routes/userDirectoryRoutes");
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
  studentGraphService,
  studentIntentStore,
  notificationStore,
  notificationService,
  vapid,
  calendarSyncService,
  classroomService,
  unifiedDeadlineService,
  erpAcademicSnapshotStore,
  appBaseUrl = "",
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
  hostelBuddyStore,
  userDirectoryStore = null,
}) {
  const app = express();
  // The backend is only published through the single nginx ingress hop.
  // `req.ip` therefore reflects nginx's rewritten forwarding header and is
  // safe for rate-limiter keys.
  app.set("trust proxy", 1);

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
  // Runtime data is deliberately not exposed as a static URL namespace.
  // Domain routes provide authenticated, authorization-aware downloads for
  // artifacts that users are allowed to retrieve.
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
  app.use("/api", createTelemetryRoutes({ sessionStore, adminPassword: contentAdminPassword }));
  if (hostelBuddyStore) {
    // Mount EARLY so other routes' catchalls (e.g. scrapeRoutes'
    // /:pageKey) can't shadow /api/hostel-buddy/*.
    app.use(
      "/api",
      createHostelBuddyRoutes({
        hostelBuddyStore,
      })
    );
  }
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
  if (userDirectoryStore) {
    app.use(
      "/api",
      createUserDirectoryRoutes({
        userDirectory: userDirectoryStore,
        sessionStore,
        adminPassword: contentAdminPassword,
      })
    );
  }
  app.use(
    "/api",
    createEventsRoutes({
      eventsStore,
      sessionStore,
      competitionStore,
      studentGraphService,
      userDirectory: userDirectoryStore,
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
        studentGraphService,
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
        userDirectory: userDirectoryStore,
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
  if (competitionStore) {
    app.use(
      "/api",
      createScoresRoutes({
        competitionStore,
        eventsStore,
        persistentTeamStore,
        sessionStore,
        adminPassword: contentAdminPassword,
      })
    );
  }
  // (hostelBuddyStore is mounted earlier — see above — so the
  // scrape catchall /:pageKey can't shadow /api/hostel-buddy/*)
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
  if (studentGraphService) {
    app.use(
      "/api",
      createStudentGraphRoutes({
        studentGraphService,
        studentIntentStore,
        sessionStore,
        adminPassword: contentAdminPassword,
      })
    );
  }
  if (notificationStore) {
    app.use(
      "/api",
      createNotificationRoutes({
        notificationStore,
        notificationService,
        vapid,
        sessionStore,
        adminPassword: contentAdminPassword,
      })
    );
  }
  if (calendarSyncService) {
    app.use(
      "/api",
      createGoogleCalendarRoutes({
        calendarSyncService,
        classroomService,
        erpAcademicSnapshotStore,
        careerStore,
        appBaseUrl,
        sessionStore,
        adminPassword: contentAdminPassword,
      })
    );
  }
  if (unifiedDeadlineService) {
    app.use(
      "/api",
      createDeadlineRoutes({ unifiedDeadlineService, sessionStore, adminPassword: contentAdminPassword })
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
        studentGraphService,
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
