import React, { Suspense } from "react";
import { useLocation } from "react-router-dom";
import { ErrorBoundary } from "./ErrorBoundary";

function PageLoader() {
  const { pathname } = useLocation();
  const section =
    pathname.startsWith("/academic") ? "academic records" :
    pathname.startsWith("/exams") ? "exam records" :
    pathname.startsWith("/finance") ? "fee records" :
    pathname.startsWith("/events") ? "events workspace" :
    pathname.startsWith("/learn") ? "learning resources" :
    pathname.startsWith("/career") ? "career workspace" :
    pathname.startsWith("/helpdesk") ? "helpdesk" :
    "student workspace";

  return (
    <div className="flex h-full w-full items-center justify-center p-8" aria-live="polite">
      <div className="w-full max-w-xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Preparing {section}</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Keeping your place while this page loads.</p>
        <div className="mt-4 space-y-2" aria-hidden="true">
          <div className="skeleton-shimmer h-4 w-2/3 rounded-full" />
          <div className="skeleton-shimmer h-4 w-full rounded-full" />
          <div className="skeleton-shimmer h-4 w-4/5 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </ErrorBoundary>
  );
}
