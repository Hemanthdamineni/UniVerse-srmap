/**
 * SavedSearchBar.tsx — save the current opportunity filters, re-apply a saved
 * search with one click, and toggle an "alert me" bell that fires an in-app
 * notification when new listings match (B7 / T4.2.6).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Bookmark, Check, X } from "lucide-react";
import {
  createSavedSearch,
  deleteSavedSearch,
  listSavedSearches,
  updateSavedSearch,
  type SavedSearch,
  type SavedSearchFilters,
} from "../../lib/career/careerApi";
import { careerKeys } from "../../lib/career/queryKeys";

function describe(filters: SavedSearchFilters): string {
  const parts: string[] = [];
  if (filters.query) parts.push(`"${filters.query}"`);
  if (filters.type) parts.push(filters.type);
  if (filters.location) parts.push(filters.location);
  return parts.join(" · ") || "all opportunities";
}

export function SavedSearchBar({
  currentFilters,
  onApply,
}: {
  currentFilters: SavedSearchFilters;
  onApply: (filters: SavedSearchFilters) => void;
}) {
  const queryClient = useQueryClient();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [alertOnSave, setAlertOnSave] = useState(true);

  const { data } = useQuery({
    queryKey: careerKeys.savedSearches,
    queryFn: listSavedSearches,
    staleTime: 60_000,
  });
  const searches = data?.items ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: careerKeys.savedSearches });

  const create = useMutation({
    mutationFn: () =>
      createSavedSearch({ name: name.trim(), filters: currentFilters, alertsEnabled: alertOnSave }),
    onSuccess: () => {
      setNaming(false);
      setName("");
      void invalidate();
    },
  });
  const toggleAlert = useMutation({
    mutationFn: (s: SavedSearch) => updateSavedSearch(s.id, { alertsEnabled: !s.alertsEnabled }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteSavedSearch(id),
    onSuccess: invalidate,
  });

  const hasAnyFilter = Boolean(currentFilters.query || currentFilters.type || currentFilters.location);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {searches.map((s) => (
        <span
          key={s.id}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--comp-border)] bg-[var(--comp-surface)] py-1 pl-3 pr-1 text-xs"
        >
          <button
            type="button"
            onClick={() => onApply(s.filters)}
            className="font-semibold text-[var(--comp-text-primary)] hover:text-[var(--comp-accent)]"
            title={`Apply: ${describe(s.filters)}`}
          >
            {s.name}
          </button>
          <button
            type="button"
            onClick={() => toggleAlert.mutate(s)}
            className={s.alertsEnabled ? "text-[var(--comp-accent)]" : "text-[var(--comp-text-muted)]"}
            aria-label={s.alertsEnabled ? `Turn off alerts for ${s.name}` : `Alert me about ${s.name}`}
            aria-pressed={s.alertsEnabled}
          >
            {s.alertsEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => remove.mutate(s.id)}
            className="text-[var(--comp-text-muted)] hover:text-[var(--error)]"
            aria-label={`Delete saved search ${s.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}

      {naming ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--comp-accent)] bg-[var(--comp-surface)] py-1 pl-3 pr-1 text-xs">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) create.mutate();
              if (e.key === "Escape") setNaming(false);
            }}
            placeholder="Name this search"
            aria-label="Saved search name"
            className="w-36 bg-transparent text-xs outline-none"
          />
          <label className="flex items-center gap-1 text-[var(--comp-text-secondary)]">
            <input
              type="checkbox"
              checked={alertOnSave}
              onChange={(e) => setAlertOnSave(e.target.checked)}
              aria-label="Alert me about new matches"
            />
            Alert
          </label>
          <button
            type="button"
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
            className="text-[var(--comp-accent)] disabled:opacity-40"
            aria-label="Save search"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setNaming(false)}
            className="text-[var(--comp-text-muted)]"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={!hasAnyFilter}
          onClick={() => setNaming(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--comp-border)] px-3 py-1 text-xs font-semibold text-[var(--comp-text-secondary)] hover:border-[var(--comp-accent)] hover:text-[var(--comp-accent)] disabled:opacity-40"
          title={hasAnyFilter ? "Save the current filters" : "Set a filter to save a search"}
        >
          <Bookmark className="h-3.5 w-3.5" />
          Save search
        </button>
      )}
    </div>
  );
}
