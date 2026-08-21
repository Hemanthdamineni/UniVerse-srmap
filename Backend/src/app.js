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
  competitionStore,
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
}) {
  const app = express();

  app.use(cors());
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
    app.use("/files/submissions", express.static(submissionsPath));
    app.use("/files/certificates", express.static(certificatesPath));
  }
  if (uploadsDir) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    app.use("/uploads", express.static(uploadsDir));
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
    app.use("/api", createErpV2Routes({ erpAggregationService, uiMapStore, actionExecutor }));
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
  app.use("/api", createAttendanceRoutes({ sessionStore }));
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
