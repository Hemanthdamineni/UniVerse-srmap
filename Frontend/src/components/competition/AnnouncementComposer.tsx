/**
 * AnnouncementComposer.tsx — Rich announcement composer for event organizers.
 * Supports subject/message input, audience targeting, and preview.
 * Matches the announcement_composer design screen.
 */

import { useState } from 'react';

interface AnnouncementComposerProps {
  onSend: (data: { subject: string; message: string; audience: string; priority: string }) => Promise<void>;
  sending?: boolean;
}

export function AnnouncementComposer({ onSend, sending = false }: AnnouncementComposerProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all');
  const [priority, setPriority] = useState('normal');
  const [preview, setPreview] = useState(false);

  const canSend = subject.trim().length > 0 && message.trim().length > 0;
  const charCount = message.length;

  const handleSend = async () => {
    if (!canSend) return;
    await onSend({ subject: subject.trim(), message: message.trim(), audience, priority });
    setSubject('');
    setMessage('');
    setPreview(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    border: '1px solid var(--comp-border)', borderRadius: 8,
    background: 'var(--comp-surface)', color: 'var(--comp-text-primary)',
    fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{
      background: 'var(--comp-surface)', border: '1px solid var(--comp-border)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: 'var(--space-md)',
        borderBottom: '1px solid var(--comp-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <h3 className="comp-heading-md" style={{ margin: 0 }}>📢 Broadcast Announcement</h3>
        <button
          className="comp-btn-ghost"
          onClick={() => setPreview(!preview)}
          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
        >
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {preview ? (
        /* Preview mode */
        <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <div style={{
            background: priority === 'urgent' ? 'var(--status-live-bg)' : 'var(--comp-accent-light)',
            border: `1px solid ${priority === 'urgent' ? 'var(--status-live-border)' : 'var(--comp-accent)'}`,
            borderRadius: 10, padding: 'var(--space-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
              {priority === 'urgent' && <span style={{ fontSize: '0.9rem' }}>🔴</span>}
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: priority === 'urgent' ? 'var(--status-live-text)' : 'var(--comp-accent)',
              }}>
                {audience === 'all' ? 'All Participants' : audience === 'finalists' ? 'Finalists Only' : 'Organizers Only'}
              </span>
            </div>
            <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--comp-text-primary)' }}>
              {subject || 'No subject'}
            </h4>
            <p className="comp-body" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {message || 'No message content.'}
            </p>
          </div>
        </div>
      ) : (
        /* Edit mode */
        <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* Subject */}
          <div>
            <label className="comp-label" htmlFor="ann-subject" style={{ display: 'block', marginBottom: 4, fontSize: '0.78rem' }}>
              Subject
            </label>
            <input
              id="ann-subject"
              style={inputStyle}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Announcement subject..."
              aria-label="Announcement subject"
            />
          </div>

          {/* Audience & Priority row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
            <div>
              <label className="comp-label" htmlFor="ann-audience" style={{ display: 'block', marginBottom: 4, fontSize: '0.78rem' }}>
                Audience
              </label>
              <select
                id="ann-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                aria-label="Select audience"
              >
                <option value="all">All Participants</option>
                <option value="finalists">Finalists Only</option>
                <option value="organizers">Organizers Only</option>
              </select>
            </div>
            <div>
              <label className="comp-label" htmlFor="ann-priority" style={{ display: 'block', marginBottom: 4, fontSize: '0.78rem' }}>
                Priority
              </label>
              <select
                id="ann-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                aria-label="Select priority"
              >
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="comp-label" htmlFor="ann-message" style={{ display: 'block', marginBottom: 4, fontSize: '0.78rem' }}>
              Message
            </label>
            <textarea
              id="ann-message"
              style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Write your announcement message..."
              aria-label="Announcement message"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--comp-text-muted)' }}>
                {charCount} characters
              </span>
              {charCount > 500 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--status-pending-text)' }}>
                  Consider keeping messages concise
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: 'var(--space-sm) var(--space-md)',
        borderTop: '1px solid var(--comp-border)',
        display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)',
      }}>
        <button
          disabled={!canSend || sending}
          onClick={() => void handleSend()}
          className="comp-btn-primary"
          style={{ fontSize: '0.85rem' }}
          aria-label="Send announcement"
        >
          {sending ? 'Sending...' : '📢 Send Announcement'}
        </button>
      </div>
    </div>
  );
}
