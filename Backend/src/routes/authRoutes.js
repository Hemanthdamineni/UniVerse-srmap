const express = require("express");

const {
  fetchCaptcha,
  loginWithCaptcha,
  initiatePasswordReset,
  completePasswordReset,
  createApiContext,
  fetchProfileViaApi,
  fetchStudentPhoto,
  extractStudentPhotoSrc,
  isUsableProfileData,
  buildFallbackProfileData,
  verifyAuthenticatedShellFromStorageState,
} = require("../services/erp/erpClient");
const {
  resolveSessionId,
  setSessionCookie,
  clearSessionCookie,
} = require("../utils/cookies");

const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");
const {
  NODE_ENV,
  LOGIN_DEADLINE_MS,
  ERP_HEARTBEAT_PROBE_INTERVAL_MS,
} = require("../config/env");

const DEMO_ADMIN_REG_NO = "AP23110010419";

function buildDemoProfileData(username) {
  const registerNo = String(username || DEMO_ADMIN_REG_NO).trim().toUpperCase() || DEMO_ADMIN_REG_NO;
  return {
    PageHeading: "PROFILE",
    TableContent: {
      "Student Name": "Hemachandra K",
      Name: "Hemachandra K",
      "Register No.": registerNo,
      Semester: "VI",
      "Academic Year": "III Year",
      "Program / Section": "B.Tech Computer Science and Engineering / A",
      Department: "Computer Science and Engineering",
      "Student E-Mail": `${registerNo.toLowerCase()}@srmap.edu.in`,
      "Student Contact Number": "9000000000",
    },
    tables: [],
    text: "",
    meta: {
      source: "development-demo-login",
    },
  };
}

function createAuthRoutes({ sessionStore, erpDumpService }) {
  const router = express.Router();

  // Rejects with LOGIN_TIMEOUT if the wrapped promise exceeds the deadline.
  // The losing promise gets a no-op catch so a late upstream failure can
  // never surface as an unhandled rejection after the response is sent.
  function withLoginDeadline(loginPromise) {
    let timer;
    const deadline = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        const error = new Error(
          "The ERP took too long to verify your login. Please try again."
        );
        error.status = 504;
        error.code = "LOGIN_TIMEOUT";
        reject(error);
      }, LOGIN_DEADLINE_MS);
    });
    loginPromise.catch(() => {});
    return Promise.race([loginPromise, deadline]).finally(() => clearTimeout(timer));
  }

  async function handleHeartbeat(req, res) {
    const sessionId = resolveSessionId(req);
    try {
      const session = await sessionStore.getOrThrow(sessionId);

      if (!session.loggedIn) {
        const error = new Error("Not signed in.");
        error.status = 401;
        error.code = "UNAUTHORIZED";
        return sendApiError(res, req, error);
      }

      const now = Date.now();
      const lastProbeAt = Number(session.lastUpstreamProbeAt || 0);
      const shouldProbeUpstream =
        Boolean(session.storageState) &&
        now - lastProbeAt > ERP_HEARTBEAT_PROBE_INTERVAL_MS;

      let storageState = session.storageState;
      let alive = session.lastUpstreamAlive !== false;

      if (shouldProbeUpstream) {
        try {
          const probe = await verifyAuthenticatedShellFromStorageState(storageState);
          storageState = probe.storageState || storageState;
          alive = Boolean(probe.authenticated);
        } catch {
          // Upstream unreachable — never kill healthy local sessions on flaky networks.
          alive = true;
        }
      }

      await sessionStore.update(sessionId, {
        storageState,
        lastHeartbeatAt: now,
        ...(shouldProbeUpstream
          ? { lastUpstreamProbeAt: now, lastUpstreamAlive: alive }
          : {}),
      });

      return sendApiSuccess(res, req, {
        success: true,
        alive,
        probed: shouldProbeUpstream,
      });
    } catch (error) {
      if (Number(error?.status) === 401) clearSessionCookie(res, req);
      return sendApiError(res, req, error);
    }
  }

  router.get("/heartbeat", handleHeartbeat);
  router.get("/auth/heartbeat", handleHeartbeat);

  async function handleCaptcha(req, res) {
    try {
      const { captchaBase64, storageState, loginBootstrap, issuedAt, expiresInMs, expiresAt, loginAttemptId } =
        await fetchCaptcha();

      const sessionId = await sessionStore.create(storageState);

      await sessionStore.update(sessionId, {
        loginBootstrap,
        preAuthAttempt: {
          loginAttemptId,
          issuedAt,
          expiresInMs,
          expiresAt,
          loginBootstrap,
        },
      });

      setSessionCookie(res, req, sessionId);

      return sendApiSuccess(res, req, {
        success: true,
        sessionId,
        captchaBase64,
        issuedAt,
        expiresInMs,
        expiresAt,
        loginAttemptId,
      });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  }

  router.get("/captcha", handleCaptcha);
  router.get("/auth/captcha", handleCaptcha);

  async function handleLogin(req, res) {
    const { username, password, captcha } = req.body || {};
    const sessionId = String(
      req.body?.sessionId || resolveSessionId(req) || ""
    ).trim();

    if (!username || !password || !captcha || !sessionId) {
      const error = new Error(
        "username, password, captcha are required (session via body/cookie/header)"
      );
      error.status = 400;
      error.code = "BAD_REQUEST";
      return sendApiError(res, req, error);
    }

    try {
      const session = await sessionStore.getOrThrow(sessionId);

      const loginPromise = loginWithCaptcha({
        storageState: session.storageState,
        username,
        password,
        captcha,
        loginBootstrap: session.loginBootstrap || session.preAuthAttempt?.loginBootstrap,
        preAuthAttempt: session.preAuthAttempt,
        sessionId,
      });

      const loginResult = await withLoginDeadline(loginPromise);

      if (!loginResult.success) {
        await sessionStore.update(sessionId, {
          storageState: loginResult.storageState,
        });
        const error = new Error(
          loginResult.message || "Login failed. Check username/password/captcha and try again."
        );
        error.status = Number(loginResult.status || 401);
        error.code = loginResult.failureCode || "UNAUTHORIZED";
        error.extra = {
          loginAttemptId: loginResult.loginAttemptId || session.preAuthAttempt?.loginAttemptId || null,
        };

        return sendApiError(res, req, error);
      }

      // Rotate session: create a new authenticated session and discard the
      // pre-auth captcha session to prevent session fixation attacks.
      const newSessionId = await sessionStore.create(loginResult.storageState);
      await sessionStore.update(newSessionId, {
        loggedIn: true,
        profileData: loginResult.profileStatus === "ready" ? loginResult.profileData || null : null,
        username: String(username).trim(),
        preAuthAttempt: null,
      });
      // Best-effort cleanup of the pre-auth session.
      await sessionStore.delete(sessionId).catch(() => {});

      setSessionCookie(res, req, newSessionId);

      return sendApiSuccess(res, req, {
        success: true,
        sessionId: newSessionId,
        profileData: loginResult.profileData,
        profileStatus: loginResult.profileStatus || "deferred",
        loginAttemptId: loginResult.loginAttemptId || session.preAuthAttempt?.loginAttemptId || null,
      });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  }

  router.post("/login", handleLogin);
  router.post("/auth/login", handleLogin);

  async function handleDevelopmentLogin(req, res) {
    if (NODE_ENV === "production") {
      const error = new Error("Development login is disabled in production.");
      error.status = 404;
      error.code = "NOT_FOUND";
      return sendApiError(res, req, error);
    }

    try {
      const username = String(req.body?.username || DEMO_ADMIN_REG_NO).trim().toUpperCase();
      const sessionId = await sessionStore.create({ cookies: [], origins: [] });

      let profileData;
      if (process.env.ERP_DEBUG_MODE === "1" && erpDumpService?.getProfile()) {
        profileData = erpDumpService.getProfile();
      } else {
        profileData = buildDemoProfileData(username);
      }

      await sessionStore.update(sessionId, {
        loggedIn: true,
        profileData,
        username,
        loginBootstrap: null,
        preAuthAttempt: null,
      });

      setSessionCookie(res, req, sessionId);

      return sendApiSuccess(res, req, {
        success: true,
        sessionId,
        profileData,
        profileStatus: "ready",
        demo: true,
      });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  }

  router.post("/dev/login", handleDevelopmentLogin);
  router.post("/auth/dev-login", handleDevelopmentLogin);

  async function handleForgotPassword(req, res) {
    const type = String(req.body?.type || "").trim().toLowerCase();
    const username = String(req.body?.username || "").trim().toUpperCase();

    if (type === "initiate") {
      const captcha = String(req.body?.captcha || "").trim();
      const sessionId = String(
        req.body?.sessionId || resolveSessionId(req) || ""
      ).trim();

      if (!username || !captcha || !sessionId) {
        const error = new Error("username, captcha, sessionId and type=initiate are required");
        error.status = 400;
        error.code = "BAD_REQUEST";
        return sendApiError(res, req, error);
      }

      try {
        const session = await sessionStore.getOrThrow(sessionId);
        const result = await initiatePasswordReset({
          storageState: session.storageState,
          loginBootstrap: session.loginBootstrap || session.preAuthAttempt?.loginBootstrap,
          preAuthAttempt: session.preAuthAttempt,
          username,
          captcha,
        });

        await sessionStore.update(sessionId, {
          storageState: result.storageState,
        });

        if (!result.success) {
          const error = new Error(result.message || "Unable to start password reset.");
          error.status = Number(result.status || 400);
          error.code = result.code || "PASSWORD_RESET_FAILED";
          error.extra = {
            loginAttemptId: result.loginAttemptId || null,
          };
          return sendApiError(res, req, error);
        }

        return sendApiSuccess(res, req, {
          success: true,
          sessionId,
          message: result.message || "OTP sent successfully.",
          loginAttemptId: result.loginAttemptId || null,
        });
      } catch (error) {
        return sendApiError(res, req, error);
      }
    }

    if (type === "change") {
      const otp = String(req.body?.otp || "").trim();
      const newPassword = String(req.body?.newPassword || "").trim();

      if (!username || !otp || !newPassword) {
        const error = new Error("username, otp, newPassword and type=change are required");
        error.status = 400;
        error.code = "BAD_REQUEST";
        return sendApiError(res, req, error);
      }

      try {
        const result = await completePasswordReset({
          username,
          otp,
          newPassword,
        });

        if (!result.success) {
          const error = new Error(result.message || "Unable to change password.");
          error.status = Number(result.status || 400);
          error.code = result.code || "PASSWORD_RESET_FAILED";
          return sendApiError(res, req, error);
        }

        return sendApiSuccess(res, req, {
          success: true,
          message: result.message || "Password changed successfully.",
        });
      } catch (error) {
        return sendApiError(res, req, error);
      }
    }

    const error = new Error("type must be either initiate or change");
    error.status = 400;
    error.code = "BAD_REQUEST";
    return sendApiError(res, req, error);
  }

  router.post("/forgot", handleForgotPassword);
  router.post("/auth/forgot", handleForgotPassword);

  async function handleLogout(req, res) {
    const sessionId = resolveSessionId(req);
    if (sessionId) {
      try {
        await sessionStore.update(sessionId, {
          loggedIn: false,
          storageState: null,
          profileData: null,
          loginBootstrap: null,
          preAuthAttempt: null,
          username: "",
        });
      } catch { /* best effort */ }
    }
    clearSessionCookie(res, req);
    return sendApiSuccess(res, req, { success: true });
  }

  router.post("/logout", handleLogout);
  router.post("/auth/logout", handleLogout);

  async function handleProfile(req, res) {
    const sessionId = resolveSessionId(req);

    try {
      const session = await sessionStore.getOrThrow(sessionId);

      const fallbackProfile =
        session.profileData && typeof session.profileData === "object"
          ? session.profileData
          : buildFallbackProfileData(session.username || "");

      if (isUsableProfileData(session.profileData)) {
        return res.json(session.profileData);
      }

      const api = await createApiContext(session.storageState);

      try {
        const profileData = await fetchProfileViaApi(api);
        const nextStorageState = await api.storageState();

        if (!isUsableProfileData(profileData)) {
          await sessionStore.update(sessionId, {
            storageState: nextStorageState,
          });
          return res.json(fallbackProfile);
        }

        await sessionStore.update(sessionId, {
          profileData,
          storageState: nextStorageState,
        });

        return res.json(profileData);
      } catch (error) {
        if (String(error?.code || "").trim().toUpperCase() === "SESSION_EXPIRED") {
          throw error;
        }
        if (fallbackProfile) {
          return res.json(fallbackProfile);
        }
        throw error;
      } finally {
        await api.dispose();
      }
    } catch (error) {
      if (String(error?.code || "").trim().toUpperCase() === "SESSION_EXPIRED") {
        clearSessionCookie(res, req);
      }
      return sendApiError(res, req, error);
    }
  }

  router.get("/profile", handleProfile);
  router.get("/auth/profile", handleProfile);

  // Avatar proxy: streams the ERP-hosted student photo through the app so
  // the browser never talks to the ERP origin directly. An image request
  // must never disturb the app session — every failure mode (no ERP
  // session, no photo on the shell, upstream error) degrades to a plain
  // 404 that the client renders as its placeholder avatar.
  async function handleProfilePhoto(req, res) {
    const sessionId = resolveSessionId(req);

    try {
      const session = await sessionStore.getOrThrow(sessionId);
      const api = await createApiContext(session.storageState);
      try {
        const photo = await fetchStudentPhoto(api);
        if (!photo) {
          res.status(404).end();
          return;
        }
        res.setHeader("Content-Type", photo.contentType);
        res.setHeader("Cache-Control", "private, max-age=1800");
        res.status(200).end(photo.buffer);
      } finally {
        await api.dispose();
      }
    } catch {
      res.status(404).end();
    }
  }

  router.get("/profile/photo", handleProfilePhoto);
  router.get("/auth/profile/photo", handleProfilePhoto);

  // Diagnostic route — never returns image bytes, never disturbs the session.
  // Returns the raw upstream HTML from the post-login shell and the candidate
  // photo URLs the extractor would pick, so a real-login user can see exactly
  // why the photo proxy is 404'ing.
  async function handleProfilePhotoDebug(req, res) {
    const sessionId = resolveSessionId(req);
    let session = null;
    try {
      session = await sessionStore.getOrThrow(sessionId);
    } catch (err) {
      sendApiSuccess(res, req, {
        ok: false,
        reason: "no_app_session",
        message: err && err.message ? err.message : "Session not found",
      });
      return;
    }

    const storageState = session && session.storageState;
    const cookies = Array.isArray(storageState?.cookies) ? storageState.cookies : [];
    const hasErpCookies = cookies.some((c) => {
      const name = String(c?.name || "").toLowerCase();
      return name.includes("jsession") || name.includes("erp") || name.includes("srm");
    });

    if (!cookies.length || !hasErpCookies) {
      sendApiSuccess(res, req, {
        ok: false,
        reason: "no_erp_cookies",
        message:
          "The current app session has no ERP cookies. The dev login shortcut does not capture a real ERP session, so the photo proxy has nothing to fetch. Sign in via the real login page (captcha + password) to obtain an ERP session.",
        cookieCount: cookies.length,
        cookieNames: cookies.map((c) => c.name),
      });
      return;
    }

    let api;
    try {
      api = await createApiContext(storageState);
      let shellResponse;
      try {
        shellResponse = await api.get("HRDSystem");
      } catch (err) {
        sendApiSuccess(res, req, {
          ok: false,
          reason: "upstream_threw",
          message: err && err.message ? err.message : "HRDSystem request threw",
        });
        return;
      }
      const status = shellResponse.status();
      const finalUrl = typeof shellResponse.url === "function" ? shellResponse.url() : null;
      const html = await shellResponse.text();
      const candidate = extractStudentPhotoSrc(html);

      // Dump every <img> src so the user can see what the real shell looks like.
      const imgSrcs = [];
      const imgRegex = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
      let m;
      while ((m = imgRegex.exec(html)) !== null) {
        imgSrcs.push(m[1]);
      }

      sendApiSuccess(res, req, {
        ok: shellResponse.ok(),
        status,
        finalUrl,
        htmlLength: html.length,
        candidate,
        imgSrcCount: imgSrcs.length,
        imgSrcs: imgSrcs.slice(0, 30),
      });
    } catch (err) {
      sendApiSuccess(res, req, {
        ok: false,
        reason: "diagnostic_error",
        message: err && err.message ? err.message : "Unknown error",
      });
    } finally {
      if (api) {
        try { await api.dispose(); } catch { /* ignore */ }
      }
    }
  }

  router.get("/profile/photo/debug", handleProfilePhotoDebug);
  router.get("/auth/profile/photo/debug", handleProfilePhotoDebug);

  return router;
}

module.exports = {
  createAuthRoutes,
};
