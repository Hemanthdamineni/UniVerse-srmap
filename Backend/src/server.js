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
  ADMIN_CONTENT_PASSWORD,
  ERP_UI_MAP_FILE,
  ERP_ARTIFACT_MAX_AGE_DAYS,
  FRONTEND_BLUEPRINT_FILE,
  EVENTS_DATA_DIR,
  EVENTS_DB_PATH,
  HELPDESK_DB_PATH,
  CAREER_DB_PATH,
  FEEDBACK_AUTOMATION_ENABLED,
  UPLOADS_DIR,
  LMS_FILES_DIR,
} = require("./config/env");
const { EXTERNAL_PAGE_SEED_DATA } = require("./data/externalSeedData");
const scrapeTargets = require("./config/scrapeTargets");
const { createApp } = require("./app");
const { DiscoveryRepository } = require("./services/discoveryRepository");
const { ExternalDataStore } = require("./services/externalDataStore");
const { ContentStore } = require("./services/contentStore");
const { SessionStore } = require("./services/sessionStore");
const { RedisSessionStore } = require("./services/redisSessionStore");
const {
  InMemoryErpCacheStore,
  RedisErpCacheStore,
} = require("./services/erpCacheStore");
const { getRedisClient } = require("./services/redisClient");
const { ErpLiveService } = require("./services/erpLiveService");
const { FeedbackAutomationService } = require("./services/feedbackAutomationService");
const { ErpAggregationService } = require("./services/erpAggregationService");
const { ErpUiMapStore } = require("./services/erpUiMapStore");
const { ErpActionExecutor } = require("./services/erpActionExecutor");
const { createApiContext } = require("./services/erpClient");
const { PagePolicyStore } = require("./services/pagePolicyStore");
const { EventsStore } = require("./services/eventsStore");
const { createCompetitionStore } = require("./services/competitionStore");
const { HelpdeskStore } = require("./services/helpdeskStore");
const { CareerStore } = require("./services/careerStore");
const { LmsTrackerService } = require("./services/lmsTrackerService");
const { LmsStore } = require("./services/lmsStore");
const { LmsModerationService } = require("./services/lmsModerationService");
const { LmsRevisionScheduler } = require("./services/lmsRevisionScheduler");
const { LmsReadingTimeEstimator } = require("./services/lmsReadingTimeEstimator");
const { LmsDuplicateDetector } = require("./services/lmsDuplicateDetector");
const { LmsFeatureFlagService } = require("./services/lmsFeatureFlagService");
const { LmsRecommendationEngine } = require("./services/lmsRecommendationEngine");
const { LmsInteractionQueue } = require("./services/lmsInteractionQueue");
const { LmsInteractionTracker } = require("./services/lmsInteractionTracker");
const { LmsExamFeedbackService } = require("./services/lmsExamFeedbackService");
const { ErpIntegrityService } = require("./services/erpIntegrityService");
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
  const redisClient = await getRedisClient();
  const discoveryRepository = new DiscoveryRepository(DISCOVERY_FILE_CANDIDATES);
  const externalDataStore = new ExternalDataStore(EXTERNAL_DB_PATH);
  const contentStore = new ContentStore(CONTENT_DB_PATH);
  const sessionStore = await createSessionStore(redisClient);
  const erpCacheStore = await createErpCacheStore(redisClient);
  const pagePolicyStore = new PagePolicyStore(ERP_PAGE_POLICY_FILE);
  const uiMapStore = new ErpUiMapStore({
    uiMapFile: ERP_UI_MAP_FILE,
    scrapeTargets,
  });
  const erpLiveService = new ErpLiveService({
    sessionStore,
    discoveryRepository,
    scrapeTargets,
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
  const helpdeskStore = new HelpdeskStore({
    dbPath: HELPDESK_DB_PATH,
  });
  const careerStore = new CareerStore({
    dbPath: CAREER_DB_PATH,
  });
  const lmsModerationService = new LmsModerationService();
  const lmsRevisionScheduler = new LmsRevisionScheduler();
  const lmsStore = new LmsStore({
    dbPath: LMS_DB_PATH,
    filesDir: LMS_FILES_DIR,
    moderationService: lmsModerationService,
    revisionScheduler: lmsRevisionScheduler,
  });
  const lmsReadingTimeEstimator = new LmsReadingTimeEstimator();
  const lmsDuplicateDetector = new LmsDuplicateDetector({ lmsStore });
  const lmsFeatureFlagService = new LmsFeatureFlagService({ lmsStore });
  const lmsRecommendationEngine = new LmsRecommendationEngine({
    lmsStore,
    featureFlagService: lmsFeatureFlagService,
  });
  const lmsInteractionQueue = new LmsInteractionQueue({ lmsStore });
  const lmsInteractionTracker = new LmsInteractionTracker({
    lmsStore,
    queue: lmsInteractionQueue,
    recommendationEngine: lmsRecommendationEngine,
  });
  const lmsTrackerService = new LmsTrackerService({
    erpAggregationService,
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

  const app = createApp({
    sessionStore,
    discoveryRepository,
    externalDataStore,
    contentStore,
    contentAdminPassword: ADMIN_CONTENT_PASSWORD,
    feedbackService,
    eventsStore,
    helpdeskStore,
    careerStore,
    competitionStore,
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
    uploadsDir: UPLOADS_DIR,
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

  const { runCareerNotificationCycle } = require("./services/careerNotifier");
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
    lmsInteractionQueue.stop();
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
