/**
 * Theme resolution for the app shell.
 *
 * Three user-facing choices — `system`, `light`, `dark` — resolve to exactly two
 * rendered themes. The resolved theme is written to the document as BOTH
 * `data-theme` (read by `styles/base.css` tokens) and the `.dark` class (read by
 * the Tailwind `dark:` variant, which `styles/markdown.css` rebinds to this
 * toggle). Keeping the two in lockstep is why every write goes through
 * `applyResolvedTheme` rather than touching the element directly.
 *
 * `system` deliberately stores the *choice*, not the resolved value, so a student
 * who picks "system" keeps following their OS when it flips at sunset.
 */

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "erp.theme.choice";
/** Written by the pre-hydration snippet and the older ThemeToggle. Read once, then migrated. */
const LEGACY_STORAGE_KEY = "theme";

const THEME_CHOICES = new Set<ThemeChoice>(["system", "light", "dark"]);

type Listener = (choice: ThemeChoice, resolved: ResolvedTheme) => void;
const listeners = new Set<Listener>();

function hasStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function prefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** The stored choice, migrating the legacy binary `theme` key on first read. */
export function getThemeChoice(): ThemeChoice {
  if (!hasStorage()) return "system";

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && THEME_CHOICES.has(stored as ThemeChoice)) {
      return stored as ThemeChoice;
    }

    // Migrate the legacy key so an existing dark-mode user isn't reset to system.
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy === "dark" || legacy === "light") {
      window.localStorage.setItem(STORAGE_KEY, legacy);
      return legacy;
    }
  } catch {
    // Private mode or blocked storage — follow the OS rather than failing.
  }

  return "system";
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  // Dark mode is still in development — production users only ever see light,
  // regardless of a stored choice or OS preference. Dev keeps full dark-mode
  // behavior so work on it can continue.
  if (import.meta.env.PROD) return "light";
  if (choice === "system") return prefersDark() ? "dark" : "light";
  return choice;
}

/** Single writer for both theme signals on <html>. */
function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

/** Apply once before React paints, without attaching an OS listener. */
export function applyInitialTheme(): void {
  applyResolvedTheme(resolveTheme(getThemeChoice()));
}

export function setThemeChoice(choice: ThemeChoice): ResolvedTheme {
  const next = THEME_CHOICES.has(choice) ? choice : "system";
  const resolved = resolveTheme(next);

  if (hasStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      // Keep the legacy key aligned so a stale ThemeToggle instance agrees.
      window.localStorage.setItem(LEGACY_STORAGE_KEY, resolved);
    } catch {
      // Choice applies for this session only.
    }
  }

  applyResolvedTheme(resolved);
  for (const listener of listeners) listener(next, resolved);
  return resolved;
}

export function subscribeToTheme(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Apply the stored choice and start following the OS while the choice is
 * `system`. Call once at app start; returns a teardown for StrictMode remounts.
 */
export function initTheme(): () => void {
  applyInitialTheme();

  if (typeof window === "undefined" || !window.matchMedia) return () => {};

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    // Only `system` tracks the OS; an explicit choice must survive an OS flip.
    if (getThemeChoice() !== "system") return;
    const resolved = resolveTheme("system");
    applyResolvedTheme(resolved);
    for (const listener of listeners) listener("system", resolved);
  };

  media.addEventListener("change", onSystemChange);
  return () => media.removeEventListener("change", onSystemChange);
}
