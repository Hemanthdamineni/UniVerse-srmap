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
          fontSize: '0.85rem',
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
        <span style={{ fontSize: '0.75rem', color: 'var(--comp-text-muted)' }}>
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
              fontSize: '0.85rem',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
              marginTop: 'var(--space-sm)',
            }}
            aria-label="Private notes for this submission"
          />
          <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--comp-text-muted)' }}>
            {notes.length} characters · Auto-saves after 1 second
          </p>
        </div>
      )}
    </div>
  );
}
