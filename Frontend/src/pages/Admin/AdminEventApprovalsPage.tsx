/**
 * AdminEventApprovalsPage.tsx — /admin/event-approvals
 * Queue for reviewing and approving/rejecting proposed events.
 */

import { useEffect, useState, useCallback } from 'react';
import { ErpPageShell } from '../../components/erp/ErpPrimitives';
import { ErrorMessage } from '../../components/competition/ErrorMessage';
import { EmptyState } from '../../components/competition/EmptyState';
import { listEvents } from '../../lib/campusApi';
import { DataToolbar } from '../../components/data/DataToolbar';

/* ---------- Types ---------- */

interface ApprovalItem {
  id: string;
  title: string;
  organizer: string;
  department: string;
  submittedDate: string;
  category: string;
  estimatedAttendees: number;
  status: 'pending' | 'approved' | 'rejected';
  priority: 'high' | 'normal' | 'low';
}

/* ---------- Main Page ---------- */

export default function AdminEventApprovalsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await listEvents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const items: ApprovalItem[] = [
    { id: 'ap1', title: 'Annual Hackathon 2025', organizer: 'CS Society', department: 'Computer Science', submittedDate: new Date(Date.now() - 86400000).toISOString(), category: 'Technical', estimatedAttendees: 500, status: 'pending', priority: 'high' },
    { id: 'ap2', title: 'Spring Art Exhibition', organizer: 'Fine Arts Club', department: 'Visual Arts', submittedDate: new Date(Date.now() - 172800000).toISOString(), category: 'Cultural', estimatedAttendees: 200, status: 'pending', priority: 'normal' },
    { id: 'ap3', title: 'Business Plan Competition', organizer: 'Entrepreneurship Cell', department: 'Business School', submittedDate: new Date(Date.now() - 259200000).toISOString(), category: 'Academic', estimatedAttendees: 150, status: 'approved', priority: 'normal' },
    { id: 'ap4', title: 'Music Night', organizer: 'Cultural Committee', department: 'Student Affairs', submittedDate: new Date(Date.now() - 345600000).toISOString(), category: 'Cultural', estimatedAttendees: 800, status: 'rejected', priority: 'low' },
  ];

  const filtered = items.filter((i) => filter === 'all' || i.status === filter);
  const pendingCount = items.filter((i) => i.status === 'pending').length;

  const [localItems, setLocalItems] = useState(items);
  const updateStatus = (id: string, status: 'approved' | 'rejected') => {
    setLocalItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
  };

  const displayItems = (filter === 'all' ? localItems : localItems.filter((i) => i.status === filter));

  return (
    <ErpPageShell title="Event Approvals" source="Internal API" isLoading={loading} loadingMessage="Loading approval queue...">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
          <div>
            <h1 className="comp-heading-lg" style={{ margin: 0 }}>Event Approvals Queue</h1>
            <p className="comp-body" style={{ margin: '4px 0 0' }}>
              Review and approve proposed campus events
            </p>
          </div>
          {pendingCount > 0 && (
            <span style={{
              padding: '6px 14px', borderRadius: 20,
              background: 'var(--status-pending-bg)', color: 'var(--status-pending-text)',
              fontSize: '0.82rem', fontWeight: 700,
            }}>
              {pendingCount} Pending Review
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <DataToolbar
          right={
            <>
              {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600,
                    border: `1px solid ${filter === f ? 'var(--comp-accent)' : 'var(--comp-border)'}`,
                    background: filter === f ? 'var(--comp-accent)' : 'var(--comp-surface)',
                    color: filter === f ? '#fff' : 'var(--comp-text-secondary)',
                    cursor: 'pointer', textTransform: 'capitalize',
                  }}
                >
                  {f}
                </button>
              ))}
            </>
          }
        />

        {error && <ErrorMessage message={error} onRetry={loadData} />}

        {/* Items */}
        {displayItems.length === 0 ? (
          <EmptyState icon={<span>📋</span>} title="No events to review" description="All caught up! No pending approvals." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }} role="list" aria-label="Approval requests">
            {displayItems.map((item) => (
              <div
                key={item.id}
                role="listitem"
                style={{
                  background: 'var(--comp-surface)', border: '1px solid var(--comp-border)',
                  borderLeft: `1px solid ${item.status === 'approved' ? 'var(--status-open-text)' : item.status === 'rejected' ? 'var(--status-live-text)' : 'var(--status-pending-border)'}`,
                  borderRadius: 10, padding: 'var(--space-md)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  flexWrap: 'wrap', gap: 'var(--space-sm)',
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 4 }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--comp-text-primary)' }}>{item.title}</h3>
                    {item.priority === 'high' && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'var(--status-live-bg)', color: 'var(--status-live-text)' }}>
                        HIGH PRIORITY
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--comp-text-muted)' }}>
                    {item.organizer} · {item.department} · {item.category} · Est. {item.estimatedAttendees} attendees
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--comp-text-muted)' }}>
                    Submitted {new Date(item.submittedDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                  {item.status === 'pending' ? (
                    <>
                      <button className="comp-btn-primary" onClick={() => updateStatus(item.id, 'approved')} style={{ fontSize: '0.82rem' }}>
                        ✓ Approve
                      </button>
                      <button className="comp-btn-ghost" onClick={() => updateStatus(item.id, 'rejected')} style={{ fontSize: '0.82rem', color: 'var(--status-live-text)' }} aria-label={`Reject ${item.title}`}>
                        ✕ Reject
                      </button>
                    </>
                  ) : (
                    <span style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                      background: item.status === 'approved' ? 'var(--status-open-bg)' : 'var(--status-live-bg)',
                      color: item.status === 'approved' ? 'var(--status-open-text)' : 'var(--status-live-text)',
                      textTransform: 'uppercase',
                    }}>
                      {item.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ErpPageShell>
  );
}
