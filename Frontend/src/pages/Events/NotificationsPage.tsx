/**
 * NotificationsPage.tsx — /events/notifications
 * Full-page notification center for event updates.
 */

import { NotificationCenter } from '../../components/competition/NotificationCenter';
import { CompetitionPageShell } from '../../components/competition/CompetitionChrome';

export default function NotificationsPage() {
  return (
    <CompetitionPageShell
      title="Updates"
      subtitle="Competition updates, shortlist notices, results, round openings, and deadline reminders."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        <NotificationCenter />
      </div>
    </CompetitionPageShell>
  );
}
