/**
 * CreateEventPage.tsx — /events/create
 *
 * Two modes:
 * - Quick Mode: single-step form (title, category, start/end, description)
 * - Full Mode: 4-step form (Basic Info → Competition Config → Rounds → Review)
 *
 * Tracks mode selection for analytics.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErpPageShell } from '../../components/erp/ErpPrimitives';
import { createEvent } from '../../lib/campusApi';
import { track } from '../../lib/analytics';
import { ErrorMessage } from '../../components/competition/ErrorMessage';

type Mode = 'select' | 'quick' | 'full';
type FullStep = 1 | 2 | 3 | 4;

const CATEGORIES = ['Technical', 'Cultural', 'Sports', 'Academic', 'Workshop', 'Other'];

interface QuickForm {
  title: string;
  category: string;
  startAt: string;
  endAt: string;
  description: string;
  venue: string;
}

export default function CreateEventPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('select');
  const [step, setStep] = useState<FullStep>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick form state
  const [quick, setQuick] = useState<QuickForm>({
    title: '', category: 'Technical', startAt: '', endAt: '', description: '', venue: '',
  });

  // Full form basic state
  const [basic, setBasic] = useState({ title: '', category: 'Technical', startAt: '', endAt: '', description: '', venue: '' });
  const [isCompetition, setIsCompetition] = useState(false);
  const [submissionScope, setSubmissionScope] = useState<'individual' | 'team'>('individual');
  const [rounds, setRounds] = useState<{ title: string; submissionDeadline: string; maxResubmissions: number; evaluationCriteria?: { label: string; maxScore: number }[] }>([{ title: 'Round 1', submissionDeadline: '', maxResubmissions: 1 }]);

  function fieldStyle(hasError?: boolean): React.CSSProperties {
    return {
      width: '100%',
      padding: '8px 12px',
      border: `1px solid ${hasError ? 'var(--deadline-urgent)' : 'var(--comp-border)'}`,
      borderRadius: 8,
      background: 'var(--comp-surface)',
      color: 'var(--comp-text-primary)',
      fontSize: '0.875rem',
      outline: 'none',
      boxSizing: 'border-box',
    };
  }

  async function submitQuick() {
    if (!quick.title.trim() || !quick.startAt || !quick.endAt) {
      setError('Title, Start, and End dates are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createEvent({
        title: quick.title.trim(),
        category: quick.category,
        startAt: quick.startAt,
        endAt: quick.endAt,
        description: quick.description.trim(),
        venue: quick.venue.trim(),
      });
      const createdEvent = Array.isArray(created) ? created[0] : created;
      const id = (createdEvent as { id?: string }).id;
      track('create_event_completed', { mode: 'quick' });
      if (id) navigate(`/events/${encodeURIComponent(id)}`);
      else navigate('/events/my-created');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create event.');
    } finally {
      setBusy(false);
    }
  }

  async function submitFull() {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        ...basic,
        title: basic.title.trim(),
        description: basic.description.trim(),
        venue: basic.venue.trim(),
      };
      if (isCompetition) {
        payload.competitionConfig = { isCompetition: true, submissionScope, rounds };
      }
      const created = await createEvent(payload);
      const createdEvent = Array.isArray(created) ? created[0] : created;
      const id = (createdEvent as { id?: string }).id;
      track('create_event_completed', { mode: 'full' });
      if (id) navigate(`/events/${encodeURIComponent(id)}/manage`);
      else navigate('/events/my-created');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create event.');
    } finally {
      setBusy(false);
    }
  }

  function addRound() {
    setRounds((prev) => [...prev, { title: `Round ${prev.length + 1}`, submissionDeadline: '', maxResubmissions: 1 }]);
  }

  function applySimpleDefaults() {
    setRounds([{
      title: 'Round 1',
      submissionDeadline: basic.endAt || '',
      maxResubmissions: 5,
      evaluationCriteria: [{ label: 'Overall', maxScore: 30 }]
    }]);
  }

  return (
    <ErpPageShell title="Create Event" source="Internal API" isLoading={false}>
      <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {error && <ErrorMessage message={error} onRetry={() => setError(null)} preservedInput />}

        {/* Mode selection */}
        {mode === 'select' && (
          <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setMode('quick'); track('create_event_quick_mode'); }}
              aria-label="Quick mode"
              style={{
                flex: '1 1 260px',
                padding: 'var(--space-lg)',
                border: '2px solid var(--comp-border)',
                borderRadius: 12,
                background: 'var(--comp-surface)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--comp-accent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--comp-border)'; }}
            >
              <p className="comp-heading-lg" style={{ margin: '0 0 6px' }}>⚡ Quick Mode</p>
              <p className="comp-body" style={{ margin: 0 }}>Basic details only. Takes 1 minute. Best for simple events.</p>
            </button>
            <button
              onClick={() => { setMode('full'); track('create_event_full_mode'); }}
              aria-label="Full mode"
              style={{
                flex: '1 1 260px',
                padding: 'var(--space-lg)',
                border: '2px solid var(--comp-border)',
                borderRadius: 12,
                background: 'var(--comp-accent-light)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--comp-accent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--comp-border)'; }}
            >
              <p className="comp-heading-lg" style={{ margin: '0 0 6px' }}>🏆 Full Mode</p>
              <p className="comp-body" style={{ margin: 0 }}>Complete setup with competition rounds, criteria, and team config.</p>
            </button>
          </div>
        )}

        {/* Quick mode form */}
        {mode === 'quick' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <h2 className="comp-heading-lg">Quick Event Setup</h2>

            <div>
              <label className="comp-label" style={{ display: 'block', marginBottom: 4 }}>Event Title *</label>
              <input
                style={fieldStyle(!quick.title)}
                value={quick.title}
                onChange={(e) => setQuick((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Code Clash 2026"
                aria-label="Event title"
                aria-required="true"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
              <div>
                <label className="comp-label" style={{ display: 'block', marginBottom: 4 }}>Category</label>
                <select
                  style={fieldStyle()}
                  value={quick.category}
                  onChange={(e) => setQuick((p) => ({ ...p, category: e.target.value }))}
                  aria-label="Event category"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="comp-label" style={{ display: 'block', marginBottom: 4 }}>Venue</label>
                <input
                  style={fieldStyle()}
                  value={quick.venue}
                  onChange={(e) => setQuick((p) => ({ ...p, venue: e.target.value }))}
                  placeholder="e.g. Main Auditorium / Online"
                  aria-label="Venue"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
              <div>
                <label className="comp-label" style={{ display: 'block', marginBottom: 4 }}>Starts *</label>
                <input
                  type="datetime-local"
                  style={fieldStyle(!quick.startAt)}
                  value={quick.startAt}
                  onChange={(e) => setQuick((p) => ({ ...p, startAt: e.target.value }))}
                  aria-label="Start date and time"
                  aria-required="true"
                />
              </div>
              <div>
                <label className="comp-label" style={{ display: 'block', marginBottom: 4 }}>Ends *</label>
                <input
                  type="datetime-local"
                  style={fieldStyle(!quick.endAt)}
                  value={quick.endAt}
                  onChange={(e) => setQuick((p) => ({ ...p, endAt: e.target.value }))}
                  aria-label="End date and time"
                  aria-required="true"
                />
              </div>
            </div>

            <div>
              <label className="comp-label" style={{ display: 'block', marginBottom: 4 }}>Description</label>
              <textarea
                style={{ ...fieldStyle(), resize: 'vertical', minHeight: 80 }}
                value={quick.description}
                onChange={(e) => setQuick((p) => ({ ...p, description: e.target.value }))}
                placeholder="What is this event about?"
                aria-label="Event description"
                rows={4}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button
                onClick={() => void submitQuick()}
                disabled={busy}
                className="comp-btn-primary"
                aria-label="Create event"
              >
                {busy ? 'Creating...' : '⚡ Create Event'}
              </button>
              <button onClick={() => setMode('select')} className="comp-btn-ghost">
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* Full mode — 4-step form */}
        {mode === 'full' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {/* Step indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {[1, 2, 3, 4].map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: step >= s ? 'var(--comp-accent)' : 'var(--comp-border)',
                      color: step >= s ? '#fff' : 'var(--comp-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {s}
                  </div>
                  {i < 3 && (
                    <div style={{ width: 60, height: 2, background: step > s ? 'var(--comp-accent)' : 'var(--comp-border)' }} />
                  )}
                </div>
              ))}
              <p className="comp-label" style={{ marginLeft: 'var(--space-sm)' }}>
                {['Basic Info', 'Competition Config', 'Rounds', 'Review'][step - 1]}
              </p>
            </div>

            {/* Step 1: Basic Info */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div>
                  <label className="comp-label" style={{ display: 'block', marginBottom: 4 }}>Event Title *</label>
                  <input style={fieldStyle()} value={basic.title} onChange={(e) => setBasic((p) => ({ ...p, title: e.target.value }))} aria-label="Event title" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
                  <div>
                    <label className="comp-label" style={{ display: 'block', marginBottom: 4 }}>Category</label>
                    <select style={fieldStyle()} value={basic.category} onChange={(e) => setBasic((p) => ({ ...p, category: e.target.value }))} aria-label="Category">
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="comp-label" style={{ display: 'block', marginBottom: 4 }}>Venue</label>
                    <input style={fieldStyle()} value={basic.venue} onChange={(e) => setBasic((p) => ({ ...p, venue: e.target.value }))} aria-label="Venue" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
                  <div>
                    <label className="comp-label" style={{ display: 'block', marginBottom: 4 }}>Starts *</label>
                    <input type="datetime-local" style={fieldStyle()} value={basic.startAt} onChange={(e) => setBasic((p) => ({ ...p, startAt: e.target.value }))} aria-label="Start date" />
                  </div>
                  <div>
                    <label className="comp-label" style={{ display: 'block', marginBottom: 4 }}>Ends *</label>
                    <input type="datetime-local" style={fieldStyle()} value={basic.endAt} onChange={(e) => setBasic((p) => ({ ...p, endAt: e.target.value }))} aria-label="End date" />
                  </div>
                </div>
                <div>
                  <label className="comp-label" style={{ display: 'block', marginBottom: 4 }}>Description</label>
                  <textarea style={{ ...fieldStyle(), resize: 'vertical', minHeight: 80 }} value={basic.description} onChange={(e) => setBasic((p) => ({ ...p, description: e.target.value }))} rows={3} aria-label="Description" />
                </div>
              </div>
            )}

            {/* Step 2: Competition Config */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isCompetition}
                      onChange={(e) => setIsCompetition(e.target.checked)}
                      aria-label="This is a competition"
                    />
                    <span className="comp-heading-md">This is a competition</span>
                  </label>
                  <p className="comp-body" style={{ margin: '4px 0 0 24px' }}>
                    Enables submission rounds, evaluation criteria, shortlisting, and leaderboards.
                  </p>
                </div>
                {isCompetition && (
                  <div>
                    <p className="comp-label" style={{ marginBottom: 8 }}>Submission Scope</p>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                      {(['individual', 'team'] as const).map((scope) => (
                        <button
                          key={scope}
                          onClick={() => setSubmissionScope(scope)}
                          aria-pressed={submissionScope === scope}
                          style={{
                            padding: '8px 18px',
                            border: `2px solid ${submissionScope === scope ? 'var(--comp-accent)' : 'var(--comp-border)'}`,
                            borderRadius: 8,
                            background: submissionScope === scope ? 'var(--comp-accent)' : 'var(--comp-surface)',
                            color: submissionScope === scope ? '#fff' : 'var(--comp-text-secondary)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          {scope}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Rounds Builder */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {!isCompetition ? (
                  <p className="comp-body">This event doesn't have rounds. Skip to Review.</p>
                ) : (
                  <>
                    {rounds.length === 1 && !rounds[0].evaluationCriteria && (
                      <div
                        style={{
                          background: 'var(--status-pending-bg)',
                          border: '2px solid var(--comp-accent)',
                          borderRadius: 8,
                          padding: 'var(--space-md)',
                          color: 'var(--comp-text-primary)'
                        }}
                      >
                        <p className="comp-heading-md" style={{ margin: '0 0 6px' }}>💡 Start simple — you can always add more rounds later.</p>
                        <p className="comp-body" style={{ margin: '0 0 12px' }}>One round with one evaluation criterion is enough to ship.</p>
                        <button
                          onClick={applySimpleDefaults}
                          className="comp-btn-primary"
                          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                          aria-label="Start with Round 1 only"
                        >
                          Start with Round 1 only ↓
                        </button>
                      </div>
                    )}
                    {rounds.map((round, i) => (
                      <div
                        key={i}
                        style={{
                          background: 'var(--comp-surface)',
                          border: '1px solid var(--comp-border)',
                          borderRadius: 10,
                          padding: 'var(--space-md)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 'var(--space-sm)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p className="comp-heading-md" style={{ margin: 0 }}>Round {i + 1}</p>
                          {rounds.length > 1 && (
                            <button
                              onClick={() => setRounds((prev) => prev.filter((_, idx) => idx !== i))}
                              style={{ background: 'none', border: 'none', color: 'var(--deadline-urgent)', cursor: 'pointer', fontSize: '0.8rem' }}
                              aria-label={`Remove round ${i + 1}`}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div>
                          <label className="comp-label" style={{ display: 'block', marginBottom: 4 }}>Round Title</label>
                          <input
                            style={fieldStyle()}
                            value={round.title}
                            onChange={(e) => setRounds((prev) => prev.map((r, idx) => idx === i ? { ...r, title: e.target.value } : r))}
                            aria-label={`Round ${i + 1} title`}
                          />
                        </div>
                        <div>
                          <label className="comp-label" style={{ display: 'block', marginBottom: 4 }}>Submission Deadline</label>
                          <input
                            type="datetime-local"
                            style={fieldStyle()}
                            value={round.submissionDeadline}
                            onChange={(e) => setRounds((prev) => prev.map((r, idx) => idx === i ? { ...r, submissionDeadline: e.target.value } : r))}
                            aria-label={`Round ${i + 1} deadline`}
                          />
                        </div>
                      </div>
                    ))}
                    <button onClick={addRound} className="comp-btn-ghost" aria-label="Add round" style={{ alignSelf: 'flex-start' }}>
                      + Add Round
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div style={{ background: 'var(--comp-surface)', border: '1px solid var(--comp-border)', borderRadius: 10, padding: 'var(--space-md)' }}>
                  <p className="comp-heading-md" style={{ margin: '0 0 8px' }}>Review</p>
                  <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: '0.875rem' }}>
                    <dt className="comp-label">Title</dt><dd style={{ margin: 0, color: 'var(--comp-text-primary)' }}>{basic.title || '—'}</dd>
                    <dt className="comp-label">Category</dt><dd style={{ margin: 0, color: 'var(--comp-text-primary)' }}>{basic.category}</dd>
                    <dt className="comp-label">Starts</dt><dd style={{ margin: 0, color: 'var(--comp-text-primary)' }}>{basic.startAt || '—'}</dd>
                    <dt className="comp-label">Ends</dt><dd style={{ margin: 0, color: 'var(--comp-text-primary)' }}>{basic.endAt || '—'}</dd>
                    <dt className="comp-label">Competition</dt><dd style={{ margin: 0, color: 'var(--comp-text-primary)' }}>{isCompetition ? `Yes (${submissionScope})` : 'No'}</dd>
                    {isCompetition && <><dt className="comp-label">Rounds</dt><dd style={{ margin: 0, color: 'var(--comp-text-primary)' }}>{rounds.length}</dd></>}
                  </dl>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              {step > 1 && (
                <button onClick={() => setStep((s) => (s - 1) as FullStep)} className="comp-btn-ghost">
                  ← Back
                </button>
              )}
              {step < 4 && (
                <button onClick={() => setStep((s) => (s + 1) as FullStep)} className="comp-btn-primary">
                  Next →
                </button>
              )}
              {step === 4 && (
                <button onClick={() => void submitFull()} disabled={busy} className="comp-btn-primary">
                  {busy ? 'Creating...' : '🎉 Create Event'}
                </button>
              )}
              {mode === 'full' && step === 1 && (
                <button onClick={() => setMode('select')} className="comp-btn-ghost">
                  ← Change Mode
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ErpPageShell>
  );
}
