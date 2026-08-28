const cheerio = require("cheerio");
const { cleanText } = require("../../utils/text");
const { log } = require("../../utils/logger");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { EXTERNAL_PAGE_SEED_DATA } = require("../../data/externalSeedData");
const client = require("prom-client");

// --- feedbackAutomationService.js ---
const {
  createApiContext,
  callEndpointViaApi,
  isErpSessionExpiredResponse,
  makeSessionExpiredError,
} = require("../erp/erpClient");
const FEEDBACK_RESOURCE_URL = "students/transaction/subjectwisefeedbackresources.jsp";

const DEFAULT_FEEDBACK_ENDPOINT = {
  argId: 9,
  method: "POST",
  url: "students/transaction/subjectwisefeedback.jsp",
  paramsTemplate: {
    ids: "{{argId}}",
  },
};

const ANSWER_OPTIONS = [
  { optionNo: 1, value: "21", label: "Strongly disagree", pointvalue: "1.00" },
  { optionNo: 2, value: "22", label: "Somewhat disagree", pointvalue: "2.00" },
  { optionNo: 3, value: "23", label: "Neutral", pointvalue: "3.00" },
  { optionNo: 4, value: "24", label: "Somewhat agree", pointvalue: "4.00" },
  { optionNo: 5, value: "25", label: "Strongly agree", pointvalue: "5.00" },
];

function sanitizeSubjectName(value) {
  return cleanText(value).replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function validateOptionNumber(optionNo) {
  const parsed = Number(optionNo);
  const match = ANSWER_OPTIONS.find((option) => option.optionNo === parsed);
  if (!match) {
    const error = new Error("optionNo must be between 1 and 5.");
    error.status = 400;
    error.code = "INVALID_OPTION";
    throw error;
  }
  return match;
}

function resolveEndpoint(discoveryRepository) {
  return (
    discoveryRepository?.resolveEndpoint?.("Feedback", "End Semester Feedback") ||
    DEFAULT_FEEDBACK_ENDPOINT
  );
}

function parseFeedbackLandingPage(html = "") {
  const $ = cheerio.load(String(html || ""));
  const pendingSubjects = [];
  const submittedSubjects = [];

  $("td.clsSubject").each((_index, element) => {
    const id = cleanText($(element).attr("id"));
    const name = sanitizeSubjectName($(element).text());
    if (!id || !name) return;
    pendingSubjects.push({ id, name });
  });

  $("tr, li, div").each((_index, element) => {
    const text = cleanText($(element).text());
    if (!/submitted|completed/i.test(text) || !/feedback/i.test(text)) return;
    const name = sanitizeSubjectName(text.replace(/feedback/gi, ""));
    if (name) {
      submittedSubjects.push({ name });
    }
  });

  const feedbackType = cleanText($("#feedbacktype").val()) || cleanText($("input[name='feedbacktype']").val());
  const controller = cleanText($("#mcontroller").val()) || cleanText($("input[name='controller']").val());
  const pageText = cleanText($.root().text());
  const alreadySubmitted =
    pendingSubjects.length === 0 &&
    /already submitted|feedback completed|no subjects found/i.test(pageText);

  return {
    pendingSubjects,
    submittedSubjects,
    feedbackType,
    controller,
    alreadySubmitted,
    pageText,
  };
}

function parseQuestionRows($form, selectedOption, comment) {
  const answersJson = [];
  const descriptiveJson = [];

  $form("tr.clsquestions").each((_index, element) => {
    const row = $form(element);
    const questionId = cleanText(row.attr("id")).replace(/_\d+$/, "");
    const textarea = row.find("textarea").first();

    if (textarea.length) {
      const descQuestionId = cleanText(row.attr("itemid")).replace(/_\d+$/, "");
      const quesid = cleanText(textarea.attr("quesid"));
      if (descQuestionId && quesid) {
        descriptiveJson.push({
          questionid: descQuestionId,
          answerdesc: comment,
          quesid,
          partid: cleanText(textarea.attr("partid")) || "6",
        });
      }
      return;
    }

    if (!questionId) return;
    const selectedAnswer = row
      .find("input.answers")
      .filter((_answerIndex, answerElement) => cleanText($form(answerElement).attr("answervalue")) === selectedOption.value)
      .first();

    if (!selectedAnswer.length) return;

    answersJson.push({
      questionid: questionId,
      answerid: cleanText(selectedAnswer.attr("id")),
      answerdesc: selectedOption.label,
      quesid: cleanText(selectedAnswer.attr("quesid")) || questionId,
      partid: cleanText(selectedAnswer.attr("partid")),
      answervalue: selectedOption.value,
      pointvalue: selectedOption.pointvalue,
    });
  });

  return { answersJson, descriptiveJson };
}

async function postFeedbackForm(api, formData) {
  const response = await api.post(FEEDBACK_RESOURCE_URL, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
    },
    form: formData,
  });

  const raw = await response.text();
  if (isErpSessionExpiredResponse(raw)) {
    throw makeSessionExpiredError();
  }

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  return {
    status: response.status(),
    raw,
    parsed,
  };
}

class FeedbackAutomationService {
  constructor({ sessionStore, discoveryRepository, enabled }) {
    this.sessionStore = sessionStore;
    this.discoveryRepository = discoveryRepository;
    this.enabled = Boolean(enabled);
  }

  async _loadLandingPage(sessionId) {
    const session = await this.sessionStore.getOrThrow(sessionId);
    const endpoint = resolveEndpoint(this.discoveryRepository);
    const api = await createApiContext(session.storageState);

    try {
      const payload = await callEndpointViaApi(api, endpoint, {
        dropdown: "Feedback",
        subitem: "End Semester Feedback",
      });
      const nextStorageState = await api.storageState();
      await this.sessionStore.update(sessionId, { storageState: nextStorageState });
      return {
        session,
        payload,
      };
    } finally {
      await api.dispose();
    }
  }

  async getStatus(sessionId) {
    const { payload } = await this._loadLandingPage(sessionId);
    const landing = parseFeedbackLandingPage(payload.rawHtml || "");

    const isFeedbackNotEnabled = /Feedback Not Enabled/i.test(landing.pageText);

    return {
      enabled: this.enabled && !isFeedbackNotEnabled,
      pendingSubjects: landing.pendingSubjects,
      submittedSubjects: landing.submittedSubjects,
      totalPending: landing.pendingSubjects.length,
      defaultOption: 5,
      templateAvailable: readFeedbackTemplates().length > 0,
      alreadySubmitted: landing.alreadySubmitted,
      disabledMessage: isFeedbackNotEnabled ? "Feedback Not Enabled By Administrator" : null,
    };
  }

  getRandomTemplate() {
    const template = getRandomFeedbackTemplate();
    return {
      comment: template,
      available: Boolean(template),
    };
  }

  async submit(sessionId, { optionNo, comment, subjectIds, requestId } = {}) {
    if (!this.enabled) {
      const error = new Error("Feedback automation is disabled right now.");
      error.status = 403;
      error.code = "FEEDBACK_AUTOMATION_DISABLED";
      throw error;
    }

    const selectedOption = validateOptionNumber(optionNo);
    const normalizedComment = validateFeedbackComment(comment);
    const session = await this.sessionStore.getOrThrow(sessionId);
    const api = await createApiContext(session.storageState);

    try {
      const landingPayload = await callEndpointViaApi(
        api,
        resolveEndpoint(this.discoveryRepository),
        {
          dropdown: "Feedback",
          subitem: "End Semester Feedback",
        }
      );

      const landing = parseFeedbackLandingPage(landingPayload.rawHtml || "");
      const requestedSubjectIds = Array.isArray(subjectIds)
        ? new Set(subjectIds.map((entry) => cleanText(entry)).filter(Boolean))
        : null;
      const subjectsToProcess = landing.pendingSubjects.filter((subject) =>
        requestedSubjectIds ? requestedSubjectIds.has(subject.id) : true
      );

      if (!subjectsToProcess.length) {
        return {
          optionNo: selectedOption.optionNo,
          comment: normalizedComment,
          results: [],
          counts: {
            submitted: 0,
            skipped: 0,
            failed: 0,
          },
          message: landing.alreadySubmitted
            ? "No pending subjects found. Feedback looks already completed."
            : "No matching pending subjects found.",
        };
      }

      const results = [];

      for (const subject of subjectsToProcess) {
        const formData = {
          ids: "1",
          filter: subject.id,
          controller: landing.controller,
        };

        const formResponse = await postFeedbackForm(api, formData);
        const $form = cheerio.load(formResponse.raw || "");
        const hdnControllerId =
          cleanText($form("#hdnControllerId").val()) || cleanText($form("input[name='hdnControllerId']").val());
        const remarks = cleanText($form("#txtRemarks").val());
        const { answersJson, descriptiveJson } = parseQuestionRows($form, selectedOption, normalizedComment);

        if (!answersJson.length) {
          results.push({
            subjectId: subject.id,
            subjectName: subject.name,
            status: "failed",
            message: "Unable to build feedback answers for this subject.",
          });
          continue;
        }

        const submitResponse = await postFeedbackForm(api, {
          txtRemarks: remarks,
          hdnSubjectId: subject.id,
          hdnControllerId,
          ids: "2",
          filter: "",
          answers: JSON.stringify(answersJson),
          descriptiveanswer: JSON.stringify(descriptiveJson),
          remarks,
          feedbacktype: landing.feedbackType,
        });

        const submitMessage =
          cleanText(submitResponse.parsed?.result || submitResponse.parsed?.message || submitResponse.raw) ||
          "Unknown response";
        const wasSubmitted =
          submitResponse.status === 200 &&
          /feedback completed|success|submitted/i.test(submitMessage);

        results.push({
          subjectId: subject.id,
          subjectName: subject.name,
          status: wasSubmitted ? "submitted" : "failed",
          message: submitMessage,
        });
      }

      const counts = results.reduce(
        (acc, item) => {
          if (item.status === "submitted") acc.submitted += 1;
          else if (item.status === "skipped") acc.skipped += 1;
          else acc.failed += 1;
          return acc;
        },
        { submitted: 0, skipped: 0, failed: 0 }
      );

      const nextStorageState = await api.storageState();
      await this.sessionStore.update(sessionId, { storageState: nextStorageState });

      log({
        level: counts.failed > 0 ? "warn" : "info",
        msg: "End-semester feedback batch executed",
        requestId,
        sessionId,
        optionNo: selectedOption.optionNo,
        requestedSubjects: subjectsToProcess.length,
        submitted: counts.submitted,
        failed: counts.failed,
      });

      return {
        optionNo: selectedOption.optionNo,
        comment: normalizedComment,
        results,
        counts,
        message:
          counts.submitted > 0 && counts.failed === 0
            ? "Feedback submitted successfully."
            : counts.submitted > 0
              ? "Feedback submitted for some subjects."
              : "Feedback submission failed.",
      };
    } finally {
      await api.dispose();
    }
  }
}

// --- feedbackTemplates.js ---
const TEMPLATE_FILE = path.join(__dirname, "../data/feedbackTemplates.json");

function readFeedbackTemplates() {
  try {
    const raw = fs.readFileSync(TEMPLATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => String(entry || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function validateFeedbackComment(value) {
  const comment = String(value || "").replace(/\s+/g, " ").trim();
  if (comment.length <= 10) {
    const error = new Error("Comment must be more than 10 characters.");
    error.status = 400;
    error.code = "INVALID_COMMENT";
    throw error;
  }

  if (comment.length > 500) {
    const error = new Error("Comment must be less than 500 characters.");
    error.status = 400;
    error.code = "INVALID_COMMENT";
    throw error;
  }

  return comment;
}

function getRandomFeedbackTemplate() {
  const templates = readFeedbackTemplates();
  if (!templates.length) return "";
  const index = Math.floor(Math.random() * templates.length);
  return templates[index] || "";
}

// --- externalDataStore.js ---
class ExternalDataStore {
  constructor(dbPath) {
    const dirPath = path.dirname(dbPath);
    fs.mkdirSync(dirPath, { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.ensureSchema();
    this.seedMissing(EXTERNAL_PAGE_SEED_DATA);
  }

  ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS external_pages (
        page_key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  seedMissing(seedData) {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO external_pages (page_key, title, payload_json, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    let inserted = 0;
    for (const [pageKey, payload] of Object.entries(seedData)) {
      const result = insert.run(pageKey, toTitle(pageKey), JSON.stringify(payload), now);
      inserted += Number(result.changes || 0);
    }

    return inserted;
  }

  upsertAll(seedData) {
    const upsert = this.db.prepare(`
      INSERT INTO external_pages (page_key, title, payload_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(page_key) DO UPDATE SET
        title = excluded.title,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `);

    const now = new Date().toISOString();
    let affected = 0;
    for (const [pageKey, payload] of Object.entries(seedData)) {
      const result = upsert.run(pageKey, toTitle(pageKey), JSON.stringify(payload), now);
      affected += Number(result.changes || 0);
    }

    return affected;
  }

  clearAll() {
    const result = this.db.prepare("DELETE FROM external_pages").run();
    return Number(result.changes || 0);
  }

  countPages() {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM external_pages").get();
    return Number(row?.count || 0);
  }

  getPage(pageKey) {
    const safePageKey = String(pageKey || "").trim();
    if (!safePageKey) return null;

    let row = null;
    try {
      row = this.db
        .prepare(
          "SELECT page_key, title, payload_json, updated_at FROM external_pages WHERE page_key = ?"
        )
        .get(safePageKey);
    } catch (error) {
      throw new Error(`SQLite read failure for "${safePageKey}"`);
    }

    if (!row) return null;

    let payload = {};
    try {
      payload = JSON.parse(row.payload_json);
    } catch (_error) {
      payload = { summary: "Failed to parse payload", items: [] };
    }

    return {
      pageKey: row.page_key,
      title: row.title,
      source: "sqlite",
      updatedAt: row.updated_at,
      ...payload,
    };
  }

  ping() {
    try {
      const row = this.db.prepare("SELECT 1 AS ok").get();
      return Number(row?.ok || 0) === 1;
    } catch {
      return false;
    }
  }
}

function toTitle(pageKey) {
  return pageKey
    .split("/")
    .join(" / ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

// --- metricsService.js ---
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDurationSeconds = new client.Histogram({
  name: "erp_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8, 15],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: "erp_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const erpCacheResultTotal = new client.Counter({
  name: "erp_cache_result_total",
  help: "ERP cache lookup outcomes",
  labelNames: ["result"],
  registers: [register],
});

const erpFetchSourceTotal = new client.Counter({
  name: "erp_fetch_source_total",
  help: "ERP page source results",
  labelNames: ["source", "policy"],
  registers: [register],
});

const erpUpstreamFailuresTotal = new client.Counter({
  name: "erp_upstream_failures_total",
  help: "ERP upstream failures",
  labelNames: ["reason"],
  registers: [register],
});

const erpSourceDurationSeconds = new client.Histogram({
  name: "erp_source_duration_seconds",
  help: "Latency by ERP source and policy",
  labelNames: ["source", "policy", "page_group"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8, 15],
  registers: [register],
});

const erpCircuitOpenState = new client.Gauge({
  name: "erp_circuit_open_state",
  help: "ERP circuit breaker open state by page group",
  labelNames: ["page_group"],
  registers: [register],
});

const erpUpstreamInFlight = new client.Gauge({
  name: "erp_upstream_inflight",
  help: "Current number of in-flight ERP upstream calls",
  labelNames: ["class"],
  registers: [register],
});

const erpUpstreamQueueDepth = new client.Gauge({
  name: "erp_upstream_queue_depth",
  help: "Current queued ERP upstream calls waiting for a slot",
  labelNames: ["class"],
  registers: [register],
});

const erpFinancePaidSourceRows = new client.Gauge({
  name: "erp_finance_paid_source_rows",
  help: "Rows observed per upstream fee-paid finance source before frontend merge/dedupe",
  labelNames: ["page_key", "source"],
  registers: [register],
});

const erpCacheHitRatio = new client.Gauge({
  name: "erp_cache_hit_ratio",
  help: "Observed ERP cache hit ratio by policy mode",
  labelNames: ["policy"],
  registers: [register],
});

const frontendRouteTransitionSeconds = new client.Histogram({
  name: "erp_frontend_route_transition_seconds",
  help: "Frontend route transition timings",
  labelNames: ["route", "kind"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8],
  registers: [register],
});

const frontendWebVitalValue = new client.Gauge({
  name: "erp_frontend_web_vital_value",
  help: "Latest web vital values from frontend beacons",
  labelNames: ["name", "route"],
  registers: [register],
});

const cacheStatsByPolicy = new Map();

function normalizePath(path) {
  const raw = String(path || "").split("?")[0];
  if (!raw) return "unknown";

  return raw
    .replace(/\/[0-9a-fA-F-]{10,}/g, "/:id")
    .replace(/\/[0-9]+/g, "/:n");
}

function pageGroup(pageKey) {
  const normalized = String(pageKey || "").trim().toLowerCase();
  if (!normalized) return "unknown";
  return normalized.split("/")[0] || "unknown";
}

function observeErpSourceLatency({ source, policy, pageKey, durationMs }) {
  erpSourceDurationSeconds.observe(
    {
      source: String(source || "unknown"),
      policy: String(policy || "unknown"),
      page_group: pageGroup(pageKey),
    },
    Math.max(0, Number(durationMs || 0)) / 1000
  );
}

function setCircuitState({ pageKey, isOpen }) {
  erpCircuitOpenState.set(
    { page_group: pageGroup(pageKey) },
    isOpen ? 1 : 0
  );
}

function setUpstreamLoad({ className = "default", inFlight = 0, queued = 0 }) {
  const labels = { class: String(className || "default") };
  erpUpstreamInFlight.set(labels, Math.max(0, Number(inFlight || 0)));
  erpUpstreamQueueDepth.set(labels, Math.max(0, Number(queued || 0)));
}

function setFinancePaidSourceRows({ pageKey, source, rowCount }) {
  erpFinancePaidSourceRows.set(
    {
      page_key: String(pageKey || "unknown"),
      source: String(source || "unknown"),
    },
    Math.max(0, Number(rowCount || 0))
  );
}

function updateCacheHitRatio({ policy = "cached-first", result = "miss" }) {
  const key = String(policy || "cached-first");
  const current = cacheStatsByPolicy.get(key) || { hit: 0, total: 0 };
  const next = {
    hit: current.hit + (result === "fresh" || result === "stale" ? 1 : 0),
    total: current.total + 1,
  };
  cacheStatsByPolicy.set(key, next);
  const ratio = next.total > 0 ? next.hit / next.total : 0;
  erpCacheHitRatio.set({ policy: key }, ratio);
}

function recordFrontendTelemetry(payload = {}) {
  const route = normalizePath(payload.route || "unknown");
  const routeDurationMs = Number(payload.routeDurationMs || 0);
  const kind = String(payload.kind || "navigation");

  if (routeDurationMs > 0) {
    frontendRouteTransitionSeconds.observe(
      { route, kind },
      routeDurationMs / 1000
    );
  }

  if (Array.isArray(payload.vitals)) {
    for (const metric of payload.vitals) {
      const name = String(metric?.name || "").trim().toUpperCase();
      const value = Number(metric?.value);
      if (!name || !Number.isFinite(value)) continue;
      frontendWebVitalValue.set({ name, route }, value);
    }
  }
}

function recordHttpRequest({ method, path, statusCode, durationMs }) {
  const route = normalizePath(path);
  const labels = {
    method: String(method || "GET").toUpperCase(),
    route,
    status_code: String(statusCode || 0),
  };

  httpRequestsTotal.inc(labels);
  httpRequestDurationSeconds.observe(labels, Math.max(0, Number(durationMs || 0)) / 1000);
}

module.exports = {
  FeedbackAutomationService,
  parseFeedbackLandingPage,
  validateOptionNumber,
  readFeedbackTemplates,
  validateFeedbackComment,
  getRandomFeedbackTemplate,
  ExternalDataStore,
  EXTERNAL_PAGE_SEED_DATA,
  register,
  erpCacheResultTotal,
  erpFetchSourceTotal,
  erpUpstreamFailuresTotal,
  recordHttpRequest,
  observeErpSourceLatency,
  setCircuitState,
  setUpstreamLoad,
  setFinancePaidSourceRows,
  updateCacheHitRatio,
  recordFrontendTelemetry,
};