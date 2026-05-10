import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  extractApiErrorCode,
  extractApiErrorMessage,
  normalizeCaptchaImageSource,
  normalizeRegistrationNumber,
  validateRegistrationNumber,
} from "../../lib/auth";
import { hasSessionAuth, storeSessionAuth } from "../../lib/session";

type Tone = "neutral" | "error" | "success";

function StatusMessage({ tone, message }: { tone: Tone; message: string }) {
  if (!message) return null;

  const toneClasses =
    tone === "success"
      ? "border-green-200 bg-green-50 text-green-700"
      : tone === "error"
        ? "border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] text-[var(--error)]"
        : "border-[var(--comp-border)] bg-[var(--comp-surface-hover)] text-[var(--comp-text-secondary)]";

  return <div className={`rounded-xl border px-4 py-3 text-sm ${toneClasses}`}>{message}</div>;
}

function formatExpiry(expiresAt: string) {
  if (!expiresAt) return "";
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LoginPage() {
  const navigate = useNavigate();
  const requestedInitialCaptcha = useRef(false);

  const [form, setForm] = useState({
    username: "",
    password: "",
    captcha: "",
  });
  const [sessionId, setSessionId] = useState("");
  const [captchaBase64, setCaptchaBase64] = useState("");
  const [captchaExpiresAt, setCaptchaExpiresAt] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [statusTone, setStatusTone] = useState<Tone>("neutral");
  const [statusMessage, setStatusMessage] = useState("");

  const usernameError = useMemo(() => validateRegistrationNumber(form.username), [form.username]);
  const canSubmit =
    !submitting &&
    !captchaLoading &&
    Boolean(sessionId) &&
    Boolean(form.password.trim()) &&
    Boolean(form.captcha.trim()) &&
    !usernameError;

  useEffect(() => {
    if (hasSessionAuth()) {
      navigate("/dashboard", { replace: true });
      return;
    }

    if (requestedInitialCaptcha.current) return;
    requestedInitialCaptcha.current = true;
    void fetchCaptcha();
  }, [navigate]);

  const fetchCaptcha = async (nextMessage = "") => {
    setCaptchaLoading(true);
    try {
      const response = await axios.get("/api/captcha");
      setCaptchaBase64(normalizeCaptchaImageSource(response.data?.captchaBase64));
      setSessionId(String(response.data?.sessionId || ""));
      setCaptchaExpiresAt(String(response.data?.expiresAt || ""));
      setForm((current) => ({ ...current, captcha: "" }));

      if (nextMessage) {
        setStatusTone("neutral");
        setStatusMessage(nextMessage);
      }
    } catch (error: unknown) {
      const payload = axios.isAxiosError(error) ? error.response?.data : null;
      setStatusTone("error");
      setStatusMessage(extractApiErrorMessage(payload, "Failed to load captcha."));
    } finally {
      setCaptchaLoading(false);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const nextValue = name === "username" ? normalizeRegistrationNumber(value) : value;
    setForm((current) => ({ ...current, [name]: nextValue }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (usernameError) {
      setStatusTone("error");
      setStatusMessage(usernameError);
      return;
    }

    if (!form.password.trim()) {
      setStatusTone("error");
      setStatusMessage("Password is required.");
      return;
    }

    if (!form.captcha.trim()) {
      setStatusTone("error");
      setStatusMessage("Enter the captcha to continue.");
      return;
    }

    if (!sessionId) {
      setStatusTone("error");
      setStatusMessage("Captcha session is missing. Refresh the captcha and try again.");
      return;
    }

    setSubmitting(true);
    setStatusTone("neutral");
    setStatusMessage("Logging in...");

    try {
      const response = await axios.post("/api/login", {
        username: normalizeRegistrationNumber(form.username),
        password: form.password,
        captcha: form.captcha,
        sessionId,
      });

      if (!response.data?.success) {
        setStatusTone("error");
        setStatusMessage(
          `Login failed: ${extractApiErrorMessage(response.data, "Unknown login error.")}`
        );
        return;
      }

      const nextSessionId = String(response.data?.sessionId || sessionId);
      storeSessionAuth({
        sessionId: nextSessionId,
        profileData: response.data?.profileData,
      });

      setStatusTone("success");
      setStatusMessage("Login successful. Opening dashboard...");
      navigate("/dashboard", { replace: true });
    } catch (error: unknown) {
      const payload = axios.isAxiosError(error) ? error.response?.data : null;
      const code = extractApiErrorCode(payload);
      const message = extractApiErrorMessage(
        payload,
        axios.isAxiosError(error) ? error.message || "Login failed." : "Login failed."
      );

      if (code === "CAPTCHA_EXPIRED" || code === "PREAUTH_EXPIRED") {
        await fetchCaptcha("Captcha expired. A fresh captcha is ready.");
      } else {
        setStatusTone("error");
        setStatusMessage(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[30px] border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--background)] p-8 shadow-[0_24px_80px_rgba(10,38,42,0.12)]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[var(--comp-accent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
              Login
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              Backend-managed ERP access with manual captcha.
            </span>
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
            Sign in with your ERP registration number.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
            The frontend now trusts normalized backend payloads and a real session model, so login failures
            should tell you exactly whether the issue is the captcha, the session, or your credentials.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "Use your registration number",
                text: "The login form validates the AP-prefixed format before sending a request.",
              },
              {
                title: "Watch the captcha",
                text: "If it expires, the app refreshes the challenge and tells you what happened.",
              },
              {
                title: "Recover safely",
                text: "Forgot password now has a real OTP flow instead of a dead link.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[color-mix(in_srgb,var(--border)_85%,transparent)] bg-[color-mix(in_srgb,var(--surface)_75%,transparent)] p-4"
              >
                <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--surface)] p-6 shadow-[0_24px_70px_rgba(10,38,42,0.1)]">
          <div className="mb-5 rounded-2xl bg-[var(--comp-accent)] px-5 py-4 text-white">
            <p className="text-lg font-semibold">Welcome back</p>
            <p className="mt-1 text-sm text-white/80">
              Manual captcha remains required for compliance.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <StatusMessage tone={statusTone} message={statusMessage} />

            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-[var(--text-primary)]">
                Registration Number
              </label>
              <input
                id="username"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="AP24110000000"
                className="w-full rounded-xl border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[var(--comp-accent)]"
                autoComplete="username"
              />
              {form.username && usernameError ? (
                <p className="text-xs text-[var(--error)]">{usernameError}</p>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">Use the exact AP-prefixed registration number.</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-[var(--text-primary)]">
                Password
              </label>
              <div className="flex items-center overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--background)]">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your ERP password"
                  className="flex-1 bg-transparent px-4 py-3 text-sm outline-none"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="px-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--comp-text-primary)]"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="captcha" className="text-sm font-medium text-[var(--text-primary)]">
                  Captcha
                </label>
                <button
                  type="button"
                  onClick={() => {
                    void fetchCaptcha("Captcha refreshed.");
                  }}
                  className="text-xs font-semibold text-[var(--comp-text-primary)] underline-offset-4 hover:underline"
                  disabled={captchaLoading}
                >
                  {captchaLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--background)]">
                <div className="flex items-center">
                  <div className="flex min-h-[70px] w-[172px] items-center justify-center border-r border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-white px-3 py-2">
                    {captchaBase64 ? (
                      <img
                        src={captchaBase64}
                        alt="ERP captcha"
                        className="block max-h-[54px] w-full max-w-[148px] object-contain"
                      />
                    ) : (
                      <span className="text-xs text-[var(--text-secondary)]">Loading captcha...</span>
                    )}
                  </div>
                  <input
                    id="captcha"
                    name="captcha"
                    value={form.captcha}
                    onChange={handleChange}
                    placeholder="Enter captcha"
                    className="min-h-[70px] flex-1 bg-transparent px-4 text-sm outline-none"
                  />
                </div>
              </div>

              {captchaExpiresAt ? (
                <p className="text-xs text-[var(--text-secondary)]">
                  Captcha available until {formatExpiry(captchaExpiresAt)}.
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Session-backed login. Nothing is stored as a fake token.</span>
              <Link to="/forgot-password" className="font-semibold text-[var(--comp-text-primary)] no-underline hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-xl bg-[var(--comp-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Logging in..." : "Log In"}
            </button>

            <div className="border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] pt-4 text-sm text-[var(--text-secondary)]">
              New session only needs your ERP registration number, password, and the current captcha.
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
