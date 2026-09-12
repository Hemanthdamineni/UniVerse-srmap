import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import MobileTabBar from "../components/shell/MobileTabBar";
import Header from "../components/Header";
import Footer from "../components/Footer";
import NavigationCommandPalette from "../components/NavigationCommandPalette";
import AppContentChrome from "../components/shell/AppContentChrome";
import AppKeyboardShortcuts from "../components/AppKeyboardShortcuts";
import { AdminAccessPrompt } from "../components/admin/AdminPanels";
import { AdminModeProvider } from "../contexts/AdminModeContext";
import { isStaticPrototype } from "../lib/core/prototype";
import { useRouteViewTracking } from "../lib/core/useRouteViewTracking";
import OnboardingFlow from "./Onboarding/OnboardingFlow";
import { OfflineBanner } from "../components/shell/OfflineBanner";

const PUBLIC_ROUTES = new Set(["/login", "/forgot-password"]);

export default function PageLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isPublicRoute = PUBLIC_ROUTES.has(location.pathname);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // One route_view per navigation (backlog T8.1). Safe on public routes too —
  // the sender no-ops when unauthenticated.
  useRouteViewTracking();

  // Navigating from inside the drawer should close it.
  useEffect(() => setMobileNavOpen(false), [location.pathname]);

  // Escape closes the drawer, matching the dialog convention used elsewhere.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileNavOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  if (isPublicRoute) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[var(--background)]">
        <OfflineBanner />
        <Header />
        <main role="main" className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto bg-[var(--background)] sm:items-center">
          {children}
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <AdminModeProvider>
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--background)]">
      <OfflineBanner />
      {isStaticPrototype() ? (
        <div
          className="z-[70] shrink-0 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          role="status"
        >
          Static prototype — UI only; data comes from <code className="rounded bg-amber-200 px-1 text-amber-950 dark:bg-amber-900 dark:text-amber-100">public/fixtures</code> and
          built-in stubs. No live backend.
        </div>
      ) : null}
      <div className="dashboard-background relative flex flex-1 overflow-hidden">
        <Sidebar mobileNavOpen={mobileNavOpen} onMobileNavClose={() => setMobileNavOpen(false)} />
        <main
          role="main"
          className="relative z-[1] flex-1 overflow-auto pb-[68px] md:pb-0"
          style={{ minHeight: "100vh" }}
        >
            <a
              href="#main-content"
              className="fixed left-4 top-2 z-[60] -translate-y-24 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-md transition focus:translate-y-0 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent-blue)]"
            >
              Skip to main content
            </a>
            {/* Keyboard affordances are desktop-only; on touch they sit over content
                and advertise a shortcut the device cannot produce. */}
            <div className="pointer-events-none fixed bottom-6 right-6 z-40 hidden items-center gap-3 md:flex">
              <NavigationCommandPalette />
              <AppKeyboardShortcuts />
            </div>
            <OnboardingFlow />
            <AppContentChrome>{children}</AppContentChrome>
          </main>
        </div>
        <MobileTabBar onOpenMenu={() => setMobileNavOpen(true)} />
        <AdminAccessPrompt />
      </div>
    </AdminModeProvider>
  );
}
