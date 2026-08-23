/**
 * Settings.tsx — /settings
 * User preferences and account settings with event notification controls,
 * privacy toggles, theme selection, and data export.
 */

import { Download } from "lucide-react";
import { useState } from 'react';
import { ErpPageShell, SectionCard } from '../../components/erp/ErpPrimitives';

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
  // Notification preferences
  const [eventReminders, setEventReminders] = useState(true);
  const [registrationUpdates, setRegistrationUpdates] = useState(true);
  const [resultAlerts, setResultAlerts] = useState(true);
  const [organizerMessages, setOrganizerMessages] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(true);

  // Privacy
  const [profilePublic, setProfilePublic] = useState(true);
  const [showAchievements, setShowAchievements] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Appearance
  const [selectedTheme, setSelectedTheme] = useState<'system' | 'light' | 'dark'>('system');

  return (
    <ErpPageShell title="Settings" source="Internal API" isLoading={false}>
      <div className="flex max-w-[720px] flex-col gap-6">

        <p className="comp-body mt-1">
          Manage your notifications, privacy, and display preferences
        </p>

        {/* Event Notifications */}
        <SectionCard title="Event Notifications">
          <div className="flex flex-col">
            <ToggleSwitch
              checked={eventReminders}
              onChange={setEventReminders}
              label="Event Reminders"
              description="Get notified 24h and 1h before events you've registered for"
            />
            <ToggleSwitch
              checked={registrationUpdates}
              onChange={setRegistrationUpdates}
              label="Registration Updates"
              description="Status changes for your event registrations"
            />
            <ToggleSwitch
              checked={resultAlerts}
              onChange={setResultAlerts}
              label="Result Announcements"
              description="Instant alerts when competition results are published"
            />
            <ToggleSwitch
              checked={organizerMessages}
              onChange={setOrganizerMessages}
              label="Organizer Messages"
              description="Direct messages from event organizers"
            />
            <ToggleSwitch
              checked={weeklyDigest}
              onChange={setWeeklyDigest}
              label="Weekly Digest"
              description="Summary of upcoming events and campus activity"
            />
          </div>
        </SectionCard>

        {/* Privacy */}
        <SectionCard title="Privacy & Visibility">
          <div className="flex flex-col">
            <ToggleSwitch
              checked={profilePublic}
              onChange={setProfilePublic}
              label="Public Profile"
              description="Allow other students and organizers to view your profile"
            />
            <ToggleSwitch
              checked={showAchievements}
              onChange={setShowAchievements}
              label="Show Achievements"
              description="Display your badges and achievements on your public profile"
            />
            <ToggleSwitch
              checked={showLeaderboard}
              onChange={setShowLeaderboard}
              label="Leaderboard Visibility"
              description="Include your profile in faculty and department leaderboards"
            />
          </div>
        </SectionCard>

        {/* Appearance */}
        <SectionCard title="Appearance">
          <p className="comp-body mb-4 text-sm">
            Choose how the platform looks to you
          </p>
          <div className="flex gap-4">
            {(['system', 'light', 'dark'] as const).map((theme) => (
              <button
                key={theme}
                onClick={() => setSelectedTheme(theme)}
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
              <button className="comp-btn-ghost"><Download size={14} aria-hidden="true" /> Export</button>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-[var(--comp-text-primary)]">
                  Clear Event Cache
                </p>
                <p className="mt-0.5 text-xs text-[var(--comp-text-muted)]">
                  Reset locally cached event data for a fresh sync
                </p>
              </div>
              <button className="comp-btn-ghost" style={{ color: 'var(--status-live-text)' }}>Clear</button>
            </div>
          </div>
        </SectionCard>

        {/* Save */}
        <div className="flex justify-end gap-2">
          <button className="comp-btn-ghost">Reset to Defaults</button>
          <button className="comp-btn-primary">Save Preferences</button>
        </div>
      </div>
    </ErpPageShell>
  );
}
