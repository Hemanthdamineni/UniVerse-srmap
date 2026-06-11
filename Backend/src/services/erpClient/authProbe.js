const { BASE_ORIGIN, BASE_PATH } = require("../../config/env");
const { createApiContext } = require("./apiContext");
const { callEndpointViaApi, fetchProfileViaApi } = require("./endpointApi");
const { resolveLoginUrl } = require("./loginForm");
const { isUsableProfileData, looksLikeLoginPage } = require("./sessionState");

const LOGIN_AUTH_PROBE_ENDPOINT = {
  method: "POST",
  url: "students/report/studentreportresources.jsp",
  paramsTemplate: { ids: "10" },
  argId: 10,
};
const LOGIN_AUTH_PROBE_MENU_ITEM = {
  dropdown: "Academic",
  subitem: "Time Table",
};

async function verifyAuthenticatedShellFromStorageState(storageState) {
  const api = await createApiContext(storageState);
  try {
    const finalUrl = resolveLoginUrl(
      LOGIN_AUTH_PROBE_ENDPOINT.url,
      `${BASE_ORIGIN}${BASE_PATH}/`
    );
    try {
      const parsed = await callEndpointViaApi(
        api,
        LOGIN_AUTH_PROBE_ENDPOINT,
        LOGIN_AUTH_PROBE_MENU_ITEM
      );
      const html = String(parsed?.rawHtml || "");
      const authenticated = !looksLikeLoginPage(html, parsed);

      return {
        storageState: await api.storageState(),
        html,
        finalUrl,
        httpStatus: parsed?.status || 200,
        classifier: authenticated ? "authenticated_shell" : "login_page",
        authenticated,
      };
    } catch (error) {
      if (String(error?.code || "").trim().toUpperCase() === "SESSION_EXPIRED") {
        return {
          storageState: await api.storageState(),
          html: "",
          finalUrl,
          httpStatus: error?.status || 401,
          classifier: "login_page",
          authenticated: false,
        };
      }
      throw error;
    }
  } finally {
    await api.dispose();
  }
}

async function probeProfileFromStorageState(storageState, finalUrl = "") {
  const api = await createApiContext(storageState);
  try {
    try {
      const profileData = await fetchProfileViaApi(api, { includeRawHtml: true });
      const valid = isUsableProfileData(profileData);

      return {
        storageState: await api.storageState(),
        profileData,
        valid,
        profileStatus: valid ? "ready" : "deferred",
        classifier: valid ? "authenticated_shell" : "unknown_upstream_state",
        finalUrl,
        rawHtml: profileData?.rawHtml || "",
      };
    } catch (error) {
      if (String(error?.code || "").trim().toUpperCase() === "SESSION_EXPIRED") {
        return {
          storageState: await api.storageState(),
          profileData: null,
          valid: false,
          profileStatus: "deferred",
          classifier: "profile_probe_login_page",
          finalUrl,
          rawHtml: "",
          error,
        };
      }
      throw error;
    }
  } finally {
    await api.dispose();
  }
}

module.exports = {
  verifyAuthenticatedShellFromStorageState,
  probeProfileFromStorageState,
};
