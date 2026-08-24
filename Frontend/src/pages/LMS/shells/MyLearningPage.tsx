import { Link, useSearchParams } from "react-router-dom";
import { SegmentedControl, SkeletonCard } from "../../../components/ui";
import CollectionsPage from "../CollectionsPage";
import ProgressPage from "../me/ProgressPage";
import SavedResourcesPage from "../me/SavedResourcesPage";
import { getMyActivity, listRoadmaps, useAsyncPage, SectionCard } from "../_shared/LmsPageShared";
import type { LmsRoadmap } from "../_shared/LmsPageShared";

type MyLearningTab = "saved" | "collections" | "progress" | "history";

const TAB_OPTIONS = [
  { label: "Saved", value: "saved" as const },
  { label: "Collections", value: "collections" as const },
  { label: "Progress", value: "progress" as const },
  { label: "History", value: "history" as const },
] as const;

const TAB_VALUES = new Set<string>(TAB_OPTIONS.map((option) => option.value));

function activeRoadmaps(items: LmsRoadmap[]): LmsRoadmap[] {
  return (items || []).filter((roadmap) => (roadmap.userProgress?.completedNodes?.length || 0) > 0);
}

function JourneysSection() {
  const { data, loading } = useAsyncPage(() => listRoadmaps(), []);
  if (loading && !data) return null;
  const journeys = activeRoadmaps(data || []);
  if (!journeys.length) return null;

  return (
    <SectionCard title="Your roadmaps">
      <div className="divide-y divide-[var(--comp-border)]">
        {journeys.map((roadmap) => {
          const done = roadmap.userProgress?.completedNodes.length || 0;
          const total = roadmap.nodes?.length || done;
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <Link
              key={roadmap.id}
              to={`/learn/roadmaps/${roadmap.id}`}
              className="flex items-center justify-between gap-3 py-3 no-underline"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-medium text-[var(--comp-text-primary)]">{roadmap.title}</p>
                <div className="h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-[var(--comp-surface-hover)]">
                  <div className="h-full rounded-full bg-[var(--comp-accent)]" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <span className="shrink-0 text-xs font-medium text-[var(--comp-text-secondary)]">
                {done}/{total || "?"} · {pct}%
              </span>
            </Link>
          );
        })}
      </div>
    </SectionCard>
  );
}

function HistorySection() {
  const { data, loading, error } = useAsyncPage(() => getMyActivity(), []);

  if (loading && !data) return <SkeletonCard />;
  if (error) return <p className="body-text text-sm text-[var(--error)]">{error}</p>;

  return (
    <SectionCard title="Recent activity">
      {(data || []).length === 0 ? (
        <p className="body-text text-sm">Studying, quiz attempts, and revision reviews will appear here.</p>
      ) : (
        <div className="divide-y divide-[var(--comp-border)]">
          {(data || []).map((entry, index) => (
            <div key={String(entry.id ?? index)} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-medium text-[var(--comp-text-primary)]">
                  {String(entry.resourceTitle || entry.title || "Learning activity")}
                </p>
                <p className="text-xs capitalize text-[var(--comp-text-secondary)]">
                  {String(entry.action || entry.type || "activity").replace(/_/g, " ")}
                </p>
              </div>
              <span className="shrink-0 text-xs text-[var(--comp-text-muted)]">
                {entry.createdAt ? new Date(String(entry.createdAt)).toLocaleDateString() : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export default function MyLearningPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const tab: MyLearningTab = TAB_VALUES.has(String(requested)) ? (requested as MyLearningTab) : "saved";

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        options={TAB_OPTIONS}
        value={tab}
        onChange={(value) =>
          setSearchParams((prev) => ({ ...Object.fromEntries(prev), tab: value }), { replace: true })
        }
      />
      {tab === "saved" ? <SavedResourcesPage /> : null}
      {tab === "collections" ? <CollectionsPage /> : null}
      {tab === "progress" ? (
        <>
          <JourneysSection />
          <ProgressPage />
        </>
      ) : null}
      {tab === "history" ? <HistorySection /> : null}
    </div>
  );
}
