const { chromium, request } = require("playwright");
const fs = require("fs");
const path = require("path");
const { cleanText, slugify } = require("../src/utils/text");

const DISCOVERY_FILE =
  process.argv[2] || path.join(__dirname, "../data/endpoint-discovery.json");
const OUTPUT_DIR =
  process.argv[3] || path.join(__dirname, "../data/direct-api-output");

function ts() {
  return new Date().toISOString();
}

function log(message) {
  console.log(`[${ts()}] ${message}`);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isExternalUrl(url) {
  return /^https?:\/\//i.test(url) || String(url).startsWith("//");
}

function stripLeadingSlash(url) {
  return String(url || "").replace(/^\/+/, "");
}

function buildRequestParams(endpoint, item) {
  const params = {};
  const argId = endpoint.argId ?? item.action?.argId ?? item.argId ?? null;
  const template = endpoint.paramsTemplate || {};

  Object.entries(template).forEach(([key, value]) => {
    if (value === "{{argId}}") {
      if (argId !== null && argId !== undefined) params[key] = String(argId);
      return;
    }
    params[key] = String(value);
  });

  if (
    endpoint.method === "POST" &&
    !Object.prototype.hasOwnProperty.call(params, "ids") &&
    Number.isInteger(argId)
  ) {
    params.ids = String(argId);
  }

  return params;
}

async function parseHtmlWithBrowser(parserPage, html) {
  try {
    await parserPage.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    return await parserPage.evaluate(() => {
      const getText = (value) =>
        String(value || "")
          .replace(/\s+/g, " ")
          .trim();

      const title =
        document.querySelector("#divContent h1, #divContent h2, #divContent h3")?.textContent ||
        document.querySelector("h1, h2, h3")?.textContent ||
        "";

      const tables = [];
      const tableEls = Array.from(document.querySelectorAll("table"));
      tableEls.forEach((table, tableIndex) => {
        const rows = Array.from(table.querySelectorAll("tr"));
        if (!rows.length) return;

        const headerCells =
          Array.from(table.querySelectorAll("thead tr:last-child th, thead tr:last-child td"));
        const headers = headerCells.length
          ? headerCells.map((cell) => getText(cell.textContent))
          : Array.from(rows[0].querySelectorAll("th, td")).map((cell) => getText(cell.textContent));

        const dataRows = Array.from(table.querySelectorAll("tbody tr"));
        const rowsToUse = dataRows.length ? dataRows : rows.slice(1);

        const data = [];
        rowsToUse.forEach((row) => {
          const cells = Array.from(row.querySelectorAll("td"));
          if (!cells.length) return;
          const rowData = {};
          cells.forEach((cell, idx) => {
            rowData[headers[idx] || `col${idx + 1}`] = getText(cell.textContent);
          });
          if (Object.values(rowData).some((value) => value !== "")) {
            data.push(rowData);
          }
        });

        if (data.length) {
          tables.push({
            index: tableIndex,
            headers,
            rowCount: data.length,
            sampleRows: data.slice(0, 3),
          });
        }
      });

      const textPreview = getText(
        document.querySelector("#divContent")?.textContent || document.body?.textContent || ""
      ).slice(0, 1200);

      return {
        pageHeading: getText(title),
        tableCount: tables.length,
        tables,
        textPreview,
      };
    });
  } catch (error) {
    return {
      parseError: error.message,
      pageHeading: "",
      tableCount: 0,
      tables: [],
      textPreview: "",
    };
  }
}

async function clickLogin(page) {
  try {
    await page.getByRole("button", { name: /login/i }).click({ timeout: 3000 });
    return true;
  } catch (_error) {
    try {
      await page.click('button[type="submit"], input[type="submit"], .login-btn', {
        timeout: 3000,
      });
      return true;
    } catch (_fallbackError) {
      return false;
    }
  }
}

async function main() {
  if (!fs.existsSync(DISCOVERY_FILE)) {
    throw new Error(`Discovery file not found: ${DISCOVERY_FILE}`);
  }

  const discovery = JSON.parse(fs.readFileSync(DISCOVERY_FILE, "utf8"));
  const baseOrigin = discovery.baseOrigin || "https://student.srmap.edu.in";
  const basePath = discovery.basePath || "/srmapstudentcorner";
  const loginUrl = discovery.loginUrl || `${baseOrigin}${basePath}/StudentLoginPage`;
  const requestBase = `${baseOrigin}${basePath.replace(/\/+$/, "")}/`;
  const resolvedItems = Array.isArray(discovery.resolvedItems) ? discovery.resolvedItems : [];

  const internalItems = resolvedItems.filter(
    (item) =>
      item.endpoint &&
      item.endpoint.url &&
      !item.endpoint.external &&
      !isExternalUrl(item.endpoint.url)
  );

  ensureDir(OUTPUT_DIR);
  const rawDir = path.join(OUTPUT_DIR, "raw");
  ensureDir(rawDir);

  let browser;
  let context;
  let page;
  let parserPage;
  let api;

  try {
    browser = await chromium.launch({ headless: false, timeout: 60000 });
    context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      timeout: 60000,
    });
    page = await context.newPage();

    log(`Opening login page: ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: "networkidle", timeout: 30000 });

    const username = process.env.ERP_USERNAME || process.env.SRM_USERNAME || "";
    const password = process.env.ERP_PASSWORD || process.env.SRM_PASSWORD || "";

    if (username && password) {
      await page.getByRole("textbox", { name: /Enter Application Number/i }).fill(username).catch(() => {});
      await page.getByRole("textbox", { name: /Password/i }).fill(password).catch(() => {});
      log("Credentials filled from environment variables.");
    } else {
      log("ERP_USERNAME/ERP_PASSWORD not set. Fill credentials manually in browser.");
    }

    log("Complete captcha, then resume script.");
    await page.pause();

    const hasSidebarBeforeClick = await page.locator("#sidebar-menu").count().then((count) => count > 0);
    if (!hasSidebarBeforeClick) {
      await clickLogin(page);
    }

    await page.waitForSelector("#sidebar-menu", { timeout: 15000 });
    log("Login successful. Creating authenticated request context.");

    const storageState = await context.storageState();
    api = await request.newContext({
      baseURL: requestBase,
      storageState,
      extraHTTPHeaders: { Referer: loginUrl },
      timeout: 30000,
    });

    parserPage = await context.newPage();

    const results = [];
    log(`Fetching ${internalItems.length} internal endpoints from discovered map.`);

    for (let i = 0; i < internalItems.length; i += 1) {
      const item = internalItems[i];
      const endpoint = item.endpoint;
      const method = String(endpoint.method || "POST").toUpperCase();
      const requestPath = stripLeadingSlash(endpoint.url);
      const params = buildRequestParams(endpoint, item);
      const label = `${item.dropdown} -> ${item.subitem}`;

      log(`[${i + 1}/${internalItems.length}] ${label} (${method} ${requestPath})`);

      try {
        let response;
        if (method === "GET") {
          response = await api.get(requestPath, { params });
        } else {
          response = await api.post(requestPath, { form: params });
        }

        const status = response.status();
        const headers = response.headers();
        const contentType = headers["content-type"] || "";

        const baseName = `${String(i + 1).padStart(2, "0")}-${slugify(
          `${item.dropdown}-${item.subitem}`
        )}`;

        const resultEntry = {
          index: i + 1,
          key: `${item.dropdown}::${item.subitem}`,
          dropdown: item.dropdown,
          subitem: item.subitem,
          endpoint: {
            method,
            url: requestPath,
            params,
          },
          status,
          ok: response.ok(),
          contentType,
          rawFile: "",
          parsed: null,
          error: null,
        };

        if (/html|text\/plain|application\/xhtml\+xml/i.test(contentType) || !contentType) {
          const bodyText = await response.text();
          const rawFile = `${baseName}.html`;
          const rawPath = path.join(rawDir, rawFile);
          fs.writeFileSync(rawPath, bodyText);
          resultEntry.rawFile = path.relative(OUTPUT_DIR, rawPath);
          resultEntry.parsed = await parseHtmlWithBrowser(parserPage, bodyText);
        } else {
          const buffer = await response.body();
          const extension = /pdf/i.test(contentType) ? "pdf" : "bin";
          const rawFile = `${baseName}.${extension}`;
          const rawPath = path.join(rawDir, rawFile);
          fs.writeFileSync(rawPath, buffer);
          resultEntry.rawFile = path.relative(OUTPUT_DIR, rawPath);
          resultEntry.parsed = { note: "Non-HTML response saved as binary." };
        }

        results.push(resultEntry);
      } catch (error) {
        results.push({
          index: i + 1,
          key: `${item.dropdown}::${item.subitem}`,
          dropdown: item.dropdown,
          subitem: item.subitem,
          endpoint: {
            method,
            url: requestPath,
            params,
          },
          status: null,
          ok: false,
          contentType: "",
          rawFile: "",
          parsed: null,
          error: error.message,
        });
      }
    }

    const summary = {
      generatedAt: ts(),
      discoveryFile: path.resolve(DISCOVERY_FILE),
      requestBase,
      totalDiscoveredItems: resolvedItems.length,
      totalInternalItems: internalItems.length,
      successCount: results.filter((item) => item.ok).length,
      failureCount: results.filter((item) => !item.ok).length,
      results,
    };

    const summaryFile = path.join(OUTPUT_DIR, "fetched-endpoints.json");
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

    log(`Fetch summary saved: ${summaryFile}`);
    log(`Completed. Success: ${summary.successCount}, Failed: ${summary.failureCount}`);
  } finally {
    if (parserPage && !parserPage.isClosed()) await parserPage.close().catch(() => {});
    if (api) await api.dispose().catch(() => {});
    if (page && !page.isClosed()) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`[${ts()}] ERROR ${error.message}`);
  process.exitCode = 1;
});
