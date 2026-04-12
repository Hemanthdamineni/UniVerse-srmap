/**
 * NotificationsPage.tsx — /events/notifications
 * Full-page notification center for event updates.
 */

import { ErpPageShell } from '../../components/erp/ErpPrimitives';
import { NotificationCenter } from '../../components/competition/NotificationCenter';

export default function NotificationsPage() {
  return (
    <ErpPageShell title="Notifications" source="Internal API" isLoading={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        <p className="comp-body">
          Competition updates — shortlists, published results, round openings, and deadline reminders.
        </p>
        {/* The NotificationCenter component handles its own fetch */}
        <NotificationCenter />
      </div>
    </ErpPageShell>
  );
}
