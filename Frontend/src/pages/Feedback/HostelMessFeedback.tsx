import { useState } from "react";
import { ErpPageShell, SectionCard, EmptyStateCard } from "../../components/erp/ErpPrimitives";
import { readStore, appendToStore, generateId } from "../../lib/localStore";

const CATEGORIES = ["Food Quality", "Cleanliness", "Facilities", "Staff Behavior", "Maintenance"] as const;
type Category = (typeof CATEGORIES)[number];

interface FeedbackEntry {
  id: string;
  ratings: Record<Category, number>;
  comment: string;
  submittedAt: string;
}

const STORE_KEY = "hostel-mess-feedback";

function StarRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3">
      <span className="text-sm font-medium text-[var(--comp-text-primary)]">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" onClick={() => onChange(star)}
            className={`text-xl transition ${star <= value ? "text-amber-400" : "text-slate-300 hover:text-amber-300"}`}>★</button>
        ))}
      </div>
    </div>
  );
}

function averageRating(ratings: Record<Category, number>): string {
  const values = Object.values(ratings).filter((v) => v > 0);
  if (values.length === 0) return "-";
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
}

export default function HostelMessFeedback() {
  const [ratings, setRatings] = useState<Record<Category, number>>(
    Object.fromEntries(CATEGORIES.map((cat) => [cat, 0])) as Record<Category, number>
  );
  const [comment, setComment] = useState("");
  const [entries, setEntries] = useState<FeedbackEntry[]>(() => readStore<FeedbackEntry>(STORE_KEY));
  const [message, setMessage] = useState("");

  const updateRating = (category: Category, value: number) => {
    setRatings((prev) => ({ ...prev, [category]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasAnyRating = Object.values(ratings).some((v) => v > 0);
    if (!hasAnyRating) {
      setMessage("Please rate at least one category before submitting.");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    const entry: FeedbackEntry = {
      id: generateId("HMF"),
      ratings: { ...ratings },
      comment: comment.trim(),
      submittedAt: new Date().toLocaleString(),
    };

    appendToStore(STORE_KEY, entry);
    setEntries(readStore<FeedbackEntry>(STORE_KEY));
    setRatings(Object.fromEntries(CATEGORIES.map((cat) => [cat, 0])) as Record<Category, number>);
    setComment("");
    setMessage("Feedback submitted successfully!");
    setTimeout(() => setMessage(""), 4000);
  };

  return (
    <ErpPageShell title="Hostel & Mess Feedback" source="Internal API">
      {message && (
        <div className={`rounded-xl border px-3 py-2 text-sm font-medium ${
          message.includes("success") ? "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]" : "border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]"
        }`}>{message}</div>
      )}

      <SectionCard title="Rate Your Experience">
        <form onSubmit={handleSubmit} className="space-y-3">
          {CATEGORIES.map((category) => (
            <StarRow key={category} label={category} value={ratings[category]} onChange={(v) => updateRating(category, v)} />
          ))}
          <div className="pt-2">
            <label htmlFor="hostel-comment" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Additional Comments (optional)</label>
            <textarea id="hostel-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Any specific feedback about the hostel or mess services..." rows={3}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]" />
          </div>
          <div>
            <button type="submit" className="rounded-full bg-[var(--comp-accent)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)]">Submit Feedback</button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Previous Submissions">
        {entries.length === 0 ? (
          <EmptyStateCard message="No feedback submitted yet. Rate the categories above to share your experience." />
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">{entry.id}</span>
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] px-2.5 py-0.5 text-xs font-bold text-[var(--warning)]">
                        Avg: {averageRating(entry.ratings)} ★
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-[var(--text-secondary)] sm:grid-cols-2 lg:grid-cols-3">
                      {CATEGORIES.map((cat) => (
                        <div key={cat}>{cat}: {"★".repeat(entry.ratings[cat])}{"☆".repeat(5 - entry.ratings[cat])}</div>
                      ))}
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
