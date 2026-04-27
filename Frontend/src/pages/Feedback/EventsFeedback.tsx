import { useState } from "react";
import { ErpPageShell, SectionCard, EmptyStateCard } from "../../components/erp/ErpPrimitives";
import { readStore, appendToStore, generateId } from "../../lib/localStore";

interface FeedbackEntry {
  id: string;
  eventName: string;
  rating: number;
  comment: string;
  submittedAt: string;
}

interface EventOption {
  id: string;
  name: string;
}

const EVENTS_STORE = "feedback-events-list";
const FEEDBACK_STORE = "events-feedback";

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onChange(star)}
          className={`text-2xl transition ${star <= value ? "text-amber-400" : "text-slate-300 hover:text-amber-300"}`}>★</button>
      ))}
    </div>
  );
}

export default function EventsFeedback() {
  const [eventOptions, setEventOptions] = useState<EventOption[]>(() => readStore<EventOption>(EVENTS_STORE));
  const [selectedEvent, setSelectedEvent] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [entries, setEntries] = useState<FeedbackEntry[]>(() => readStore<FeedbackEntry>(FEEDBACK_STORE));
  const [message, setMessage] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [newEventName, setNewEventName] = useState("");

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;
    const event: EventOption = { id: generateId("EVTOPT"), name: newEventName.trim() };
    appendToStore(EVENTS_STORE, event);
    setEventOptions(readStore<EventOption>(EVENTS_STORE));
    setNewEventName("");
    setMessage(`Event "${event.name}" added to feedback list.`);
    setTimeout(() => setMessage(""), 3000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setMessage("Please select a rating before submitting.");
      setTimeout(() => setMessage(""), 3000);
      return;
    }
    if (!selectedEvent) {
      setMessage("Please select an event.");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    const entry: FeedbackEntry = {
      id: generateId("EFB"),
      eventName: selectedEvent,
      rating,
      comment: comment.trim(),
      submittedAt: new Date().toLocaleString(),
    };

    appendToStore(FEEDBACK_STORE, entry);
    setEntries(readStore<FeedbackEntry>(FEEDBACK_STORE));
    setRating(0);
    setComment("");
    setMessage("Feedback submitted successfully!");
    setTimeout(() => setMessage(""), 4000);
  };

  return (
    <ErpPageShell title="Events Feedback" source="Internal API">
      {message && (
        <div className={`rounded-xl border px-3 py-2 text-sm font-medium ${
          message.includes("success") || message.includes("added")
            ? "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]"
            : "border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]"
        }`}>{message}</div>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={() => setShowAdmin((v) => !v)}
          className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
            showAdmin ? "border-[var(--comp-accent)] bg-[var(--comp-accent)] text-white" : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:border-[var(--comp-accent)]"
          }`}>
          {showAdmin ? "Hide Admin" : "⚙ Admin: Manage Events"}
        </button>
      </div>

      {showAdmin && (
        <SectionCard title="Add Event to Feedback List">
          <form onSubmit={handleAddEvent} className="flex gap-2">
            <input value={newEventName} onChange={(e) => setNewEventName(e.target.value)} placeholder="Event name..." required
              className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]" />
            <button type="submit" className="shrink-0 rounded-full bg-[var(--comp-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)]">
              Add Event
            </button>
          </form>
          {eventOptions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {eventOptions.map((e) => (
                <span key={e.id} className="rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--comp-text-primary)]">{e.name}</span>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard title="Submit Event Feedback">
        {eventOptions.length === 0 ? (
          <EmptyStateCard message='No events available for feedback. An admin needs to add events using the "Admin: Manage Events" button.' />
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div>
              <label htmlFor="feedback-event" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Select Event</label>
              <select id="feedback-event" value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]">
                <option value="">— Select an event —</option>
                {eventOptions.map((event) => <option key={event.id} value={event.name}>{event.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Overall Rating</label>
              <StarRating value={rating} onChange={setRating} />
            </div>
            <div>
              <label htmlFor="feedback-comment" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Comments (optional)</label>
              <textarea id="feedback-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share your experience..." rows={3}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]" />
            </div>
            <div>
              <button type="submit" className="rounded-full bg-[var(--comp-accent)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)]">Submit Feedback</button>
            </div>
          </form>
        )}
      </SectionCard>

      <SectionCard title="Feedback History">
        {entries.length === 0 ? (
          <EmptyStateCard message="No feedback submitted yet." />
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--comp-text-primary)]">{entry.eventName}</h3>
                    <div className="mt-1 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className={`text-sm ${star <= entry.rating ? "text-amber-400" : "text-slate-300"}`}>★</span>
                      ))}
                      <span className="ml-1 text-xs text-[var(--text-secondary)]">{entry.rating}/5</span>
                    </div>
                    {entry.comment && <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{entry.comment}</p>}
                  </div>
                  <div className="text-right text-xs text-[var(--text-secondary)]">{entry.submittedAt}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </ErpPageShell>
  );
}
