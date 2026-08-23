// One-time onboarding surfaces (first-login greeting, dashboard guide) key
// off a versioned flag so shipping new guidance later is a deliberate
// re-trigger, not an accident of a renamed localStorage entry.
const ONBOARDING_SEEN_KEY = "erp.onboarding.seenVersion";
export const ONBOARDING_VERSION = 1;

function hasStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function hasSeenOnboarding(version = ONBOARDING_VERSION): boolean {
  if (!hasStorage()) return true;

  try {
    const seen = Number(window.localStorage.getItem(ONBOARDING_SEEN_KEY));
    return Number.isFinite(seen) && seen >= version;
  } catch {
    // Privacy mode / storage failure — skip onboarding rather than nag.
    return true;
  }
}

export function markOnboardingSeen(version = ONBOARDING_VERSION): void {
  if (!hasStorage()) return;

  try {
    window.localStorage.setItem(ONBOARDING_SEEN_KEY, String(version));
  } catch {
    // Storage unavailable — the guide just reappears next visit.
  }
}
