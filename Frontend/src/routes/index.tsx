import { Link, createBrowserRouter } from "react-router-dom";
import Footer from "../components/Footer";
import Header from "../components/Header";
import BackIcon from "../assets/Icons/Back.png";
import { hasSessionAuth } from "../lib/core/session";
import { adminRoutes } from "./adminRoutes";
import { baseRoutes } from "./baseRoutes";
import { erpRoutes } from "./erpRoutes";
import { eventRoutes } from "./eventRoutes";
import { lmsRoutes } from "./lmsRoutes";

function NotFoundPage() {
  const destination = hasSessionAuth() ? "/dashboard" : "/login";
  const actionLabel = hasSessionAuth() ? "Dashboard" : "Login";

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--background)" }}>
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div
          className="w-full max-w-md space-y-5 rounded-xl border p-6 text-center md:p-8"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* Code label */}
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg"
            style={{
              background: "color-mix(in srgb, var(--comp-accent) 8%, transparent)",
            }}
          >
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: "var(--comp-accent)" }}
            >
              404
            </span>
          </div>

          {/* Copy */}
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              Page not found
            </h1>
            <p className="mx-auto max-w-xs text-sm leading-6 text-[var(--text-secondary)]">
              This page doesn't exist in your workspace. The link may be outdated, or the URL may be incorrect.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-3 pt-1">
            <Link to={destination} className="btn-primary no-underline">
              {actionLabel}
            </Link>
            <button
              onClick={() => window.history.back()}
              type="button"
              className="btn-secondary gap-2"
            >
              <img src={BackIcon} alt="" aria-hidden="true" className="h-3.5 w-3.5" />
              Go back
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export const router = createBrowserRouter([
  ...baseRoutes,
  ...eventRoutes,
  ...lmsRoutes,
  ...erpRoutes,
  ...adminRoutes,
  { path: "*", element: <NotFoundPage /> },
]);
