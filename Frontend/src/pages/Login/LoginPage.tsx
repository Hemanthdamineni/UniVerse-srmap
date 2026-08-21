import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  extractApiErrorMessage,
  extractApiErrorCode,
  normalizeCaptchaImageSource,
  normalizeRegistrationNumber,
  validateRegistrationNumber,
} from "../../lib/core/auth";
import {
  consumeLoginRedirect,
  consumeSessionExpiredFlag,
  hasSessionAuth,
  storeSessionAuth,
} from "../../lib/core/session";
import { isDebugMode } from "../../lib/core/debugModeEnv";
import {
  CheckIcon,
  EyeIcon,
  INPUT,
  LABEL,
  LoadingDots,
  RefreshIcon,
  StatusMessage,
} from "./LoginParts";
import LoginIdentityPanel from "./LoginIdentityPanel";
import "./LoginPage.overdrive.css";

type SubmitPhase = "idle" | "loading" | "success";

const CAPTCHA_RETRY_CODES = new Set(["CAPTCHA_EXPIRED", "INVALID_CAPTCHA"]);
// The official ERP burns the session captcha on EVERY failed attempt
// (verified live: wrong credentials re-serve the login page rather than a
// distinct banner), so these codes all need a fresh captcha before retrying.
const RETRY_WITH_FRESH_CAPTCHA_CODES = new Set([
  ...CAPTCHA_RETRY_CODES,
  "INVALID_CREDENTIALS",
  "LOGIN_VERIFICATION_FAILED",
]);

// The backend enforces its own login deadline (LOGIN_DEADLINE_MS); this is a
// client-side backstop with headroom over it so the UI never spins forever.
const CAPTCHA_FETCH_TIMEOUT_MS = 15_000;
const LOGIN_REQUEST_TIMEOUT_MS = 60_000;
const SLOW_VERIFY_HINT_MS = 8_000;

const REMEMBER_REGNO_KEY = "erp.login.regNo";
const REMEMBER_OPTIN_KEY = "erp.login.rememberRegNo";

export default function LoginPage() {
  const navigate = useNavigate();
  const requestedInitialCaptcha = useRef(false);
  const debugAutoLoginAttempted = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const captchaInputRef = useRef<HTMLInputElement>(null);
  const slowVerifyTimerRef = useRef<number | undefined>(undefined);
  // Guards the idle-expiry auto-refresh so a failed refresh can't loop.
  const autoRefreshForExpiryRef = useRef(0);

  const [form, setForm] = useState({ username: "", password: "", captcha: "" });
  const [sessionId, setSessionId] = useState("");
  const [captchaBase64, setCaptchaBase64] = useState("");
  const [captchaDisplaySrc, setCaptchaDisplaySrc] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle");
  const [showPassword, setShowPassword] = useState(false);
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "success">("neutral");
  const [statusMessage, setStatusMessage] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [formShake, setFormShake] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [rememberOptIn, setRememberOptIn] = useState(false);
  const [captchaExpiresAt, setCaptchaExpiresAt] = useState(0);
  const [captchaTotalMs, setCaptchaTotalMs] = useState(0);
  const [captchaRemainingMs, setCaptchaRemainingMs] = useState(0);

  const submitting = submitPhase === "loading";
  const canSubmit = !submitting && submitPhase !== "success" && !captchaLoading && Boolean(sessionId) && Boolean(form.username.trim()) && Boolean(form.password.trim()) && Boolean(form.captcha.trim());

  // ── Remember registration number prefill ──
  useEffect(() => {
    try {
      if (window.localStorage.getItem(REMEMBER_OPTIN_KEY) !== "1") return;
      setRememberOptIn(true);
      const saved = window.localStorage.getItem(REMEMBER_REGNO_KEY) || "";
      if (saved) setForm((c) => ({ ...c, username: saved }));
    } catch {
      // localStorage unavailable — skip prefill.
    }
  }, []);

  // ── Captcha expiry countdown ──
  useEffect(() => {
    if (!captchaExpiresAt) {
      setCaptchaRemainingMs(0);
      return;
    }
    const tick = () => setCaptchaRemainingMs(Math.max(0, captchaExpiresAt - Date.now()));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [captchaExpiresAt]);

  // ── Silent renewal: expired while idle and nothing typed yet ──
  useEffect(() => {
    if (!captchaExpiresAt || captchaRemainingMs > 0) return;
    if (submitting || captchaLoading) return;
    if (form.captcha.trim() !== "") return;
    if (autoRefreshForExpiryRef.current === captchaExpiresAt) return;
    autoRefreshForExpiryRef.current = captchaExpiresAt;
    void fetchCaptcha();
  });

  useEffect(() => () => window.clearTimeout(slowVerifyTimerRef.current), []);

  // ── Canvas auto-crop: trim right-side whitespace from captcha ──
  useEffect(() => {
    if (!captchaBase64) { setCaptchaDisplaySrc(""); return; }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { setCaptchaDisplaySrc(captchaBase64); return; }
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // scan right-to-left to find last column with non-background content
      let rightBound = img.width;
      outer: for (let x = img.width - 1; x >= Math.floor(img.width * 0.25); x--) {
        for (let y = 0; y < img.height; y++) {
          const i = (y * img.width + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a > 30 && (r < 230 || g < 230 || b < 230)) {
            rightBound = x + 14; // 14px right padding
            break outer;
          }
        }
      }
      rightBound = Math.min(rightBound, img.width);
      const cropped = document.createElement("canvas");
      cropped.width = rightBound;
      cropped.height = img.height;
      const ctx2 = cropped.getContext("2d");
      if (!ctx2) { setCaptchaDisplaySrc(captchaBase64); return; }
      ctx2.drawImage(img, 0, 0);
      setCaptchaDisplaySrc(cropped.toDataURL());
    };
    img.onerror = () => setCaptchaDisplaySrc(captchaBase64);
    img.src = captchaBase64;
  }, [captchaBase64]);

  // ── Detect debug mode and auto-login ──
  useEffect(() => {
    if (hasSessionAuth()) {
      navigate(consumeLoginRedirect(), { replace: true });
      return;
    }
    if (consumeSessionExpiredFlag()) {
      setStatusTone("error");
      setStatusMessage("Your session expired. Please sign in again.");
    }
    if (requestedInitialCaptcha.current) return;

    let cancelled = false;
    const debugMode = isDebugMode();

    (async () => {
      if (!debugMode) {
        // Skip backend debug probe — the /api/debug/ping endpoint is only
        // available when the backend is started with --debug, and hitting it
        // during normal operation produces a noisy 401 with no benefit.
        // Developers set VITE_DEBUG_MODE=true (frontend) for debug auto-login.
        requestedInitialCaptcha.current = true;
        void fetchCaptcha();
        return;
      }

      if (cancelled) return;

      setStatusTone("neutral");
      setStatusMessage("Debug mode: signing in...");
      try {
        const r = await axios.post("/api/dev/login", { username: "AP23110010419" });
        if (cancelled) return;
        storeSessionAuth({ profileData: r.data?.profileData });
        navigate(consumeLoginRedirect(), { replace: true });
      } catch {
        if (cancelled) return;
        setStatusTone("error");
        setStatusMessage("Debug auto-login failed. Use the form below.");
        debugAutoLoginAttempted.current = true;
        requestedInitialCaptcha.current = true;
        void fetchCaptcha();
      }
    })();

    return () => { cancelled = true; };
  }, [navigate]);

  const fetchCaptcha = async (
    nextMessage = "",
    opts: { focusCaptcha?: boolean; tone?: "neutral" | "error" } = {}
  ) => {
    setCaptchaLoading(true);
    try {
      const r = await axios.get("/api/captcha", { timeout: CAPTCHA_FETCH_TIMEOUT_MS });
      setCaptchaBase64(normalizeCaptchaImageSource(r.data?.captchaBase64));
      setSessionId(String(r.data?.sessionId || ""));
      const expiresInMs = Math.max(0, Number(r.data?.expiresInMs) || 0);
      setCaptchaTotalMs(expiresInMs);
      setCaptchaExpiresAt(expiresInMs ? Date.now() + expiresInMs : 0);
      setForm((c) => ({ ...c, captcha: "" }));
      if (nextMessage) { setStatusTone(opts.tone || "neutral"); setStatusMessage(nextMessage); }
      if (opts.focusCaptcha) captchaInputRef.current?.focus();
    } catch (e: unknown) {
      const p = axios.isAxiosError(e) ? e.response?.data : null;
      setStatusTone("error");
      setStatusMessage(
        axios.isAxiosError(e) && !p
          ? "Couldn't reach the ERP to load a captcha. Check your connection, then tap Refresh."
          : extractApiErrorMessage(p, "Failed to load captcha.")
      );
    } finally {
      setCaptchaLoading(false);
    }
  };

  const triggerShake = () => {
    setFormShake(false);
    requestAnimationFrame(() => { requestAnimationFrame(() => setFormShake(true)); });
    setTimeout(() => setFormShake(false), 520);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nextValue = name === "username" ? normalizeRegistrationNumber(value) : value;
    setForm((c) => ({ ...c, [name]: nextValue }));
  };

  const handleLoginFailure = (payload: unknown, fallbackMessage: string) => {
    setSubmitPhase("idle");
    triggerShake();
    const code = extractApiErrorCode(payload);
    if (RETRY_WITH_FRESH_CAPTCHA_CODES.has(code)) {
      // Credentials are preserved; upstream has consumed the captcha, so a
      // fresh one is loaded and only it needs retyping.
      const message =
        code === "CAPTCHA_EXPIRED"
          ? "Captcha expired — we've loaded a fresh one. Just retype it."
          : code === "INVALID_CAPTCHA"
            ? "That captcha didn't match — we've loaded a fresh one. Please retype it."
            : `${fallbackMessage} We've loaded a fresh captcha for your next attempt.`;
      void fetchCaptcha(message, { focusCaptcha: true, tone: "error" });
      return;
    }
    setStatusTone("error");
    setStatusMessage(fallbackMessage);
  };

  const persistRememberedRegNo = (username: string) => {
    try {
      if (rememberOptIn) {
        window.localStorage.setItem(REMEMBER_OPTIN_KEY, "1");
        window.localStorage.setItem(REMEMBER_REGNO_KEY, username);
      } else {
        window.localStorage.removeItem(REMEMBER_OPTIN_KEY);
        window.localStorage.removeItem(REMEMBER_REGNO_KEY);
      }
    } catch {
      // localStorage unavailable — preference just won't persist.
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const regNoError = validateRegistrationNumber(form.username);
    if (regNoError) { setStatusTone("error"); setStatusMessage(regNoError); triggerShake(); return; }
    if (!form.password.trim()) { setStatusTone("error"); setStatusMessage("Password is required."); triggerShake(); return; }
    if (!form.captcha.trim()) { setStatusTone("error"); setStatusMessage("Enter the captcha to continue."); triggerShake(); return; }
    if (!sessionId) { setStatusTone("error"); setStatusMessage("Captcha session missing. Refresh and try again."); triggerShake(); return; }

    setSubmitPhase("loading");
    setStatusTone("neutral");
    setStatusMessage("Verifying credentials...");
    window.clearTimeout(slowVerifyTimerRef.current);
    slowVerifyTimerRef.current = window.setTimeout(() => {
      setStatusTone("neutral");
      setStatusMessage("Still verifying — the university ERP can take longer during busy hours.");
    }, SLOW_VERIFY_HINT_MS);

    try {
      const r = await axios.post(
        "/api/login",
        { username: form.username, password: form.password, captcha: form.captcha, sessionId },
        { timeout: LOGIN_REQUEST_TIMEOUT_MS }
      );
      window.clearTimeout(slowVerifyTimerRef.current);
      if (!r.data?.success) {
        handleLoginFailure(r.data, `Login failed: ${extractApiErrorMessage(r.data, "Unknown error.")}`);
        return;
      }
      storeSessionAuth({ profileData: r.data?.profileData });
      persistRememberedRegNo(form.username.trim().toUpperCase());
      setSubmitPhase("success");
      setStatusTone("success");
      setStatusMessage("Logged in. Opening dashboard...");
      setTimeout(() => {
        navigate(consumeLoginRedirect(), { replace: true });
      }, 700);
    } catch (e: unknown) {
      window.clearTimeout(slowVerifyTimerRef.current);
      const p = axios.isAxiosError(e) ? e.response?.data : null;
      if (axios.isAxiosError(e) && !e.response) {
        const timedOut = e.code === "ECONNABORTED" || /timeout/i.test(String(e.message || ""));
        setStatusTone("error");
        setStatusMessage(
          timedOut
            ? "The ERP is taking too long to verify your login. Please try again."
            : "Network error — couldn't reach the login service. Please try again."
        );
        triggerShake();
        setSubmitPhase("idle");
        return;
      }
      const msg = extractApiErrorMessage(p, axios.isAxiosError(e) ? (e.message || "Login failed.") : "Login failed.");
      handleLoginFailure(p, msg);
    }
  };

  const fieldClass = (field: string) => {
    if (!focusedField) return "login-spring-field";
    if (focusedField === field) return "login-spring-field login-field-focused";
    return "login-spring-field login-field-dimmed";
  };

  const captchaSecondsLeft = Math.ceil(captchaRemainingMs / 1000);
  const captchaProgressPct = captchaTotalMs > 0 ? Math.min(100, (captchaRemainingMs / captchaTotalMs) * 100) : 0;
  const captchaUrgentColor =
    captchaRemainingMs <= 10_000 ? "var(--error)"
    : captchaRemainingMs <= 30_000 ? "var(--warning)"
    : "var(--comp-accent)";

  return (
    <div className="login-page-shell">
      <div className="login-card">

        {/* ── Identity Panel ── */}
        <LoginIdentityPanel />

        {/* ── Form Panel ── */}
        <div className="login-form-panel">
          <div className="login-form-enter login-f-d0" style={{ marginBottom: "28px" }}>
            <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.015em" }}>Sign in</h2>
            <p style={{ margin: "6px 0 0", fontSize: "0.83rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>Use your ERP registration number and password.</p>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} noValidate className={formShake ? "login-form-shake" : ""}>

            {statusMessage && (
              <div className="login-form-enter login-f-d1" style={{ marginBottom: "18px" }}>
                <StatusMessage tone={statusTone} message={statusMessage} />
              </div>
            )}

            {/* Registration Number */}
            <div className={`login-form-enter login-f-d2 ${fieldClass("username")}`} style={{ marginBottom: "18px" }}>
              <label htmlFor="username" style={LABEL}>Registration Number</label>
              <input
                id="username" name="username"
                value={form.username} onChange={handleChange}
                onFocus={() => setFocusedField("username")}
                onBlur={() => setFocusedField(null)}
                placeholder="e.g. AP24110000000"
                autoComplete="username" autoCapitalize="none" spellCheck={false}
                autoFocus
                maxLength={13}
                style={INPUT}
                className={focusedField === "username" ? "login-input-focused" : ""}
              />
              <p style={{ margin: "5px 0 0", fontSize: "0.76rem", color: "var(--text-secondary)" }}>Format: AP followed by 11 digits</p>
            </div>

            {/* Password */}
            <div className={`login-form-enter login-f-d3 ${fieldClass("password")}`} style={{ marginBottom: "18px" }}>
              <label htmlFor="password" style={LABEL}>Password</label>
              <div style={{ display: "flex", alignItems: "center", borderRadius: "10px", border: `1px solid ${focusedField === "password" ? "var(--comp-accent)" : "color-mix(in srgb, var(--border) 90%, transparent)"}`, background: "var(--background)", overflow: "hidden", transition: "border-color 0.2s ease, box-shadow 0.2s ease", boxShadow: focusedField === "password" ? "0 0 0 3px color-mix(in srgb, var(--comp-accent) 18%, transparent), 0 2px 8px rgba(10,38,42,0.08)" : "none" }}>
                <input
                  id="password" name="password" type={showPassword ? "text" : "password"}
                  value={form.password} onChange={handleChange}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => { setFocusedField(null); setCapsLockOn(false); }}
                  onKeyUp={(e) => setCapsLockOn(e.getModifierState?.("CapsLock") ?? false)}
                  placeholder="Your ERP password"
                  autoComplete="current-password"
                  style={{ flex: 1, padding: "11px 14px", fontSize: "0.875rem", border: "none", background: "transparent", color: "var(--text-primary)", outline: "none", fontFamily: "inherit", minWidth: 0 }}
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{ padding: "0 14px", background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", flexShrink: 0, transition: "color 0.15s ease" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--comp-accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {capsLockOn && (
                <p role="status" style={{ margin: "5px 0 0", fontSize: "0.76rem", fontWeight: 600, color: "var(--warning)" }}>
                  Caps Lock is on
                </p>
              )}
            </div>

            {/* Captcha */}
            <div className={`login-form-enter login-f-d4 ${fieldClass("captcha")}`} style={{ marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "7px", gap: "10px" }}>
                <label htmlFor="captcha" style={{ ...LABEL, marginBottom: 0 }}>Captcha</label>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "12px" }}>
                  {!captchaLoading && captchaRemainingMs > 0 && captchaRemainingMs <= 30_000 && (
                    <span title="Time before this captcha expires" style={{ fontSize: "0.75rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: captchaUrgentColor }}>
                      {captchaSecondsLeft}s
                    </span>
                  )}
                  <button type="button" onClick={() => { void fetchCaptcha("Captcha refreshed.", { focusCaptcha: true }); }} disabled={captchaLoading} aria-label="Refresh captcha"
                    style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "transparent", border: "none", cursor: captchaLoading ? "not-allowed" : "pointer", color: "var(--comp-accent)", fontSize: "0.75rem", fontWeight: 600, padding: "2px 0", fontFamily: "inherit", opacity: captchaLoading ? 0.6 : 1, transition: "opacity 0.15s ease" }}>
                    <RefreshIcon spinning={captchaLoading} />
                    {captchaLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </span>
              </div>
              <div style={{ position: "relative", borderRadius: "10px", border: `1px solid ${focusedField === "captcha" ? "var(--comp-accent)" : "color-mix(in srgb, var(--border) 90%, transparent)"}`, background: "var(--background)", overflow: "hidden", transition: "border-color 0.2s ease, box-shadow 0.2s ease", display: "flex", alignItems: "stretch", boxShadow: focusedField === "captcha" ? "0 0 0 3px color-mix(in srgb, var(--comp-accent) 18%, transparent), 0 2px 8px rgba(10,38,42,0.08)" : "none" }}>
                <div style={{ flexShrink: 0, background: "#ffffff", borderRight: "1px solid color-mix(in srgb, var(--border) 80%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "72px", minWidth: "80px", maxWidth: "180px", overflow: "hidden" }}>
                  {captchaLoading
                    ? <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", animation: "login-pulse 1.4s ease-in-out infinite", padding: "0 12px" }}>Loading...</span>
                    : (captchaDisplaySrc || captchaBase64)
                      ? <img src={captchaDisplaySrc || captchaBase64} alt="Captcha challenge" style={{ display: "block", height: "72px", width: "auto", maxWidth: "180px" }} />
                      : <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", padding: "0 12px" }}>No captcha</span>
                  }
                </div>
                <input
                  id="captcha" name="captcha" ref={captchaInputRef}
                  value={form.captcha} onChange={handleChange}
                  onFocus={() => setFocusedField("captcha")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Type the characters above"
                  autoComplete="off"
                  style={{ flex: 1, padding: "11px 14px", fontSize: "0.875rem", border: "none", background: "transparent", color: "var(--text-primary)", outline: "none", fontFamily: "inherit", minWidth: 0 }}
                />
                {!captchaLoading && captchaExpiresAt > 0 && (
                  <div aria-hidden="true" style={{ position: "absolute", bottom: 0, left: 0, height: "3px", width: `${captchaProgressPct}%`, maxWidth: "100%", background: captchaUrgentColor, transition: "width 0.5s linear, background 0.3s ease" }} />
                )}
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="login-form-enter login-f-d5" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "0.78rem", fontWeight: 500, color: "var(--text-secondary)", cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={rememberOptIn}
                  onChange={(e) => setRememberOptIn(e.target.checked)}
                  style={{ accentColor: "var(--comp-accent)", width: "15px", height: "15px", margin: 0, cursor: "pointer" }}
                />
                Remember registration number
              </label>
              <Link to="/forgot-password" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--comp-accent)", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <div className="login-form-enter login-f-d6">
              <button
                type="submit"
                disabled={!canSubmit}
                className={`login-btn-primary${submitPhase === "success" ? " login-btn-success" : ""}`}
              >
                {submitPhase === "success"
                  ? <span className="login-btn-check"><CheckIcon /></span>
                  : submitPhase === "loading"
                    ? <LoadingDots />
                    : "Sign in"
                }
              </button>
              <p style={{ marginTop: "14px", fontSize: "0.74rem", textAlign: "center", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Access is limited to enrolled SRM AP University students and staff.
              </p>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}
