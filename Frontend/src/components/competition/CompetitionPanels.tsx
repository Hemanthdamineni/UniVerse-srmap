
// ── JudgeNotes ─────────────────────────────────────────────────────

/**
 * JudgeNotes.tsx — Private notes panel for judges during evaluation.
 * Collapsible, auto-saves, and persists per-submission.
 */

import { useState, useEffect, useRef } from 'react';

interface JudgeNotesProps {
  submissionId: string;
  initialNotes?: string;
  onSave?: (notes: string) => void;
}

export function JudgeNotes({ submissionId, initialNotes = '', onSave }: JudgeNotesProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on submission change
  useEffect(() => {
    setNotes(initialNotes);
    setSaved(false);
  }, [submissionId, initialNotes]);

  // Auto-save debounce
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (notes !== initialNotes && onSave) {
        onSave(notes);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    }, 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [notes, initialNotes, onSave]);

  return (
    <div
      style={{
        background: 'var(--comp-surface)',
        border: '1px solid var(--comp-border)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          padding: 'var(--space-sm) var(--space-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--comp-text-primary)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
        }}
        aria-expanded={expanded}
        aria-label="Toggle private notes"
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          📝 Private Notes
          {notes.length > 0 && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--comp-accent)', flexShrink: 0,
            }} />
          )}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--comp-text-muted)' }}>
          {saved ? '✓ Saved' : expanded ? '▼' : '▶'}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0 var(--space-md) var(--space-md)', borderTop: '1px solid var(--comp-border)' }}>
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
            placeholder="Your private notes about this submission (not shared with participants)..."
            style={{
              width: '100%',
              minHeight: 100,
              padding: 'var(--space-sm)',
              border: '1px solid var(--comp-border)',
              borderRadius: 6,
              background: 'var(--comp-surface)',
              color: 'var(--comp-text-primary)',
              fontSize: 'var(--text-sm)',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
              marginTop: 'var(--space-sm)',
            }}
            aria-label="Private notes for this submission"
          />
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--comp-text-muted)' }}>
            {notes.length} characters · Auto-saves after 1 second
          </p>
        </div>
      )}
    </div>
  );
}


// ── ReviewHistory ─────────────────────────────────────────────────────

/**
 * ReviewHistory.tsx — Timeline of past review actions for a submission.
 * Shows who evaluated, when, what score, and decision changes.
 */

interface ReviewEvent {
  actor: string;
  action: string;
  timestamp: string;
  details?: string;
  score?: number;
}

interface ReviewHistoryProps {
  events: ReviewEvent[];
}

export function ReviewHistory({ events }: ReviewHistoryProps) {
  if (events.length === 0) {
    return (
      <div style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
        <p className="comp-body" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
          No review history yet.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        position: 'relative',
      }}
      role="list"
      aria-label="Review history"
    >
      {/* Timeline line */}
      <div style={{
        position: 'absolute',
        left: 15,
        top: 16,
        bottom: 16,
        width: 2,
        background: 'var(--comp-border)',
      }} />

      {events.map((event, i) => (
        <div
          key={`${event.actor}-${event.timestamp}-${i}`}
          role="listitem"
          style={{
            display: 'flex',
            gap: 'var(--space-sm)',
            padding: 'var(--space-sm) 0',
            position: 'relative',
          }}
        >
          {/* Timeline dot */}
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: i === 0 ? 'var(--comp-accent)' : 'var(--comp-border-strong)',
            border: '2px solid var(--comp-surface)',
            flexShrink: 0,
            marginTop: 4,
            marginLeft: 11,
            position: 'relative',
            zIndex: 1,
          }} />

          <div style={{ flex: 1, marginLeft: 'var(--space-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--comp-text-primary)' }}>
                {event.actor}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--comp-text-muted)' }}>
                {new Date(event.timestamp).toLocaleString('en-IN', {
                  month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--comp-text-secondary)' }}>
              {event.action}
              {event.score !== undefined && (
                <span style={{ fontWeight: 600, color: 'var(--comp-accent)', marginLeft: 4 }}>
                  Score: {event.score}
                </span>
              )}
            </p>
            {event.details && (
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--comp-text-muted)', fontStyle: 'italic' }}>
                "{event.details}"
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}


// ── AuditHistoryPanel ─────────────────────────────────────────────────────

/**
 * AuditHistoryPanel.tsx — Compact audit log for evaluation/shortlist/publish events.
 * Used in EvaluationPage, OrganizerDashboard, and ShortlistPage.
 */

interface AuditEvent {
  label: string;   // "Evaluated by", "Shortlist applied", "Results published"
  actor?: string;  // register number
  at: string;      // ISO timestamp
}

interface AuditHistoryPanelProps {
  events: AuditEvent[];
}

function formatAuditTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AuditHistoryPanel({ events }: AuditHistoryPanelProps) {
  if (events.length === 0) return null;

  return (
    <div
      aria-label="History"
      style={{
        borderTop: '1px solid var(--comp-border)',
        paddingTop: 'var(--space-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <p className="comp-label" style={{ marginBottom: 4 }}>History</p>
      {events.map((event, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 'var(--text-sm)',
            color: 'var(--comp-text-secondary)',
          }}
        >
          <span style={{ color: 'var(--status-open-text)' }} aria-hidden="true">✓</span>
          <span>
            {event.label}
            {event.actor && <strong> {event.actor}</strong>}
          </span>
          <span style={{ color: 'var(--comp-text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {formatAuditTime(event.at)}
          </span>
        </div>
      ))}
    </div>
  );
}

