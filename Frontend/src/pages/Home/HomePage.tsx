import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hasSessionAuth, readStoredProfileData } from "../../lib/core/session";

const VALUE_PILLARS = [
  {
    title: "Know your day",
    description: "Timetable, attendance, announcements, and academic updates in one scan.",
  },
  {
    title: "Stay ahead",
    description: "Marks, fees, registrations, and documents without the ERP maze.",
  },
  {
    title: "Use campus tools",
    description: "LMS, events, career, feedback, and helpdesk stay close by.",
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
      <div className="flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-3xl rounded-[32px] border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--background)] p-8 shadow-[0_24px_80px_rgba(10,38,42,0.12)]">
          <span className="rounded-full bg-[var(--comp-accent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
            Session Active
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
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
              className="rounded-xl bg-[var(--comp-accent)] px-5 py-3 text-sm font-semibold text-white no-underline transition hover:opacity-95"
            >
              Open Dashboard
            </Link>
            <Link
              to="/profile"
              className="rounded-xl border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] no-underline transition hover:border-[var(--comp-accent)]"
            >
              Review Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[32px] border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--background)] p-8 shadow-[0_24px_80px_rgba(10,38,42,0.12)]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[var(--comp-accent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
              UniVerse, SRMAP Edition
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              Academic records plus campus services.
            </span>
          </div>

          <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
            Your university day, in one clear place.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--text-secondary)]">
            Check attendance, marks, timetable, fees, registrations, and campus services without losing your
            place in the old ERP flow.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="rounded-xl bg-[var(--comp-accent)] px-5 py-3 text-sm font-semibold text-white no-underline transition hover:opacity-95"
            >
              Log In to ERP
            </Link>
            <Link
              to="/forgot-password"
              className="rounded-xl border border-[color-mix(in_srgb,var(--border)_95%,transparent)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] no-underline transition hover:border-[var(--comp-accent)]"
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

        <section className="flex flex-col justify-between rounded-[32px] bg-[var(--comp-accent)] p-8 text-white shadow-[0_24px_80px_rgba(10,38,42,0.16)]">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-white/75">Start with what matters</p>
            <div className="mt-6 space-y-5">
              {[
                "Open the dashboard for today's academic snapshot.",
                "Use the sidebar to jump straight to attendance, exams, finance, or registrations.",
                "Return any time without searching for the same ERP page again.",
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
              Sign in with your university registration number. If the captcha or ERP session expires, UniVerse
              will tell you what happened and let you recover cleanly.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
