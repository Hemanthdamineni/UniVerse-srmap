const ERP_SESSION_EXPIRED_HTML_PATTERNS = [
  /studentloginpage/i,
  /studentlogintoportal/i,
  /id\s*=\s*["']frmSL["']/i,
  /name\s*=\s*["']ccode["']/i,
  /id\s*=\s*["']ccode["']/i,
  /id\s*=\s*["']UserName["']/i,
  /id\s*=\s*["']AuthKey["']/i,
  /captcha/i,
];

const ERP_SESSION_EXPIRED_TEXT_PATTERNS = [
  /\blogin with your application number\b/i,
  /\bddmmyyyy\b/i,
  /\bstudentloginpage\b/i,
  /\bstudentlogintoportal\b/i,
  /\btxt(username|authkey)\b/i,
  /\bcaptcha\b/i,
  /\bapplication number\b/i,
];

function makeAuthError(code, message, status = 401, extra = {}) {
  const error = new Error(message);
  error.code = String(code || "UNAUTHORIZED").trim().toUpperCase();
  error.status = Number(status) || 500;
  if (extra && typeof extra === "object" && Object.keys(extra).length > 0) {
    error.extra = extra;
  }
  return error;
}

function isUsableProfileData(profileData) {
  const table = profileData?.TableContent || {};
  const keys = Object.keys(table).map((key) => String(key || "").trim().toLowerCase());
  if (keys.length < 4) return false;

  const expected = [
    "student name",
    "register no",
    "semester",
    "program",
    "specialization",
    "student contact number",
  ];

  const hits = expected.filter((token) => keys.some((key) => key.includes(token))).length;
  return hits >= 2;
}

function isLoginFailureResponse(html = "", hasSidebar = false) {
  return (
    /invalid captcha/i.test(html) ||
    /invalid login/i.test(html) ||
    (/studentloginpage/i.test(html) && !hasSidebar)
  );
}

function looksLikeLoginPage(html = "", parsed = null) {
  const rawHtml = String(html || "");
  if (!rawHtml && !parsed) return false;
  if (rawHtml && ERP_SESSION_EXPIRED_HTML_PATTERNS.some((pattern) => pattern.test(rawHtml))) {
    return true;
  }

  const payloadText = collectParsedPayloadText(parsed) || rawHtml.replace(/<[^>]+>/g, " ");
  return ERP_SESSION_EXPIRED_TEXT_PATTERNS.some((pattern) => pattern.test(payloadText));
}

function classifyLoginResponse(html = "", { hasSidebar = false, finalUrl = "", httpStatus = 200 } = {}) {
  const rawHtml = String(html || "");
  const normalizedUrl = String(finalUrl || "");
  const statusCode = Number(httpStatus || 0);
  if (/invalid captcha/i.test(rawHtml)) {
    return {
      classifier: "invalid_captcha",
      authenticated: false,
      failureCode: "INVALID_CAPTCHA",
      status: 401,
      message: "Invalid captcha. Please try again.",
    };
  }
  if (/invalid login/i.test(rawHtml)) {
    return {
      classifier: "invalid_credentials",
      authenticated: false,
      failureCode: "INVALID_CREDENTIALS",
      status: 401,
      message: "Invalid username or password. Please try again.",
    };
  }

  if (statusCode >= 400) {
    return {
      classifier: "unknown_upstream_state",
      authenticated: false,
      failureCode: "",
      status: statusCode || 502,
      message: "ERP verification request failed.",
    };
  }

  const hasShell =
    hasSidebar ||
    /id\s*=\s*["']sidebar-menu["']/i.test(rawHtml) ||
    (/hrdsystem/i.test(normalizedUrl) && !looksLikeLoginPage(rawHtml));
  if (hasShell) {
    return {
      classifier: "authenticated_shell",
      authenticated: true,
      failureCode: "",
      status: 200,
      message: "",
    };
  }

  if (looksLikeLoginPage(rawHtml)) {
    return {
      classifier: "login_page",
      authenticated: false,
      failureCode: "",
      status: 401,
      message: "ERP returned the login page again.",
    };
  }

  return {
    classifier: "unknown_upstream_state",
    authenticated: false,
    failureCode: "",
    status: 502,
    message: "ERP returned an unknown login response.",
  };
}

function buildFallbackProfileData(username, profileData = null) {
  const normalizedUsername = String(username || "").trim();
  const existing = profileData && typeof profileData === "object" ? profileData : {};
  const existingTable =
    existing.TableContent && typeof existing.TableContent === "object" ? existing.TableContent : {};

  const tableContent = {
    ...existingTable,
  };

  if (normalizedUsername) {
    if (!String(tableContent["Register No."] || "").trim()) {
      tableContent["Register No."] = normalizedUsername;
    }
    if (!String(tableContent.Name || "").trim() && !String(tableContent["Student Name"] || "").trim()) {
      tableContent.Name = normalizedUsername;
    }
  }

  return {
    PageHeading: existing.PageHeading || "PROFILE",
    TableContent: tableContent,
    tables: Array.isArray(existing.tables) ? existing.tables : [],
    text: typeof existing.text === "string" ? existing.text : "",
    meta: {
      ...(existing.meta && typeof existing.meta === "object" ? existing.meta : {}),
      profileIncomplete: true,
      source: "login-session-fallback",
    },
  };
}

function makeSessionExpiredError(message = "ERP session expired. Please sign in again.") {
  const error = new Error(message);
  error.status = 401;
  error.code = "SESSION_EXPIRED";
  return error;
}

function collectParsedPayloadText(payload) {
  if (!payload || typeof payload !== "object") return "";

  const parts = [];
  if (typeof payload.title === "string") parts.push(payload.title);
  if (typeof payload.text === "string") parts.push(payload.text);

  if (payload.TableContent && typeof payload.TableContent === "object") {
    for (const [key, value] of Object.entries(payload.TableContent)) {
      parts.push(String(key || ""));
      parts.push(String(value || ""));
    }
  }

  if (Array.isArray(payload.tables)) {
    for (const table of payload.tables.slice(0, 2)) {
      if (!Array.isArray(table)) continue;
      for (const row of table.slice(0, 3)) {
        if (!row || typeof row !== "object") continue;
        parts.push(...Object.values(row).map((value) => String(value || "")));
      }
    }
  }

  return parts.join(" ");
}

function isErpSessionExpiredResponse(html = "", parsed = null) {
  const rawHtml = String(html || "");
  if (rawHtml && ERP_SESSION_EXPIRED_HTML_PATTERNS.some((pattern) => pattern.test(rawHtml))) {
    return true;
  }

  const payloadText = collectParsedPayloadText(parsed);
  if (!payloadText) return false;

  const hasSessionExpiryText = ERP_SESSION_EXPIRED_TEXT_PATTERNS.some((pattern) =>
    pattern.test(payloadText)
  );
  if (!hasSessionExpiryText) return false;

  const hasStructuredData =
    Boolean(parsed?.TableContent && Object.keys(parsed.TableContent).length > 0) ||
    (Array.isArray(parsed?.tables) && parsed.tables.some((table) => Array.isArray(table) && table.length > 0));

  return !hasStructuredData;
}

module.exports = {
  makeAuthError,
  isUsableProfileData,
  isLoginFailureResponse,
  looksLikeLoginPage,
  classifyLoginResponse,
  buildFallbackProfileData,
  makeSessionExpiredError,
  collectParsedPayloadText,
  isErpSessionExpiredResponse,
};
