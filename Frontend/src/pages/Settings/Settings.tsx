/**
 * Settings.tsx — /settings
 * User preferences and account settings with event notification controls,
 * privacy toggles, theme selection, and data export.
 */

import { Download } from "lucide-react";
import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ErpPageShell, SectionCard } from '../../components/erp/ErpPrimitives';
import CareerIntentSettings from './CareerIntentSettings';
import PushNotificationSettings from './PushNotificationSettings';
import GoogleCalendarSettings from './GoogleCalendarSettings';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  resetPreferences,
  savePreferences,
  type Preferences,
} from '../../lib/core/preferences';
import { getThemeChoice, setThemeChoice, subscribeToTheme, type ThemeChoice } from '../../lib/core/theme';

/* ---------- Sub-components ---------- */

function ToggleSwitch({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  const descriptionId = description
    ? `toggle-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-description`
    : undefined;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={descriptionId}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-4 border-b border-[var(--comp-border)] py-2 text-left transition-colors hover:bg-[var(--comp-surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 outline-[var(--accent-blue)]"
    >
      <span>
        <span className="block text-sm font-medium text-[var(--comp-text-primary)]">{label}</span>
        {description && (
          <span id={descriptionId} className="mt-0.5 block text-xs text-[var(--comp-text-muted)]">{description}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-[22px] w-10 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[var(--comp-accent)]' : 'bg-[var(--comp-border)]'
        }`}
      >
        <span
          className="absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-[var(--background)] shadow-sm transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(0)' }}
        />
      </span>
    </button>
  );
}

/* ---------- Main Page ---------- */

export default function Settings() {
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<Preferences>(() => loadPreferences());
  const [selectedTheme, setSelectedTheme] = useState<ThemeChoice>(() => getThemeChoice());
  const [status, setStatus] = useState<string>("");

  // Theme can also change from the header toggle or an OS flip — stay in sync.
  useEffect(() => subscribeToTheme((choice) => setSelectedTheme(choice)), []);

  const set = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setStatus("");
  }, []);

  const handleSave = useCallback(() => {
    setStatus(savePreferences(prefs)
      ? "Preferences saved."
      : "Couldn't save — your browser is blocking site storage.");
  }, [prefs]);

  const handleReset = useCallback(() => {
    setPrefs(resetPreferences());
    setThemeChoice("system");
    setStatus("Reset to defaults.");
  }, []);

  // Exports what this device actually holds. Server-side records (registrations,
  // submissions, certificates) need an authenticated export endpoint — not
  // claimed here until that exists.
  const handleExport = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      scope: "device-local settings only",
      theme: getThemeChoice(),
      preferences: prefs,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `universe-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Exported your device settings.");
  }, [prefs]);

  const handleClearCache = useCallback(() => {
    queryClient.clear();
    setStatus("Cached data cleared — pages will refetch.");
  }, [queryClient]);

  const isDirty = (Object.keys(DEFAULT_PREFERENCES) as (keyof Preferences)[])
    .some((key) => prefs[key] !== loadPreferences()[key]);

  return (
    <ErpPageShell title="Settings" source="This device" isLoading={false}>
      <div className="flex max-w-[720px] flex-col gap-6">

        <p className="comp-body mt-1">
          Manage your notifications, privacy, and display preferences
        </p>

        {/* Event Notifications */}
        <SectionCard title="Event Notifications">
          <div className="flex flex-col">
            <ToggleSwitch
              checked={prefs.eventReminders}
              onChange={(v) => set("eventReminders", v)}
              label="Event Reminders"
              description="Get notified 24h and 1h before events you've registered for"
            />
            <ToggleSwitch
              checked={prefs.registrationUpdates}
              onChange={(v) => set("registrationUpdates", v)}
              label="Registration Updates"
              description="Status changes for your event registrations"
            />
            <ToggleSwitch
              checked={prefs.resultAlerts}
              onChange={(v) => set("resultAlerts", v)}
              label="Result Announcements"
              description="Instant alerts when competition results are published"
            />
            <ToggleSwitch
              checked={prefs.organizerMessages}
              onChange={(v) => set("organizerMessages", v)}
              label="Organizer Messages"
              description="Direct messages from event organizers"
            />
            <ToggleSwitch
              checked={prefs.weeklyDigest}
              onChange={(v) => set("weeklyDigest", v)}
              label="Weekly Digest"
              description="Summary of upcoming events and campus activity"
            />
          </div>
        </SectionCard>

        {/* Push + channel/quiet-hour controls (Batch B8) */}
        <PushNotificationSettings />

        {/* Google Calendar sync (Batch B10) */}
        <GoogleCalendarSettings />

        {/* Privacy */}
        <SectionCard title="Privacy & Visibility">
          <div className="flex flex-col">
            <ToggleSwitch
              checked={prefs.profilePublic}
              onChange={(v) => set("profilePublic", v)}
              label="Public Profile"
              description="Allow other students and organizers to view your profile"
            />
            <ToggleSwitch
              checked={prefs.showAchievements}
              onChange={(v) => set("showAchievements", v)}
              label="Show Achievements"
              description="Display your badges and achievements on your public profile"
            />
            <ToggleSwitch
              checked={prefs.showLeaderboard}
              onChange={(v) => set("showLeaderboard", v)}
              label="Leaderboard Visibility"
              description="Include your profile in faculty and department leaderboards"
            />
          </div>
        </SectionCard>

        {/* Career intent + inference controls (Batch B5) */}
        <CareerIntentSettings />

        {/* Appearance — dark mode is still in development, so production only
            offers Light; System/Dark stay dev-only rather than offering a
            choice that can't visibly change anything. */}
        {import.meta.env.DEV ? (
        <SectionCard title="Appearance">
          <p className="comp-body mb-4 text-sm">
            Choose how the platform looks to you. Applies immediately — “System” follows your device.
          </p>
          <div className="flex gap-4">
            {(['system', 'light', 'dark'] as const).map((theme) => (
              <button
                key={theme}
                onClick={() => { setThemeChoice(theme); setSelectedTheme(theme); }}
                className={`flex flex-1 flex-col items-center gap-1 rounded-xl border-2 p-4 transition-colors ${
                  selectedTheme === theme
                    ? 'border-[var(--comp-accent)] bg-[var(--comp-accent-light)]'
                    : 'border-[var(--comp-border)] bg-[var(--comp-surface)]'
                }`}
                aria-pressed={selectedTheme === theme}
              >
                <span className="text-2xl">
                  {theme === 'system' ? '💻' : theme === 'light' ? '☀️' : '🌙'}
                </span>
                <span
                  className={`text-sm font-semibold capitalize ${
                    selectedTheme === theme ? 'text-[var(--comp-accent)]' : 'text-[var(--comp-text-secondary)]'
                  }`}
                >
                  {theme}
                </span>
              </button>
            ))}
          </div>
        </SectionCard>
        ) : null}

        {/* Data & Export */}
        <SectionCard title="Data & Export">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[var(--comp-border)] py-2">
              <div>
                <p className="text-sm font-medium text-[var(--comp-text-primary)]">
                  Export My Data
                </p>
                <p className="mt-0.5 text-xs text-[var(--comp-text-muted)]">
                  Download all your registrations, submissions, and certificates
                </p>
              </div>
              <button type="button" className="comp-btn-ghost" onClick={handleExport}>
                <Download size={14} aria-hidden="true" /> Export
              </button>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-[var(--comp-text-primary)]">
                  Clear cached data
                </p>
                <p className="mt-0.5 text-xs text-[var(--comp-text-muted)]">
                  Drop locally cached ERP and event responses and refetch from the server
                </p>
              </div>
              <button
                type="button"
                className="comp-btn-ghost"
                style={{ color: 'var(--status-live-text)' }}
                onClick={handleClearCache}
              >
                Clear
              </button>
            </div>
          </div>
        </SectionCard>

        {/* Save */}
        <div className="flex items-center justify-end gap-3">
          <p aria-live="polite" className="mr-auto text-sm text-[var(--comp-text-muted)]">{status}</p>
          <button type="button" className="comp-btn-ghost" onClick={handleReset}>Reset to Defaults</button>
          <button type="button" className="comp-btn-primary" onClick={handleSave} disabled={!isDirty}>
            {isDirty ? 'Save Preferences' : 'Saved'}
          </button>
        </div>
      </div>
    </ErpPageShell>
  );
}
