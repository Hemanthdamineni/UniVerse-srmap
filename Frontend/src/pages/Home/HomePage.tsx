import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hasSessionAuth, readStoredProfileData } from "../../lib/session";

const VALUE_PILLARS = [
  {
    title: "Canonical ERP Data",
    description: "Backend normalization now repairs known ERP quirks before anything reaches the UI.",
  },
  {
    title: "Session-First Auth",
    description: "Your local session state is derived from the real ERP session instead of placeholder tokens.",
  },
  {
    title: "Manual Captcha Flow",
    description: "Captcha stays explicit and compliant, with clearer recovery when a session expires.",
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const authenticated = hasSessionAuth();
  const profile = readStoredProfileData();
  const registerNo = String(
    profile?.RegisterNo ||
      profile?.registerNo ||
      profile?.["Register No."] ||
      profile?.["Register No"] ||
      ""
  ).trim();

  useEffect(() => {
    if (!authenticated) return;

    const timeoutId = window.setTimeout(() => {
      navigate("/dashboard", { replace: true });
    }, 1400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authenticated, navigate]);

  if (authenticated) {
    return (
      <div className="flex min-h-[calc(100vh-128px)] items-center justify-center bg-[color-mix(in_srgb,var(--surface)_55%,transparent)] px-4 py-8">
        <div className="w-full max-w-3xl rounded-[32px] border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--background)] p-8 shadow-[0_24px_80px_rgba(10,38,42,0.12)]">
          <span className="rounded-full bg-[#0A3035] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
            Session Active
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
            Your ERP session is ready.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
            {registerNo
              ? `You're signed in as ${registerNo}. We’ll take you straight to the dashboard.`
              : "You already have an active ERP session. We’ll take you straight to the dashboard."}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/dashboard"
              className="rounded-xl bg-[#0A3035] px-5 py-3 text-sm font-semibold text-white no-underline transition hover:opacity-95"
            >
              Open Dashboard
            </Link>
            <Link
              to="/profile"
              className="rounded-xl border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] no-underline transition hover:border-[#0A3035]"
            >
              Review Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[color-mix(in_srgb,var(--surface)_55%,transparent)] px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-160px)] w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[32px] border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--background)] p-8 shadow-[0_24px_80px_rgba(10,38,42,0.12)]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#0A3035] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
              University ERP
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              Cleaner sessions, safer auth, and normalized academic data.
            </span>
          </div>

          <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-[var(--text-primary)]">
            A calmer front door for the same messy ERP underneath.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--text-secondary)]">
            This version keeps ERP access on the backend, treats captcha honestly, and normalizes broken
            page structures before the UI ever has to reason about them.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="rounded-xl bg-[#0A3035] px-5 py-3 text-sm font-semibold text-white no-underline transition hover:opacity-95"
            >
              Log In to ERP
            </Link>
            <Link
              to="/forgot-password"
              className="rounded-xl border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] no-underline transition hover:border-[#0A3035]"
            >
              Reset Password
            </Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {VALUE_PILLARS.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[color-mix(in_srgb,var(--border)_85%,transparent)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] p-5"
              >
                <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col justify-between rounded-[32px] bg-[#0A3035] p-8 text-white shadow-[0_24px_80px_rgba(10,38,42,0.16)]">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-white/75">What Changed</p>
            <div className="mt-6 space-y-5">
              {[
                "Page contracts now validate live ERP payloads before they enter cache.",
                "Shared normalization rules repair shifted headers and duplicated table rows.",
                "Auth state now follows the real ERP session instead of a dummy client token.",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/15 bg-white/6 p-4">
                  <p className="text-sm leading-6 text-white/88">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-white/15 bg-white/7 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/65">Start Here</p>
            <p className="mt-3 text-sm leading-6 text-white/85">
              Use your registration number to sign in. If the captcha or session expires, the app now tells
              you that directly and refreshes the recovery path instead of leaving you stuck.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
