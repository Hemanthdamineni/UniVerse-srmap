const path = require("path");

const BASE_ORIGIN = process.env.SRM_BASE_ORIGIN || "https://student.srmap.edu.in";
const BASE_PATH = process.env.SRM_BASE_PATH || "/srmapstudentcorner";
const LOGIN_URL = `${BASE_ORIGIN}${BASE_PATH}/StudentLoginPage`;
const LOGIN_POST_URL = `${BASE_ORIGIN}${BASE_PATH}/StudentLoginToPortal`;
const PORT = Number(process.env.PORT || 5000);
const NODE_ENV = process.env.NODE_ENV || "development";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, "../../logs");
const LOG_FILE_NAME = process.env.LOG_FILE_NAME || "backend.log";
const LOGIN_PREAUTH_TTL_MS = Number(process.env.LOGIN_PREAUTH_TTL_MS || 15 * 1000);
const LOGIN_DIAGNOSTICS_DIR =
  process.env.LOGIN_DIAGNOSTICS_DIR || path.join(LOG_DIR, "login-attempts");
const LOGIN_DIAGNOSTICS_MAX_ARTIFACTS = Number(
  process.env.LOGIN_DIAGNOSTICS_MAX_ARTIFACTS || 20
);
const LOGIN_DIAGNOSTICS_MAX_HTML_CHARS = Number(
  process.env.LOGIN_DIAGNOSTICS_MAX_HTML_CHARS || 6000
);
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 30 * 60 * 1000);
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "erp_session";
const SESSION_COOKIE_SECURE = String(process.env.SESSION_COOKIE_SECURE || "auto").toLowerCase();
const SESSION_COOKIE_SAME_SITE = process.env.SESSION_COOKIE_SAME_SITE || "lax";
const REDIS_URL = process.env.REDIS_URL || "";
const REDIS_SENTINEL_URLS = process.env.REDIS_SENTINEL_URLS || "";
const REDIS_SENTINEL_MASTER_NAME = process.env.REDIS_SENTINEL_MASTER_NAME || "mymaster";
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || "";
const SESSION_STORE_DRIVER = process.env.SESSION_STORE_DRIVER || "auto";
const ERP_CACHE_DRIVER = process.env.ERP_CACHE_DRIVER || "auto";
const ERP_CACHE_FRESH_TTL_MS = Number(process.env.ERP_CACHE_FRESH_TTL_MS || 60 * 1000);
const ERP_CACHE_STALE_TTL_MS = Number(process.env.ERP_CACHE_STALE_TTL_MS || 10 * 60 * 1000);
const ERP_DISTRIBUTED_LOCK_TTL_MS = Number(process.env.ERP_DISTRIBUTED_LOCK_TTL_MS || 12 * 1000);
const ERP_CIRCUIT_REDIS_TTL_MS = Number(process.env.ERP_CIRCUIT_REDIS_TTL_MS || 5 * 60 * 1000);
const ERP_CACHED_TIMEOUT_MS = Number(process.env.ERP_CACHED_TIMEOUT_MS || 6000);
const ERP_LIVE_TIMEOUT_MS = Number(process.env.ERP_LIVE_TIMEOUT_MS || 15000);
const ERP_UPSTREAM_MAX_CONCURRENCY = Number(process.env.ERP_UPSTREAM_MAX_CONCURRENCY || 30);
const ERP_UPSTREAM_ACQUIRE_TIMEOUT_MS = Number(
  process.env.ERP_UPSTREAM_ACQUIRE_TIMEOUT_MS || 1500
);
const ERP_CIRCUIT_FAILURE_THRESHOLD = Number(
  process.env.ERP_CIRCUIT_FAILURE_THRESHOLD || 5
);
const ERP_CIRCUIT_COOLDOWN_MS = Number(process.env.ERP_CIRCUIT_COOLDOWN_MS || 30000);
const ERP_PAGE_POLICY_FILE =
  process.env.ERP_PAGE_POLICY_FILE || path.join(__dirname, "./erp-page-policy.json");
const FEATURE_ERP_V2_API = String(process.env.FEATURE_ERP_V2_API || "1") !== "0";
const FEATURE_ERP_CACHED_FIRST = String(process.env.FEATURE_ERP_CACHED_FIRST || "1") !== "0";
const FEATURE_ERP_PREFETCH = String(process.env.FEATURE_ERP_PREFETCH || "1") !== "0";
const FEATURE_AUTH_COOKIE_MODE = String(process.env.FEATURE_AUTH_COOKIE_MODE || "1") !== "0";
const FEATURE_ERP_DISTRIBUTED_LOCK =
  String(process.env.FEATURE_ERP_DISTRIBUTED_LOCK || "1") !== "0";
const FEATURE_ERP_ERROR_ENVELOPE = String(process.env.FEATURE_ERP_ERROR_ENVELOPE || "1") !== "0";
const FEATURE_FRONTEND_PERF_TELEMETRY =
  String(process.env.FEATURE_FRONTEND_PERF_TELEMETRY || "1") !== "0";
const LEGACY_SESSION_ID_CUTOFF_DATE =
  process.env.LEGACY_SESSION_ID_CUTOFF_DATE || "2026-05-15T00:00:00.000Z";
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 400);
const RATE_LIMIT_REDIS_PREFIX = process.env.RATE_LIMIT_REDIS_PREFIX || "ratelimit";
const EXTERNAL_DB_PATH =
  process.env.EXTERNAL_DB_PATH || path.join(__dirname, "../../data/external-pages.sqlite");
const CONTENT_DB_PATH =
  process.env.CONTENT_DB_PATH || path.join(__dirname, "../../data/content.sqlite");
const LMS_DB_PATH =
  process.env.LMS_DB_PATH || path.join(__dirname, "../../data/lms.sqlite");
const LMS_TRACKER_DB_PATH =
  process.env.LMS_TRACKER_DB_PATH || path.join(__dirname, "../../data/lms-tracker.sqlite");
const ADMIN_CONTENT_PASSWORD =
  process.env.ADMIN_CONTENT_PASSWORD || "asdfghjkl;'";
const ERP_UI_MAP_FILE = process.env.ERP_UI_MAP_FILE || "";
const ERP_ARTIFACT_MAX_AGE_DAYS = Number(process.env.ERP_ARTIFACT_MAX_AGE_DAYS || 14);
const FRONTEND_BLUEPRINT_FILE =
  process.env.FRONTEND_BLUEPRINT_FILE ||
  path.join(__dirname, "../../../Frontend/src/config/erpBlueprints.ts");
const EVENTS_DATA_DIR =
  process.env.EVENTS_DATA_DIR || path.join(__dirname, "../../data/events");
const EVENTS_DB_PATH =
  process.env.EVENTS_DB_PATH || path.join(__dirname, "../../data/events.sqlite");
const HELPDESK_DB_PATH =
  process.env.HELPDESK_DB_PATH || path.join(__dirname, "../../data/helpdesk.sqlite");
const CAMPUS_FEEDBACK_DB_PATH =
  process.env.CAMPUS_FEEDBACK_DB_PATH || path.join(__dirname, "../../data/campus-feedback.sqlite");
const CAREER_DB_PATH =
  process.env.CAREER_DB_PATH || path.join(__dirname, "../../data/career.sqlite");
/** Comma-separated roles that may review manual career submissions (overrides built-in defaults). */
const CAREER_SUBMISSION_REVIEW_ROLES = process.env.CAREER_SUBMISSION_REVIEW_ROLES || "";
const CAREER_CACHE_TTL_SEC = Number(process.env.CAREER_CACHE_TTL_SEC || 90);
/** When set, paired header `x-career-load-token` authenticates k6/load tests (dev/staging only). */
const CAREER_LOAD_TEST_TOKEN = process.env.CAREER_LOAD_TEST_TOKEN || "";
const FEEDBACK_AUTOMATION_ENABLED =
  String(
    process.env.FEEDBACK_AUTOMATION_ENABLED ||
      (NODE_ENV === "development" || NODE_ENV === "test" ? "1" : "0")
  ) !== "0";
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "../../data/uploads");
const LMS_FILES_DIR = process.env.LMS_FILES_DIR || path.join(__dirname, "../../data/lms");
const LMS_UPLOAD_MAX_BYTES = Number(process.env.LMS_UPLOAD_MAX_BYTES || 25 * 1024 * 1024);
const LMS_USER_STORAGE_MAX_BYTES = Number(
  process.env.LMS_USER_STORAGE_MAX_BYTES || 200 * 1024 * 1024
);
const LMS_UPLOADS_PER_DAY_MAX = Number(process.env.LMS_UPLOADS_PER_DAY_MAX || 10);
const LMS_QUEUE_FLUSH_MS = Number(process.env.LMS_QUEUE_FLUSH_MS || 300);
const LMS_QUEUE_BATCH_SIZE = Number(process.env.LMS_QUEUE_BATCH_SIZE || 50);
const LMS_QUEUE_MAX_RETRIES = Number(process.env.LMS_QUEUE_MAX_RETRIES || 3);

const DISCOVERY_FILE_CANDIDATES = [
  path.join(__dirname, "../../data/endpoint-discovery.json"),
  path.join(__dirname, "../../scripts/endpoint-discovery.json"),
  path.join(__dirname, "../../Scripts/endpoint-discovery.json"),
];

module.exports = {
  BASE_ORIGIN,
  BASE_PATH,
  LOGIN_URL,
  LOGIN_POST_URL,
  PORT,
  NODE_ENV,
  LOG_LEVEL,
  LOG_DIR,
  LOG_FILE_NAME,
  LOGIN_PREAUTH_TTL_MS,
  LOGIN_DIAGNOSTICS_DIR,
  LOGIN_DIAGNOSTICS_MAX_ARTIFACTS,
  LOGIN_DIAGNOSTICS_MAX_HTML_CHARS,
  SESSION_TTL_MS,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_SECURE,
  SESSION_COOKIE_SAME_SITE,
  REDIS_URL,
  REDIS_SENTINEL_URLS,
  REDIS_SENTINEL_MASTER_NAME,
  REDIS_PASSWORD,
  SESSION_STORE_DRIVER,
  ERP_CACHE_DRIVER,
  ERP_CACHE_FRESH_TTL_MS,
  ERP_CACHE_STALE_TTL_MS,
  ERP_DISTRIBUTED_LOCK_TTL_MS,
  ERP_CIRCUIT_REDIS_TTL_MS,
  ERP_CACHED_TIMEOUT_MS,
  ERP_LIVE_TIMEOUT_MS,
  ERP_UPSTREAM_MAX_CONCURRENCY,
  ERP_UPSTREAM_ACQUIRE_TIMEOUT_MS,
  ERP_CIRCUIT_FAILURE_THRESHOLD,
  ERP_CIRCUIT_COOLDOWN_MS,
  ERP_PAGE_POLICY_FILE,
  FEATURE_ERP_V2_API,
  FEATURE_ERP_CACHED_FIRST,
  FEATURE_ERP_PREFETCH,
  FEATURE_AUTH_COOKIE_MODE,
  FEATURE_ERP_DISTRIBUTED_LOCK,
  FEATURE_ERP_ERROR_ENVELOPE,
  FEATURE_FRONTEND_PERF_TELEMETRY,
  LEGACY_SESSION_ID_CUTOFF_DATE,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
  RATE_LIMIT_REDIS_PREFIX,
  EXTERNAL_DB_PATH,
  CONTENT_DB_PATH,
  LMS_DB_PATH,
  LMS_TRACKER_DB_PATH,
  ADMIN_CONTENT_PASSWORD,
  ERP_UI_MAP_FILE,
  ERP_ARTIFACT_MAX_AGE_DAYS,
  FRONTEND_BLUEPRINT_FILE,
  EVENTS_DATA_DIR,
  EVENTS_DB_PATH,
  HELPDESK_DB_PATH,
  CAMPUS_FEEDBACK_DB_PATH,
  CAREER_DB_PATH,
  CAREER_SUBMISSION_REVIEW_ROLES,
  CAREER_CACHE_TTL_SEC,
  CAREER_LOAD_TEST_TOKEN,
  FEEDBACK_AUTOMATION_ENABLED,
  UPLOADS_DIR,
  LMS_FILES_DIR,
  LMS_UPLOAD_MAX_BYTES,
  LMS_USER_STORAGE_MAX_BYTES,
  LMS_UPLOADS_PER_DAY_MAX,
  LMS_QUEUE_FLUSH_MS,
  LMS_QUEUE_BATCH_SIZE,
  LMS_QUEUE_MAX_RETRIES,
  DISCOVERY_FILE_CANDIDATES,
};
