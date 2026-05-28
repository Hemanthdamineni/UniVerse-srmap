import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  extractApiErrorMessage,
  normalizeCaptchaImageSource,
  normalizeRegistrationNumber,
  validateRegistrationNumber,
} from "../../lib/auth";
import { hasSessionAuth, storeSessionAuth } from "../../lib/session";
import { isDebugMode, checkBackendDebugMode } from "../../lib/debugModeEnv";
import srmLogo from "../../assets/FullSrmlogo.png";
import "./LoginPage.overdrive.css";

type Tone = "neutral" | "error" | "success";
type SubmitPhase = "idle" | "loading" | "success";

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ display: "block", animation: spinning ? "login-spin 0.8s linear infinite" : "none" }}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function LoadingDots() {
  return (
    <span className="login-loading-dots" aria-label="Signing in">
      <span /><span /><span />
    </span>
  );
}

function StatusMessage({ tone, message }: { tone: Tone; message: string }) {
  if (!message) return null;
  const cfg = {
    success: { bg: "color-mix(in srgb, var(--success) 10%, transparent)", border: "color-mix(in srgb, var(--success) 35%, transparent)", color: "var(--success)", icon: "✓" },
    error:   { bg: "color-mix(in srgb, var(--error) 8%, transparent)",   border: "color-mix(in srgb, var(--error) 30%, transparent)",   color: "var(--error)",   icon: "!" },
    neutral: { bg: "color-mix(in srgb, var(--accent-blue) 8%, transparent)", border: "color-mix(in srgb, var(--accent-blue) 28%, transparent)", color: "var(--info)", icon: "·" },
  }[tone];
  return (
    <div role="status" aria-live="polite" style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "11px 14px", borderRadius: "10px", border: `1px solid ${cfg.border}`, background: cfg.bg, color: cfg.color, fontSize: "0.82rem", fontWeight: 500, lineHeight: 1.5, animation: "login-fadein 0.18s ease-out" }}>
      <span style={{ fontWeight: 700, flexShrink: 0, lineHeight: 1.4 }}>{cfg.icon}</span>
      <span>{message}</span>
    </div>
  );
}

function formatExpiry(v: string) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const LABEL: React.CSSProperties = { display: "block", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--comp-text-secondary)", marginBottom: "7px" };
const INPUT: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "11px 14px", fontSize: "0.875rem", borderRadius: "10px", border: "1px solid color-mix(in srgb, var(--border) 90%, transparent)", background: "var(--background)", color: "var(--text-primary)", outline: "none", fontFamily: "inherit", transition: "border-color 0.2s ease, box-shadow 0.2s ease" };

export default function LoginPage() {
  const navigate = useNavigate();
  const requestedInitialCaptcha = useRef(false);
  const debugAutoLoginAttempted = useRef(false);
  const cursorRippleRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [form, setForm] = useState({ username: "", password: "", captcha: "" });
  const [sessionId, setSessionId] = useState("");
  const [captchaBase64, setCaptchaBase64] = useState("");
  const [captchaDisplaySrc, setCaptchaDisplaySrc] = useState("");
  const [captchaExpiresAt, setCaptchaExpiresAt] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle");
  const [showPassword, setShowPassword] = useState(false);
  const [statusTone, setStatusTone] = useState<Tone>("neutral");
  const [statusMessage, setStatusMessage] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [formShake, setFormShake] = useState(false);

  const usernameError = useMemo(() => validateRegistrationNumber(form.username), [form.username]);
  const submitting = submitPhase === "loading";
  const canSubmit = !submitting && submitPhase !== "success" && !captchaLoading && Boolean(sessionId) && Boolean(form.password.trim()) && Boolean(form.captcha.trim()) && !usernameError;

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
    if (hasSessionAuth()) { navigate("/dashboard", { replace: true }); return; }
    if (requestedInitialCaptcha.current) return;

    let cancelled = false;
    let debugMode = isDebugMode();

    (async () => {
      if (!debugMode) {
        debugMode = await checkBackendDebugMode();
      }

      if (cancelled) return;
      if (!debugMode) {
        requestedInitialCaptcha.current = true;
        void fetchCaptcha();
        return;
      }

      setStatusTone("neutral");
      setStatusMessage("Debug mode: signing in...");
      try {
        const r = await axios.post("/api/dev/login", { username: "AP23110010419" });
        if (cancelled) return;
        storeSessionAuth({ sessionId: String(r.data?.sessionId || ""), profileData: r.data?.profileData });
        navigate("/dashboard", { replace: true });
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

  const fetchCaptcha = async (nextMessage = "") => {
    setCaptchaLoading(true);
    try {
      const r = await axios.get("/api/captcha");
      setCaptchaBase64(normalizeCaptchaImageSource(r.data?.captchaBase64));
      setSessionId(String(r.data?.sessionId || ""));
      setCaptchaExpiresAt(String(r.data?.expiresAt || ""));
      setForm((c) => ({ ...c, captcha: "" }));
      if (nextMessage) { setStatusTone("neutral"); setStatusMessage(nextMessage); }
    } catch (e: unknown) {
      const p = axios.isAxiosError(e) ? e.response?.data : null;
      setStatusTone("error");
      setStatusMessage(extractApiErrorMessage(p, "Failed to load captcha."));
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
    setForm((c) => ({ ...c, [name]: name === "username" ? normalizeRegistrationNumber(value) : value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (usernameError) { setStatusTone("error"); setStatusMessage(usernameError); triggerShake(); return; }
    if (!form.password.trim()) { setStatusTone("error"); setStatusMessage("Password is required."); triggerShake(); return; }
    if (!form.captcha.trim()) { setStatusTone("error"); setStatusMessage("Enter the captcha to continue."); triggerShake(); return; }
    if (!sessionId) { setStatusTone("error"); setStatusMessage("Captcha session missing. Refresh and try again."); triggerShake(); return; }

    setSubmitPhase("loading");
    setStatusTone("neutral");
    setStatusMessage("Verifying credentials...");

    try {
      const r = await axios.post("/api/login", { username: normalizeRegistrationNumber(form.username), password: form.password, captcha: form.captcha, sessionId });
      if (!r.data?.success) {
        setSubmitPhase("idle");
        setStatusTone("error");
        setStatusMessage(`Login failed: ${extractApiErrorMessage(r.data, "Unknown error.")}`);
        triggerShake();
        return;
      }
      storeSessionAuth({ sessionId: String(r.data?.sessionId || sessionId), profileData: r.data?.profileData });
      setSubmitPhase("success");
      setStatusTone("success");
      setStatusMessage("Logged in. Opening dashboard...");
      setTimeout(() => navigate("/dashboard", { replace: true }), 700);
    } catch (e: unknown) {
      const p = axios.isAxiosError(e) ? e.response?.data : null;
      const msg = extractApiErrorMessage(p, axios.isAxiosError(e) ? (e.message || "Login failed.") : "Login failed.");
      setStatusTone("error");
      setStatusMessage(msg);
      triggerShake();
      setSubmitPhase("idle");
    }
  };

  const handleIdentityMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1) + "%";
    const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1) + "%";
    if (cursorRippleRef.current) {
      cursorRippleRef.current.style.setProperty("--cx", x);
      cursorRippleRef.current.style.setProperty("--cy", y);
    }
  }, []);

  const handleIdentityMouseLeave = useCallback(() => {
    if (cursorRippleRef.current) {
      cursorRippleRef.current.style.setProperty("--cx", "-200px");
      cursorRippleRef.current.style.setProperty("--cy", "-200px");
    }
  }, []);

  const fieldClass = (field: string) => {
    if (!focusedField) return "login-spring-field";
    if (focusedField === field) return "login-spring-field login-field-focused";
    return "login-spring-field login-field-dimmed";
  };

  const inputStyle = (field: string, hasError?: boolean): React.CSSProperties => ({
    ...INPUT,
    ...(hasError ? {} : focusedField === field ? {} : {}),
  });

  const showUsernameError = Boolean(form.username && usernameError);

  return (
    <div className="login-page-shell">
      <div className="login-card">

        {/* ── Identity Panel ── */}
        <div
          className="login-identity-panel"
          onMouseMove={handleIdentityMouseMove}
          onMouseLeave={handleIdentityMouseLeave}
        >
          <div ref={cursorRippleRef} className="login-cursor-ripple" />

          <div className="login-identity-content" style={{ padding: "48px 40px", justifyContent: "space-between" }}>
            <div>
              <div className="login-identity-enter login-id-d0">
                <img src={srmLogo} alt="SRM AP University" style={{ height: "40px", width: "auto", objectFit: "contain", display: "block", filter: "brightness(0) invert(1)", marginBottom: "40px" }} />
              </div>
              <div className="login-identity-enter login-id-d1">
                <h1 style={{ fontSize: "1.7rem", fontWeight: 700, color: "#ffffff", lineHeight: 1.25, margin: 0, letterSpacing: "-0.02em" }}>
                  SRM AP<br />University ERP
                </h1>
              </div>
              <div className="login-identity-enter login-id-d2">
                <p style={{ marginTop: "12px", fontSize: "0.875rem", color: "rgba(255,255,255,0.58)", lineHeight: 1.6, maxWidth: "260px" }}>
                  Your academic records, attendance, and campus services in one place.
                </p>
              </div>
            </div>

            <div style={{ marginTop: "48px" }}>
              {[
                { label: "Secure session-based login", sub: "Credentials verified directly against the university backend." },
                { label: "Captcha protected", sub: "Each login requires a fresh captcha for compliance." },
                { label: "Password recovery available", sub: "Reset via OTP sent to your registered email." },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className={`login-identity-enter login-id-d${i + 2}`}
                  style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px 0", borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.09)" }}
                >
                  <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#34AEBE", flexShrink: 0, marginTop: "5px", boxShadow: "0 0 8px rgba(52,174,190,0.55)" }} />
                  <div>
                    <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "rgba(255,255,255,0.88)", lineHeight: 1.3 }}>{item.label}</p>
                    <p style={{ margin: "3px 0 0", fontSize: "0.76rem", color: "rgba(255,255,255,0.42)", lineHeight: 1.5 }}>{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="login-identity-enter login-id-d4" style={{ marginTop: "36px" }}>
              <span style={{ display: "inline-block", padding: "5px 12px", background: "rgba(52,174,190,0.18)", border: "1px solid rgba(52,174,190,0.32)", borderRadius: "20px", fontSize: "0.72rem", fontWeight: 600, color: "#34AEBE", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Student Portal
              </span>
            </div>
          </div>
        </div>

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
                placeholder="AP24110000000"
                autoComplete="username" autoCapitalize="characters" spellCheck={false}
                style={inputStyle("username", showUsernameError)}
                className={focusedField === "username" ? "login-input-focused" : showUsernameError ? "login-input-error" : ""}
              />
              {showUsernameError
                ? <p role="alert" style={{ margin: "5px 0 0", fontSize: "0.76rem", color: "var(--error)", fontWeight: 500 }}>{usernameError}</p>
                : <p style={{ margin: "5px 0 0", fontSize: "0.76rem", color: "var(--text-secondary)" }}>AP-prefixed, 13 characters (e.g. AP24110000000)</p>
              }
            </div>

            {/* Password */}
            <div className={`login-form-enter login-f-d3 ${fieldClass("password")}`} style={{ marginBottom: "18px" }}>
              <label htmlFor="password" style={LABEL}>Password</label>
              <div style={{ display: "flex", alignItems: "center", borderRadius: "10px", border: `1px solid ${focusedField === "password" ? "var(--comp-accent)" : "color-mix(in srgb, var(--border) 90%, transparent)"}`, background: "var(--background)", overflow: "hidden", transition: "border-color 0.2s ease, box-shadow 0.2s ease", boxShadow: focusedField === "password" ? "0 0 0 3px color-mix(in srgb, var(--comp-accent) 18%, transparent), 0 2px 8px rgba(10,38,42,0.08)" : "none" }}>
                <input
                  id="password" name="password" type={showPassword ? "text" : "password"}
                  value={form.password} onChange={handleChange}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
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
            </div>

            {/* Captcha */}
            <div className={`login-form-enter login-f-d4 ${fieldClass("captcha")}`} style={{ marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "7px" }}>
                <label htmlFor="captcha" style={{ ...LABEL, marginBottom: 0 }}>Captcha</label>
                <button type="button" onClick={() => { void fetchCaptcha("Captcha refreshed."); }} disabled={captchaLoading} aria-label="Refresh captcha"
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "transparent", border: "none", cursor: captchaLoading ? "not-allowed" : "pointer", color: "var(--comp-accent)", fontSize: "0.75rem", fontWeight: 600, padding: "2px 0", fontFamily: "inherit", opacity: captchaLoading ? 0.6 : 1, transition: "opacity 0.15s ease" }}>
                  <RefreshIcon spinning={captchaLoading} />
                  {captchaLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
              <div style={{ borderRadius: "10px", border: `1px solid ${focusedField === "captcha" ? "var(--comp-accent)" : "color-mix(in srgb, var(--border) 90%, transparent)"}`, background: "var(--background)", overflow: "hidden", transition: "border-color 0.2s ease, box-shadow 0.2s ease", display: "flex", alignItems: "stretch", boxShadow: focusedField === "captcha" ? "0 0 0 3px color-mix(in srgb, var(--comp-accent) 18%, transparent), 0 2px 8px rgba(10,38,42,0.08)" : "none" }}>
                <div style={{ flexShrink: 0, background: "#ffffff", borderRight: "1px solid color-mix(in srgb, var(--border) 80%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "72px", minWidth: "80px", maxWidth: "180px", overflow: "hidden" }}>
                  {captchaLoading
                    ? <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", animation: "login-pulse 1.4s ease-in-out infinite", padding: "0 12px" }}>Loading...</span>
                    : (captchaDisplaySrc || captchaBase64)
                      ? <img src={captchaDisplaySrc || captchaBase64} alt="Captcha challenge" style={{ display: "block", height: "72px", width: "auto", maxWidth: "180px" }} />
                      : <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", padding: "0 12px" }}>No captcha</span>
                  }
                </div>
                <input
                  id="captcha" name="captcha"
                  value={form.captcha} onChange={handleChange}
                  onFocus={() => setFocusedField("captcha")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Type the characters above"
                  autoComplete="off"
                  style={{ flex: 1, padding: "11px 14px", fontSize: "0.875rem", border: "none", background: "transparent", color: "var(--text-primary)", outline: "none", fontFamily: "inherit", minWidth: 0 }}
                />
              </div>
              {captchaExpiresAt && <p style={{ margin: "5px 0 0", fontSize: "0.72rem", color: "var(--text-secondary)" }}>Valid until {formatExpiry(captchaExpiresAt)}</p>}
            </div>

            {/* Forgot */}
            <div className="login-form-enter login-f-d5" style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
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
