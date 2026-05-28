import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  extractApiErrorMessage,
  normalizeCaptchaImageSource,
  normalizeRegistrationNumber,
  validatePasswordReset,
  validateRegistrationNumber,
} from "../../lib/auth";

type Step = "initiate" | "change" | "done";
type Tone = "neutral" | "error" | "success";

function StatusMessage({ tone, message }: { tone: Tone; message: string }) {
  if (!message) return null;

  const toneClasses =
    tone === "success"
      ? "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]"
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

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const requestedInitialCaptcha = useRef(false);

  const [step, setStep] = useState<Step>("initiate");
  const [form, setForm] = useState({
    username: "",
    captcha: "",
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [sessionId, setSessionId] = useState("");
  const [captchaBase64, setCaptchaBase64] = useState("");
  const [captchaExpiresAt, setCaptchaExpiresAt] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusTone, setStatusTone] = useState<Tone>("neutral");
  const [statusMessage, setStatusMessage] = useState("");

  const usernameError = useMemo(() => validateRegistrationNumber(form.username), [form.username]);
  const passwordError = useMemo(() => validatePasswordReset(form.newPassword), [form.newPassword]);
  const confirmPasswordError =
    form.confirmPassword && form.newPassword !== form.confirmPassword
      ? "Passwords do not match."
      : "";

  useEffect(() => {
    if (requestedInitialCaptcha.current) return;
    requestedInitialCaptcha.current = true;
    void fetchCaptcha();
  }, []);

  useEffect(() => {
    if (step !== "done") return;

    const timeoutId = window.setTimeout(() => {
      navigate("/login", { replace: true });
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [navigate, step]);

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
      setStatusMessage(extractApiErrorMessage(payload, "Failed to refresh captcha."));
    } finally {
      setCaptchaLoading(false);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const nextValue = name === "username" ? normalizeRegistrationNumber(value) : value;
    setForm((current) => ({ ...current, [name]: nextValue }));
  };

  const handleInitiate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (usernameError) {
      setStatusTone("error");
      setStatusMessage(usernameError);
      return;
    }

    if (!form.captcha.trim()) {
      setStatusTone("error");
      setStatusMessage("Enter the captcha before requesting an OTP.");
      return;
    }

    if (!sessionId) {
      setStatusTone("error");
      setStatusMessage("Captcha session is missing. Refresh the captcha and try again.");
      return;
    }

    setSubmitting(true);
    setStatusTone("neutral");
    setStatusMessage("Requesting OTP...");

    try {
      const response = await axios.post("/api/auth/forgot", {
        type: "initiate",
        username: normalizeRegistrationNumber(form.username),
        captcha: form.captcha,
        sessionId,
      });

      setStep("change");
      setForm((current) => ({ ...current, captcha: "", otp: "", newPassword: "", confirmPassword: "" }));
      setStatusTone("success");
      setStatusMessage(
        String(response.data?.message || "OTP sent. Enter it below along with your new password.")
      );
    } catch (error: unknown) {
      const payload = axios.isAxiosError(error) ? error.response?.data : null;
      const message = extractApiErrorMessage(payload, "Unable to request OTP.");

      setStatusTone("error");
      setStatusMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (usernameError) {
      setStatusTone("error");
      setStatusMessage(usernameError);
      return;
    }

    if (!form.otp.trim()) {
      setStatusTone("error");
      setStatusMessage("Enter the OTP sent to your registered mobile or email.");
      return;
    }

    if (passwordError) {
      setStatusTone("error");
      setStatusMessage(passwordError);
      return;
    }

    if (confirmPasswordError) {
      setStatusTone("error");
      setStatusMessage(confirmPasswordError);
      return;
    }

    setSubmitting(true);
    setStatusTone("neutral");
    setStatusMessage("Updating password...");

    try {
      const response = await axios.post("/api/auth/forgot", {
        type: "change",
        username: normalizeRegistrationNumber(form.username),
        otp: form.otp.trim(),
        newPassword: form.newPassword,
      });

      setStep("done");
      setStatusTone("success");
      setStatusMessage(String(response.data?.message || "Password changed successfully. Redirecting to login..."));
    } catch (error: unknown) {
      const payload = axios.isAxiosError(error) ? error.response?.data : null;
      setStatusTone("error");
      setStatusMessage(extractApiErrorMessage(payload, "Unable to update password."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[28px] border border-[color-mix(in_srgb,var(--border)_90%,transparent)] bg-[var(--background)] p-8 shadow-[0_24px_80px_rgba(10,38,42,0.12)]">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[var(--comp-accent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
              Password Recovery
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              Manual captcha stays in the flow. No hidden bypasses.
            </span>
          </div>

          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
            Reset your ERP password without leaving the current session flow.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
            First request an OTP with your registration number and captcha. Then confirm the OTP and
            set a stronger password that meets the new validation rules.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "Step 1",
                text: "Use your registration number exactly as the ERP expects it.",
              },
              {
                title: "Step 2",
                text: "Refresh the captcha if it expires before you submit the OTP request.",
              },
              {
                title: "Step 3",
                text: "Use a password with uppercase, lowercase, and at least one number.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[color-mix(in_srgb,var(--border)_85%,transparent)] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] p-4"
              >
                <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-[color-mix(in_srgb,var(--border)_90%,transparent)] bg-[var(--surface)] p-6 shadow-[0_24px_70px_rgba(10,38,42,0.1)]">
          <div className="mb-5 rounded-2xl bg-[var(--comp-accent)] px-5 py-4 text-white">
            <p className="text-lg font-semibold">
              {step === "initiate" ? "Request OTP" : step === "change" ? "Verify OTP" : "Password Updated"}
            </p>
            <p className="mt-1 text-sm text-white/80">
              {step === "initiate"
                ? "Enter your registration number and captcha to start."
                : step === "change"
                  ? "Finish the reset with the OTP and your new password."
                  : "You can head back to login now."}
            </p>
          </div>

          <div className="space-y-4">
            <StatusMessage tone={statusTone} message={statusMessage} />

            {step === "initiate" ? (
              <form className="space-y-4" onSubmit={handleInitiate}>
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
                  ) : null}
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

                <button
                  type="submit"
                  disabled={submitting || captchaLoading}
                  className="w-full rounded-xl bg-[var(--comp-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Requesting OTP..." : "Send OTP"}
                </button>
              </form>
            ) : null}

            {step === "change" ? (
              <form className="space-y-4" onSubmit={handleResetPassword}>
                <div className="space-y-2">
                  <label htmlFor="username-review" className="text-sm font-medium text-[var(--text-primary)]">
                    Registration Number
                  </label>
                  <input
                    id="username-review"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[color-mix(in_srgb,var(--surface)_40%,white)] px-4 py-3 text-sm text-[var(--text-secondary)]"
                    readOnly
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="otp" className="text-sm font-medium text-[var(--text-primary)]">
                    OTP
                  </label>
                  <input
                    id="otp"
                    name="otp"
                    value={form.otp}
                    onChange={handleChange}
                    placeholder="Enter the OTP"
                    className="w-full rounded-xl border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[var(--comp-accent)]"
                    autoComplete="one-time-code"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="newPassword" className="text-sm font-medium text-[var(--text-primary)]">
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={form.newPassword}
                    onChange={handleChange}
                    placeholder="Create a stronger password"
                    className="w-full rounded-xl border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[var(--comp-accent)]"
                    autoComplete="new-password"
                  />
                  {form.newPassword && passwordError ? (
                    <p className="text-xs text-[var(--error)]">{passwordError}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-[var(--text-primary)]">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter the new password"
                    className="w-full rounded-xl border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[var(--comp-accent)]"
                    autoComplete="new-password"
                  />
                  {confirmPasswordError ? (
                    <p className="text-xs text-[var(--error)]">{confirmPasswordError}</p>
                  ) : null}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("initiate");
                      void fetchCaptcha("You can request a fresh OTP if needed.");
                    }}
                    className="flex-1 rounded-xl border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--background)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--comp-accent)]"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-[var(--comp-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Saving..." : "Update Password"}
                  </button>
                </div>
              </form>
            ) : null}

            {step === "done" ? (
              <div className="space-y-4 rounded-2xl border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] p-5 text-sm text-[var(--success)]">
                <p>Your ERP password has been updated successfully.</p>
                <p>You’ll be sent back to the login page in a moment.</p>
                <Link
                  to="/login"
                  className="inline-flex rounded-lg bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white no-underline"
                >
                  Go to login
                </Link>
              </div>
            ) : null}

            <div className="border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] pt-4 text-sm text-[var(--text-secondary)]">
              <Link to="/login" className="font-semibold text-[var(--comp-text-primary)] no-underline hover:underline">
                Back to login
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
