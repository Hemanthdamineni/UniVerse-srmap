import { useState } from "react";
import { ErpPageShell, SectionCard, EmptyStateCard } from "../../components/erp/ErpPrimitives";
import { readStore, appendToStore, generateId } from "../../lib/localStore";

const CATEGORIES = ["Punctuality", "Cleanliness", "Driver Behavior", "Route Coverage", "Safety"] as const;
type Category = (typeof CATEGORIES)[number];

interface RouteOption {
  id: string;
  name: string;
}

interface FeedbackEntry {
  id: string;
  route: string;
  ratings: Record<Category, number>;
  comment: string;
  submittedAt: string;
}

const ROUTES_STORE = "transport-routes";
const FEEDBACK_STORE = "transport-feedback";

function StarRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3">
      <span className="text-sm font-medium text-[#0A3035]">{label}</span>
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

export default function TransportFeedback() {
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>(() => readStore<RouteOption>(ROUTES_STORE));
  const [selectedRoute, setSelectedRoute] = useState("");
  const [ratings, setRatings] = useState<Record<Category, number>>(
    Object.fromEntries(CATEGORIES.map((cat) => [cat, 0])) as Record<Category, number>
  );
  const [comment, setComment] = useState("");
  const [entries, setEntries] = useState<FeedbackEntry[]>(() => readStore<FeedbackEntry>(FEEDBACK_STORE));
  const [message, setMessage] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [newRouteName, setNewRouteName] = useState("");

  const updateRating = (category: Category, value: number) => {
    setRatings((prev) => ({ ...prev, [category]: value }));
  };

  const handleAddRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteName.trim()) return;
    const route: RouteOption = { id: generateId("RTE"), name: newRouteName.trim() };
    appendToStore(ROUTES_STORE, route);
    setRouteOptions(readStore<RouteOption>(ROUTES_STORE));
    setNewRouteName("");
    setMessage(`Route "${route.name}" added.`);
    setTimeout(() => setMessage(""), 3000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasAnyRating = Object.values(ratings).some((v) => v > 0);
    if (!hasAnyRating) {
      setMessage("Please rate at least one category before submitting.");
      setTimeout(() => setMessage(""), 3000);
      return;
    }
    if (!selectedRoute) {
      setMessage("Please select a route.");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    const entry: FeedbackEntry = {
      id: generateId("TFB"),
      route: selectedRoute,
      ratings: { ...ratings },
      comment: comment.trim(),
      submittedAt: new Date().toLocaleString(),
    };

    appendToStore(FEEDBACK_STORE, entry);
    setEntries(readStore<FeedbackEntry>(FEEDBACK_STORE));
    setRatings(Object.fromEntries(CATEGORIES.map((cat) => [cat, 0])) as Record<Category, number>);
    setComment("");
    setMessage("Feedback submitted successfully!");
    setTimeout(() => setMessage(""), 4000);
  };

  return (
    <ErpPageShell title="Transport Feedback" source="Internal API">
      {message && (
        <div className={`rounded-xl border px-3 py-2 text-sm font-medium ${
          message.includes("success") || message.includes("added")
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}>{message}</div>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={() => setShowAdmin((v) => !v)}
          className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
            showAdmin ? "border-[#0A3035] bg-[#0A3035] text-white" : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:border-[#0A3035]"
          }`}>
          {showAdmin ? "Hide Admin" : "⚙ Admin: Manage Routes"}
        </button>
      </div>

      {showAdmin && (
        <SectionCard title="Add Transport Route">
          <form onSubmit={handleAddRoute} className="flex gap-2">
            <input value={newRouteName} onChange={(e) => setNewRouteName(e.target.value)} placeholder="Route name (e.g. Route 1 — Campus to City Center)" required
              className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]" />
            <button type="submit" className="shrink-0 rounded-full bg-[#0A3035] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#124850]">
              Add Route
            </button>
          </form>
          {routeOptions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {routeOptions.map((r) => (
                <span key={r.id} className="rounded-full bg-[#0A3035]/8 px-3 py-1 text-xs font-semibold text-[#0A3035]">{r.name}</span>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard title="Rate Transport Service">
        {routeOptions.length === 0 ? (
          <EmptyStateCard message='No routes available. An admin needs to add routes using the "Admin: Manage Routes" button.' />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="transport-route" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Select Route</label>
              <select id="transport-route" value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]">
                <option value="">— Select a route —</option>
                {routeOptions.map((route) => <option key={route.id} value={route.name}>{route.name}</option>)}
              </select>
            </div>
            {CATEGORIES.map((category) => (
              <StarRow key={category} label={category} value={ratings[category]} onChange={(v) => updateRating(category, v)} />
            ))}
            <div className="pt-2">
              <label htmlFor="transport-comment" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Additional Comments (optional)</label>
              <textarea id="transport-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Any specific feedback about the transport service..." rows={3}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]" />
            </div>
            <div>
              <button type="submit" className="rounded-full bg-[#0A3035] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#124850]">Submit Feedback</button>
            </div>
          </form>
        )}
      </SectionCard>

      <SectionCard title="Previous Submissions">
        {entries.length === 0 ? (
          <EmptyStateCard message="No feedback submitted yet." />
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">{entry.id}</span>
                      <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-800">Avg: {averageRating(entry.ratings)} ★</span>
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-[#0A3035]">{entry.route}</h3>
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
