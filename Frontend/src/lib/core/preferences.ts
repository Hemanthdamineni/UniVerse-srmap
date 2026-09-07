/**
 * Client-held student preferences.
 *
 * These are display/notification intents that have no dedicated backend table
 * yet. Storing them locally keeps the Settings screen honest — every control
 * does something and survives a reload — without inventing an API surface that
 * the server does not actually honour.
 *
 * When a preferences endpoint lands, `loadPreferences`/`savePreferences` are the
 * only two functions that need to change; callers stay as they are.
 */

const STORAGE_KEY = "erp.preferences.v1";

export type Preferences = {
  // Notifications
  eventReminders: boolean;
  registrationUpdates: boolean;
  resultAlerts: boolean;
  organizerMessages: boolean;
  weeklyDigest: boolean;
  // Privacy
  profilePublic: boolean;
  showAchievements: boolean;
  showLeaderboard: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  eventReminders: true,
  registrationUpdates: true,
  resultAlerts: true,
  organizerMessages: false,
  weeklyDigest: true,
  profilePublic: true,
  showAchievements: true,
  showLeaderboard: false,
};

function hasStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

/** Reads stored preferences, ignoring unknown or malformed keys. */
export function loadPreferences(): Preferences {
  if (!hasStorage()) return { ...DEFAULT_PREFERENCES };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };

    const parsed = JSON.parse(raw) as Partial<Record<keyof Preferences, unknown>>;
    const merged = { ...DEFAULT_PREFERENCES };
    for (const key of Object.keys(DEFAULT_PREFERENCES) as (keyof Preferences)[]) {
      if (typeof parsed[key] === "boolean") merged[key] = parsed[key] as boolean;
    }
    return merged;
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/** Returns false when storage rejected the write, so the UI can say so. */
export function savePreferences(prefs: Preferences): boolean {
  if (!hasStorage()) return false;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

export function resetPreferences(): Preferences {
  if (hasStorage()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Defaults still apply in memory.
    }
  }
  return { ...DEFAULT_PREFERENCES };
}
