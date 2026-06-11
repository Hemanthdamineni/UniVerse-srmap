const {
  cleanText,
  makeError,
  normalizeExpectedUrl,
  extractMessageFromResponse,
  shouldIncludeHtml,
} = require("./utils");

const transportResultMethods = {
  async executeHttp(api, method, url, payload) {
    const normalizedMethod = cleanText(method).toUpperCase() || "POST";
    const normalizedUrl = normalizeExpectedUrl(url);
    if (!normalizedUrl) {
      throw makeError("Action has no endpoint mapping", 400, "BAD_REQUEST");
    }

    let response;
    if (normalizedMethod === "GET") {
      response = await api.get(normalizedUrl, { params: payload });
    } else {
      response = await api.post(normalizedUrl, { form: payload });
    }

    const raw = await response.text();
    let contentType = "";
    if (typeof response.headers === "function") {
      const headers = response.headers() || {};
      contentType = headers["content-type"] || headers["Content-Type"] || "";
    }

    return {
      response,
      raw,
      contentType: cleanText(contentType),
      method: normalizedMethod,
      url: normalizedUrl,
    };
  },

  buildResult({
    action,
    pageKey,
    actionId,
    method,
    url,
    response,
    raw,
    contentType = "",
    defaultMessage,
    extra = {},
  }) {
    const safeRaw = String(raw || "");
    const includeHtml = shouldIncludeHtml(action, url, contentType) && safeRaw.length <= 1_000_000;
    return {
      success: response.ok(),
      pageKey: cleanText(pageKey),
      actionId: cleanText(actionId),
      status: response.status(),
      method: cleanText(method).toUpperCase() || "POST",
      url: normalizeExpectedUrl(url),
      message: extractMessageFromResponse(safeRaw, defaultMessage),
      preview: cleanText(safeRaw).slice(0, 260),
      ...(contentType ? { contentType } : {}),
      ...(includeHtml ? { html: safeRaw } : {}),
      ...(extra && typeof extra === "object" ? extra : {}),
    };
  },
};

module.exports = { transportResultMethods };
