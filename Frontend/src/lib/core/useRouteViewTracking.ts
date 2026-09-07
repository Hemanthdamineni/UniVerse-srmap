import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { track } from "./analytics";
import { hasSessionAuth } from "./session";

/**
 * Fires one `route_view` analytics event per distinct route the user lands on.
 *
 * Backlog T8.1 — "know which pages are used". `track()` already batches and
 * swallows failures; this just supplies the navigation signal it was missing.
 *
 * De-duplicates consecutive identical paths (a `replace` navigation or a
 * state-only update should not double-count), and ignores the query string and
 * hash so `/events?tab=x` and `/events?tab=y` roll up to `/events`.
 */
export function useRouteViewTracking(): void {
  const { pathname } = useLocation();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (lastTracked.current === pathname) return;
    // The backend rejects unauthenticated analytics; don't bother beaconing
    // from the login / forgot-password screens.
    if (!hasSessionAuth()) return;
    lastTracked.current = pathname;
    track("route_view", { route: pathname });
  }, [pathname]);
}
