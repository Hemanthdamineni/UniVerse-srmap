/**
 * NotificationToast.tsx — Notification center UI.
 * Renders whatever GET /api/events/notifications returns.
 * Shows placeholder empty state if backend not yet wired.
 */

import { useEffect, useRef, useState } from 'react';

interface NotificationItem {
  id: string;
  type:
    | 'shortlisted'
    | 'results-published'
    | 'submission-confirmed'
    | 'deadline-reminder'
    | 'round-opened';
  eventName: string;
  roundTitle?: string;
  createdAt: string;
  read: boolean;
}

const TYPE_ICON: Record<NotificationItem['type'], string> = {
  shortlisted: '🏆',
  'results-published': '📊',
  'submission-confirmed': '✅',
  'deadline-reminder': '⏰',
  'round-opened': '🚀',
};

function getNotificationMessage(n: NotificationItem): string {
  switch (n.type) {
    case 'shortlisted':
      return `You've been shortlisted${n.roundTitle ? ` for ${n.roundTitle}` : ''} of ${n.eventName}.`;
    case 'results-published':
      return `Results for ${n.roundTitle ?? 'a round'} have been published.`;
    case 'submission-confirmed':
      return `Your submission for ${n.roundTitle ?? 'a round'} was received.`;
    case 'deadline-reminder':
      return `${n.roundTitle ?? 'A round'} closes in 3 hours.`;
    case 'round-opened':
      return `${n.roundTitle ?? 'A round'} is now open for submission.`;
    default:
      return n.eventName;
  }
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function fetchNotifications(): Promise<NotificationItem[]> {
  try {
    const res = await fetch('/api/events/notifications', { credentials: 'include' });
    if (!res.ok) return [];
    if (res.status === 404) return [];
    const payload = await res.json();
    if (Array.isArray(payload)) return payload as NotificationItem[];
    if (
      payload &&
      typeof payload === 'object' &&
      Array.isArray((payload as { data?: unknown }).data)
    ) {
      return (payload as { data: NotificationItem[] }).data;
    }
    return [];
  } catch {
    return [];
  }
}

interface NotificationToastProps {
  /** External notification count badge (e.g., from sidebar) */
  standalone?: boolean;
}

export function NotificationCenter(_props: NotificationToastProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchNotifications().then(setNotifications);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: 'var(--status-live-text)',
              color: '#fff',
              borderRadius: '50%',
              width: 16,
              height: 16,
              fontSize: '0.6rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Notification center"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            width: 320,
            maxHeight: 400,
            overflowY: 'auto',
            background: 'var(--comp-surface)',
            border: '1px solid var(--comp-border)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 100,
          }}
        >
          <div
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              borderBottom: '1px solid var(--comp-border)',
              fontWeight: 600,
              color: 'var(--comp-text-primary)',
              fontSize: '0.875rem',
            }}
          >
            Notifications
          </div>
          {notifications.length === 0 ? (
            <p
              className="comp-body"
              style={{ textAlign: 'center', padding: 'var(--space-lg)', margin: 0 }}
            >
              No notifications yet.
            </p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  display: 'flex',
                  gap: 'var(--space-sm)',
                  padding: 'var(--space-sm) var(--space-md)',
                  borderBottom: '1px solid var(--comp-border)',
                  background: n.read ? 'transparent' : 'var(--comp-accent-light)',
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: '1rem', marginTop: 1 }} aria-hidden="true">
                  {TYPE_ICON[n.type]}
                </span>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.8rem',
                      color: 'var(--comp-text-primary)',
                      lineHeight: 1.4,
                    }}
                  >
                    {getNotificationMessage(n)}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.7rem',
                      color: 'var(--comp-text-muted)',
                      marginTop: 2,
                    }}
                  >
                    {formatRelativeTime(n.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
