require("dotenv").config();
const {
  PORT,
  SESSION_TTL_MS,
  REDIS_URL,
  SESSION_STORE_DRIVER,
  ERP_CACHE_DRIVER,
  DISCOVERY_FILE_CANDIDATES,
  ERP_PAGE_POLICY_FILE,
  EXTERNAL_DB_PATH,
  CONTENT_DB_PATH,
  LMS_DB_PATH,
  LMS_TRACKER_DB_PATH,
  UNIFIED_PROFILE_DB_PATH,
  COMPANION_ANALYTICS_DB_PATH,
  ADMIN_CONTENT_PASSWORD,
  ERP_UI_MAP_FILE,
  ERP_ARTIFACT_MAX_AGE_DAYS,
  FRONTEND_BLUEPRINT_FILE,
  EVENTS_DATA_DIR,
  EVENTS_DB_PATH,
  HELPDESK_DB_PATH,
  CAMPUS_FEEDBACK_DB_PATH,
  CAREER_DB_PATH,
  ERP_ATTENDANCE_SNAPSHOTS_DB_PATH,
  VACANT_ROOMS_DB_PATH,
  PERSISTENT_TEAMS_DB_PATH,
  FEEDBACK_AUTOMATION_ENABLED,
  UPLOADS_DIR,
  LMS_FILES_DIR,
} = require("./config/env");
const { EXTERNAL_PAGE_SEED_DATA } = require("./data/externalSeedData");
const path = require("path");
const fs = require("fs");
const scrapeTargets = require("./config/scrapeTargets");
const { createApp } = require("./app");
const { DiscoveryRepository } = require("./services/career/careerServices");
const { ExternalDataStore } = require("./services/campus/feedbackServices");
const { ContentStore } = require("./services/lms/contentStore");
const { SessionStore } = require("./services/core/sessionServices");
const { RedisSessionStore } = require("./services/core/sessionServices");
const {
  InMemoryErpCacheStore,
  RedisErpCacheStore,
} = require("./services/erp/erpServices");
const { getRedisClient } = require("./services/core/sessionServices");
const { ErpLiveService } = require("./services/erp/erpServices");
const { FeedbackAutomationService } = require("./services/campus/feedbackServices");
const { ErpAggregationService } = require("./services/erp/erpAggregationService");
const { ErpUiMapStore } = require("./services/erp/erpUiMapStore");
const { ErpActionExecutor } = require("./services/erp/erpActionExecutor");
const { AttendanceSnapshotStore } = require("./services/erp/attendanceSnapshotStore");
const { VacantRoomStore } = require("./services/erp/vacantRoomStore");
const { createApiContext } = require("./services/erp/erpClient");
const { PagePolicyStore } = require("./services/core/sessionServices");
const { EventsStore } = require("./services/events/eventsStore");
const { createCompetitionStore } = require("./services/events/competitionStore");
const { createPersistentTeamStore } = require("./services/events/persistentTeamStore");
const { HelpdeskStore } = require("./services/campus/helpdeskStore");
const { CampusFeedbackStore } = require("./services/campus/campusFeedbackStore");
const { CareerStore } = require("./services/career/careerStore");
const {
  createCareerScraperSupervisor,
} = require("./services/career/careerScraperSupervisor");
const { LmsTrackerService } = require("./services/lms/lmsTrackerService");
const { LmsTrackerStore } = require("./services/lms/lmsTrackerStore");
const { LmsStore } = require("./services/lms/lmsStore");
const { UnifiedProfileStore } = require("./services/core/unifiedProfileStore");
const { CompanionAnalyticsStore } = require("./services/career/careerServices");
const { LmsModerationService } = require("./services/lms/lmsServices");
const { LmsRevisionScheduler } = require("./services/lms/lmsServices");
const { LmsReadingTimeEstimator } = require("./services/lms/lmsServices");
const { LmsDuplicateDetector } = require("./services/lms/lmsServices");
const { LmsFeatureFlagService } = require("./services/lms/lmsServices");
const { LmsRecommendationEngine } = require("./services/lms/lmsServices");
const { LmsInteractionQueue } = require("./services/lms/lmsServices");
const { LmsInteractionTracker } = require("./services/lms/lmsServices");
const { LmsExamFeedbackService } = require("./services/lms/lmsServices");
const { ErpIntegrityService } = require("./services/erp/erpServices");
const { log, getLogFilePath, shutdownLogger } = require("./utils/logger");

async function createSessionStore(redisClient) {
  const shouldUseRedis =
    SESSION_STORE_DRIVER === "redis" ||
    (SESSION_STORE_DRIVER === "auto" && Boolean(redisClient) && Boolean(REDIS_URL));

  if (shouldUseRedis && redisClient) {
    return new RedisSessionStore({ client: redisClient, ttlMs: SESSION_TTL_MS });
  }

  return new SessionStore(SESSION_TTL_MS);
}

async function createErpCacheStore(redisClient) {
  const shouldUseRedis =
    ERP_CACHE_DRIVER === "redis" ||
    (ERP_CACHE_DRIVER === "auto" && Boolean(redisClient) && Boolean(REDIS_URL));

  if (shouldUseRedis && redisClient) {
    return new RedisErpCacheStore(redisClient);
  }

  return new InMemoryErpCacheStore();
}

async function startServer() {
  const isDebugMode = process.argv.includes("--debug");
  if (isDebugMode) {
    process.env.ERP_DEBUG_MODE = "1";
  }

  const isCaptureMode = process.argv.includes("--capture");
  if (isCaptureMode) {
    const { setCaptureDir } = require("./services/erp/erpClient");
    const { ErpDumpService } = require("./services/erp/erpServices");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const captureDir = path.join(ErpDumpService.getBaseDir(), timestamp);
    fs.mkdirSync(path.join(captureDir, "raw"), { recursive: true });
    setCaptureDir(captureDir);
    log({ level: "info", msg: `Capture mode: saving responses to ${captureDir}` });
  }

  const redisClient = await getRedisClient();
  const discoveryRepository = new DiscoveryRepository(DISCOVERY_FILE_CANDIDATES);
  const externalDataStore = new ExternalDataStore(EXTERNAL_DB_PATH);
  const contentStore = new ContentStore(CONTENT_DB_PATH);
  const sessionStore = await createSessionStore(redisClient);
  const erpCacheStore = await createErpCacheStore(redisClient);
  const pagePolicyStore = new PagePolicyStore(ERP_PAGE_POLICY_FILE);
  const { ErpDumpService } = require("./services/erp/erpServices");
  const erpDumpService = isDebugMode
    ? (ErpDumpService.resolveLatest()
        ? new ErpDumpService(ErpDumpService.resolveLatest())
        : null)
    : null;
  if (isDebugMode && !erpDumpService) {
    log({ level: "warn", msg: "Debug mode: no dump found. Run `npm run dump:erp` first." });
  }
  const uiMapStore = new ErpUiMapStore({
    uiMapFile: ERP_UI_MAP_FILE,
    scrapeTargets,
  });
  const erpLiveService = new ErpLiveService({
    sessionStore,
    discoveryRepository,
    scrapeTargets,
    erpDumpService,
  });
  const feedbackService = new FeedbackAutomationService({
    sessionStore,
    discoveryRepository,
    enabled: FEEDBACK_AUTOMATION_ENABLED,
  });
  const erpAggregationService = new ErpAggregationService({
    liveService: erpLiveService,
    cacheStore: erpCacheStore,
    pagePolicyStore,
    sessionStore,
    redisClient,
  });
  const actionExecutor = new ErpActionExecutor({
    uiMapStore,
    sessionStore,
    apiContextFactory: createApiContext,
    discoveryRepository,
  });
  const eventsStore = new EventsStore({
    dataDir: EVENTS_DATA_DIR,
    dbPath: EVENTS_DB_PATH,
    contentStore,
  });
  const competitionStore = createCompetitionStore({
    eventsStore,
    dbPath: EVENTS_DB_PATH,
  });
  const persistentTeamStore = createPersistentTeamStore({
    dbPath: PERSISTENT_TEAMS_DB_PATH,
  });
  const helpdeskStore = new HelpdeskStore({
    dbPath: HELPDESK_DB_PATH,
  });
  const campusFeedbackStore = new CampusFeedbackStore({
    dbPath: CAMPUS_FEEDBACK_DB_PATH,
  });
  const careerStore = new CareerStore({
    dbPath: CAREER_DB_PATH,
  });
  const careerScraperSupervisor = createCareerScraperSupervisor();
  const lmsModerationService = new LmsModerationService();
  const lmsRevisionScheduler = new LmsRevisionScheduler();
  const lmsStore = new LmsStore({
    dbPath: LMS_DB_PATH,
    filesDir: LMS_FILES_DIR,
    moderationService: lmsModerationService,
    revisionScheduler: lmsRevisionScheduler,
  });
  const lmsTrackerStore = new LmsTrackerStore({
    dbPath: LMS_TRACKER_DB_PATH,
  });
  const unifiedProfileStore = new UnifiedProfileStore({
    dbPath: UNIFIED_PROFILE_DB_PATH,
    lmsStore,
    careerStore,
    eventsStore,
    competitionStore,
  });
  const companionAnalyticsStore = new CompanionAnalyticsStore({
    dbPath: COMPANION_ANALYTICS_DB_PATH,
  });
  const lmsReadingTimeEstimator = new LmsReadingTimeEstimator();
  const lmsDuplicateDetector = new LmsDuplicateDetector({ lmsStore });
  const lmsFeatureFlagService = new LmsFeatureFlagService({ lmsStore });
  const lmsRecommendationEngine = new LmsRecommendationEngine({
    lmsStore,
    featureFlagService: lmsFeatureFlagService,
    unifiedProfileStore,
  });
  const lmsInteractionQueue = new LmsInteractionQueue({ lmsStore });
  const lmsInteractionTracker = new LmsInteractionTracker({
    lmsStore,
    queue: lmsInteractionQueue,
    recommendationEngine: lmsRecommendationEngine,
  });
  const lmsTrackerService = new LmsTrackerService({
    erpAggregationService,
    careerStore,
    trackerStore: lmsTrackerStore,
    lmsStore,
    recommendationEngine: lmsRecommendationEngine,
  });
  const lmsExamFeedbackService = new LmsExamFeedbackService({
    lmsStore,
    erpAggregationService,
  });
  const integrityService = new ErpIntegrityService({
    discoveryRepository,
    uiMapStore,
    scrapeTargets,
    externalSeedData: EXTERNAL_PAGE_SEED_DATA,
    frontendBlueprintFile: FRONTEND_BLUEPRINT_FILE,
    maxArtifactAgeDays: ERP_ARTIFACT_MAX_AGE_DAYS,
  });

  const externalSeeded = contentStore.seedExternalPages(EXTERNAL_PAGE_SEED_DATA);
  const eventsSeeded = contentStore.seedEvents(Array.isArray(eventsStore.events) ? eventsStore.events : []);

  const attendanceSnapshotStore = new AttendanceSnapshotStore({
    dbPath: ERP_ATTENDANCE_SNAPSHOTS_DB_PATH,
  });
  const vacantRoomStore = new VacantRoomStore({
    dbPath: VACANT_ROOMS_DB_PATH,
  });

  const app = createApp({
    sessionStore,
    discoveryRepository,
    externalDataStore,
    contentStore,
    contentAdminPassword: ADMIN_CONTENT_PASSWORD,
    feedbackService,
    eventsStore,
    helpdeskStore,
    campusFeedbackStore,
    careerStore,
    scraperSupervisorStatus: () => careerScraperSupervisor.getStatus(),
    scraperTriggerOnce: () => careerScraperSupervisor.triggerOnce(),
    competitionStore,
    persistentTeamStore,
    unifiedProfileStore,
    companionAnalyticsStore,
    lmsStore,
    lmsTrackerService,
    recommendationEngine: lmsRecommendationEngine,
    interactionTracker: lmsInteractionTracker,
    examFeedbackService: lmsExamFeedbackService,
    duplicateDetector: lmsDuplicateDetector,
    readingTimeEstimator: lmsReadingTimeEstimator,
    featureFlagService: lmsFeatureFlagService,
    erpAggregationService,
    erpLiveService,
    uiMapStore,
    actionExecutor,
    pagePolicyStore,
    redisClient,
    integrityService,
    erpDumpService,
    uploadsDir: UPLOADS_DIR,
    attendanceSnapshotStore,
    vacantRoomStore,
    erpDataSink: {
      onLivePageFetched({ pageKey, sessionId, payload }) {
        if (!sessionId || !payload) return;
        erpAggregationService
          .resolveUserKey(sessionId)
          .then((userKey) => {
            if (
              (pageKey === "academic/attendance-details" || pageKey === "academic/student-attendance") &&
              Array.isArray(payload.records)
            ) {
              attendanceSnapshotStore.record({ userKey, pageKey, records: payload.records });
              return;
            }
            if (pageKey === "academic/time-table" && Array.isArray(payload.schedule)) {
              vacantRoomStore.ingestTimetable(payload.schedule);
            }
          })
          .catch(() => {});
      },
    },
  });
  const reminderTicker = setInterval(() => {
    try {
      competitionStore.processDeadlineReminders();
    } catch (error) {
      log({
        level: "error",
        msg: "Deadline reminder job failed",
        error: error?.stack || error?.message || String(error),
      });
    }
  }, 5 * 60 * 1000);
  reminderTicker.unref();

  const { runCareerNotificationCycle } = require("./services/career/careerServices");
  const careerNotifyTicker = setInterval(() => {
    try {
      const summary = runCareerNotificationCycle({ careerStore, eventsStore });
      if (summary.deadlineSent || summary.digestSent) {
        log({
          msg: "Career notification cycle",
          deadlineSent: summary.deadlineSent,
          digestSent: summary.digestSent,
        });
      }
    } catch (error) {
      log({
        level: "error",
        msg: "Career notification job failed",
        error: error?.stack || error?.message || String(error),
      });
    }
  }, 15 * 60 * 1000);
  careerNotifyTicker.unref();

  let shuttingDown = false;
  const server = app.listen(PORT, () => {
    log({ msg: `Backend running on http://localhost:${PORT}` });
    log({ msg: `Persistent logs writing to ${getLogFilePath()}` });
    const discovery = discoveryRepository.getHealth();
    log({ msg: `Discovery map: ${discovery.filePath || "NOT FOUND"}` });
    if (!discovery.loaded) {
      log({ level: "warn", msg: "endpoint discovery file not found. Run endpoint discovery first." });
    }
    log({
      msg: `Unified content seeded: external=${externalSeeded}, events=${eventsSeeded}`,
    });
    log({
      msg: `ERP policy loaded from ${pagePolicyStore.getHealth().policyPath}`,
    });
    log({
      msg: `Feedback automation: ${FEEDBACK_AUTOMATION_ENABLED ? "enabled" : "disabled"}`,
    });
    const uiMapHealth = uiMapStore.getHealth();
    log({
      msg: `ERP UI map support: ${
        ERP_UI_MAP_FILE
          ? `${uiMapHealth.loaded ? "loaded" : "configured but empty"} (${uiMapHealth.mappedPageCount} mapped page keys)`
          : "disabled"
      }`,
    });
    const scraperStatus = careerScraperSupervisor.start();
    log({
      msg: `Career scraper: ${scraperStatus.state}${scraperStatus.pid ? ` (pid ${scraperStatus.pid})` : ""}`,
    });
  });

  server.on("error", (error) => {
    log({
      level: "error",
      msg: "HTTP server error",
      error,
    });
  });

  const shutdown = (signal, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;

    log({ level: "info", msg: `Received ${signal}, shutting down gracefully` });
    server.close(() => {
    log({ level: "info", msg: "HTTP server closed" });
    clearInterval(reminderTicker);
    careerScraperSupervisor.stop();
    lmsInteractionQueue.stop();
    // Release the in-memory cache sweep timer (no-op if cache is Redis-backed).
    if (typeof erpCacheStore?.close === "function") {
      erpCacheStore.close();
    }
    // Close Redis connections so the process can exit cleanly.
    if (redisClient && typeof redisClient.quit === "function") {
      redisClient.quit().catch(() => {});
    }
    shutdownLogger().finally(() => {
      process.exit(exitCode);
    });
    });

    setTimeout(() => {
      log({ level: "error", msg: "Forced shutdown after timeout" });
      shutdownLogger().finally(() => {
        process.exit(1);
      });
    }, 10000).unref();
  };

  process.on("unhandledRejection", (error) => {
    log({
      level: "error",
      msg: "Unhandled promise rejection",
      error: error instanceof Error ? error : new Error(String(error)),
    });
  });

  process.on("uncaughtException", (error) => {
    log({
      level: "error",
      msg: "Uncaught exception",
      error,
    });
    shutdown("uncaughtException", 1);
  });

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

if (require.main === module) {
  startServer().catch((error) => {
    log({
      level: "error",
      msg: "Failed to start backend",
      error: error?.stack || error?.message || String(error),
    });
    process.exitCode = 1;
  });
}

module.exports = {
  startServer,
};
