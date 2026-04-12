const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE_ORIGIN = process.env.SRM_BASE_ORIGIN || "https://student.srmap.edu.in";
const BASE_PATH = process.env.SRM_BASE_PATH || "/srmapstudentcorner";
const LOGIN_URL = `${BASE_ORIGIN}${BASE_PATH}/StudentLoginPage`;
const OUTPUT_FILE =
  process.argv[2] || path.join(__dirname, "../data/endpoint-discovery.json");

const KNOWN_HELPER_FUNCTIONS = [
  "funLoadDetails",
  "funMobileVerification",
  "funEventAttendance",
  "funEarlierInternalMarks",
];

function ts() {
  return new Date().toISOString();
}

function log(message) {
  console.log(`[${ts()}] ${message}`);
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEndpointPath(url) {
  const raw = cleanText(url);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) return raw;
  if (raw.startsWith("/")) return raw.slice(1);
  return raw;
}

function parseParamsTemplate(objectLiteral = "") {
  const params = {};
  const body = cleanText(objectLiteral).replace(/^\{/, "").replace(/\}$/, "");
  if (!body) return params;

  const pairRegex = /([A-Za-z0-9_]+)\s*:\s*('[^']*'|"[^"]*"|[^,}]+)/g;
  let match;
  while ((match = pairRegex.exec(body)) !== null) {
    const key = match[1];
    const rawValue = cleanText(match[2]);
    if (!key) continue;

    if (/argId/.test(rawValue)) {
      params[key] = "{{argId}}";
      continue;
    }

    const quoted = rawValue.match(/^['"]([\s\S]*)['"]$/);
    if (quoted) {
      params[key] = quoted[1];
      continue;
    }

    if (/^\d+$/.test(rawValue)) {
      params[key] = rawValue;
      continue;
    }

    params[key] = rawValue;
  }

  return params;
}

function extractConditionalBlocks(source) {
  const blocks = [];
  const pattern = /\b(?:if|else if)\s*\(([^)]+)\)\s*\{/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const condition = cleanText(match[1]);
    const openBraceIdx = source.indexOf("{", match.index);
    if (openBraceIdx < 0) continue;

    let depth = 0;
    let closeBraceIdx = openBraceIdx;
    for (let i = openBraceIdx; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === "{") depth += 1;
      if (ch === "}") depth -= 1;
      if (depth === 0) {
        closeBraceIdx = i;
        break;
      }
    }

    const block = source.slice(openBraceIdx + 1, closeBraceIdx);
    blocks.push({ condition, block });
    pattern.lastIndex = closeBraceIdx + 1;
  }

  return blocks;
}

function expandArgIdsFromCondition(condition) {
  const ids = new Set();

  const equalsRegex = /argId\s*==\s*(\d+)/g;
  let eqMatch;
  while ((eqMatch = equalsRegex.exec(condition)) !== null) {
    ids.add(Number(eqMatch[1]));
  }

  const lessThanRegex = /argId\s*<\s*(\d+)/g;
  let ltMatch;
  while ((ltMatch = lessThanRegex.exec(condition)) !== null) {
    const limit = Number(ltMatch[1]);
    for (let i = 1; i < limit; i += 1) ids.add(i);
  }

  return Array.from(ids).sort((a, b) => a - b);
}

function extractPostCall(blockText) {
  const postRegex =
    /\$\.post\(\s*["']([^"']+)["']\s*,\s*({[\s\S]*?})\s*,[\s\S]*?\)/m;
  const match = blockText.match(postRegex);
  if (!match) return null;
  return {
    method: "POST",
    url: normalizeEndpointPath(match[1]),
    paramsTemplate: parseParamsTemplate(match[2]),
  };
}

function extractWindowOpenCall(blockText) {
  const openRegex = /window\.open\(\s*["']([^"']+)["']/m;
  const match = blockText.match(openRegex);
  if (!match) return null;
  return {
    method: "GET",
    url: normalizeEndpointPath(match[1]),
    paramsTemplate: {},
    opensNewTab: true,
  };
}

function parseFunLoadDetailsSource(source) {
  const byId = {};
  if (!source) return byId;

  const blocks = extractConditionalBlocks(source);
  for (const { condition, block } of blocks) {
    const ids = expandArgIdsFromCondition(condition);
    if (!ids.length) continue;

    const endpoint = extractPostCall(block) || extractWindowOpenCall(block);
    if (!endpoint) continue;

    ids.forEach((id) => {
      byId[id] = {
        argId: id,
        method: endpoint.method,
        url: endpoint.url,
        paramsTemplate: endpoint.paramsTemplate,
        opensNewTab: Boolean(endpoint.opensNewTab),
        sourceFunction: "funLoadDetails",
        sourceCondition: condition,
      };
    });
  }

  return byId;
}

function parseSimpleHelperSource(source, functionName) {
  if (!source) return null;
  const endpoint = extractPostCall(source) || extractWindowOpenCall(source);
  if (!endpoint) return null;
  return {
    method: endpoint.method,
    url: endpoint.url,
    paramsTemplate: endpoint.paramsTemplate || {},
    sourceFunction: functionName,
    opensNewTab: Boolean(endpoint.opensNewTab),
  };
}

function parseHrefAction(href) {
  const value = cleanText(href);
  if (!value) return { type: "none" };

  const fnCall = value.match(/^javascript:([A-Za-z0-9_]+)\((.*?)\);?$/i);
  if (fnCall) {
    const functionName = fnCall[1];
    const rawArgs = cleanText(fnCall[2]);
    const numericArg = rawArgs.match(/^(\d+)$/);
    return {
      type: "javascript_function",
      functionName,
      rawArgs,
      argId: numericArg ? Number(numericArg[1]) : null,
    };
  }

  if (/^https?:\/\//i.test(value) || value.startsWith("//")) {
    return { type: "external_url", url: value };
  }

  return { type: "other", value };
}

function resolveMenuItems(menuItems, funLoadMap, helperMap) {
  return menuItems.map((item) => {
    const action = parseHrefAction(item.href);
    const resolved = {
      ...item,
      action,
      endpoint: null,
      resolved: false,
    };

    if (action.type === "javascript_function") {
      if (action.functionName === "funLoadDetails" && Number.isInteger(action.argId)) {
        resolved.endpoint = funLoadMap[action.argId] || null;
        resolved.resolved = Boolean(resolved.endpoint);
        return resolved;
      }

      resolved.endpoint = helperMap[action.functionName] || null;
      resolved.resolved = Boolean(resolved.endpoint);
      return resolved;
    }

    if (action.type === "external_url") {
      resolved.endpoint = {
        method: "GET",
        url: action.url,
        paramsTemplate: {},
        sourceFunction: "direct_url",
        external: true,
      };
      resolved.resolved = true;
    }

    return resolved;
  });
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
  let browser;
  let context;
  let page;

  try {
    browser = await chromium.launch({ headless: false, timeout: 60000 });
    context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      timeout: 60000,
    });
    page = await context.newPage();

    log(`Opening login page: ${LOGIN_URL}`);
    await page.goto(LOGIN_URL, { waitUntil: "networkidle", timeout: 30000 });

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

    const hasSidebar = await page.locator("#sidebar-menu").count().then((count) => count > 0);
    if (!hasSidebar) {
      await clickLogin(page);
    }

    await page.waitForSelector("#sidebar-menu", { timeout: 15000 });
    log("Login successful. Extracting runtime mappings.");

    const runtimeData = await page.evaluate((knownFunctions) => {
      const cleanAnchorText = (anchor) => {
        const clone = anchor.cloneNode(true);
        clone.querySelectorAll("i, span").forEach((el) => el.remove());
        return (clone.textContent || "").replace(/\s+/g, " ").trim();
      };

      const menuItems = [];
      const rootItems = Array.from(document.querySelectorAll("#sidebar-menu .side-menu > li"));

      rootItems.forEach((li) => {
        const topAnchor = li.querySelector(":scope > a");
        if (!topAnchor) return;

        const dropdown = cleanAnchorText(topAnchor);
        const childAnchors = Array.from(li.querySelectorAll(":scope > ul.child_menu > li > a"));

        if (childAnchors.length) {
          childAnchors.forEach((a) => {
            menuItems.push({
              dropdown,
              subitem: cleanAnchorText(a),
              href: a.getAttribute("href") || "",
              target: a.getAttribute("target") || "",
              rawText: (a.textContent || "").replace(/\s+/g, " ").trim(),
            });
          });
          return;
        }

        menuItems.push({
          dropdown,
          subitem: dropdown,
          href: topAnchor.getAttribute("href") || "",
          target: topAnchor.getAttribute("target") || "",
          rawText: (topAnchor.textContent || "").replace(/\s+/g, " ").trim(),
        });
      });

      const functionSources = {};
      knownFunctions.forEach((name) => {
        try {
          const fn = window[name];
          functionSources[name] = typeof fn === "function" ? fn.toString() : "";
        } catch (_error) {
          functionSources[name] = "";
        }
      });

      return { menuItems, functionSources };
    }, KNOWN_HELPER_FUNCTIONS);

    const funLoadMap = parseFunLoadDetailsSource(runtimeData.functionSources.funLoadDetails);

    const helperMap = {};
    for (const fnName of KNOWN_HELPER_FUNCTIONS) {
      if (fnName === "funLoadDetails") continue;
      const parsed = parseSimpleHelperSource(runtimeData.functionSources[fnName], fnName);
      if (parsed) helperMap[fnName] = parsed;
    }

    const resolvedItems = resolveMenuItems(runtimeData.menuItems, funLoadMap, helperMap);
    const unresolvedItems = resolvedItems.filter((item) => !item.resolved);

    const result = {
      generatedAt: ts(),
      baseOrigin: BASE_ORIGIN,
      basePath: BASE_PATH,
      loginUrl: LOGIN_URL,
      counts: {
        menuItems: runtimeData.menuItems.length,
        mappedFunLoadDetailsIds: Object.keys(funLoadMap).length,
        helperFunctionsMapped: Object.keys(helperMap).length,
        resolvedItems: resolvedItems.filter((item) => item.resolved).length,
        unresolvedItems: unresolvedItems.length,
      },
      functionMappings: {
        funLoadDetailsById: funLoadMap,
        helperFunctions: helperMap,
      },
      menuItems: runtimeData.menuItems,
      resolvedItems,
      unresolvedItems,
    };

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));

    log(`Endpoint discovery saved: ${OUTPUT_FILE}`);
    log(
      `Resolved ${result.counts.resolvedItems}/${result.counts.menuItems} items. Unresolved: ${result.counts.unresolvedItems}`
    );
  } catch (error) {
    console.error(`[${ts()}] ERROR ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

main();
