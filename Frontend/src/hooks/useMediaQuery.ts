import { useEffect, useState } from "react";

/**
 * Subscribes to a CSS media query.
 *
 * Used where a responsive variant must exist in the DOM *exclusively* rather
 * than being hidden with `md:hidden`. Rendering both variants duplicates the
 * content for assistive technology, and `aria-hidden` is not a fix when the
 * hidden copy contains focusable controls — that produces focusable-but-
 * unannounced elements. Rendering one keeps the accessibility tree honest.
 *
 * Returns false during the first paint on the server or before the listener
 * attaches, so callers should treat `false` as "not yet known to match".
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const list = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);

    // Re-read on mount: the query may have changed between render and effect.
    setMatches(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True below the `md` breakpoint, matching the Tailwind scale used app-wide. */
export function useIsMobileViewport(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
