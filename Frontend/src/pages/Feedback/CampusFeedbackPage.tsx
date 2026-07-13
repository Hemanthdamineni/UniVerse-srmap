import { useEffect, useMemo, useState } from "react";
import { ErpPageShell, SectionCard, EmptyStateCard } from "../../components/erp/ErpPrimitives";
import { StarRating } from "../../components/ui/Progress";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import {
  createCampusFeedbackOption,
  getCampusFeedbackGovernance,
  getCampusFeedbackOptions,
  getMyCampusFeedback,
  importLegacyCampusFeedback,
  submitCampusFeedback,
  type CampusFeedbackEntry,
  type CampusFeedbackGovernanceResponse,
  type CampusFeedbackOption,
  type CampusFeedbackType,
} from "../../lib/campus/campusApi";

type CampusFeedbackPageProps<Category extends string> = {
  title: string;
  type: CampusFeedbackType;
  categories: readonly Category[];
  fixedTarget?: CampusFeedbackOption;
  targetLabel: string;
  targetEmptyMessage?: string;
  optionManagementLabel?: string;
  optionPlaceholder?: string;
};

function emptyRatings<Category extends string>(categories: readonly Category[]) {
  return Object.fromEntries(categories.map((category) => [category, 0])) as Record<Category, number>;
}

function averageRating(ratings: Record<string, number>) {
  const values = Object.values(ratings).filter((value) => value > 0);
  if (values.length === 0) return "-";
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function readLegacyEntries(type: CampusFeedbackType, fallbackTarget?: CampusFeedbackOption) {
  if (typeof window === "undefined" || !window.localStorage) return [];

  try {
    if (type === "events") {
      const entries = JSON.parse(window.localStorage.getItem("events-feedback") || "[]");
      return Array.isArray(entries)
        ? entries
            .filter((entry) => entry?.eventName && Number(entry?.rating) > 0)
            .map((entry) => ({
              targetLabel: String(entry.eventName),
              ratings: { Experience: Number(entry.rating) },
              comment: String(entry.comment || ""),
              submittedAt: String(entry.submittedAt || ""),
              displayMode: "anonymous" as const,
            }))
        : [];
    }

    if (type === "transport") {
      const entries = JSON.parse(window.localStorage.getItem("transport-feedback") || "[]");
      return Array.isArray(entries)
        ? entries
            .filter((entry) => entry?.route && entry?.ratings)
            .map((entry) => ({
              targetLabel: String(entry.route),
              ratings: entry.ratings as Record<string, number>,
              comment: String(entry.comment || ""),
              submittedAt: String(entry.submittedAt || ""),
              displayMode: "anonymous" as const,
            }))
        : [];
    }

    const entries = JSON.parse(window.localStorage.getItem("hostel-mess-feedback") || "[]");
    return Array.isArray(entries)
      ? entries
          .filter((entry) => entry?.ratings)
          .map((entry) => ({
            targetId: fallbackTarget?.id,
            targetLabel: fallbackTarget?.label || "Hostel and mess services",
            ratings: entry.ratings as Record<string, number>,
            comment: String(entry.comment || ""),
            submittedAt: String(entry.submittedAt || ""),
            displayMode: "anonymous" as const,
          }))
      : [];
  } catch {
    return [];
  }
}

function markLegacyMigrated(type: CampusFeedbackType) {
  if (typeof window === "undefined" || !window.localStorage) return;
  const keyByType: Record<CampusFeedbackType, string> = {
    events: "events-feedback",
    hostel_mess: "hostel-mess-feedback",
    transport: "transport-feedback",
  };
  window.localStorage.setItem(`campus-feedback-migrated-${type}`, "1");
  window.localStorage.removeItem(keyByType[type]);
}

function wasLegacyMigrated(type: CampusFeedbackType) {
  if (typeof window === "undefined" || !window.localStorage) return true;
  return window.localStorage.getItem(`campus-feedback-migrated-${type}`) === "1";
}

function StatusPill({ status }: { status: CampusFeedbackEntry["status"] }) {
  const className =
    status === "approved"
      ? "border-[color-mix(in_srgb,var(--success)_28%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]"
      : status === "rejected"
        ? "border-[color-mix(in_srgb,var(--error)_28%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] text-[var(--error)]"
        : "border-[color-mix(in_srgb,var(--warning)_32%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]";

  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${className}`}>
      {status}
    </span>
  );
}

function GovernanceBanner({ governance }: { governance: CampusFeedbackGovernanceResponse | null }) {
  return (
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_22%,var(--border))] bg-[var(--comp-surface)] px-3 py-2 text-sm text-[var(--comp-text-secondary)]">
      <div className="font-semibold text-[var(--comp-text-primary)]">Unofficial campus feedback</div>
      <p className="mt-1 leading-6">
        Managed through {governance?.unofficial.routeNamespace || "/api/campus-feedback"} with
        moderation. Official course feedback remains in{" "}
        {governance?.official.routeNamespace || "/api/feedback/end-semester"} and cannot be edited
        here.
      </p>
    </div>
  );
}

function StarRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] py-3 last:border-b-0">
      <span className="text-sm font-medium text-[var(--comp-text-primary)]">{label}</span>
      <StarRating value={value} onChange={onChange} size="md" />
    </div>
  );
}

export default function CampusFeedbackPage<Category extends string>({
  title,
  type,
  categories,
  fixedTarget,
  targetLabel,
  targetEmptyMessage = "No feedback targets are available yet.",
  optionManagementLabel = "Add feedback target",
  optionPlaceholder = "Target name",
}: CampusFeedbackPageProps<Category>) {
  const admin = useAdminAccess();
  const [governance, setGovernance] = useState<CampusFeedbackGovernanceResponse | null>(null);
  const [options, setOptions] = useState<CampusFeedbackOption[]>(fixedTarget ? [fixedTarget] : []);
  const [selectedTargetId, setSelectedTargetId] = useState(fixedTarget?.id || "");
  const [ratings, setRatings] = useState<Record<Category, number>>(() => emptyRatings(categories));
  const [comment, setComment] = useState("");
  const [history, setHistory] = useState<CampusFeedbackEntry[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState("");

  const selectedOption = useMemo(
    () => options.find((option) => option.id === selectedTargetId),
    [options, selectedTargetId]
  );

  async function loadFeedback() {
    setLoading(true);
    setError("");
    try {
      const [governanceData, optionData, historyData] = await Promise.all([
        getCampusFeedbackGovernance(),
        fixedTarget ? Promise.resolve([fixedTarget]) : getCampusFeedbackOptions(type),
        getMyCampusFeedback(type),
      ]);
      setGovernance(governanceData);
      setOptions(optionData);
      let nextHistory = historyData.items;
      if (!wasLegacyMigrated(type)) {
        const legacyEntries = readLegacyEntries(type, fixedTarget || optionData[0]);
        if (legacyEntries.length > 0) {
          const migration = await importLegacyCampusFeedback(type, legacyEntries);
          nextHistory = [...migration.imported, ...nextHistory].filter(
            (entry, index, all) => all.findIndex((candidate) => candidate.id === entry.id) === index
          );
        }
        markLegacyMigrated(type);
      }
      setHistory(nextHistory);
      setSelectedTargetId((current) => current || optionData[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load feedback.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFeedback();
    // type and fixedTarget are stable per route component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateRating(category: Category, value: number) {
    setRatings((prev) => ({ ...prev, [category]: value }));
  }

  async function handleAddOption(event: React.FormEvent) {
    event.preventDefault();
    const label = newOptionLabel.trim();
    if (!label) return;
    setError("");
    try {
      const option = await createCampusFeedbackOption(type, label, admin.adminHeaders);
      setOptions((current) => {
        const withoutDuplicate = current.filter((item) => item.id !== option.id && item.label !== option.label);
        return [...withoutDuplicate, option].sort((left, right) => left.label.localeCompare(right.label));
      });
      setSelectedTargetId(option.id);
      setNewOptionLabel("");
      setMessage(`${option.label} is available for campus feedback.`);
      window.setTimeout(() => setMessage(""), 3000);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Unable to add target.");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const hasAnyRating = Object.values(ratings).some((value) => Number(value) > 0);
    if (!hasAnyRating) {
      setError("Rate at least one category before submitting.");
      return;
    }
    if (!selectedOption) {
      setError(`Select ${targetLabel.toLowerCase()} before submitting.`);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const entry = await submitCampusFeedback(type, {
        targetId: selectedOption.id,
        targetLabel: selectedOption.label,
        ratings,
        comment,
        displayMode: "anonymous",
      });
      setHistory((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
      setRatings(emptyRatings(categories));
      setComment("");
      setMessage("Feedback submitted for moderation.");
      window.setTimeout(() => setMessage(""), 4000);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ErpPageShell
      title={title}
      source="Internal API"
      isLoading={loading}
      loadingMessage={`Loading ${title.toLowerCase()}...`}
      onRefresh={loadFeedback}
    >
      <GovernanceBanner governance={governance} />

      {message ? (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] px-3 py-2 text-sm font-medium text-[var(--success)]">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-3 py-2 text-sm font-medium text-[var(--error)]">
          {error}
        </div>
      ) : null}

      {!fixedTarget && admin.unlocked ? (
        <SectionCard title={optionManagementLabel}>
          <form onSubmit={handleAddOption} className="flex flex-col gap-2 sm:flex-row">
            <input
              value={newOptionLabel}
              onChange={(event) => setNewOptionLabel(event.target.value)}
              placeholder={optionPlaceholder}
              className="min-h-11 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--comp-accent)]"
            />
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!newOptionLabel.trim()}
            >
              Add
            </button>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard title={`Submit ${title}`}>
        {options.length === 0 ? (
          <EmptyStateCard message={targetEmptyMessage} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {!fixedTarget ? (
              <div>
                <label
                  htmlFor={`${type}-target`}
                  className="mb-2 block text-sm font-medium text-[var(--text-primary)]"
                >
                  {targetLabel}
                </label>
                <select
                  id={`${type}-target`}
                  value={selectedTargetId}
                  onChange={(event) => setSelectedTargetId(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--comp-accent)]"
                >
                  <option value="">Select {targetLabel.toLowerCase()}</option>
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--background)] px-3">
              {categories.map((category) => (
                <StarRow
                  key={category}
                  label={category}
                  value={ratings[category]}
                  onChange={(value) => updateRating(category, value)}
                />
              ))}
            </div>

            <div>
              <label htmlFor={`${type}-comment`} className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                Comments
              </label>
              <textarea
                id={`${type}-comment`}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Share specific feedback for moderators to review."
                rows={3}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 rounded-lg bg-[var(--comp-accent)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </form>
        )}
      </SectionCard>

      <SectionCard title="Submission History">
        {history.length === 0 ? (
          <EmptyStateCard message="No unofficial feedback submitted yet." />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {history.map((entry) => (
              <article key={entry.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">
                        {entry.targetLabel}
                      </h3>
                      <StatusPill status={entry.status} />
                      <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
                        Avg {averageRating(entry.ratings)}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-[var(--text-secondary)] sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(entry.ratings).map(([category, value]) => (
                        <div key={category} className="flex items-center gap-1">
                          <span>{category}:</span>
                          <StarRating value={value} size="sm" />
                        </div>
                      ))}
                    </div>
                    {entry.comment ? (
                      <p className="mt-2 max-w-[72ch] text-sm leading-6 text-[var(--text-secondary)]">
                        {entry.comment}
                      </p>
                    ) : null}
                    {entry.moderationReason ? (
                      <p className="mt-2 text-xs font-medium text-[var(--text-secondary)]">
                        Moderation note: {entry.moderationReason}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right text-xs text-[var(--text-secondary)]">{formatDate(entry.createdAt)}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </ErpPageShell>
  );
}
