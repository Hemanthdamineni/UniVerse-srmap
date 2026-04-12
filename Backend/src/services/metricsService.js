const client = require("prom-client");

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
  register,
  erpCacheResultTotal,
  erpFetchSourceTotal,
  erpUpstreamFailuresTotal,
  recordHttpRequest,
  observeErpSourceLatency,
  setCircuitState,
  setUpstreamLoad,
  updateCacheHitRatio,
  recordFrontendTelemetry,
};
