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
  ERP_ACADEMIC_SNAPSHOTS_DB_PATH,
  GOOGLE_TOKENS_DB_PATH,
  APP_BASE_URL,
  EMAIL_CONFIG,
  VACANT_ROOMS_DB_PATH,
  PERSISTENT_TEAMS_DB_PATH,
  HOSTEL_BUDDY_DB_PATH,
  USER_DIRECTORY_DB_PATH,
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
const { ErpAcademicSnapshotStore } = require("./services/erp/erpAcademicSnapshotStore");
const { VacantRoomStore, timetableScheduleFromPagePayload } = require("./services/erp/vacantRoomStore");
const { createApiContext } = require("./services/erp/erpClient");
const { PagePolicyStore } = require("./services/core/sessionServices");
const { EventsStore } = require("./services/events/eventsStore");
const { createCompetitionStore } = require("./services/events/competitionStore");
const { createPersistentTeamStore } = require("./services/events/persistentTeamStore");
const { HelpdeskStore } = require("./services/campus/helpdeskStore");
const { CampusFeedbackStore } = require("./services/campus/campusFeedbackStore");
const { HostelBuddyStore } = require("./services/campus/hostelBuddyStore");
const { UserDirectoryStore } = require("./services/core/userDirectoryStore");
const { CareerStore } = require("./services/career/careerStore");
const {
  createCareerScraperSupervisor,
} = require("./services/career/careerScraperSupervisor");
const { LmsTrackerService } = require("./services/lms/lmsTrackerService");
const { LmsTrackerStore } = require("./services/lms/lmsTrackerStore");
const { LmsStore } = require("./services/lms/lmsStore");
const { UnifiedProfileStore } = require("./services/core/unifiedProfileStore");
const { StudentGraphService } = require("./services/core/studentGraphService");
const { StudentIntentStore } = require("./services/core/studentIntentStore");
const { NotificationStore } = require("./services/core/notificationStore");
const {
  NotificationService,
  createInAppAdapter,
  createWebPushAdapter,
  createEmailAdapter,
  createNativePushAdapter,
} = require("./services/core/notificationService");
const { runWeeklyDigestCycle } = require("./services/core/digestService");
const { GoogleTokenStore } = require("./services/core/googleTokenStore");
const { CalendarSyncService } = require("./services/core/calendarSyncService");
const { ClassroomService } = require("./services/core/classroomService");
const { UnifiedDeadlineService } = require("./services/core/unifiedDeadlineService");
const { resolveVapid } = require("./config/vapid");
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
const academicCalendar = require("./services/core/academicCalendar");
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
  const hostelBuddyStore = new HostelBuddyStore({
    dbPath: HOSTEL_BUDDY_DB_PATH,
  });
  const userDirectoryStore = new UserDirectoryStore({
    dbPath: USER_DIRECTORY_DB_PATH,
  });
  const careerStore = new CareerStore({
    dbPath: CAREER_DB_PATH,
  });
  const careerScraperSupervisor = createCareerScraperSupervisor();
  const lmsModerationService = new LmsModerationService();
  const lmsRevisionScheduler = new LmsRevisionScheduler({ academicCalendar });
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

  // Batch B5 — what the student told us they want, plus consent choices.
  // Shares the unified-profile DB file (same "who is this student" concern).
  const studentIntentStore = new StudentIntentStore({ dbPath: UNIFIED_PROFILE_DB_PATH });

  // Batch B6 — last-known curriculum / results / CGPA per user, fed by the
  // live-data sink, read synchronously by the student graph.
  const erpAcademicSnapshotStore = new ErpAcademicSnapshotStore({
    dbPath: ERP_ACADEMIC_SNAPSHOTS_DB_PATH,
  });

  // Batch B10 — Google Calendar sync. Inert until GOOGLE_CLIENT_* env is set.
  const googleTokenStore = new GoogleTokenStore({ dbPath: GOOGLE_TOKENS_DB_PATH });
  const calendarSyncService = new CalendarSyncService({ tokenStore: googleTokenStore, log });
  // Batch B12 — Classroom read-only pull (further gated on GOOGLE_CLASSROOM_ENABLED=1)
  // + a merged deadline timeline that works with or without Classroom.
  const classroomService = new ClassroomService({ tokenStore: googleTokenStore, log });
  const unifiedDeadlineService = new UnifiedDeadlineService({ classroomService, careerStore, eventsStore });

  // Batch B8 — one channel-agnostic notification layer. In-app always; Web
  // Push when a VAPID keypair is present (auto-generated in dev).
  const vapid = resolveVapid();
  const notificationStore = new NotificationStore({ dbPath: UNIFIED_PROFILE_DB_PATH });
  const emailAdapter = createEmailAdapter({ store: notificationStore, config: EMAIL_CONFIG });
  const notificationService = new NotificationService({
    store: notificationStore,
    adapters: [
      createInAppAdapter({ eventsStore }),
      createWebPushAdapter({ store: notificationStore, vapid }),
      createNativePushAdapter({ store: notificationStore }),
      emailAdapter,
    ],
  });

  // Batch B4 — the student graph composes identity + academic + skills +
  // activity + derived signals from the stores above. In-process TTL cache for
  // now; swap `cache` for a Redis-backed get/set/delete when available.
  const studentGraphService = new StudentGraphService({
    unifiedProfileStore,
    attendanceSnapshotStore,
    careerStore,
    studentIntentStore,
    erpReader: erpAcademicSnapshotStore.readerFor(),
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
    hostelBuddyStore,
    userDirectoryStore,
    careerStore,
    scraperSupervisorStatus: () => careerScraperSupervisor.getStatus(),
    scraperTriggerOnce: () => careerScraperSupervisor.triggerOnce(),
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
    appBaseUrl: APP_BASE_URL,
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
            // Any fresh academic/exam page can move a graph input — drop the
            // cached graph so the next read recomputes (B4 / T3.1.3).
            if (userKey && (String(pageKey).startsWith("academic/") || String(pageKey).startsWith("examination/"))) {
              studentGraphService.invalidate(userKey);
              // Capture curriculum / results / CGPA / exam history for the graph.
              // Note whether graded results existed *before* this ingest so the
              // results-published notification only fires on the transition.
              const hadResults = erpAcademicSnapshotStore.hasGradedResults(userKey);
              erpAcademicSnapshotStore.ingest({ userKey, pageKey, payload });
              if (!hadResults && erpAcademicSnapshotStore.hasGradedResults(userKey)) {
                void notificationService.emit("results_published", { userId: userKey }).catch(() => {});
              }
            }
            if (
              (pageKey === "academic/attendance-details" || pageKey === "academic/student-attendance") &&
              Array.isArray(payload.records)
            ) {
              const outcome = attendanceSnapshotStore.record({ userKey, pageKey, records: payload.records });
              // Only alert on a *changed* snapshot, so a re-fetch doesn't
              // re-notify. One notification per breaching subject (B8 / T6.2.3).
              if (outcome === "stored") {
                for (const r of payload.records) {
                  const pct = Number.parseFloat(String(r.attendancePercentage ?? "").replace("%", ""));
                  if (Number.isFinite(pct) && pct < 75) {
                    const conducted = Number.parseInt(String(r.classesConducted ?? ""), 10);
                    const present = Number.parseInt(String(r.present ?? ""), 10);
                    const needed =
                      Number.isFinite(conducted) && Number.isFinite(present)
                        ? Math.max(0, Math.ceil((0.75 * conducted - present) / 0.25))
                        : null;
                    void notificationService
                      .emit("attendance_risk", {
                        userId: userKey,
                        params: { subject: r.subjectCode || r.subjectDescription, pct: Math.round(pct), needed },
                      })
                      .catch(() => {});
                  }
                }
              }
              return;
            }
            if (pageKey === "academic/time-table" || pageKey === "academic/timetable") {
              // Live payloads nest the schedule under _extracted
              // (adaptToLegacyPayload); resolve through the shared helper so
              // both payload generations ingest.
              const timetableSchedule = timetableScheduleFromPagePayload(payload);
              if (timetableSchedule) {
                vacantRoomStore.ingestTimetable(timetableSchedule);
              }
            }
          })
          .catch((error) => {
            log({
              level: "error",
              msg: "ERP live-data sink failed",
              pageKey,
              error: error?.message || String(error),
            });
          });
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

  // Batch B9 — weekly email digest. Checks hourly; the per-ISO-week
  // idempotency marker in the delivery log means at most one send per user
  // per week regardless of tick frequency. Inert unless SMTP is configured
  // and the user opted the email channel in.
  // Batch B10 — re-sync connected Google Calendars every 6h. No-op when
  // Google is not configured or nobody has connected.
  const calendarTicker = setInterval(() => {
    void calendarSyncService
      .runSyncCycle({ erpAcademicSnapshotStore, careerStore })
      .then((s) => {
        if (s.users) log({ msg: "Google Calendar sync cycle", users: s.users });
      })
      .catch((error) => log({ level: "error", msg: "Google Calendar sync job failed", error: error?.message || String(error) }));
  }, 6 * 60 * 60 * 1000);
  calendarTicker.unref();

  const digestTicker = setInterval(() => {
    void runWeeklyDigestCycle({
      notificationStore,
      studentGraphService,
      emailAdapter,
      careerStore,
      log,
    })
      .then((summary) => {
        if (summary.sent) log({ msg: "Weekly digest cycle", sent: summary.sent, skipped: summary.skipped });
      })
      .catch((error) => log({ level: "error", msg: "Weekly digest job failed", error: error?.message || String(error) }));
  }, 60 * 60 * 1000);
  digestTicker.unref();

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

  // Hard shutdown budget: close the listener, give in-flight requests
  // SHUTDOWN_BUDGET_MS to drain, then force-close any keep-alive
  // sockets and exit. Without closeAllConnections, a slow client
  // holding a keep-alive connection would block server.close()
  // indefinitely — the unref'd timer below would then never fire.
  const SHUTDOWN_BUDGET_MS = 8_000;

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

    // After the budget, force-close keep-alive sockets and exit.
    // The timer is unref'd so it doesn't itself keep the process alive
    // if everything else has exited cleanly.
    setTimeout(() => {
      log({
        level: "warn",
        msg: `Shutdown budget exceeded (${SHUTDOWN_BUDGET_MS}ms); force-closing connections`,
      });
      if (typeof server.closeAllConnections === "function") {
        server.closeAllConnections();
      } else {
        // Node < 18.2 fallback
        server.closeIdleConnections?.();
      }
      // Give the force-close a brief moment, then exit hard.
      setTimeout(() => process.exit(exitCode || 1), 250).unref();
    }, SHUTDOWN_BUDGET_MS).unref();
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
