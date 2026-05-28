/**
 * Settings.tsx — /settings
 * User preferences and account settings with event notification controls,
 * privacy toggles, theme selection, and data export.
 */

import { useState } from 'react';
import { ErpPageShell, SectionCard } from '../../components/erp/ErpPrimitives';

/* ---------- Sub-components ---------- */

function ToggleSwitch({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  const labelId = `toggle-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const descriptionId = `${labelId}-description`;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--comp-border)',
      gap: 'var(--space-md)',
    }}>
      <div id={labelId}>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500, color: 'var(--comp-text-primary)' }}>{label}</p>
        {description && (
          <p id={descriptionId} style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--comp-text-muted)' }}>{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        style={{
          width: 40, height: 22, borderRadius: 11,
          background: checked ? 'var(--comp-accent)' : 'var(--comp-border)',
          position: 'relative', flexShrink: 0,
          transition: 'background 0.2s ease', cursor: 'pointer',
        }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: '50%',
          background: 'var(--background)', position: 'absolute', top: 3,
          left: checked ? 21 : 3,
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }} />
      </button>
    </div>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', maxWidth: 720 }}>

        <div>
          <h1 className="comp-heading-lg" style={{ margin: 0 }}>Settings & Preferences</h1>
          <p className="comp-body" style={{ margin: '4px 0 0' }}>
            Manage your notifications, privacy, and display preferences
          </p>
        </div>

        {/* Event Notifications */}
        <SectionCard title="Event Notifications">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
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
          <p className="comp-body" style={{ margin: '0 0 var(--space-md)', fontSize: '0.82rem' }}>
            Choose how the platform looks to you
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            {(['system', 'light', 'dark'] as const).map((theme) => (
              <button
                key={theme}
                onClick={() => setSelectedTheme(theme)}
                style={{
                  flex: 1, padding: 'var(--space-md)',
                  borderRadius: 12,
                  border: `2px solid ${selectedTheme === theme ? 'var(--comp-accent)' : 'var(--comp-border)'}`,
                  background: selectedTheme === theme ? 'var(--comp-accent-light)' : 'var(--comp-surface)',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-xs)',
                }}
                aria-pressed={selectedTheme === theme}
              >
                <span style={{ fontSize: '1.5rem' }}>
                  {theme === 'system' ? '💻' : theme === 'light' ? '☀️' : '🌙'}
                </span>
                <span style={{
                  fontSize: '0.82rem', fontWeight: 600,
                  color: selectedTheme === theme ? 'var(--comp-accent)' : 'var(--comp-text-secondary)',
                  textTransform: 'capitalize',
                }}>
                  {theme}
                </span>
              </button>
            ))}
          </div>
        </SectionCard>

        {/* Data & Export */}
        <SectionCard title="Data & Export">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--comp-border)',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500, color: 'var(--comp-text-primary)' }}>
                  Export My Data
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--comp-text-muted)' }}>
                  Download all your registrations, submissions, and certificates
                </p>
              </div>
              <button className="comp-btn-ghost" style={{ fontSize: '0.82rem' }}>↓ Export</button>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: 'var(--space-sm) 0',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500, color: 'var(--comp-text-primary)' }}>
                  Clear Event Cache
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--comp-text-muted)' }}>
                  Reset locally cached event data for a fresh sync
                </p>
              </div>
              <button className="comp-btn-ghost" style={{ fontSize: '0.82rem', color: 'var(--status-live-text)' }}>Clear</button>
            </div>
          </div>
        </SectionCard>

        {/* Save */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
          <button className="comp-btn-ghost" style={{ fontSize: '0.85rem' }}>Reset to Defaults</button>
          <button className="comp-btn-primary" style={{ fontSize: '0.85rem' }}>Save Preferences</button>
        </div>
      </div>
    </ErpPageShell>
  );
}
