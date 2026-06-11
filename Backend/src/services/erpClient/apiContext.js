const { request } = require("playwright");
const { BASE_ORIGIN, BASE_PATH, LOGIN_URL } = require("../../config/env");

const AUTHENTICATED_REFERER = `${BASE_ORIGIN}${BASE_PATH}/HRDsystem`;

async function createApiContext(storageState = null, options = {}) {
  const baseURL = `${BASE_ORIGIN}${BASE_PATH.replace(/\/+$/, "")}/`;
  const referer =
    String(options?.referer || "").trim() ||
    (storageState ? AUTHENTICATED_REFERER : LOGIN_URL);
  return request.newContext({
    baseURL,
    storageState: storageState || undefined,
    timeout: 30000,
    extraHTTPHeaders: {
      Referer: referer,
      Origin: BASE_ORIGIN,
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });
}

module.exports = {
  createApiContext,
  AUTHENTICATED_REFERER,
};
