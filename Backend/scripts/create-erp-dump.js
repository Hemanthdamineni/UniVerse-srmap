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
  SESSION_COOKIE_NAME,
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
const { encodeKey } = require("../src/services/erpDumpService");

const DUMP_BASE_DIR = path.join(__dirname, "../data/erp-dump");
const OUTPUT_DIR = path.resolve(process.env.ERP_DUMP_OUTPUT_DIR || DUMP_BASE_DIR);
const WAIT_FOR_LOGIN_MS = Number(process.env.ERP_AUDIT_LOGIN_TIMEOUT_MS || 10 * 60 * 1000);

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage:
  npm --prefix Backend run dump:erp
  ERP_DUMP_OUTPUT_DIR=/tmp/my-dump npm --prefix Backend run dump:erp

What it does:
  1. Opens the university ERP login page in a visible Playwright browser.
  2. Waits while you log in manually (or uses ERP_USERNAME/ERP_PASSWORD env vars).
  3. Creates a local backend session from the authenticated browser cookies.
  4. Fetches every configured ERP page through /api/v2/erp/page/*.
  5. Saves raw HTML, processed payloads, summary, and profile to the output directory.
  6. Syncs frontend fixtures to Frontend/public/fixtures/.

Environment:
  ERP_DUMP_OUTPUT_DIR          Override output directory (default: Backend/data/erp-dump).
  ERP_AUDIT_LOGIN_TIMEOUT_MS   Override manual-login wait time (default: 600000).
  ERP_USERNAME / ERP_PASSWORD  Auto-fill login credentials.
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

function buildDumpSummaryEntry(rawEntry, pageKey, status, bytes) {
  const trail = rawEntry.trail;
  const dropdown = trail[1] || "";
  const subitem = trail[2] || "";
  const rawFile = `${encodeKey(dropdown, subitem)}.html`;
  return {
    pageKey,
    dropdown,
    subitem,
    status,
    ok: status >= 200 && status < 300,
    rawFile,
    bytes,
    trail: trail.join("/"),
  };
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

async function fetchPage({ api, sessionId, pageKey }) {
  const startedAt = Date.now();
  const response = await api.get(`/api/v2/erp/page/${pageKey}`, {
    params: { mode: "live-first" },
    headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` },
  });
  const headers = response.headers();
  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = { success: false, parseError: "Response was not JSON", bodyText };
  }
  const status = response.status();
  const ok = response.ok() && body?.success !== false;
  const durationMs = Date.now() - startedAt;
  const source = headers["x-erp-source"] || body?.source || null;
  const policyMode = headers["x-erp-policy"] || body?.policyMode || null;
  const requestId = headers["x-request-id"] || body?.requestId || null;
  const error = body?.error || null;

  const rawEntries = ok ? collectRawHtml(body) : [];
  const dumpResults = rawEntries.map((entry) => {
    const bytes = Buffer.byteLength(entry.html);
    return { entry, bytes, dumpEntry: buildDumpSummaryEntry(entry, pageKey, status, bytes) };
  });

  return { ok, status, source, policyMode, requestId, durationMs, error, rawHtmlEntries: dumpResults, body };
}

async function fillCredentials(page) {
  const username = process.env.ERP_USERNAME || process.env.SRM_USERNAME || "";
  const password = process.env.ERP_PASSWORD || process.env.SRM_PASSWORD || "";
  if (username && password) {
    await page.getByRole("textbox", { name: /Enter Application Number/i }).fill(username).catch(() => {});
    await page.getByRole("textbox", { name: /Password/i }).fill(password).catch(() => {});
    log("Credentials filled from environment variables.");
    return true;
  }
  return false;
}

async function fetchSemesterExpansions(storageState, dumpDir, results, seenRawFiles) {
  const rawDir = path.join(dumpDir, "raw");
  const api = await createApiContext(storageState);
  try {
    for (let semester = 1; semester <= 8; semester++) {
      const label = `Semester ${semester}`;
      try {
        const response = await api.post("students/report/studentreportresources.jsp", {
          form: { ids: "23", filter: String(semester) },
        });
        const body = await response.text();
        const key = encodeKey("Examination", label);
        const rawFile = `${key}.html`;
        const filePath = path.join(rawDir, rawFile);

        if (!seenRawFiles.has(rawFile)) {
          fs.writeFileSync(filePath, body);
          seenRawFiles.add(rawFile);
        }

        results.push({
          pageKey: "examination/earlier-internal-marks/semester",
          dropdown: "Examination",
          subitem: label,
          status: response.status(),
          ok: response.ok(),
          rawFile,
          bytes: Buffer.byteLength(body),
        });
        log(`  [expansion] ${label} (${response.status()}, ${Buffer.byteLength(body)} bytes)`);
      } catch (error) {
        log(`  [expansion] ERROR ${label}: ${error.message}`);
        results.push({
          pageKey: "examination/earlier-internal-marks/semester",
          dropdown: "Examination",
          subitem: label,
          status: null,
          ok: false,
          rawFile: null,
          bytes: 0,
          error: error.message,
        });
      }
    }
  } finally {
    await api.dispose();
  }
}

async function main() {
  const startedAt = Date.now();
  ensureDir(OUTPUT_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpDir = path.join(OUTPUT_DIR, timestamp);
  const rawDir = path.join(dumpDir, "raw");
  ensureDir(rawDir);

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
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    const credsFilled = await fillCredentials(page);

    if (credsFilled) {
      log("Credentials filled. Complete captcha and login, then resume here.");
      await page.pause();
    }

    await waitForManualLogin(page);
    const storageState = await context.storageState();
    log("Login detected. Creating backend session from Playwright storage state.");

    const { sessionStore, sessionId, profileData } = await createAuthenticatedSession(storageState);

    writeJson(path.join(dumpDir, "profile.json"), profileData);

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
    const seenRawFiles = new Set();

    for (let index = 0; index < pageKeys.length; index += 1) {

      const pageKey = pageKeys[index];
      log(`[${index + 1}/${pageKeys.length}] ${pageKey}`);

      try {
        const fetchResult = await fetchPage({ api, sessionId, pageKey });

        if (fetchResult.ok && fetchResult.rawHtmlEntries.length > 0) {
          for (const { entry, bytes, dumpEntry } of fetchResult.rawHtmlEntries) {
            const rawFile = dumpEntry.rawFile;
            const filePath = path.join(rawDir, rawFile);

            if (!seenRawFiles.has(rawFile)) {
              fs.writeFileSync(filePath, entry.html);
              seenRawFiles.add(rawFile);
            }
            results.push(dumpEntry);
          }
        }

        if (!fetchResult.ok) {
          results.push({
            pageKey,
            dropdown: "",
            subitem: "",
            status: fetchResult.status,
            ok: false,
            rawFile: null,
            bytes: 0,
            error: fetchResult.error,
          });
        }
      } catch (error) {
        log(`  ERROR: ${error.message}`);
        results.push({
          pageKey,
          dropdown: "",
          subitem: "",
          status: null,
          ok: false,
          rawFile: null,
          bytes: 0,
          error: { message: error.message || String(error) },
        });
      }
    }

    // Fetch semester-specific earlier internal marks expansions
    log("Fetching semester-specific internal marks expansions...");
    await fetchSemesterExpansions(storageState, dumpDir, results, seenRawFiles);

    const durationMs = Date.now() - startedAt;
    const summary = {
      generatedAt: ts(),
      durationMs,
      pageCount: results.length,
      successCount: results.filter((r) => r.ok).length,
      failureCount: results.filter((r) => !r.ok).length,
      dumpDir,
      results,
    };
    writeJson(path.join(dumpDir, "summary.json"), summary);

    log(`Done. Success=${summary.successCount}, failed=${summary.failureCount}`);
    log(`Dump saved to ${dumpDir}`);

    // Sync frontend fixtures
    log("Syncing to frontend fixtures...");
    const fixturesDir = path.join(__dirname, "../../Frontend/public/fixtures");
    ensureDir(fixturesDir);

    const batch = {};
    for (const r of results) {
      if (!r.ok || !r.rawFile) continue;
      const rawPath = path.join(rawDir, r.rawFile);
      if (!fs.existsSync(rawPath)) continue;
      const html = fs.readFileSync(rawPath, "utf8");
      const { parseHtmlContent } = require("../src/services/htmlParser");
      const parsed = parseHtmlContent(html);
      const dropdownKey = r.dropdown;
      const subitemKey = r.subitem || "";

      const payload = {
        success: true,
        pageKey: "dump",
        source: "dump-snapshot",
        fetchedAt: ts(),
        data: {
          title: parsed.title || subitemKey,
          text: parsed.text || "",
          tables: parsed.tables || [],
          meta: parsed.meta || null,
        },
      };

      for (const pk of Object.keys(scrapeTargets)) {
        const targets = scrapeTargets[pk];
        if (!Array.isArray(targets)) continue;
        if (targets.some((t) => t.dropdown === r.dropdown && t.subitem === r.subitem)) {
          if (!batch[pk]) {
            batch[pk] = {
              success: true,
              pageKey: pk,
              source: "dump-snapshot",
              fetchedAt: ts(),
              data: {},
            };
          }
          if (!batch[pk].data[dropdownKey]) {
            batch[pk].data[dropdownKey] = {};
          }
          if (!batch[pk].data[dropdownKey][subitemKey]) {
            batch[pk].data[dropdownKey][subitemKey] = payload.data;
          }
        }
      }
    }

    writeJson(path.join(fixturesDir, "erp-batch.json"), batch);

    const profileDataForFixture = JSON.parse(fs.readFileSync(path.join(dumpDir, "profile.json"), "utf8"));
    if (profileDataForFixture?.TableContent) {
      writeJson(path.join(fixturesDir, "session-profile.json"), { TableContent: profileDataForFixture.TableContent });
    }

    log(`Fixtures synced to ${fixturesDir}`);

  } catch (error) {
    console.error(`[${ts()}] FATAL: ${error.stack || error.message}`);
    process.exitCode = 1;
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
