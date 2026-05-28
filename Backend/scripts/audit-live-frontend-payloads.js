#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const helmet = require("helmet");
const { chromium, request } = require("playwright");

const {
  LOGIN_URL,
  SESSION_TTL_MS,
  DISCOVERY_FILE_CANDIDATES,
  ERP_PAGE_POLICY_FILE,
} = require("../src/config/env");
const scrapeTargets = require("../src/config/scrapeTargets");
const { createRequestContextMiddleware } = require("../src/middleware/requestContext");
const { createGlobalRateLimitMiddleware } = require("../src/middleware/rateLimit");
const { createErpV2Routes } = require("../src/routes/erpV2Routes");
const { sendApiError } = require("../src/utils/apiResponse");
const { SessionStore } = require("../src/services/sessionStore");
const { InMemoryErpCacheStore } = require("../src/services/erpCacheStore");
const { DiscoveryRepository } = require("../src/services/discoveryRepository");
const { PagePolicyStore } = require("../src/services/pagePolicyStore");
const { ErpLiveService } = require("../src/services/erpLiveService");
const { ErpAggregationService } = require("../src/services/erpAggregationService");
const {
  fetchProfileViaApi,
  createApiContext,
  isUsableProfileData,
  buildFallbackProfileData,
} = require("../src/services/erpClient");

const DEFAULT_OUTPUT_DIR = path.join(__dirname, "../data/live-page-audit");
const OUTPUT_DIR = path.resolve(process.argv[2] || process.env.ERP_AUDIT_OUTPUT_DIR || DEFAULT_OUTPUT_DIR);
const WAIT_FOR_LOGIN_MS = Number(process.env.ERP_AUDIT_LOGIN_TIMEOUT_MS || 10 * 60 * 1000);

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage:
  npm --prefix Backend run audit:live-pages
  npm --prefix Backend run audit:live-pages -- /absolute/or/relative/output-dir

What it does:
  1. Opens the university ERP login page in a visible Playwright browser.
  2. Waits while you log in manually.
  3. Creates a local backend session from the authenticated browser cookies.
  4. Fetches every configured ERP frontend page through /api/v2/erp/page/*.
  5. Saves frontend-payload.json, processed-data-no-raw-html.json, raw/*.html, and summary.json.

Environment:
  ERP_AUDIT_OUTPUT_DIR          Override output directory.
  ERP_AUDIT_LOGIN_TIMEOUT_MS    Override manual-login wait time.
  PLAYWRIGHT_CHROMIUM_EXECUTABLE Use a system Chromium/Chrome executable.
`);
  process.exit(0);
}

function ts() {
  return new Date().toISOString();
}

function log(message) {
  console.log(`[${ts()}] ${message}`);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveChromiumExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "page";
}

function getAuditedPageKeys() {
  return Object.entries(scrapeTargets)
    .filter(([pageKey, targets]) => {
      if (pageKey === "logout" || pageKey === "settings") return false;
      return pageKey === "profile" || (Array.isArray(targets) && targets.length > 0);
    })
    .map(([pageKey]) => pageKey);
}

function removeRawHtml(value) {
  if (Array.isArray(value)) return value.map(removeRawHtml);
  if (!value || typeof value !== "object") return value;

  const next = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "rawHtml") {
      next.rawHtmlFile = null;
      continue;
    }
    next[key] = removeRawHtml(child);
  }
  return next;
}

function collectRawHtml(value, trail = [], out = []) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => collectRawHtml(child, [...trail, String(index)], out));
    return out;
  }

  if (!value || typeof value !== "object") return out;

  if (typeof value.rawHtml === "string" && value.rawHtml.length > 0) {
    out.push({
      trail,
      html: value.rawHtml,
      endpoint: value.endpoint && typeof value.endpoint === "object" ? value.endpoint : null,
      title: typeof value.title === "string" ? value.title : "",
    });
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === "rawHtml") continue;
    collectRawHtml(child, [...trail, key], out);
  }

  return out;
}

function createAuditApp({ erpAggregationService }) {
  const app = express();
  app.use(helmet());
  app.use(cookieParser());
  app.use(compression());
  app.use(createRequestContextMiddleware());
  app.use(express.json({ limit: "2mb" }));
  app.use("/api", createGlobalRateLimitMiddleware({ redisClient: null }));
  app.use("/api", createErpV2Routes({ erpAggregationService }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    return sendApiError(res, req, error);
  });
  return app;
}

async function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
    server.on("error", reject);
  });
}

async function waitForManualLogin(page) {
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  log("Browser opened. Log in to the university ERP in that Playwright window.");
  log("After the ERP shell loads, this script will continue automatically.");

  await page.waitForFunction(
    () =>
      Boolean(document.querySelector("#sidebar-menu")) ||
      /HRDsystem/i.test(window.location.href),
    null,
    { timeout: WAIT_FOR_LOGIN_MS }
  );

  try {
    await page.waitForLoadState("networkidle", { timeout: 10000 });
  } catch {
    // Authenticated ERP pages can keep background requests open. The storage state is enough.
  }
}

async function createAuthenticatedSession(storageState) {
  const sessionStore = new SessionStore(SESSION_TTL_MS);
  const sessionId = await sessionStore.create(storageState);

  let profileData = null;
  const api = await createApiContext(storageState);
  try {
    profileData = await fetchProfileViaApi(api, { includeRawHtml: true });
  } finally {
    await api.dispose();
  }

  const profileForSession = isUsableProfileData(profileData)
    ? { ...profileData, rawHtml: undefined }
    : buildFallbackProfileData("", profileData);

  await sessionStore.update(sessionId, {
    storageState,
    loggedIn: true,
    profileData: profileForSession,
  });

  return { sessionStore, sessionId, profileData };
}

async function fetchPage({ api, sessionId, pageKey, pageDir }) {
  const startedAt = Date.now();
  const response = await api.get(`/api/v2/erp/page/${pageKey}`, {
    params: { mode: "live-first" },
    headers: { "x-session-id": sessionId },
  });

  const headers = response.headers();
  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = { success: false, parseError: "Response was not JSON", bodyText };
  }

  writeJson(path.join(pageDir, "frontend-payload.json"), body);
  writeJson(path.join(pageDir, "processed-data-no-raw-html.json"), removeRawHtml(body));

  const rawEntries = collectRawHtml(body);
  const rawDir = path.join(pageDir, "raw");
  ensureDir(rawDir);

  const rawFiles = rawEntries.map((entry, index) => {
    const nameParts = [
      String(index + 1).padStart(2, "0"),
      slugify(entry.title || entry.trail.join("-") || "raw"),
    ];
    const fileName = `${nameParts.join("-")}.html`;
    const filePath = path.join(rawDir, fileName);
    fs.writeFileSync(filePath, entry.html);
    return {
      file: path.relative(pageDir, filePath),
      bytes: Buffer.byteLength(entry.html),
      trail: entry.trail,
      title: entry.title,
      endpoint: entry.endpoint,
    };
  });

  writeJson(path.join(pageDir, "raw-index.json"), rawFiles);

  return {
    pageKey,
    ok: response.ok() && body?.success !== false,
    status: response.status(),
    source: headers["x-erp-source"] || body?.source || null,
    policyMode: headers["x-erp-policy"] || body?.policyMode || null,
    requestId: headers["x-request-id"] || body?.requestId || null,
    durationMs: Date.now() - startedAt,
    rawFileCount: rawFiles.length,
    pageDir: path.relative(OUTPUT_DIR, pageDir),
    error: body?.error || null,
  };
}

async function main() {
  ensureDir(OUTPUT_DIR);
  const runDir = path.join(OUTPUT_DIR, new Date().toISOString().replace(/[:.]/g, "-"));
  ensureDir(runDir);

  const discoveryRepository = new DiscoveryRepository(DISCOVERY_FILE_CANDIDATES);
  if (!discoveryRepository.getHealth().loaded) {
    throw new Error("Endpoint discovery map not found. Run `npm run discover:endpoints` in Backend first.");
  }

  const executablePath = resolveChromiumExecutable();
  const browser = await chromium.launch({
    headless: false,
    timeout: 60000,
    ...(executablePath ? { executablePath } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    timeout: 60000,
  });
  const page = await context.newPage();

  let server;
  let api;

  try {
    await waitForManualLogin(page);
    const storageState = await context.storageState();
    log("Login detected. Creating backend session from Playwright storage state.");

    const { sessionStore, sessionId, profileData } = await createAuthenticatedSession(storageState);
    writeJson(path.join(runDir, "login-profile.json"), {
      capturedAt: ts(),
      profileData,
    });

    const erpLiveService = new ErpLiveService({
      sessionStore,
      discoveryRepository,
      scrapeTargets,
    });
    const erpAggregationService = new ErpAggregationService({
      liveService: erpLiveService,
      cacheStore: new InMemoryErpCacheStore(),
      pagePolicyStore: new PagePolicyStore(ERP_PAGE_POLICY_FILE),
      sessionStore,
      redisClient: null,
    });

    const app = createAuditApp({ erpAggregationService });
    const listener = await listen(app);
    server = listener.server;
    const baseURL = `http://127.0.0.1:${listener.port}`;
    api = await request.newContext({ baseURL, timeout: 60000 });

    const pageKeys = getAuditedPageKeys();
    log(`Fetching ${pageKeys.length} frontend ERP page payloads through the local backend route.`);

    const results = [];
    for (let index = 0; index < pageKeys.length; index += 1) {
      const pageKey = pageKeys[index];
      const pageDir = path.join(
        runDir,
        "pages",
        `${String(index + 1).padStart(2, "0")}-${slugify(pageKey)}`
      );
      ensureDir(pageDir);

      log(`[${index + 1}/${pageKeys.length}] ${pageKey}`);
      try {
        results.push(await fetchPage({ api, sessionId, pageKey, pageDir }));
      } catch (error) {
        const failure = {
          pageKey,
          ok: false,
          status: null,
          source: null,
          policyMode: null,
          requestId: null,
          durationMs: 0,
          rawFileCount: 0,
          pageDir: path.relative(OUTPUT_DIR, pageDir),
          error: { message: error.message || String(error) },
        };
        writeJson(path.join(pageDir, "error.json"), failure);
        results.push(failure);
      }
    }

    const summary = {
      generatedAt: ts(),
      runDir,
      loginUrl: LOGIN_URL,
      discovery: discoveryRepository.getHealth(),
      total: results.length,
      successCount: results.filter((result) => result.ok).length,
      failureCount: results.filter((result) => !result.ok).length,
      results,
    };

    writeJson(path.join(runDir, "summary.json"), summary);
    log(`Done. Success=${summary.successCount}, failed=${summary.failureCount}`);
    log(`Saved audit artifacts to ${runDir}`);
  } finally {
    if (api) await api.dispose().catch(() => {});
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`[${ts()}] ERROR ${error.stack || error.message || String(error)}`);
  process.exitCode = 1;
});
