const cheerio = require("cheerio");
const { LOGIN_URL } = require("../../config/env");
const { cleanText } = require("../../utils/text");
const { createLoginAttemptId } = require("../loginDiagnostics");
const { createApiContext } = require("./apiContext");
const { parseLoginBootstrap, buildLoginPayload } = require("./loginForm");
const { assertFreshPreAuthAttempt } = require("./preAuth");

function validatePasswordResetPassword(value) {
  const password = String(value || "");
  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/\d/.test(password)) {
    return "Password must include at least one number.";
  }
  return "";
}

function classifyPasswordResetInitiateResponse(html = "", httpStatus = 200) {
  const rawHtml = String(html || "");
  const $ = cheerio.load(rawHtml);
  const title = cleanText($("title").first().text()).toLowerCase();
  const hasOtpField =
    $('input[name="passwordotp"]').length > 0 ||
    $('input[id*="otp" i]').length > 0 ||
    /passwordotp/i.test(rawHtml);

  if (/invalid captcha/i.test(rawHtml)) {
    return {
      success: false,
      code: "INVALID_CAPTCHA",
      status: 401,
      message: "Invalid captcha. Please try again.",
    };
  }

  if (httpStatus >= 400) {
    return {
      success: false,
      code: "UPSTREAM_UNAVAILABLE",
      status: httpStatus,
      message: "Password reset initiation failed.",
    };
  }

  if (title.includes("password reset") || hasOtpField) {
    return {
      success: true,
      code: "",
      status: 200,
      message: "OTP sent successfully.",
    };
  }

  if (title.includes("student login")) {
    return {
      success: false,
      code: "PASSWORD_RESET_UNAVAILABLE",
      status: 429,
      message: "Password reset is temporarily unavailable. Please try again later.",
    };
  }

  return {
    success: false,
    code: "PASSWORD_RESET_FAILED",
    status: 502,
    message: "Unable to start password reset. Please try again.",
  };
}

async function ensureLoginBootstrap(storageState, loginBootstrap) {
  if (loginBootstrap) return loginBootstrap;

  const bootstrapApi = await createApiContext(storageState, { referer: LOGIN_URL });
  try {
    const loginPageResp = await bootstrapApi.get("StudentLoginPage");
    const loginHtml = await loginPageResp.text();
    return {
      ...parseLoginBootstrap(loginHtml),
      loginHtml,
    };
  } finally {
    await bootstrapApi.dispose();
  }
}

async function initiatePasswordReset({
  storageState,
  loginBootstrap,
  preAuthAttempt,
  username,
  captcha,
}) {
  const loginAttemptId =
    String(preAuthAttempt?.loginAttemptId || "").trim() || createLoginAttemptId();
  assertFreshPreAuthAttempt(preAuthAttempt, loginAttemptId);

  const activeBootstrap = await ensureLoginBootstrap(storageState, loginBootstrap);
  const payload = buildLoginPayload({
    username: String(username || "").trim().toUpperCase(),
    password: "",
    captcha: String(captcha || "").trim(),
    loginBootstrap: activeBootstrap,
  });

  const api = await createApiContext(storageState, { referer: LOGIN_URL });
  try {
    const response = await api.post("StudentPasswordResetInitiate", {
      form: Object.fromEntries(payload.entries()),
      headers: {
        Referer: LOGIN_URL,
      },
    });

    const html = await response.text();
    const classification = classifyPasswordResetInitiateResponse(html, response.status());
    return {
      ...classification,
      storageState: await api.storageState(),
      loginAttemptId,
    };
  } finally {
    await api.dispose();
  }
}

async function completePasswordReset({ username, otp, newPassword }) {
  const validationMessage = validatePasswordResetPassword(newPassword);
  if (validationMessage) {
    const error = new Error(validationMessage);
    error.status = 422;
    error.code = "INVALID_PASSWORD";
    throw error;
  }

  const api = await createApiContext(null, { referer: LOGIN_URL });
  try {
    const response = await api.post("usermanager/loginmanager/loginmanagerresources.jsp", {
      form: {
        cpassword: String(newPassword || ""),
        ids: "1",
        txtUserName: String(username || "").trim().toUpperCase(),
        passwordotp: String(otp || "").trim(),
      },
      headers: {
        Referer: LOGIN_URL,
      },
    });

    const raw = await response.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    const resultStatus = String(data?.resultstatus ?? "").trim();
    if (resultStatus === "1") {
      return {
        success: true,
        status: response.status(),
        message: "Password changed successfully.",
        data,
      };
    }

    return {
      success: false,
      status: 401,
      code: "INVALID_OTP",
      message: "Invalid OTP. Please try again.",
      data,
    };
  } finally {
    await api.dispose();
  }
}

module.exports = {
  validatePasswordResetPassword,
  classifyPasswordResetInitiateResponse,
  ensureLoginBootstrap,
  initiatePasswordReset,
  completePasswordReset,
};
